// ============================================================
// map.js — loads data/projects.json and renders:
//   1. a self-hosted inline SVG heat map of the US, states shaded
//      by how many projects are there (hover for a preview, click
//      to pin the tooltip open and scroll through every project)
//   2. the "Featured Projects" card grid
//
// The map backdrop is img/us-states.svg — a public-domain (CC0)
// state-outline map from Wikimedia Commons — injected inline so
// each <path class="tx"> etc. can be shaded and scripted directly.
// No external map service, tiles, or API key involved.
//
// To swap in real data: replace data/projects.json. Each entry
// needs, for US entries, location.region as the full state name
// (e.g. "Texas") — that's all this map uses for placement, since
// projects are grouped and shown per state rather than pinned to
// exact coordinates.
// ============================================================

// Full state name -> USPS code, matching img/us-states.svg's classes.
const STATE_NAME_TO_CODE = {
  Alabama: "al", Alaska: "ak", Arizona: "az", Arkansas: "ar", California: "ca",
  Colorado: "co", Connecticut: "ct", Delaware: "de", "District of Columbia": "dc",
  Florida: "fl", Georgia: "ga", Hawaii: "hi", Idaho: "id", Illinois: "il",
  Indiana: "in", Iowa: "ia", Kansas: "ks", Kentucky: "ky", Louisiana: "la",
  Maine: "me", Maryland: "md", Massachusetts: "ma", Michigan: "mi",
  Minnesota: "mn", Mississippi: "ms", Missouri: "mo", Montana: "mt",
  Nebraska: "ne", Nevada: "nv", "New Hampshire": "nh", "New Jersey": "nj",
  "New Mexico": "nm", "New York": "ny", "North Carolina": "nc",
  "North Dakota": "nd", Ohio: "oh", Oklahoma: "ok", Oregon: "or",
  Pennsylvania: "pa", "Rhode Island": "ri", "South Carolina": "sc",
  "South Dakota": "sd", Tennessee: "tn", Texas: "tx", Utah: "ut",
  Vermont: "vt", Virginia: "va", Washington: "wa", "West Virginia": "wv",
  Wisconsin: "wi", Wyoming: "wy",
};

const STATE_CODES = new Set(Object.values(STATE_NAME_TO_CODE));

// Heat scale: solid accent-teal fill at an alpha that ramps up with
// project count. Log-scaled because the distribution is heavily skewed
// (Texas carries an order of magnitude more work than anywhere else) —
// linear or even sqrt scaling would flatten every other state to near
// invisible.
const HEAT_RGB = "52, 195, 166"; // var(--color-accent)
const HEAT_ALPHA_MIN = 0.3;
const HEAT_ALPHA_MAX = 0.92;

function heatFill(count, maxCount) {
  if (!count || !maxCount) return null;
  const intensity = maxCount > 1 ? Math.log(1 + count) / Math.log(1 + maxCount) : 1;
  const alpha = HEAT_ALPHA_MIN + intensity * (HEAT_ALPHA_MAX - HEAT_ALPHA_MIN);
  return `rgba(${HEAT_RGB}, ${alpha.toFixed(2)})`;
}

let allProjects = [];
let mapSvg, tooltip, grid;

function stateCodeFor(project) {
  if (project.location.country !== "United States") return null;
  // The spreadsheet gives 2-letter codes; fall back to the full state
  // name for hand-written entries.
  const code = project.location.regionCode;
  if (code && STATE_CODES.has(code.toLowerCase())) return code.toLowerCase();
  return STATE_NAME_TO_CODE[project.location.region] || null;
}

// Group US projects by state code.
function groupByState(projects) {
  const groups = new Map();
  projects.forEach((p) => {
    const code = stateCodeFor(p);
    if (!code) return;
    if (!groups.has(code)) groups.set(code, []);
    groups.get(code).push(p);
  });
  return groups;
}

// "Austin, Texas, United States" — skipping any part the sheet leaves
// blank (a few entries have no city, only a state).
function placeLabel(location) {
  return [location.city, location.region, location.country].filter(Boolean).join(", ");
}

function popupCardHtml(project) {
  const tags = (project.tags || []).map((t) => `<span class="tag">${t}</span>`).join("");
  const category = (project.category || "").toUpperCase();
  return `
    <article class="project-card">
      ${category ? `<span class="project-card__category">${category}</span>` : ""}
      <h3>${project.title}</h3>
      <p class="project-card__place">${placeLabel(project.location)} &middot; ${project.years}</p>
      <p>${project.summary}</p>
      <div class="tag-list">${tags}</div>
    </article>
  `;
}

// The sheet carries far more engagements than belong on screen at once,
// so show a first tranche and let the reader expand to the full list.
const CARDS_VISIBLE = 12;

function renderProjectCards(projects) {
  if (!grid) return;
  const toggle = document.getElementById("projectsToggle");
  const render = (showAll) => {
    const shown = showAll ? projects : projects.slice(0, CARDS_VISIBLE);
    grid.innerHTML = shown.map(popupCardHtml).join("");
    if (toggle) {
      toggle.textContent = showAll
        ? "Show fewer"
        : `Show all ${projects.length} engagements`;
      toggle.hidden = projects.length <= CARDS_VISIBLE;
    }
  };
  let showAll = false;
  render(showAll);
  if (toggle) {
    toggle.addEventListener("click", () => {
      showAll = !showAll;
      render(showAll);
    });
  }
}

// International engagements can't sit on a US map, so they're listed
// beneath it rather than dropped.
function renderInternational(projects) {
  const host = document.getElementById("mapInternational");
  if (!host) return;
  const intl = projects.filter((p) => p.location.country !== "United States");
  if (!intl.length) {
    host.hidden = true;
    return;
  }
  host.hidden = false;
  host.innerHTML = `
    <h3 class="map-international__heading">SELECT INTERNATIONAL PROJECTS</h3>
    <ul class="map-international__list">
      ${intl
        .map(
          (p) => `
        <li>
          <span class="map-international__place">${[p.location.city, p.location.country].filter(Boolean).join(", ")}</span>
          <span class="map-international__client">${p.client || p.title}</span>
          <span class="map-international__summary">${p.summary}</span>
        </li>`
        )
        .join("")}
    </ul>
  `;
}

// Hero stat tiles come from the workbook's own totals (159 engagements
// across 24 states, etc.), NOT from counting the map entries — the map
// features a curated subset of the full portfolio, so counting it here
// would understate the real figures.
function updateStats(stats) {
  if (!stats) return;
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el && value !== null && value !== undefined) el.textContent = value;
  };
  set("statValue", stats.totalValueLabel);
  set("statProjects", stats.totalProjects);
  set("statStudies", stats.impactStudies);
  set("statPlaces", stats.statesWorked);
}

let stateGroups = new Map();

// A map entry can represent a project that ran several times (an annual
// impact study, say), carrying a `count`. The heat scale and the counts
// shown to the reader are in project instances, so they reconcile with
// the headline engagement total.
function instancesIn(group) {
  return group.reduce((sum, p) => sum + (p.count || 1), 0);
}

function paintHeatMap(projects) {
  if (!mapSvg) return;
  stateGroups = groupByState(projects);
  const maxCount = Math.max(0, ...[...stateGroups.values()].map(instancesIn));

  mapSvg.querySelectorAll("g.state path[data-state]").forEach((path) => {
    const code = path.dataset.state;
    const group = stateGroups.get(code);
    if (group && group.length) {
      const n = instancesIn(group);
      path.classList.add("has-projects");
      path.style.fill = heatFill(n, maxCount);
      path.setAttribute("tabindex", "0");
      const engagements = group.length;
      path.setAttribute("aria-label", `${engagements} engagement${engagements === 1 ? "" : "s"} in ${stateNameOf(path)}`);
    } else {
      path.classList.remove("has-projects");
      path.style.fill = "";
      path.removeAttribute("tabindex");
      path.removeAttribute("aria-label");
    }
    path.classList.toggle("is-pinned-state", path === pinnedState);
  });
}

// ------------------------------------------------------------
// Tooltip: hovering a shaded state previews its projects. Clicking
// "pins" the tooltip open (stays through mouseleave, and hovering
// other states) so the list — which can run long, e.g. Texas — can
// be scrolled. Pinned tooltip closes on: clicking it again, clicking
// elsewhere, or Escape.
// ------------------------------------------------------------
let pinnedState = null; // the <path> element currently pinned open

function stateNameOf(path) {
  return path.querySelector("title")?.textContent || (path.dataset.state || "").toUpperCase();
}

function tooltipHtml(path, group, pinned) {
  const stateName = stateNameOf(path);
  const items = group
    .slice()
    .sort((a, b) => (b.count || 1) - (a.count || 1))
    .map((p) => {
      // Each entry is one engagement, however many workbook rows it spans
      // (Kemmerer's three rows are one multi-year engagement), so show
      // when it ran rather than a row count.
      const years = (p.count || 1) > 1 && p.years ? `<span class="map-tooltip__years">${p.years}</span>` : "";
      const place = [p.client !== p.title ? p.client : null, p.location.city].filter(Boolean).join(" &middot; ");
      return `
        <li>
          <span class="map-tooltip__title">${p.title}${years}</span>
          ${place ? `<span class="map-tooltip__place">${place}</span>` : ""}
          <span class="map-tooltip__summary">${p.summary}</span>
        </li>`;
    })
    .join("");
  const closeBtn = pinned ? `<button type="button" class="map-tooltip__close" aria-label="Close">&times;</button>` : "";
  const n = group.length;

  return `
    ${closeBtn}
    <strong>${stateName}</strong>
    <span class="map-tooltip__count">${n} engagement${n === 1 ? "" : "s"}</span>
    <ul class="map-tooltip__list">${items}</ul>
  `;
}

function positionTooltip(evt) {
  const container = document.getElementById("projectMap");
  const rect = container.getBoundingClientRect();
  let x = evt.clientX - rect.left + 14;
  let y = evt.clientY - rect.top + 14;

  const tw = tooltip.offsetWidth;
  const th = tooltip.offsetHeight;
  if (x + tw > rect.width) x = evt.clientX - rect.left - tw - 14;
  if (y + th > rect.height) y = evt.clientY - rect.top - th - 14;

  tooltip.style.left = `${Math.max(0, x)}px`;
  tooltip.style.top = `${Math.max(0, y)}px`;
}

function showTooltip(path, evt) {
  const group = stateGroups.get(path.dataset.state);
  if (!group || !group.length) return;
  const pinned = path === pinnedState;
  tooltip.innerHTML = tooltipHtml(path, group, pinned);
  tooltip.hidden = false;
  tooltip.classList.toggle("is-pinned", pinned);
  positionTooltip(evt);
}

function hideTooltip() {
  tooltip.hidden = true;
  tooltip.classList.remove("is-pinned");
}

function unpin() {
  const prev = pinnedState;
  pinnedState = null;
  if (prev) prev.classList.remove("is-pinned-state");
  hideTooltip();
}

function initMapInteractions() {
  // Rebuild the tooltip only when the hovered state changes — a busy
  // state like Texas renders dozens of entries, and mousemove fires far
  // too often to re-render that markup on every event. Same state, new
  // cursor position: just move the existing tooltip.
  let hoveredPath = null;
  mapSvg.addEventListener("mousemove", (e) => {
    if (pinnedState) return; // a pinned tooltip stays put regardless of hover
    const path = e.target.closest("path.has-projects");
    if (!path) {
      hoveredPath = null;
      tooltip.hidden = true;
      return;
    }
    if (path === hoveredPath && !tooltip.hidden) {
      positionTooltip(e);
      return;
    }
    hoveredPath = path;
    showTooltip(path, e);
  });
  mapSvg.addEventListener("mouseleave", () => {
    hoveredPath = null;
    if (!pinnedState) tooltip.hidden = true;
  });

  mapSvg.addEventListener("click", (e) => {
    const path = e.target.closest("path.has-projects");
    if (!path) {
      unpin();
      return;
    }
    if (path === pinnedState) {
      unpin();
    } else {
      if (pinnedState) pinnedState.classList.remove("is-pinned-state");
      pinnedState = path;
      path.classList.add("is-pinned-state");
      showTooltip(path, e);
    }
  });

  // Close button inside the pinned tooltip. Stop the click from
  // bubbling to the document-level "click outside closes it" handler
  // below — by the time it reached document, e.target could already
  // be detached from an innerHTML update, breaking the "inside the
  // map" check.
  tooltip.addEventListener("click", (e) => {
    e.stopPropagation();
    if (e.target.closest(".map-tooltip__close")) unpin();
  });

  mapSvg.addEventListener("focusin", (e) => {
    const path = e.target.closest("path.has-projects");
    if (path && !pinnedState) {
      const rect = path.getBoundingClientRect();
      showTooltip(path, { clientX: rect.left, clientY: rect.top });
    }
  });
  mapSvg.addEventListener("focusout", (e) => {
    if (!pinnedState && e.target.closest("path.has-projects")) tooltip.hidden = true;
  });

  document.addEventListener("click", (e) => {
    if (pinnedState && !e.target.closest("#projectMap")) unpin();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && pinnedState) unpin();
  });
}

async function initMap() {
  const mapContainer = document.getElementById("projectMap");
  if (!mapContainer) return;

  tooltip = document.getElementById("mapTooltip");
  grid = document.getElementById("projectGrid");

  try {
    const svgRes = await fetch("img/us-states.svg");
    const svgText = await svgRes.text();
    mapContainer.insertAdjacentHTML("afterbegin", svgText);
    mapSvg = mapContainer.querySelector("svg");
    mapSvg.removeAttribute("width");
    mapSvg.removeAttribute("height");
    mapSvg.setAttribute("viewBox", "0 0 959 593");
    mapSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    mapSvg.setAttribute("role", "img");
    mapSvg.setAttribute("aria-label", "Heat map of US project locations by state");

    // Drop the Alaska/Hawaii insets and their connector lines — none of
    // our data lives there, and as relocated insets they'd sit oddly in
    // the bottom-left corner of an otherwise geographically-placed map.
    // Also drop the base map's District of Columbia marker circle: DC is
    // too small to draw at this scale, so the source SVG stands in a
    // 5px circle for it, which reads as a stray dot with no projects.
    mapSvg.querySelectorAll("path.ak, path.hi, path.separator1, .dccircle").forEach((el) => el.remove());

    // Record each state shape's code now, while its class attribute is
    // still just the bare code. Later we add classes (has-projects,
    // is-pinned-state), so reading the code back off `class` would
    // return "tx has-projects" and never match the project lookup.
    mapSvg.querySelectorAll("g.state path[class]").forEach((path) => {
      path.dataset.state = path.getAttribute("class").trim().split(/\s+/)[0];
    });
  } catch (err) {
    console.error("Could not load img/us-states.svg", err);
    return;
  }

  let stats = null;
  let mapProjects = [];
  try {
    const res = await fetch("data/projects.json");
    const data = await res.json();
    allProjects = data.projects || [];
    // Heat map runs off every project row (full 24-state coverage);
    // cards run off the curated client engagements.
    mapProjects = data.mapProjects && data.mapProjects.length ? data.mapProjects : allProjects;
    stats = data.stats || null;
  } catch (err) {
    console.error("Could not load data/projects.json", err);
    allProjects = [];
  }

  // Render each region independently: a bad field in one dataset should
  // degrade that section only, not abort the rest of init. (A missing
  // `category` once threw here and silently took out the project cards,
  // the international list and the stat tiles in one go.)
  const safely = (label, fn) => {
    try {
      fn();
    } catch (err) {
      console.error(`Failed to render ${label}`, err);
    }
  };

  initMapInteractions();
  safely("heat map", () => paintHeatMap(mapProjects));
  safely("project cards", () => renderProjectCards(allProjects));
  safely("international list", () => renderInternational(allProjects));
  safely("stat tiles", () => updateStats(stats));
}

document.addEventListener("DOMContentLoaded", initMap);
