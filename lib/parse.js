// Turns the rows of the OKR sheet tab into the JSON the dashboard renders.
// Reads columns A to P only (column I, Metric, is used for logic but never displayed).
//
// raw: rows from the Sheets API with valueRenderOption=UNFORMATTED_VALUE (numbers, date serials)
// fmt: the same range with valueRenderOption=FORMATTED_VALUE (strings exactly as shown in the sheet)

const get = (rows, r, c) => (rows[r] && rows[r][c] !== undefined ? rows[r][c] : "");
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const clamp01 = (n) => Math.max(0, Math.min(1, n));

function serialToISO(n) {
  return new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000).toISOString().slice(0, 10);
}

function headerValue(raw, label) {
  for (let r = 0; r < Math.min(raw.length, 14); r++) {
    if (String(get(raw, r, 8)).trim() === label) return get(raw, r, 10);
  }
  return "";
}

function parseSheet(raw, fmt) {
  const objectives = [];
  let cur = null;

  for (let r = 0; r < raw.length; r++) {
    const colA = String(get(raw, r, 0)).trim();
    const text = String(get(raw, r, 2)).trim();

    if (colA === "Objective:") {
      cur = { title: text, progress: null, krs: [] };
      objectives.push(cur);
      continue;
    }
    if (!cur) continue;

    const progressCell = get(raw, r, 12);
    if (!text) {
      // The row under an objective header holds that objective's average progress in column M.
      if (cur.progress === null && isNum(progressCell)) cur.progress = clamp01(progressCell);
      continue;
    }

    const metric = String(get(raw, r, 8)).trim();
    if (!metric) continue; // not a key result row

    const shown = (c) => String(get(fmt, r, c)).trim();
    const yn = metric === "Yes/No";
    const startRaw = get(raw, r, 9);
    const targetRaw = get(raw, r, 10);
    const currentRaw = get(raw, r, 11);

    const display = (rawVal, c) => {
      if (rawVal === "" || rawVal === null) return "TBD";
      if (yn && isNum(rawVal)) return rawVal >= 1 ? "Yes" : "No";
      return shown(c) || "TBD";
    };

    const due = get(raw, r, 14);
    cur.krs.push({
      text,
      start: display(startRaw, 9),
      target: display(targetRaw, 10),
      current: display(currentRaw, 11),
      progress: isNum(progressCell) ? clamp01(progressCell) : null,
      status: String(get(raw, r, 13)).trim() || "Not Started",
      due: isNum(due) ? serialToISO(due) : null,
      calibration: String(get(raw, r, 15)).trim()
    });
  }

  const startSerial = headerValue(raw, "Start Date:");
  const endSerial = headerValue(raw, "End Date:");
  const overall = headerValue(raw, "Overall Progress:");

  return {
    cycle: {
      start: isNum(startSerial) ? serialToISO(startSerial) : null,
      end: isNum(endSerial) ? serialToISO(endSerial) : null
    },
    overall: isNum(overall) ? clamp01(overall) : null,
    objectives
  };
}

module.exports = { parseSheet, serialToISO };
