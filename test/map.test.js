// Behavior tests for initMap with a fake Leaflet: layers, labels, spotlight,
// re-render. The fake records exactly the Leaflet surface the module uses.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

let initMap;
let dom;
let log;

const PLACES = {
  Munich: [48.14, 11.58],
  Bratislava: [48.15, 17.11],
  Balaton: [46.88, 17.73],
};

const EVENTS = [
  { title: "Roadtrip", where: "Munich → Bratislava" },
  { title: "Swim", where: "Balaton" },
  { title: "Lost", where: "Atlantis" },
];

function fakeLayer(type, args) {
  return {
    type,
    args,
    options: args[1] || {},
    style: {},
    handlers: {},
    tooltip: null,
    addTo(parent) {
      (parent.layers ||= []).push(this);
      return this;
    },
    bindTooltip(text, opts) {
      this.tooltip = { text, opts };
      return this;
    },
    setStyle(style) {
      Object.assign(this.style, style);
      return this;
    },
    on(name, fn) {
      this.handlers[name] = fn;
      return this;
    },
    fire(name) {
      this.handlers[name]?.();
    },
  };
}

function fakeLeaflet() {
  const created = { tiles: [], maps: [] };
  return {
    created,
    map(el, opts) {
      const m = { el, opts, layers: [], fits: [], fitBounds(bounds, fitOpts) { this.fits.push({ bounds, fitOpts }); } };
      created.maps.push(m);
      return m;
    },
    tileLayer(url, opts) {
      const layer = fakeLayer("tile", [url, opts]);
      created.tiles.push(layer);
      return layer;
    },
    layerGroup() {
      const group = fakeLayer("group", []);
      group.layers = [];
      group.clearLayers = () => { group.layers.length = 0; };
      return group;
    },
    circleMarker(latlng, opts) {
      return fakeLayer("circleMarker", [latlng, opts]);
    },
    polyline(latlngs, opts) {
      return fakeLayer("polyline", [latlngs, opts]);
    },
    latLngBounds(coords) {
      return { coords };
    },
  };
}

beforeEach(async () => {
  dom = new JSDOM('<!doctype html><html><body><div id="map"></div></body></html>', {
    url: "https://tabelle.test/",
  });
  global.window = dom.window;
  global.document = dom.window.document;
  global.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  log = fakeLeaflet();
  ({ initMap } = await import("../map.js"));
});

function init(events = EVENTS, extra = {}) {
  let current = events;
  const map = initMap({
    container: "#map",
    events: () => current,
    where: (r) => r.where,
    places: PLACES,
    leaflet: log,
    ...extra,
  });
  return { map, setEvents: (next) => (current = next) };
}

function overlay() {
  // first layerGroup added to the map
  return log.created.maps[0].layers.find((layer) => layer.type === "group");
}

function shapes() {
  // the visible hairlines (their invisible hit twins carry the handlers);
  // labeled place dots are non-interactive too, so exclude anything labeled
  return overlay().layers.filter((l) => l.options.interactive === false && !l.tooltip);
}

function hitShapes() {
  return overlay().layers.filter(
    (l) => !l.tooltip && (l.options.opacity === 0 || l.options.fillOpacity === 0),
  );
}

function labels() {
  return overlay().layers.filter((l) => l.tooltip);
}

test("uses no-label basemap tiles with attribution, and no zoom chrome", () => {
  init();
  const [tile] = log.created.tiles;
  assert.match(tile.args[0], /_nolabels/);
  assert.match(tile.args[1].attribution, /OpenStreetMap/);
  assert.equal(log.created.maps[0].opts.zoomControl, false);
});

test("labels come only from the rows", () => {
  init();
  assert.deepEqual(labels().map((l) => l.tooltip.text).sort(), ["Balaton", "Bratislava", "Munich"]);
});

test("a trajectory draws a line, a single place a ring, unknown places nothing", () => {
  init();
  const drawn = shapes();
  assert.equal(drawn.length, 2, "the Atlantis row draws nothing");
  assert.equal(drawn[0].type, "polyline");
  assert.equal(drawn[0].args[0].length, 2, "one point per stop");
  assert.equal(drawn[1].type, "circleMarker");
  assert.equal(drawn[1].options.fill, false, "single place renders as a ring");
});

test("fits the view to the places the rows mention", () => {
  init();
  const fit = log.created.maps[0].fits.at(-1);
  assert.equal(fit.bounds.coords.length, 3);
});

test("hovering a shape's hit area fades the others and reports the row", () => {
  const seen = [];
  init(EVENTS, { onHover: (row) => seen.push(row) });
  const [line, ring] = shapes();
  const [lineHit, ringHit] = hitShapes();
  assert.ok(lineHit.options.weight >= 10, "trajectory hit area is generous");
  assert.ok(ringHit.options.radius >= 10, "ring hit area is generous");
  lineHit.fire("mouseover");
  assert.equal(ring.style.opacity, 0.08);
  assert.equal(line.style.opacity, 0.6);
  assert.equal(seen.at(-1), EVENTS[0]);
  lineHit.fire("mouseout");
  assert.equal(ring.style.opacity, 0.6);
  assert.equal(seen.at(-1), null);
});

test("highlight(row) fades from outside without echoing onHover", () => {
  const seen = [];
  const { map } = init(EVENTS, { onHover: (row) => seen.push(row) });
  map.highlight(EVENTS[1]);
  const [line, ring] = shapes();
  assert.equal(line.style.opacity, 0.08);
  assert.equal(ring.style.opacity, 0.6);
  assert.equal(seen.length, 0);
  map.highlight(null);
  assert.equal(line.style.opacity, 0.6);
});

test("clustered places fan their labels out in different directions", () => {
  init([{ title: "Cluster", where: "Munich → Bratislava" }], {
    places: { Munich: [48.14, 11.58], MUC: [48.35, 11.79], Bratislava: [48.15, 13.0] },
  });
  // all three are within the cluster radius of each other
  const dirs = labels().map((l) => l.tooltip.opts.direction);
  assert.equal(new Set(dirs).size, dirs.length, `directions differ: ${dirs}`);
});

test("render() redraws from the current events; no mappable rows clears the overlay", () => {
  const { map, setEvents } = init();
  setEvents([{ title: "Swim", where: "Balaton" }]);
  map.render();
  assert.equal(shapes().length, 1);
  assert.equal(labels().length, 1);
  setEvents([{ title: "Lost", where: "Atlantis" }]);
  map.render();
  assert.equal(overlay().layers.length, 0);
});
