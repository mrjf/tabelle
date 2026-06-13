// calendar — a bare-bones week-grid companion to listtable.
//
// Renders one continuous Sunday-first grid covering the current rows: only
// the weeks that contain events appear — quiet stretches collapse away — and
// there are no month headers; the first of a month is labeled "aug 1" so the
// turnover stays legible. An event lands on every day it covers (start
// through end). Almost no state of its own: call the returned render() to
// redraw — pair it with listtable's onApply so the calendar always mirrors
// the filtered view. Styled by the same theme stylesheet (.lt-cal rules).
//
// Hovering an entry fades all the others and reports the row via onHover;
// the returned highlight(row|null) fades from outside. Cross-wire with
// listtable's onHover/highlight and both views spotlight together.
//
// Config:
//   container   - element or selector the calendar renders into
//   events()    - returns the rows to draw (e.g. listtable's rows())
//   date(row)   - ISO local date/datetime ("YYYY-MM-DD" or "YYYY-MM-DDTHH:MM")
//   end(row)    - optional, same format; defaults to the start day
//   label(row)  - short text shown in the day cell
//   onHover(row)- fires as the pointer enters/leaves entries (null on leave)

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function initCalendar(config) {
  const container =
    typeof config.container === "string" ? document.querySelector(config.container) : config.container;
  const root = document.createElement("div");
  root.className = "lt-cal";
  container.appendChild(root);
  let entries = []; // every rendered event element with its row

  function fmt(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function dayKey(value) {
    return value ? String(value).slice(0, 10) : "";
  }

  function render() {
    const rows = config.events() || [];
    const byDay = new Map();
    let min = null;
    let max = null;
    for (const row of rows) {
      const start = dayKey(config.date(row));
      if (!start) continue;
      let end = dayKey(config.end ? config.end(row) : "") || start;
      if (end < start) end = start;
      const cursor = new Date(start + "T00:00:00");
      while (fmt(cursor) <= end) {
        const key = fmt(cursor);
        if (!byDay.has(key)) byDay.set(key, []);
        byDay.get(key).push({ row, label: config.label(row) ?? "" });
        cursor.setDate(cursor.getDate() + 1);
      }
      if (!min || start < min) min = start;
      if (!max || end > max) max = end;
    }

    root.textContent = "";
    entries = [];
    if (!min) return;

    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    for (const day of WEEKDAYS) {
      const th = document.createElement("th");
      th.textContent = day;
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    const cursor = new Date(min + "T00:00:00");
    cursor.setDate(cursor.getDate() - cursor.getDay()); // back to Sunday
    const last = new Date(max + "T00:00:00");
    while (cursor <= last) {
      const week = [];
      for (let i = 0; i < 7; i += 1) {
        week.push(new Date(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
      if (!week.some((day) => byDay.has(fmt(day)))) continue;
      const tr = document.createElement("tr");
      for (const day of week) {
        const key = fmt(day);
        const td = document.createElement("td");
        const num = document.createElement("span");
        num.className = "lt-cal-day";
        num.textContent =
          day.getDate() === 1
            ? `${day.toLocaleDateString("en-US", { month: "short" }).toLowerCase()} 1`
            : String(day.getDate());
        td.appendChild(num);
        for (const item of byDay.get(key) || []) {
          const entry = document.createElement("div");
          entry.className = "lt-cal-event";
          entry.textContent = item.label;
          entry.title = item.label;
          entries.push({ el: entry, row: item.row });
          td.appendChild(entry);
        }
        if (byDay.has(key)) td.classList.add("lt-cal-busy");
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    root.appendChild(table);
  }

  // Fade every entry that isn't this row (a multi-day row keeps all its
  // days lit); null clears. Driven by local hover or from outside — it never
  // echoes onHover, so cross-wired views can't loop.
  function highlight(row) {
    for (const entry of entries) {
      entry.el.classList.toggle("lt-dim", row != null && entry.row !== row);
    }
  }

  root.addEventListener("mouseover", (event) => {
    const el = event.target.closest(".lt-cal-event");
    const entry = el ? entries.find((candidate) => candidate.el === el) : null;
    highlight(entry ? entry.row : null);
    if (config.onHover) config.onHover(entry ? entry.row : null);
  });
  root.addEventListener("mouseout", (event) => {
    if (event.relatedTarget && root.contains(event.relatedTarget)) return;
    highlight(null);
    if (config.onHover) config.onHover(null);
  });

  render();
  return { render, highlight };
}
