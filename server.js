// ============================================================
// server.js — minimal Express static server for the portfolio
// ============================================================
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Serve everything in this folder as static assets
// (index.html, css/, js/, img/, data/, resume/, robots.txt, sitemap.xml)
app.use(express.static(path.join(__dirname), { extensions: ["html"] }));

// Fallback to index.html for any unmatched route (simple SPA-style fallback).
// Requests that look like files are excluded: answering /favicon.ico or a
// missing image with a page of HTML makes the browser silently fall back to
// a cached icon (or fail in confusing ways) instead of reporting a 404.
app.get("*", (req, res, next) => {
  if (path.extname(req.path)) return next();
  res.sendFile(path.join(__dirname, "index.html"));
});

app.use((req, res) => {
  res.status(404).type("text/plain").send("Not found");
});

// Bind on 0.0.0.0 so the process is reachable inside a container
// (Railway and similar platforms route to the port given in $PORT).
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Portfolio running on port ${PORT}`);
});
