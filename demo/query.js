// The demo's query function — the same shape a sapi site would serve as
// query.js. Exact-match params per column, plus sort=key / sort=-key.
//
// A sort key need not be a raw field: SORT_KEYS derives the comparable for
// keys where the natural order isn't the stored string. People sort by last
// name (full name breaks ties between siblings of a surname).
const SORT_KEYS = {
  designer: (r) => `${r.designer.split(" ").at(-1)} ${r.designer}`,
};

export default function query(data, params) {
  let rows = data.works;
  for (const key of ["designer", "kind", "year"]) {
    if (params[key]) rows = rows.filter((r) => String(r[key]) === String(params[key]));
  }
  const sort = params.sort || "";
  const key = sort.replace(/^-/, "");
  if (key) {
    const dir = sort.startsWith("-") ? -1 : 1;
    const val = SORT_KEYS[key] || ((r) => r[key]);
    rows = [...rows].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * dir;
    });
  }
  return rows;
}
