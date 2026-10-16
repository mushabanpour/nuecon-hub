# Northeastern Economics PhD Student Hub

A static website for Northeastern Economics PhD students, live at
https://mushabanpour.github.io/nuecon-hub/. GitHub Pages publishes the `main` branch as-is
(no build step), so a change goes live about a minute after it is merged. The Google Sites wiki
(https://sites.google.com/site/nueconphdstudentwiki) only links here. Google Sites has no API, so
never try to edit or automate it.

The people asking you for changes are PhD students who maintain the hub, usually not programmers.

## How to work

1. Work on a branch and open a pull request. Never push to `main`: a student maintainer reviews
   and merges every change.
2. Run `python3 tools/check.py` and fix everything it reports before opening the PR. It validates
   the data files and links, then loads the page in headless Chrome (when one is installed) to
   confirm the JavaScript rendered. GitHub runs the same check on every PR.
3. For anything visual, preview with `python3 -m http.server 8000` and open http://localhost:8000.
   Opening `index.html` directly from disk will not load the data. If you can take screenshots,
   check a desktop width and a phone width (under 600px).
4. Write the PR description for a non-programmer: what changed and where on the site, the source
   for every new fact, and anything you were unsure about.

## Where things live

| To change… | Edit |
|---|---|
| Alumni directory (Careers tab) | `data/alumni.json` |
| Link lists on each tab (Plan, Coursework, Research, Teaching, Careers, Community) | `data/resources.json` → `resources` |
| Archive links (Community tab and footer) | `data/resources.json` → `archive` |
| Search-only entries that are not cards | `data/resources.json` → `searchExtras` |
| Page text, headings, dataset cards, software table, computing section, footer | `index.html` |
| LaTeX templates and their previews | `latex/<name>/` and `data/latex.json` |
| Colours, fonts, layout | `assets/style.css` |
| Behaviour: routing, search, alumni filters | `assets/hub.js` |

- `assets/hub.js` only renders content. Never hard-code content in it.
- In `resources`, `route` picks the list (the `data-groups` containers in `index.html`) and
  `group` is the heading within it. A new group needs a one-line entry in `groupNotes`.
- Write `{alumni_count}` in a description instead of a hard-coded number of alumni.
- Site search is built automatically from `resources`, `archive`, `searchExtras`, the alumni, and
  the dataset cards (`#rr-data .rr-card`) and software rows (`#rr-software tbody tr`) in
  `index.html`. A new card or row is searchable with no extra step, as long as it keeps the same
  markup (`h4`, `.rr-what`, `.rr-tag`, first link).
- `index.html` and `assets/hub.js` have very long lines. Make exact, minimal edits and never
  reformat or re-indent whole files, so reviewers can read the diff.

## Content rules

- Facts must be checkable. Link to the official university page where one exists, and date claims
  that go stale ("checked 9 October 2026"), as the existing text does.
- Alumni come only from public professional sources: a public LinkedIn profile, a personal or
  employer website. Never add personal emails, phone numbers, addresses, grades, visa status or
  anything a person has not made public. The repo and the site are public.
- Alumni fields:
  - `id`: a unique positive number. Never renumber or reuse ids, because `#alumni-<id>` links
    point at them. Give new people the next unused number.
  - `name` is the name as listed in the wiki. `display_name` is how the person presents themselves
    now.
  - `cohort`: the wiki cohort, written like `2024–2025` with an en dash.
  - `status`: `verified` or `unconfirmed`.
  - `verification_scope`: `role_and_employer`, `employer` or `unconfirmed`.
  - `title_precision`: `formal_title`, `profile_description`, `unknown` or `unavailable`.
  - `source_url`, `source_title`, `source_label`: the evidence you used.
  - `checked_date`: the day you checked, as `YYYY-MM-DD`.
  - `notes`: free text.
  - If you cannot confirm a position, mark it `unconfirmed`. Never guess.
- Keep the voice: short, plain, friendly. Use sentence-case headings and typographic punctuation
  (’ “ ” – —), like the existing copy.

## Design rules

- Colours and fonts are CSS variables in `:root` at the top of `assets/style.css` (`--paper`,
  `--ink`, `--muted`, `--line`, `--red`, `--red-dark`, `--rose`, `--serif`, `--sans`). Use them,
  and don't introduce new colours or fonts unless asked.
- Reuse the existing components before inventing new ones:
  - `.rr-card` inside `.rr-grid`: a resource with steps and links.
  - `.rr-table`: comparisons.
  - `.quick-link`: the "links you come back to".
  - `.journey-link` and `.path`: the Home navigation cards.
- Layout breakpoints are at 1100, 850, 700, 600 and 360px. New layouts must work at phone width.
- External links need `target="_blank" rel="noopener noreferrer"`, and the check enforces this.
  Internal links use `#<tab>` or `#<section-id>`.
- No external scripts, web fonts, frameworks, analytics or trackers. The site is plain static files.
- Keep accessibility intact: aria labels, headings in order, alt text, visible focus outlines.
- Tabs are `<section class="view" id="view-<name>">`, switched by `route()` in `assets/hub.js`.
  A new top-level tab needs four things:
  - a nav link in `index.html`
  - its `view-` section
  - an entry in `knownRoutes` in `hub.js`
  - an entry in `ROUTES` in `tools/check.py`

## LaTeX templates

The preview images are the real compiled output of each `.tex` file, and the check fails if a
`.tex` file changes without new previews. After editing a template:

1. Compile it with `pdflatex` (run it twice).
2. Render every page to JPEG at the existing width (504px for slides, 510px for the paper), for
   example `pdftoppm -jpeg -scale-to-x 504 -scale-to-y -1 file.pdf page`.
3. Name the images `page-01.jpg`, `page-02.jpg`, … in `latex/<name>/`, and delete leftover pages
   and build files.
4. Run `python3 tools/check.py --update-latex` to record the new page list and source hash.
5. Update the "compiled on" date in the note under the LaTeX section of `index.html`.

If `pdflatex` or a PDF-to-image tool isn't available, don't change the template. Say so instead.
