// Page-side wiring for the demo: column spec and chrome. Written as a plain
// script (no imports/exports) — the build inlines it after the engine, the
// query function, and the data, which it references as globals.
const works = initListTable({
  table: "#works",
  data,
  query,
  rowHref: (r) => r.url,
  defaultSort: "designer", // data.json ships ordered by designer
  downloadFilename: "swiss-graphic-design",

  columns: [
    {
      id: "designer", param: "designer", sortable: true, group: true,
      width: "28%", mobileWidth: "26%", variants: ["strong"],
      key: (r) => r.designer, label: (r) => r.designer, value: (r) => r.designer,
    },
    {
      id: "work", width: "44%", mobileWidth: "38%",
      label: (r) => r.work, href: (r) => r.url,
    },
    {
      // group: runs of equal years collapse into one rowspan cell whose
      // hairline ditto shows how far the value extends
      id: "year", param: "year", sortable: true, group: true,
      width: "12%", mobileWidth: "13%", variants: ["mono"],
      key: (r) => r.year, label: (r) => String(r.year), value: (r) => String(r.year),
    },
    {
      // kind's uppercase tags ("TYPEFACE") need more of a narrow screen than
      // their 16% desktop share
      id: "kind", param: "kind", group: true,
      width: "16%", mobileWidth: "23%", variants: ["tag", "muted"],
      key: (r) => r.kind, label: (r) => r.kind, value: (r) => r.kind,
    },
  ],
});

initAbout({
  container: "#title",
  html: "<p><strong>tabelle</strong> renders any dataset as one flat, URL-addressable table. Click headers to sort, values to filter, rows to visit the source. Escape clears everything.</p><p>This demo lists landmark works of Swiss graphic design. It is a single self-contained file — it works from file:// — and, served over http, it is also a <a href=\"https://github.com/mrjf/sapi\">sapi</a> site.</p>",
});
