// Turns the rows of an OKR sheet tab into the JSON the dashboard renders.
// Reads columns A to P only (column I, Metric, is used for logic but never displayed).
//
// raw: rows with UNFORMATTED_VALUE (numbers, dates as sheet serial numbers)
// fmt: the same range with FORMATTED_VALUE (strings exactly as shown in the sheet)

const get = (rows, r, c) => (rows[r] && rows[r][c] !== undefined ? rows[r][c] : "");
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const clamp01 = (n) => Math.max(0, Math.min(1, n));

const CALIBRATIONS = { committed: "Committed", aspirational: "Aspirational" };
// Key results with these confidence levels don't count toward progress.
const EXCLUDED = new Set(["On Hold", "Deprioritized"]);

function serialToISO(n) {
  return new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000).toISOString().slice(0, 10);
}

function headerValue(raw, label) {
  for (let r = 0; r < Math.min(raw.length, 14); r++) {
    if (String(get(raw, r, 8)).trim() === label) return get(raw, r, 10);
  }
  return "";
}

function calibrationAt(rows, r, col) {
  const v = String(get(rows, r, col)).trim().toLowerCase();
  return CALIBRATIONS[v] || "";
}

function avg(list) {
  return list.length ? list.reduce((a, b) => a + b, 0) / list.length : null;
}

function parseSheet(raw, fmt) {
  const objectives = [];
  let cur = null;

  for (let r = 0; r < raw.length; r++) {
    const colA = String(get(raw, r, 0)).trim();
    const text = String(get(raw, r, 2)).trim();

    if (colA === "Objective:") {
      cur = { title: text, progress: null, calibration: "", krs: [] };
      objectives.push(cur);
      continue;
    }
    if (!cur) continue;

    if (!text) {
      // The rows under an objective header carry its progress (column M) and,
      // in most departments, its Committed/Aspirational label (column P or K).
      const p = get(raw, r, 12);
      if (cur.progress === null && isNum(p)) cur.progress = clamp01(p);
      if (!cur.calibration) cur.calibration = calibrationAt(raw, r, 15) || calibrationAt(raw, r, 10);
      continue;
    }

    const metric = String(get(raw, r, 8)).trim();
    if (!metric) continue; // not a key result row

    const shown = (c) => String(get(fmt, r, c)).trim();
    // Some departments use the Yes/No metric for counts ("3 of 12"), so only
    // show Yes/No when the key result really is a 0-to-1 milestone.
    const yn = metric === "Yes/No" && get(raw, r, 10) === 1 && (get(raw, r, 9) === 0 || get(raw, r, 9) === "");
    const display = (rawVal, c) => {
      if (rawVal === "" || rawVal === null) return "TBD";
      if (yn && isNum(rawVal)) return rawVal >= 1 ? "Yes" : "No";
      return shown(c) || "TBD";
    };

    const progressCell = get(raw, r, 12);
    const due = get(raw, r, 14);
    cur.krs.push({
      text,
      start: display(get(raw, r, 9), 9),
      target: display(get(raw, r, 10), 10),
      current: display(get(raw, r, 11), 11),
      progress: isNum(progressCell) ? clamp01(progressCell) : null,
      status: String(get(raw, r, 13)).trim(), // blank means the sheet has no confidence level set

      due: isNum(due) ? serialToISO(due) : null,
      calibration: calibrationAt(raw, r, 15) || cur.calibration
    });
  }

  // Objectives with no progress cell of their own fall back to the average of their key results,
  // leaving out On Hold and Deprioritized ones, the same rule the sheets use.
  for (const o of objectives) {
    if (o.progress === null) {
      o.progress = avg(o.krs.filter((k) => !EXCLUDED.has(k.status)).map((k) => k.progress).filter((p) => p !== null));
    }
  }

  const startSerial = headerValue(raw, "Start Date:");
  const endSerial = headerValue(raw, "End Date:");
  const overall = headerValue(raw, "Overall Progress:");
  const unit = headerValue(raw, "Business Unit/Team:");

  return {
    unit: typeof unit === "string" ? unit.trim() : "",
    cycle: {
      start: isNum(startSerial) ? serialToISO(startSerial) : null,
      end: isNum(endSerial) ? serialToISO(endSerial) : null
    },
    overall: isNum(overall) ? clamp01(overall) : avg(objectives.map((o) => o.progress).filter((p) => p !== null)),
    objectives
  };
}

module.exports = { parseSheet, serialToISO };
