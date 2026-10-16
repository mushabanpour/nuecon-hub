#!/usr/bin/env python3
"""Check the hub before a change is merged.

    python3 tools/check.py                 run every check
    python3 tools/check.py --no-browser    skip the headless-Chrome page test
    python3 tools/check.py --update-latex  re-record LaTeX page images and source
                                           hashes after regenerating previews

Prints every problem it finds and exits non-zero if there are any.
Standard library only, so it runs anywhere Python 3.9+ does.
"""
import argparse
import datetime
import functools
import hashlib
import html.parser
import http.server
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROUTES = {'home', 'research', 'teaching', 'careers', 'community'}
# Hashes hub.js handles itself (see route() in assets/hub.js).
SPECIAL_HASHES = {'placements', 'archive', 'plan', 'program', 'coursework', 'resources', 'main'}
ALUMNI_FIELDS = ['id', 'name', 'display_name', 'cohort', 'status', 'current_role', 'current_employer',
                 'verification_scope', 'title_precision', 'source_url', 'source_title', 'source_label',
                 'checked_date', 'notes']
SCOPES = {'role_and_employer', 'employer', 'unconfirmed'}
PRECISIONS = {'formal_title', 'profile_description', 'unknown', 'unavailable'}

problems = []


def problem(where, msg):
    problems.append(f'{where}: {msg}')


def path(*parts):
    return os.path.join(ROOT, *parts)


def load_json(rel):
    try:
        with open(path(rel), encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError) as err:
        problem(rel, f'cannot be read as JSON ({err})')
        return None


class PageParser(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids, self.links, self.groups, self.tabs, self.urls = [], [], set(), set(), []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        line = self.getpos()[0]
        if 'id' in a:
            self.ids.append((a['id'], line))
        if 'data-groups' in a:
            self.groups.add(a['data-groups'])
        if 'data-tpl' in a:
            self.tabs.add(a['data-tpl'])
        if tag == 'a' and 'href' in a:
            self.links.append((a, line))
        for key in ('href', 'src', 'action'):
            if a.get(key):
                self.urls.append((a[key], line))


def check_page():
    rel = 'index.html'
    parser = PageParser()
    with open(path(rel), encoding='utf-8') as f:
        parser.feed(f.read())
    seen = {}
    for id_, line in parser.ids:
        if id_ in seen:
            problem(f'{rel}:{line}', f'id "{id_}" is already used on line {seen[id_]}')
        seen.setdefault(id_, line)
    for a, line in parser.links:
        href = a['href']
        if href.startswith(('http://', 'https://')):
            if a.get('target') != '_blank' or 'noopener' not in a.get('rel', ''):
                problem(f'{rel}:{line}', f'external link {href} needs target="_blank" rel="noopener noreferrer"')
    for url, line in parser.urls:
        if url.startswith('http://'):
            problem(f'{rel}:{line}', f'{url} must use https://')
    return parser, set(seen)


def check_hash(where, url, ids, alumni_ids):
    name = url[1:]
    if name in ROUTES or name in SPECIAL_HASHES or name in ids:
        return
    m = re.fullmatch(r'alumni-(\d+)', name)
    if m and int(m.group(1)) in alumni_ids:
        return
    problem(where, f'link {url} does not point to a page section')


def check_url(where, url, ids, alumni_ids):
    if not isinstance(url, str) or not url:
        problem(where, 'url is missing')
    elif url.startswith('#'):
        check_hash(where, url, ids, alumni_ids)
    elif not url.startswith('https://'):
        problem(where, f'url {url} must start with https:// or #')


def check_alumni(alumni):
    rel = 'data/alumni.json'
    if not isinstance(alumni, list):
        problem(rel, 'must be a list of people')
        return set()
    ids = set()
    today = datetime.date.today()
    for i, p in enumerate(alumni):
        where = f'{rel} entry {i + 1} ({p.get("name", "?")})' if isinstance(p, dict) else f'{rel} entry {i + 1}'
        if not isinstance(p, dict):
            problem(where, 'must be an object')
            continue
        missing = [k for k in ALUMNI_FIELDS if k not in p]
        extra = [k for k in p if k not in ALUMNI_FIELDS]
        if missing:
            problem(where, f'missing fields: {", ".join(missing)}')
        if extra:
            problem(where, f'unknown fields: {", ".join(extra)}')
        if missing:
            continue
        if not isinstance(p['id'], int) or p['id'] < 1:
            problem(where, 'id must be a positive whole number')
        elif p['id'] in ids:
            problem(where, f'id {p["id"]} is used twice')
        ids.add(p['id'])
        if not p['name'].strip() or not p['display_name'].strip():
            problem(where, 'name and display_name must not be empty')
        m = re.fullmatch(r'(\d{4})–(\d{4})', p['cohort'])
        if not m or int(m.group(2)) != int(m.group(1)) + 1:
            problem(where, f'cohort "{p["cohort"]}" must look like 2024–2025 (with an en dash)')
        if p['status'] not in ('verified', 'unconfirmed'):
            problem(where, 'status must be "verified" or "unconfirmed"')
        if p['verification_scope'] not in SCOPES:
            problem(where, f'verification_scope must be one of {sorted(SCOPES)}')
        if (p['status'] == 'unconfirmed') != (p['verification_scope'] == 'unconfirmed'):
            problem(where, 'status and verification_scope must both be "unconfirmed", or neither')
        if p['title_precision'] not in PRECISIONS:
            problem(where, f'title_precision must be one of {sorted(PRECISIONS)}')
        if p['status'] == 'verified':
            if not p['source_url'].startswith('https://'):
                problem(where, 'a verified position needs a public https:// source_url')
            if not p['current_employer'].strip():
                problem(where, 'a verified position needs current_employer')
            if p['verification_scope'] == 'role_and_employer' and not p['current_role'].strip():
                problem(where, 'role_and_employer needs current_role')
        elif p['source_url'] and not p['source_url'].startswith('https://'):
            problem(where, 'source_url must start with https://')
        try:
            checked = datetime.date.fromisoformat(p['checked_date'])
            if checked > today:
                problem(where, f'checked_date {checked} is in the future')
        except (TypeError, ValueError):
            problem(where, f'checked_date "{p["checked_date"]}" must be YYYY-MM-DD')
    return ids


def check_resources(content, groups, ids, alumni_ids):
    rel = 'data/resources.json'
    if not isinstance(content, dict):
        problem(rel, 'must be an object with resources, archive, groupNotes and searchExtras')
        return
    notes = content.get('groupNotes', {})
    shapes = {
        'resources': ['category', 'group', 'title', 'desc', 'url', 'keywords', 'route'],
        'archive': ['category', 'title', 'desc', 'url', 'keywords'],
        'searchExtras': ['category', 'title', 'desc', 'url', 'keywords'],
    }
    for section, fields in shapes.items():
        entries = content.get(section)
        if not isinstance(entries, list):
            problem(rel, f'"{section}" must be a list')
            continue
        for i, r in enumerate(entries):
            where = f'{rel} {section} entry {i + 1} ({r.get("title", "?") if isinstance(r, dict) else "?"})'
            if not isinstance(r, dict):
                problem(where, 'must be an object')
                continue
            missing = [k for k in fields if not isinstance(r.get(k), str) or (k != 'keywords' and not r[k].strip())]
            if missing:
                problem(where, f'missing or empty fields: {", ".join(missing)}')
                continue
            check_url(where, r['url'], ids, alumni_ids)
            if section == 'resources':
                if r['route'] not in groups:
                    problem(where, f'route "{r["route"]}" has no data-groups container in index.html '
                                   f'(use one of {sorted(groups)})')
                if r['group'] not in notes:
                    problem(where, f'group "{r["group"]}" needs a one-line description in groupNotes')
    used = {r.get('group') for r in content.get('resources', []) if isinstance(r, dict)}
    for name in notes:
        if name not in used:
            problem(rel, f'groupNotes has "{name}" but no resource uses that group')


def page_files(key):
    folder = path('latex', key)
    return sorted(f'latex/{key}/{f}' for f in os.listdir(folder) if re.fullmatch(r'page-\d+\.jpg', f))


def check_latex(latex, tabs, update):
    rel = 'data/latex.json'
    if not isinstance(latex, dict):
        problem(rel, 'must be an object keyed by template name')
        return
    if set(latex) != tabs:
        problem(rel, f'templates {sorted(latex)} do not match the tabs in index.html {sorted(tabs)}')
    for key, t in latex.items():
        where = f'{rel} "{key}"'
        src = t.get('source', '')
        if not os.path.isfile(path(src)):
            problem(where, f'source file {src} does not exist')
            continue
        with open(path(src), 'rb') as f:
            digest = hashlib.sha256(f.read()).hexdigest()
        if update:
            t['source_sha256'] = digest
            t['pages'] = page_files(key)
        if t.get('source_sha256') != digest:
            problem(where, f'{src} changed but its preview images were not regenerated. Recompile it, '
                           f'replace latex/{key}/page-*.jpg, then run tools/check.py --update-latex '
                           f'(see CLAUDE.md, "LaTeX templates")')
        if not t.get('pages'):
            problem(where, 'has no preview pages')
        for page in t.get('pages', []):
            if not os.path.isfile(path(page)):
                problem(where, f'preview image {page} does not exist')
    if update:
        with open(path(rel), 'w', encoding='utf-8') as f:
            json.dump(latex, f, ensure_ascii=False, indent=2)
            f.write('\n')
        print(f'Updated {rel}.')


def find_chrome():
    for name in ('google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome'):
        found = shutil.which(name)
        if found:
            return found
    mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    return mac if os.path.exists(mac) else None


def check_in_browser(alumni):
    """Load the real page in headless Chrome and confirm the JavaScript rendered everything."""
    chrome = find_chrome()
    if not chrome:
        print('Note: no Chrome/Chromium found, so the in-browser test was skipped.')
        return
    handler = functools.partial(QuietHandler, directory=ROOT)
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f'http://127.0.0.1:{server.server_address[1]}/'
    try:
        with tempfile.TemporaryDirectory() as profile:
            for route in ('', '#careers', '#research'):
                where = f'browser test ({route or "#home"})'
                cmd = [chrome, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
                       f'--user-data-dir={profile}', '--enable-logging=stderr', '--v=0',
                       '--virtual-time-budget=10000', '--dump-dom', base + route]
                try:
                    run = subprocess.run(cmd, capture_output=True, text=True, timeout=90)
                except subprocess.TimeoutExpired:
                    problem(where, 'Chrome timed out loading the page')
                    continue
                dom = run.stdout
                for line in run.stderr.splitlines():
                    if 'CONSOLE' in line and ('Uncaught' in line or 'Error' in line) and 'favicon' not in line:
                        problem(where, 'JavaScript error: ' + line.split('CONSOLE', 1)[1].strip())
                if 'id="nuecon-hub"' not in dom:
                    problem(where, 'the page did not load')
                    continue
                if 'class="load-error"' in dom:
                    problem(where, 'the page showed "content could not be loaded"')
                m = re.search(r'id="alumni-total">([^<]*)<', dom)
                if not m or m.group(1) != str(len(alumni)):
                    problem(where, f'alumni count shows {m.group(1) if m else "nothing"}, expected {len(alumni)}')
                for group in re.findall(r'data-groups="([^"]+)"></div>', dom):
                    problem(where, f'the "{group}" resource list rendered empty')
                if re.search(r'id="tex-code"[^>]*></pre>', dom):
                    problem(where, 'the LaTeX source pane is empty')
                if route:
                    view = re.search(r'<section class="view" id="view-%s"[^>]*>' % route[1:], dom)
                    if not view or 'hidden' in view.group(0):
                        problem(where, f'the {route} tab did not open')
    finally:
        server.shutdown()


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--no-browser', action='store_true', help='skip the headless-Chrome page test')
    ap.add_argument('--update-latex', action='store_true', help='re-record LaTeX page lists and hashes')
    args = ap.parse_args()

    parser, ids = check_page()
    alumni = load_json('data/alumni.json')
    content = load_json('data/resources.json')
    latex = load_json('data/latex.json')
    alumni_ids = check_alumni(alumni) if alumni is not None else set()
    if content is not None:
        check_resources(content, parser.groups, ids, alumni_ids)
    if latex is not None:
        check_latex(latex, parser.tabs, args.update_latex)
    if not args.no_browser and not problems:
        check_in_browser(alumni)

    if problems:
        print(f'{len(problems)} problem(s) found:\n')
        for p in problems:
            print('  - ' + p)
        sys.exit(1)
    print(f'All checks passed ({len(alumni)} alumni, {len(content["resources"])} resources, '
          f'{len(latex)} LaTeX templates).')


if __name__ == '__main__':
    main()
