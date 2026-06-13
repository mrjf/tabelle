// Behavior tests for initCalendar under jsdom: one continuous Sunday-first
// grid, busy weeks only, no month headers, re-render via the returned render().
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

let initCalendar;
let dom;

const EVENTS = [
  { title: "Bus to Balaton", start: "2026-07-12" },
  { title: "Roadtrip", start: "2026-07-13", end: "2026-07-15" },
  { title: "Swim", start: "2026-07-18T07:00" },
  { title: "Fly home", start: "2026-08-01T10:45", end: "2026-08-01T13:50" },
];

beforeEach(async () => {
  dom = new JSDOM('<!doctype html><html><body><div id="cal"></div></body></html>', {
    url: "https://tabelle.test/",
  });
  global.window = dom.window;
  global.document = dom.window.document;
  ({ initCalendar } = await import("../calendar.js"));
});

function init(events = EVENTS, extra = {}) {
  let current = events;
  const cal = initCalendar({
    container: "#cal",
    events: () => current,
    date: (r) => r.start,
    end: (r) => r.end,
    label: (r) => r.title,
    ...extra,
  });
  return { cal, setEvents: (next) => (current = next) };
}

function dayCell(dayText) {
  return [...dom.window.document.querySelectorAll("tbody td")].find(
    (td) => td.querySelector(".lt-cal-day")?.textContent === String(dayText),
  );
}

test("renders one continuous grid with no month headers", () => {
  init();
  assert.equal(dom.window.document.querySelectorAll(".lt-cal table").length, 1);
  assert.equal(dom.window.document.querySelectorAll(".lt-cal-title, .lt-cal-month").length, 0);
});

test("only weeks containing events render", () => {
  init();
  // Jul 12–18 (bus, roadtrip, swim) and Jul 26–Aug 1 (fly home); Jul 19–25 collapses
  assert.equal(dom.window.document.querySelectorAll("tbody tr").length, 2);
  assert.ok(dayCell(12), "busy week renders");
  assert.equal(dayCell(20), undefined, "empty week is dropped");
});

test("weeks run Sunday to Saturday", () => {
  init();
  const headers = [...dom.window.document.querySelectorAll("th")].map((th) => th.textContent);
  assert.deepEqual(headers, ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]);
  const firstWeek = dom.window.document.querySelector("tbody tr");
  assert.equal(firstWeek.children.length, 7);
  // July 12, 2026 is a Sunday — it opens its week
  assert.equal(firstWeek.children[0].querySelector(".lt-cal-day").textContent, "12");
});

test("a multi-day event lands on every day it covers", () => {
  init();
  for (const day of [13, 14, 15]) {
    const cell = dayCell(day);
    assert.ok(cell.classList.contains("lt-cal-busy"), `Jul ${day} is busy`);
    assert.equal(cell.querySelector(".lt-cal-event").textContent, "Roadtrip");
  }
  assert.ok(!dayCell(16).classList.contains("lt-cal-busy"), "Jul 16 stays empty");
});

test("the first of a month is labeled so the turnover stays legible", () => {
  init();
  const aug1 = dayCell("aug 1");
  assert.ok(aug1, "first-of-month cell is labeled 'aug 1'");
  assert.ok(aug1.classList.contains("lt-cal-busy"));
  assert.equal(aug1.querySelector(".lt-cal-event").textContent, "Fly home");
});

test("render() redraws from the current events — the filtered-view hook", () => {
  const { cal, setEvents } = init();
  assert.equal(dom.window.document.querySelectorAll("tbody tr").length, 2);
  setEvents([{ title: "Swim", start: "2026-07-18" }]);
  cal.render();
  assert.equal(dom.window.document.querySelectorAll("tbody tr").length, 1);
  assert.ok(dayCell(18).classList.contains("lt-cal-busy"));
  assert.ok(!dayCell(13)?.classList.contains("lt-cal-busy"), "roadtrip days cleared");
});

test("hovering an entry fades the others; a multi-day row keeps all its days lit", () => {
  const seen = [];
  init(EVENTS, { onHover: (row) => seen.push(row) });
  const roadtrip = [...dom.window.document.querySelectorAll(".lt-cal-event")]
    .find((el) => el.textContent === "Roadtrip");
  roadtrip.dispatchEvent(new dom.window.MouseEvent("mouseover", { bubbles: true }));
  const entries = [...dom.window.document.querySelectorAll(".lt-cal-event")];
  for (const el of entries) {
    assert.equal(el.classList.contains("lt-dim"), el.textContent !== "Roadtrip");
  }
  assert.equal(seen.at(-1), EVENTS[1], "onHover reports the row");

  dom.window.document.querySelector(".lt-cal").dispatchEvent(
    new dom.window.MouseEvent("mouseout", { bubbles: true }),
  );
  assert.equal(dom.window.document.querySelectorAll(".lt-cal-event.lt-dim").length, 0);
  assert.equal(seen.at(-1), null);
});

test("highlight(row) fades from outside without echoing onHover", () => {
  const seen = [];
  const { cal } = init(EVENTS, { onHover: (row) => seen.push(row) });
  cal.highlight(EVENTS[2]);
  const dimmed = dom.window.document.querySelectorAll(".lt-cal-event.lt-dim").length;
  assert.equal(dimmed, dom.window.document.querySelectorAll(".lt-cal-event").length - 1);
  assert.equal(seen.length, 0, "external highlight never echoes onHover");
  cal.highlight(null);
  assert.equal(dom.window.document.querySelectorAll(".lt-cal-event.lt-dim").length, 0);
});

test("no rows renders an empty calendar without crashing", () => {
  const { cal, setEvents } = init([]);
  assert.equal(dom.window.document.querySelector(".lt-cal").children.length, 0);
  setEvents(EVENTS);
  cal.render();
  assert.equal(dom.window.document.querySelectorAll("tbody tr").length, 2);
});
