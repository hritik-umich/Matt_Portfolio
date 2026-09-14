# Matthew Patton Portfolio

Portfolio site for Matthew T. Patton, Ph.D. — plain HTML/CSS/JS served by a
small Express server. No build step, no framework, no third-party map service.

## Run locally

```bash
npm install
npm start
```

Then open http://localhost:3000

`PORT` is the only environment variable (defaults to 3000). Copy
`.env.example` to `.env` to override it locally.

## Deploying on Railway

The repo runs as-is:

- Railway detects Node from `package.json` and runs `npm start`
- `server.js` reads `process.env.PORT` and binds `0.0.0.0`, which is what
  Railway routes to — no extra configuration or Procfile needed
- No build command is required; everything is served statically

## The map

The "Field of Work" section is a self-hosted SVG heat map of the US. States
are shaded by project volume; hovering shows the projects there, and clicking
pins the tooltip open so a long list can be scrolled.

`img/us-states.svg` is a public-domain (CC0) state-outline map from Wikimedia
Commons, injected inline so each state path can be styled and scripted. The
Alaska/Hawaii insets and the DC marker circle are removed at load, since no
project data lives there.

## Data

`data/projects.json` drives the map, the project cards and the hero stat
tiles. It is **generated** from `data/AE Project Management.xlsx` and should
not be hand-edited. It contains two arrays:

| Key | Source sheet | Used for |
| --- | --- | --- |
| `projects[]` | Map Data | Selected Work cards, international list |
| `mapProjects[]` | Raw Data | State heat map + tooltips |
| `stats{}` | Project Statistics | Hero stat tiles |

`mapProjects[]` groups Raw Data by client + project detail, with `count`
recording how many times a recurring project ran — so per-state totals
reconcile with the headline engagement count.

### The workbook is not in this repo

`data/AE Project Management.xlsx` is gitignored on purpose: it contains
salary figures, per-client project pricing and personal career notes. Only
the generated, public-safe `data/projects.json` is committed. Keep the
workbook locally to regenerate the JSON.

## File map

```
index.html           Page structure and content
css/style.css        All styling + design tokens (:root)
js/main.js           Nav toggle, active-link highlighting, footer year
js/map.js            SVG heat map, tooltips, project cards, stat tiles
data/projects.json   Generated project + stats data
img/us-states.svg    CC0 US state outlines (map backdrop)
img/favicon.svg      Site icon
Image/               Portrait used in the hero
resume/              Résumé PDF linked by the Download button
server.js            Express static server + SPA fallback
robots.txt / sitemap.xml
```
