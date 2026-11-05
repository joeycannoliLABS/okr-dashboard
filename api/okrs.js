// GET /api/okrs
// Fetches the OKR tab from the Apps Script web app attached to the sheet and returns clean JSON.
// No npm dependencies (Node 18+ provides fetch).
//
// Environment variables (Vercel > Project > Settings > Environment Variables):
//   APPS_SCRIPT_URL     the web app URL ending in /exec
//   APPS_SCRIPT_TOKEN   the same secret you stored as the TOKEN script property

const { parseSheet } = require("../lib/parse");

module.exports = async (req, res) => {
  try {
    const url = process.env.APPS_SCRIPT_URL;
    const token = process.env.APPS_SCRIPT_TOKEN;
    if (!url || !token) throw new Error("Missing APPS_SCRIPT_URL or APPS_SCRIPT_TOKEN");

    const upstream = await fetch(`${url}?token=${encodeURIComponent(token)}`, { redirect: "follow" });
    const text = await upstream.text();

    let body;
    try {
      body = JSON.parse(text);
    } catch (e) {
      throw new Error("The Apps Script URL did not return JSON. Check that the web app is deployed with access set to Anyone.");
    }
    if (body.error) throw new Error(`Apps Script: ${body.error}`);

    const data = parseSheet(body.raw || [], body.fmt || []);
    data.tab = body.tab;
    data.updatedAt = new Date().toISOString();

    // Edge cache: fresh for 30 seconds, then served stale while it refreshes in the background.
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=120");
    res.status(200).json(data);
  } catch (err) {
    res.setHeader("Cache-Control", "no-store");
    res.status(500).json({ error: err.message });
  }
};
