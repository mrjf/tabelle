// The built demo must be fully self-contained: loadable from file:// with no
// fetches and no module imports. JSDOM.fromFile gives us a real file:// URL,
// which also exercises the engine's file:// fallback (replaceState may throw;
// in-memory param state must keep filtering working).
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const demoFile = join(root, "demo", "index.html");

before(() => {
  // test against the current parts, not a stale build
  execFileSync(process.execPath, [join(root, "scripts", "build-demo.js")]);
});

async function loadDemo() {
  const dom = await JSDOM.fromFile(demoFile, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
  });
  return dom;
}

test("the built demo renders from file:// with no external resources", async () => {
  const dom = await loadDemo();
  const doc = dom.window.document;
  assert.ok(doc.location.href.startsWith("file://"), "loaded via file://");
  assert.equal(doc.querySelectorAll("script[src], link[rel=stylesheet]").length, 0,
    "no external scripts or stylesheets");
  assert.equal(doc.querySelectorAll("tbody tr").length, 15, "all works render");
  assert.ok(doc.querySelector(".lt-about"), "about chrome renders");
});

test("filtering works on file:// even though the url cannot change", async () => {
  const dom = await loadDemo();
  const doc = dom.window.document;
  const chip = [...doc.querySelectorAll("a[data-filter]")]
    .find((a) => a.dataset.filter === "designer=Max Bill");
  chip.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
  const rows = doc.querySelectorAll("tbody tr");
  assert.equal(rows.length, 2, "filtered to Max Bill's two works");
  assert.match(rows[1].textContent, /Ulmer Hocker/);
});

test("the demo directory is a sapi site: data.json, query.js, schema.json agree", async () => {
  const { readFile } = await import("node:fs/promises");
  const data = JSON.parse(await readFile(join(root, "demo", "data.json"), "utf8"));
  const schema = JSON.parse(await readFile(join(root, "demo", "schema.json"), "utf8"));
  const querySrc = await readFile(join(root, "demo", "query.js"), "utf8");
  assert.ok(Array.isArray(data.works) && data.works.length > 0);
  assert.match(querySrc, /^export default function query\(/m, "sapi-conformant query.js");
  for (const param of Object.keys(schema["x-sapi"].params)) {
    if (param === "sort") continue;
    assert.ok(querySrc.includes(`"${param}"`), `query.js handles documented param ${param}`);
  }
  const kinds = new Set(data.works.map((w) => w.kind));
  const allowed = new Set(schema.properties.works.items.properties.kind.enum);
  for (const kind of kinds) assert.ok(allowed.has(kind), `schema allows kind "${kind}"`);
});
