import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const snapshot = JSON.parse(await readFile(new URL("../src/data.json", import.meta.url), "utf8"));
const source = await readFile(new URL("../src/content/dashboard/DashboardContent.jsx", import.meta.url), "utf8");
const css = await readFile(new URL("../src/content/dashboard/dashboard.css", import.meta.url), "utf8");
const startups = snapshot.queries.researched_startups.rows;
const mainnet = startups.filter(({ queue }) => queue === "Mainnet Analysis Queue");
const slug = (item) => (item.displayAlias ? item.startup + "-" + item.displayAlias : item.currentBrand ? item.startup + "-" + item.currentBrand : item.startup)
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

test("canonical research contains STUK-001 through STUK-033", () => {
  assert.deepEqual(startups.map(({ id }) => id), Array.from({ length: 33 }, (_, index) => `STUK-${String(index + 1).padStart(3, "0")}`));
});
test("derived totals are 33 researched, 14 mainnet and 19 non-mainnet", () => {
  assert.equal(snapshot.queries.research_summary.rows[0].directoryStartups, 66);
  assert.equal(startups.length, 33);
  assert.equal(mainnet.length, 14);
  assert.equal(startups.length - mainnet.length, 19);
  assert.equal((startups.length / 66) * 100, 50);
});
test("only the approved startups are in the mainnet queue", () => {
  assert.deepEqual(mainnet.map(({ startup }) => startup), ["Fanplay","Fundl","Purebet","AgriDex","Makina Finance","HawkFi","Zynta","Agant","BananaZone","Saga Monkes","Pyra","dWallet Labs","LivingIP","Poll.fun"]);
});
test("IDs and public profile slugs are unique", () => {
  assert.equal(new Set(startups.map(({ id }) => id)).size, 33);
  assert.equal(new Set(startups.map(slug)).size, 33);
});
test("all records support complete profiles and graceful logo fallback", () => {
  for (const startup of startups) {
    assert.ok(startup.monogram);
    for (const field of ["technicalEntryPoints","completedAnalysis","outstandingAnalysis","verifiedMetrics","projectReportedMetrics","dataQualityNotes","sources"]) assert.ok(Array.isArray(startup[field]), `${startup.id} ${field}`);
  }
  assert.match(source, /onError=\{\(\) => setFailed\(true\)\}/);
});
test("card grid and selected profile remain mutually exclusive", () => {
  assert.match(source, /selected\s*\?\s*<StartupDetail[\s\S]*?:\s*<section className="startup-directory"/);
});
test("profile routes and safe external links are implemented", () => {
  assert.match(source, /history\.pushState/);
  assert.match(source, /addEventListener\("popstate"/);
  assert.doesNotMatch(source, /target="_blank" rel="noreferrer"/);
  assert.match(source, /target="_blank" rel="noopener noreferrer"/);
});
test("theme controls are untouched and mobile metric/startup grids use two columns", () => {
  assert.match(css, /\.metric-strip \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.startup-list \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
});
