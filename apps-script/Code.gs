/**
 * OKR dashboard feed.
 *
 * Serves every department's OKR tab for a given year as JSON.
 * Deploy as a web app (Execute as: Me, Who has access: Anyone) and set the
 * TOKEN script property. See README.md.
 *
 * To add a department: add a row to DEPARTMENTS below, then publish a new
 * version of the deployment.
 */

var RANGE = 'A1:P150';

var DEPARTMENTS = [
  { slug: 'avacloud',    name: 'AvaCloud',                group: 'Product',         id: '1pp7c1J4hgUd9FwhF9nWKasfYiqcq_pL5PLMg9jvT82E' },
  { slug: 'bd-eg',       name: 'BD/EG',                   group: 'Platform',        id: '1g4hYO3sm6SfH9lvXKF6MvjhAFW6mWk19lzPPLtTmtjU' },
  { slug: 'core',        name: 'Core',                    group: 'Product',         id: '14IiqWW9t9rJLmx8Ka7i6stiFLtEV5c3DgMlKDlLdmR8' },
  { slug: 'custody',     name: 'Custody',                 group: 'Product',         id: '1OnbABZP7bIefph4aBmhAG4DdCV5wtdZhwvuaTRqpAy8' },
  { slug: 'executive',   name: 'Executive Office',        group: 'Executive',       id: '1hviaLL2MrlMO2em1lYOUIjDSV4ZYLGpZeD9Sb753blM' },
  { slug: 'finance',     name: 'Finance',                 group: 'Shared Services', id: '1arzyTBTamNJGQH_MQmN-hBu7w30ST67qhMgmULZA4bY' },
  { slug: 'infosec-it',  name: 'Information Sec & Tech',  group: 'Shared Services', id: '1kRxXRHLu5AvhYyNp5f_MGRSh-jP_AgaLObiWWiNbM7w' },
  { slug: 'legal',       name: 'Legal',                   group: 'Shared Services', id: '1GROlO1_c8C1h4S9aUFD1-w4xGbviLvTjlhrPFPpI1iA' },
  { slug: 'marketing',   name: 'Marketing',               group: 'Platform',        id: '1Vax1fnsHvulaQUnRmREXPQ_CzjTD4tsMHcx6BbiWtBU' },
  { slug: 'people-ops',  name: 'People Operations',       group: 'Shared Services', id: '1-2i1F-07flKcS8NGjrvnpOBBKGjL_aVcQpqSXEd8zL8' },
  { slug: 'peg-devrel',  name: 'Platform Engineering',    group: 'Platform',        id: '1xZrQnAndMynbj3i-GU4b4dgbC46eA2SatnxdmHtJs_k' },
  { slug: 'shared-eng',  name: 'Shared - Engineering',    group: 'Shared Services', id: '19O9zZGODlFylGjH9bpy_woRRuCT79BMf44MwuW2xmcg' },
  { slug: 'talent',      name: 'Talent',                  group: 'Shared Services', id: '1r3IkcBj2qRs-0LI4a716C6RtNzLmVPbpfvoqtd0E3Vc' }
];

/**
 * Tabs are found by the year ('2026', '2027', ...). Departments that name their
 * tab something else need an entry here, keyed by year then slug.
 */
var TAB_OVERRIDES = {
  '2027': { 'bd-eg': '2027 Proposed' }
};

function tabFor(year, slug) {
  var byYear = TAB_OVERRIDES[year] || {};
  return byYear[slug] || year;
}

function doGet(e) {
  var token = PropertiesService.getScriptProperties().getProperty('TOKEN');
  if (!token || !e || !e.parameter || e.parameter.token !== token) {
    return json_({ error: 'Unauthorized' });
  }

  var year = String((e.parameter.year || '2026')).trim();
  if (!/^\d{4}$/.test(year)) return json_({ error: 'Bad year' });

  var only = (e.parameter.dept || '').trim();
  var list = only ? DEPARTMENTS.filter(function (d) { return d.slug === only; }) : DEPARTMENTS;
  if (!list.length) return json_({ error: 'Unknown department' });

  return json_({ year: year, departments: readAll_(list, year) });
}

/**
 * Reads every department in parallel through the Sheets API. UrlFetchApp.fetchAll
 * issues the requests at once, which is far faster than opening each workbook in
 * turn. Falls back to SpreadsheetApp for any department the API call misses.
 */
function readAll_(list, year) {
  var oauth = ScriptApp.getOAuthToken();
  var requests = [];
  list.forEach(function (d) {
    var range = encodeURIComponent("'" + tabFor(year, d.slug).replace(/'/g, "''") + "'!" + RANGE);
    ['UNFORMATTED_VALUE', 'FORMATTED_VALUE'].forEach(function (render) {
      requests.push({
        url: 'https://sheets.googleapis.com/v4/spreadsheets/' + d.id + '/values/' + range +
             '?valueRenderOption=' + render + '&dateTimeRenderOption=SERIAL_NUMBER',
        headers: { Authorization: 'Bearer ' + oauth },
        muteHttpExceptions: true
      });
    });
  });

  var responses = [];
  try {
    responses = UrlFetchApp.fetchAll(requests);
  } catch (err) {
    responses = [];
  }

  return list.map(function (d, i) {
    var out = { slug: d.slug, name: d.name, group: d.group, tab: tabFor(year, d.slug), id: d.id };
    var rawRes = responses[i * 2];
    var fmtRes = responses[i * 2 + 1];

    if (rawRes && fmtRes && rawRes.getResponseCode() === 200 && fmtRes.getResponseCode() === 200) {
      out.raw = trim_(JSON.parse(rawRes.getContentText()).values || []);
      out.fmt = trim_(JSON.parse(fmtRes.getContentText()).values || []);
      return out;
    }

    // The usual reason for a 400 here is that the year's tab does not exist yet.
    var code = rawRes ? rawRes.getResponseCode() : 0;
    if (code === 400) {
      out.error = 'No "' + out.tab + '" tab in this workbook yet';
      return out;
    }

    try {
      var sheet = SpreadsheetApp.openById(d.id).getSheetByName(out.tab);
      if (!sheet) {
        out.error = 'No "' + out.tab + '" tab in this workbook yet';
        return out;
      }
      var range = sheet.getRange(1, 1, Math.min(150, sheet.getMaxRows()), 16);
      out.raw = trim_(range.getValues().map(function (row) { return row.map(serial_); }));
      out.fmt = trim_(range.getDisplayValues());
    } catch (err) {
      out.error = String(err && err.message ? err.message : err);
    }
    return out;
  });
}

// Drops trailing blank rows so the response stays small.
function trim_(rows) {
  var last = -1;
  for (var r = 0; r < rows.length; r++) {
    var row = rows[r] || [];
    for (var c = 0; c < row.length; c++) {
      if (row[c] !== '' && row[c] !== null && row[c] !== undefined) { last = r; break; }
    }
  }
  return rows.slice(0, last + 1);
}

// Dates come back as Date objects from SpreadsheetApp; the dashboard expects serial numbers.
function serial_(v) {
  if (v instanceof Date) {
    return Math.round((Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()) - Date.UTC(1899, 11, 30)) / 86400000);
  }
  return v;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
