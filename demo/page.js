// Page-side wiring for the demo: column spec and chrome. Written as a plain
// script (no imports/exports) — the build inlines it after the engine, the
// query function, and the data, which it references as globals.
initListTable({
  table: "#works",
  data,
  query,
  rowHref: (r) => r.url,
  columns: [
    {
      id: "designer", param: "designer", sortable: true, group: true,
      width: "28%", variants: ["strong"],
      key: (r) => r.designer, label: (r) => r.designer, value: (r) => r.designer,
    },
    {
      id: "work", width: "44%",
      label: (r) => r.work, href: (r) => r.url,
    },
    {
      id: "year", param: "year", sortable: true, width: "12%", variants: ["mono"],
      key: (r) => r.year, label: (r) => String(r.year), value: (r) => String(r.year),
    },
    {
      id: "kind", param: "kind", width: "16%", variants: ["tag", "muted"],
      key: (r) => r.kind, label: (r) => r.kind, value: (r) => r.kind,
    },
  ],
});

initAbout({
  container: "#title",
  html: "<p><strong>tabelle</strong> renders any dataset as one flat, URL-addressable table. Click headers to sort, values to filter, rows to visit the source. Escape clears everything.</p><p>This demo lists landmark works of Swiss graphic design. It is a single self-contained file — it works from file:// — and, served over http, it is also a <a href=\"https://github.com/mrjf/sapi\">sapi</a> site.</p>",
});
