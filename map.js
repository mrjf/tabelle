// map — real outlines, barest tiles: a Leaflet companion to listtable.
//
// Renders the rows on an actual map: bare no-label basemap tiles (CARTO
// light/dark following the color scheme, OpenStreetMap data) with nothing on
// them except what the rows mention — labeled dots for places, hairlines for
// trajectory rows ("A → B", any number of stops), rings for single-place
// rows. Bring your own Leaflet (global L or config.leaflet); tabelle itself
// stays dependency-free. Same contract as the calendar: render() mirrors the
// filtered view (and refits to it), highlight(row|null) + onHover join the
// cross-view spotlight. Styled by the theme (.lt-map rules).
//
// Config:
//   container       - element or selector the map renders into
//   events()        - returns the rows to draw (e.g. listtable's rows())
//   where(row)      - "Place" or "Place → Place [→ ...]"
//   places          - { name: [lat, lon] } legend resolving the names
//   onHover(row)    - fires as the pointer enters/leaves a row's shape
//   leaflet         - Leaflet module (defaults to globalThis.L)
//   tileUrl         - basemap override (default: CARTO *_nolabels)
//   tileAttribution - attribution override (keep one: tile terms require it)

export function initMap(config) {
  const L = config.leaflet || globalThis.L;
  const container =
    typeof config.container === "string" ? document.querySelector(config.container) : config.container;
  const root = document.createElement("div");
  root.className = "lt-map";
  container.appendChild(root);

  const dark = typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
  const tileUrl =
    config.tileUrl || `https://{s}.basemaps.cartocdn.com/${dark ? "dark" : "light"}_nolabels/{z}/{x}/{y}{r}.png`;
  const tileAttribution =
    config.tileAttribution ??
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

  // no controls — the barest map; attribution stays (the tiles require it)
  const map = L.map(root, { zoomControl: false, scrollWheelZoom: false });
  L.tileLayer(tileUrl, { attribution: tileAttribution }).addTo(map);
  const overlay = L.layerGroup().addTo(map);
  let entries = []; // every per-row shape with its row

  function ink() {
    if (typeof getComputedStyle !== "function") return "#1c1917";
    return getComputedStyle(document.documentElement).getPropertyValue("--fg").trim() || "#1c1917";
  }

  function parsePlaces(where) {
    return String(where || "")
      .split("→")
      .map((name) => name.trim())
      .filter((name) => config.places[name]);
  }

  function render() {
    const rows = config.events() || [];
    overlay.clearLayers();
    entries = [];

    const fg = ink();
    const used = new Map(); // place name -> [lat, lon]
    const shapes = []; // { row, names }
    for (const row of rows) {
      const names = parsePlaces(config.where(row));
      if (!names.length) continue;
      for (const name of names) used.set(name, config.places[name]);
      shapes.push({ row, names });
    }
    if (!used.size) return;

    for (const { row, names } of shapes) {
      // The visible shape is a hairline — pair it with an invisible, generous
      // hit area so a real pointer can actually find it.
      const visible =
        names.length > 1
          ? L.polyline(names.map((name) => config.places[name]), {
              color: fg, weight: 1, opacity: 0.6, interactive: false,
            })
          : L.circleMarker(config.places[names[0]], {
              radius: 9, color: fg, weight: 1, fill: false, opacity: 0.6, interactive: false,
            });
      const hit =
        names.length > 1
          ? L.polyline(names.map((name) => config.places[name]), { weight: 16, opacity: 0 })
          : L.circleMarker(config.places[names[0]], { radius: 14, stroke: false, fillOpacity: 0 });
      hit.on("mouseover", () => {
        highlight(row);
        if (config.onHover) config.onHover(row);
      });
      hit.on("mouseout", () => {
        highlight(null);
        if (config.onHover) config.onHover(null);
      });
      visible.addTo(overlay);
      hit.addTo(overlay);
      entries.push({ layer: visible, row });
    }

    // Labels come only from the rows — the basemap carries none. Clustered
    // places (airports beside their cities) fan their labels out in four
    // directions instead of stacking on the right.
    const DIRECTIONS = [
      ["right", [6, 0]],
      ["left", [-6, 0]],
      ["top", [0, -6]],
      ["bottom", [0, 6]],
    ];
    const labeled = [];
    for (const [name, place] of used) {
      const neighbors = labeled.filter(
        ([lat, lon]) => Math.hypot(lat - place[0], lon - place[1]) < 2.5,
      ).length;
      const [direction, offset] = DIRECTIONS[neighbors % DIRECTIONS.length];
      labeled.push(place);
      L.circleMarker(place, { radius: 3, stroke: false, fillColor: fg, fillOpacity: 0.85, interactive: false })
        .bindTooltip(name, { permanent: true, direction, offset, className: "lt-map-label" })
        .addTo(overlay);
    }

    map.fitBounds(L.latLngBounds([...used.values()]), { padding: [24, 24], maxZoom: 7 });
  }

  // Fade every row shape but this one; null clears. Never echoes onHover.
  function highlight(row) {
    for (const entry of entries) {
      entry.layer.setStyle({ opacity: row != null && entry.row !== row ? 0.08 : 0.6 });
    }
  }

  render();
  return { render, highlight };
}
