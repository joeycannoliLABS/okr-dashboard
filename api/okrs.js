// GET /api/okrs?year=2026
// Fetches every department's OKR tab from the Apps Script attached to the sheets,
// parses it, and returns compact JSON for the dashboard.
//
// Environment variables (Vercel > Project > Settings > Environment Variables):
//   APPS_SCRIPT_URL     the web app URL ending in /exec
//   APPS_SCRIPT_TOKEN   the same secret stored as the TOKEN script property

const { parseSheet } = require("../lib/parse");

module.exports = async (req, res) => {
  try {
    const url = process.env.APPS_SCRIPT_URL;
    const token = process.env.APPS_SCRIPT_TOKEN;
    if (!url || !token) throw new Error("Missing APPS_SCRIPT_URL or APPS_SCRIPT_TOKEN");

    const yearParam = new URL(req.url, "http://localhost").searchParams.get("year") || "2026";
    const year = /^\d{4}$/.test(yearParam) ? yearParam : "2026";

    const upstream = await fetch(
      `${url}?token=${encodeURIComponent(token)}&year=${year}`,
      { redirect: "follow" }
    );
    const text = await upstream.text();

    let body;
    try {
      body = JSON.parse(text);
    } catch (e) {
      throw new Error("The Apps Script URL did not return JSON. Check that the web app is deployed with access set to Anyone.");
    }
    if (body.error) throw new Error(`Apps Script: ${body.error}`);

    const departments = (body.departments || []).map((d) => {
      const base = { slug: d.slug, name: d.name, group: d.group, tab: d.tab, sheetUrl: `https://docs.google.com/spreadsheets/d/${d.id}/edit` };
      if (d.error || !d.raw) return { ...base, error: d.error || "No data returned", objectives: [] };
      const parsed = parseSheet(d.raw, d.fmt || []);
      return { ...base, unit: parsed.unit, cycle: parsed.cycle, overall: parsed.overall, objectives: parsed.objectives };
    });

    // Edge cache: fresh for 60 seconds, then served stale while it refreshes in the background.
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=600");
    res.status(200).json({ year, departments, updatedAt: new Date().toISOString() });
  } catch (err) {
    res.setHeader("Cache-Control", "no-store");
    res.status(500).json({ error: err.message });
  }
};
