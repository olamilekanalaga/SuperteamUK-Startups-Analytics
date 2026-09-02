import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const snapshot = JSON.parse(await readFile(new URL("../src/data.json", import.meta.url), "utf8"));
const startups = snapshot.queries.researched_startups.rows;

test("canonical research contains STUK-001 through STUK-013", () => {
  assert.deepEqual(startups.map(({ id }) => id),
    Array.from({ length: 13 }, (_, index) => `STUK-${String(index + 1).padStart(3, "0")}`));
});

test("dashboard totals derive from the canonical records", () => {
  const summary = snapshot.queries.research_summary.rows[0];
  assert.equal(summary.directoryStartups, 66);
  assert.equal(startups.length, 13);
  assert.equal(startups.filter(({ queue }) => queue === "Queue A").length, 9);
  assert.equal(startups.filter(({ queue }) => queue === "Mainnet queue").length, 4);
  assert.equal(Number(((startups.length / summary.directoryStartups) * 100).toFixed(1)), 19.7);
});

test("only the approved startups are in the mainnet queue", () => {
  assert.deepEqual(startups.filter(({ queue }) => queue === "Mainnet queue").map(({ startup }) => startup),
    ["Fanplay", "Fundl", "Purebet", "AgriDex"]);
});

test("new records have unique public profile slugs and complete profile sections", () => {
  const added = startups.filter(({ id }) => Number(id.slice(-3)) >= 9);
  const slugs = added.map(({ startup }) => startup.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
  assert.equal(new Set(slugs).size, 5);
  for (const startup of added) {
    assert.ok(startup.technicalState);
    assert.ok(Array.isArray(startup.technicalEntryPoints));
    assert.ok(Array.isArray(startup.completedAnalysis));
    assert.ok(Array.isArray(startup.outstandingAnalysis));
    assert.ok(Array.isArray(startup.metrics));
  }
});