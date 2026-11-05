/**
 * OKR dashboard feed.
 * Paste this into Extensions > Apps Script in the OKR workbook, set the TOKEN
 * script property, then deploy as a web app (see README.md).
 *
 * Returns columns A to P of the 2027 tab twice: raw values (numbers, dates as
 * sheet serial numbers) and display values (text exactly as shown in the sheet).
 */
var GID = 314819311;          // the 2027 tab (the gid in the sheet URL)
var RANGE_ROWS = 120;
var RANGE_COLS = 16;          // A to P

function doGet(e) {
  var token = PropertiesService.getScriptProperties().getProperty('TOKEN');
  if (!token || !e || !e.parameter || e.parameter.token !== token) {
    return json_({ error: 'Unauthorized' });
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets().filter(function (s) {
    return s.getSheetId() === GID;
  })[0];
  if (!sheet) return json_({ error: 'No tab with gid ' + GID });

  var range = sheet.getRange(1, 1, Math.min(RANGE_ROWS, sheet.getMaxRows()), RANGE_COLS);
  var raw = range.getValues().map(function (row) { return row.map(serial_); });
  var fmt = range.getDisplayValues();

  return json_({ tab: sheet.getName(), raw: raw, fmt: fmt });
}

// Dates come back as Date objects; convert to the serial numbers the dashboard expects.
function serial_(v) {
  if (v instanceof Date) {
    return Math.round((Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()) - Date.UTC(1899, 11, 30)) / 86400000);
  }
  return v;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
