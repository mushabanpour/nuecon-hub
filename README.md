# Northeastern Economics PhD Student Hub

A community-maintained guide for Northeastern Economics PhD students.

**Live site:** https://mushabanpour.github.io/nuecon-hub/

## Asking for a change

You don't need to know how to code.

- **With Claude Code (recommended).** Go to [claude.ai/code](https://claude.ai/code), connect your
  GitHub account and pick this repository. The first time, Claude may ask for access to it. Then
  describe what you want, for example "add the 2026 job-market placements" or "add a card for the
  new IPUMS data". Claude makes the change, runs the checks and opens a pull request for a
  maintainer to approve.
- **Without Claude.** [Open an issue](../../issues/new) describing the change, and a maintainer
  will pick it up.
- **A typo or a one-line fix.** Open the file on GitHub, click the pencil icon, edit, then choose
  "Propose changes".

## Approving a change (maintainers)

1. Open the pull request.
2. Make sure the **check** shows a green ✓. It confirms the data is valid and that the page loads
   without errors.
3. Read the description and the **Files changed** tab.
4. Click **Merge**. The site updates within about a minute.

To undo a change, open the merged pull request and click **Revert**.

## Previewing on your own computer

```sh
git clone https://github.com/mushabanpour/nuecon-hub.git
cd nuecon-hub
python3 -m http.server 8000      # then open http://localhost:8000
python3 tools/check.py           # the same check GitHub runs
```

Double-clicking `index.html` won't work, because the page loads its content from `data/`.

## Handing the site over

- Each year, add the incoming maintainers under **Settings → Collaborators**. Keep at least two
  people who can merge.
- When the PhD students have a GitHub organization, move the repository there
  (**Settings → Transfer**). The address then becomes `<organization>.github.io/nuecon-hub`, so
  update the link on the Google Sites wiki.

## What's inside

Plain static files with no build step. [`CLAUDE.md`](CLAUDE.md) has the full conventions.

| Path | What it is |
|---|---|
| `index.html` | Page structure and text |
| `assets/style.css` | Design |
| `assets/hub.js` | Behaviour: tabs, search, alumni directory |
| `data/alumni.json` | Alumni current positions |
| `data/resources.json` | Link lists, archive and extra search entries |
| `data/latex.json`, `latex/` | LaTeX templates and their compiled previews |
| `tools/check.py` | Validation run on every pull request |
