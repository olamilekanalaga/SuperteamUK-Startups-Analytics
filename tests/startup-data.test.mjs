import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const snapshot = JSON.parse(await readFile(new URL("src/data.json", root), "utf8"));
const source = await readFile(new URL("src/content/dashboard/DashboardContent.jsx", root), "utf8");
const css = await readFile(new URL("src/content/dashboard/dashboard.css", root), "utf8");
const theme = await readFile(new URL("src/theme.css", root), "utf8");
const vercel = JSON.parse(await readFile(new URL("vercel.json", root), "utf8"));
const startups = snapshot.queries.researched_startups.rows;
const mainnet = startups.filter((row) => row.queue === "Mainnet Analysis Queue");
const slug = (row) => (row.displayAlias ? `${row.startup}-${row.displayAlias}` : row.currentBrand ? `${row.startup}-${row.currentBrand}` : row.startup)
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const logoKeys = new Set(["logo", "logoPath", "logoSource", "logoSourceUrl", "logoSourceType", "logoVerificationStatus", "logoAuditCategory", "logoAuditSources"]);
const canonicalRows = startups.slice(0, 43).map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => !logoKeys.has(key))));

// Fingerprint of every canonical field before this logo/UI correction.
test("existing STUK-001 through STUK-043 remain byte-stable outside logo metadata", () => {
  const fingerprint = createHash("sha256").update(JSON.stringify(canonicalRows)).digest("hex");
  assert.equal(fingerprint, "e46161e2bb28d899cc52002afdbceec58adacdf0ba4be59553173b2470fc6e81");
  assert.deepEqual(startups.map((row) => row.id), Array.from({ length: 66 }, (_, i) => `STUK-${String(i + 1).padStart(3, "0")}`));
  assert.equal(new Set(startups.map(slug)).size, 66);
});

test("derived totals are 66 researched, 33 mainnet, 33 non-mainnet, 0 remaining and 100 percent", () => {
  const summary = snapshot.queries.research_summary.rows[0];
  assert.equal(summary.directoryStartups, 66);
  assert.equal(startups.length, 66);
  assert.equal(mainnet.length, 33);
  assert.equal(startups.length - mainnet.length, 33);
  assert.equal(66 - startups.length, 0);
  assert.equal(Number(((startups.length / 66) * 100).toFixed(1)), 100);
  assert.deepEqual(summary, { directoryStartups: 66, researched: 66, nonMainnet: 33, mainnetQueue: 33, completionRate: 1 });
});

test("pathname is the source of truth for overview, directory, insights, profiles, invalid slugs, and history", () => {
  for (const route of ['pathname === "/"', 'pathname === "/startups"', 'pathname === "/insights"', "profileSlugFromPath(pathname)"]) assert.ok(source.includes(route), route);
  assert.match(source, /useState\(currentPathname\)/u);
  assert.match(source, /routeFromPathname\(pathname, startups\)/u);
  assert.match(source, /addEventListener\("popstate"/u);
  assert.match(source, /history\.pushState/u);
  assert.match(source, /route\.notFound[\s\S]*Startup profile unavailable/u);
  for (const startup of startups) assert.ok(slug(startup));
});

test("Vercel rewrites extensionless SPA routes while leaving asset paths alone", () => {
  assert.deepEqual(vercel.rewrites, [
    { source: "/_data/:path*", destination: "/index.html" },
    { source: "/((?!.*\\.).*)", destination: "/index.html" },
  ]);
});

test("every verified logo is local and resolvable; every fallback is documented", async () => {
  const allowed = new Set(["authenticated-logo", "authenticated-app-icon", "authenticated-favicon", "monogram-identity-unresolved", "monogram-no-downloadable-asset"]);
  for (const startup of startups) {
    assert.ok(allowed.has(startup.logoAuditCategory), `${startup.id} category`);
    assert.equal(startup.logoVerificationStatus, startup.logoAuditCategory);
    assert.ok(Array.isArray(startup.logoAuditSources) && startup.logoAuditSources.length > 0, `${startup.id} audit sources`);
    if (startup.logoPath) {
      assert.match(startup.logoPath, /^\/brands\/startups\/[a-z0-9.-]+$/u);
      assert.equal(startup.logo, startup.logoPath);
      assert.match(startup.logoSource, /^https:\/\//u);
      await access(new URL(`public${startup.logoPath}`, root));
    } else {
      assert.match(startup.logoAuditCategory, /^monogram-/u);
      assert.equal(startup.logo, null);
      assert.equal(startup.logoSource, null);
    }
  }
});

test("unresolved identities never receive unrelated images", () => {
  for (const name of ["PrimeSkill", "Joyplay Ltd", "Quantum Street", "Yauga", "Pangea"]) {
    const startup = startups.find((row) => row.startup === name);
    assert.ok(startup, name);
    assert.equal(startup.logoPath, null, name);
    assert.equal(startup.logoAuditCategory, "monogram-identity-unresolved", name);
  }
  assert.equal(startups.find((row) => row.startup === "Nexus AI").logoAuditCategory, "monogram-identity-unresolved");
});

test("the common logo component has meaningful alt text, lazy list loading, and finite monogram fallback", () => {
  assert.match(source, /function ProjectLogo/u);
  assert.match(source, /alt=\{`\$\{startup\.startup\} logo`\}/u);
  assert.match(source, /loading=\{profile \? "eager" : "lazy"\}/u);
  assert.match(source, /onError=\{\(\) => setFailed\(true\)\}/u);
  assert.match(source, /showImage = startup\.logoPath && !failed/u);
});

test("directory cards are full-link horizontal cards with clamped summaries and contained tags", () => {
  const card = source.slice(source.indexOf("function StartupCard"), source.indexOf("function EvidenceLedger"));
  assert.match(card, /<a className=\{`startup-card/u);
  assert.match(card, /href=\{startupPath\(startup\)\}/u);
  assert.match(card, /startup-card__description/u);
  assert.match(card, /startup-card__tags/u);
  assert.doesNotMatch(card, /View profile|startup\.id|founder|canonicalFinding|technicalStatus|SourceLinks/u);
  assert.doesNotMatch(css, /\.startup-card[^{}]*\{[^}]*aspect-ratio/su);
  assert.match(css, /\.startup-card__description[\s\S]*-webkit-line-clamp:\s*3/u);
  assert.match(css, /\.startup-card__tags\s*\{[^}]*flex-wrap:\s*wrap/su);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*\.startup-list \{ grid-template-columns: minmax\(0, 1fr\)/u);
});

test("semantic startup-card tokens and classification strips cover every requested state", () => {
  for (const token of ["--startup-card-background", "--startup-card-border", "--startup-card-shadow", "--startup-card-shadow-hover", "--startup-card-title", "--startup-card-description", "--startup-card-tag-background", "--startup-card-tag-border", "--startup-card-focus-ring"]) assert.ok(theme.includes(token), token);
  for (const tone of ["mainnet", "historical", "devnet", "testnet", "offchain", "prelaunch", "sunset", "acquired", "unverified"]) assert.ok(css.includes(`startup-card--${tone}`), tone);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/u);
});

test("overview keeps its 2x2 mobile metric grid and Power BI elevation tokens", () => {
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*\.metric-strip \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/u);
  assert.match(css, /\.metric-strip > \*[^{}]*\{[^}]*box-shadow:\s*var\(--card-shadow\)/su);
  assert.match(theme, /--card-shadow:/u);
  assert.match(theme, /--card-shadow-hover:/u);
});

test("shared cards remain independent of all six theme implementations", async () => {
  assert.match(source, /useDataApp\(\)/u);
  assert.doesNotMatch(source, /data-app-theme|setAttribute\([^)]*theme/iu);
  assert.equal((await readFile(new URL("src/theme-presets.js", root), "utf8")).match(/\{ id:/gu)?.length, 6);
});

test("STUK-044 through STUK-053 use the existing schema with canonical classifications", () => {
  const expected = [
    ["STUK-044", "cherry.fun", "Mainnet", "Mainnet Analysis Queue"],
    ["STUK-045", "Lissen", "Off-chain", "Non-Mainnet Research"],
    ["STUK-046", "Vanish", "Mainnet", "Mainnet Analysis Queue"],
    ["STUK-047", "Alpha FC", "Pre-launch", "Non-Mainnet Research"],
    ["STUK-048", "Darklake", "Historical mainnet", "Mainnet Analysis Queue"],
    ["STUK-049", "Seer", "Off-chain/tooling", "Non-Mainnet Research"],
    ["STUK-050", "FairScale", "Mainnet", "Mainnet Analysis Queue"],
    ["STUK-051", "Xeno Money", "Mainnet", "Mainnet Analysis Queue"],
    ["STUK-052", "Pangea", "Unverified", "Non-Mainnet Research"],
    ["STUK-053", "Altify", "Mainnet/custodial", "Mainnet Analysis Queue"],
  ];
  assert.deepEqual(startups.slice(43, 53).map((row) => [row.id, row.startup, row.classification, row.queue]), expected);
  for (const row of startups.slice(43, 53)) {
    assert.equal(row.lastReviewed, "2026-09-02");
    assert.ok(row.sources.length > 0, row.id);
    for (const key of ["technicalEntryPoints", "completedAnalysis", "outstandingAnalysis", "verifiedMetrics", "projectReportedMetrics", "dataQualityNotes", "sources"]) assert.ok(Array.isArray(row[key]), `${row.id} ${key}`);
  }
});

test("only the six canonical additions enter the mainnet queue", () => {
  assert.deepEqual(startups.slice(43, 53).filter((row) => row.queue === "Mainnet Analysis Queue").map((row) => row.startup), ["cherry.fun", "Vanish", "Darklake", "FairScale", "Xeno Money", "Altify"]);
});

test("project claims, token cautions, and attribution boundaries remain explicit", () => {
  const lissen = startups.find((row) => row.id === "STUK-045");
  assert.deepEqual(lissen.projectReportedMetrics.map((metric) => metric.value), ["12M+", "80M+", "15K+"]);
  lissen.projectReportedMetrics.forEach((metric) => { assert.match(metric.qualifier, /Project-reported/u); assert.match(metric.sourceUrl, /^https:\/\//u); });
  const darklake = startups.find((row) => row.id === "STUK-048");
  assert.equal(darklake.projectReportedMetrics[0].value, "USD $1.2 million");
  assert.match(darklake.projectReportedMetrics[0].qualifier, /Reported by acquirer/u);
  assert.match(startups.find((row) => row.id === "STUK-050").dataQualityNotes.join(" "), /Do not add.*\$FAIR mint/u);
  assert.match(startups.find((row) => row.id === "STUK-051").dataQualityNotes.join(" "), /no XENO token/u);
  assert.match(startups.find((row) => row.id === "STUK-049").dataQualityNotes.join(" "), /Do not count transactions inspected/u);
  assert.match(startups.find((row) => row.id === "STUK-053").dataQualityNotes.join(" "), /Do not claim customer activity/u);
});

test("new records have unique names/slugs and route through the existing profile system", () => {
  assert.equal(new Set(startups.map((row) => row.startup.toLowerCase())).size, 66);
  assert.equal(new Set(startups.map(slug)).size, 66);
  assert.deepEqual(startups.slice(43, 53).map(slug), ["cherry-fun", "lissen", "vanish", "alpha-fc", "darklake", "seer", "fairscale", "xeno-money", "pangea", "altify"]);
  assert.match(source, /startupPath = \(startup\) => "\/startups\/" \+ startupSlug\(startup\)/u);
});

test("STUK-054 through STUK-066 form the final additive canonical batch", () => {
  const expected = [
    ["STUK-054", "Yield OS", "Mainnet Analysis Queue"],
    ["STUK-055", "Tramplin.io", "Mainnet Analysis Queue"],
    ["STUK-056", "DegenDome", "Mainnet Analysis Queue"],
    ["STUK-057", "Cluck Rush", "Non-Mainnet Research"],
    ["STUK-058", "Soilonic", "Mainnet Analysis Queue"],
    ["STUK-059", "Coldstar", "Non-Mainnet Research"],
    ["STUK-060", "Fitter Circle", "Non-Mainnet Research"],
    ["STUK-061", "Nexus AI", "Non-Mainnet Research"],
    ["STUK-062", "Percolator", "Non-Mainnet Research"],
    ["STUK-063", "Prob Trade", "Mainnet Analysis Queue"],
    ["STUK-064", "MeetSend", "Non-Mainnet Research"],
    ["STUK-065", "Parasol", "Mainnet Analysis Queue"],
    ["STUK-066", "Bonfires.ai", "Mainnet Analysis Queue"],
  ];
  assert.deepEqual(startups.slice(53).map((row) => [row.id, row.startup, row.queue]), expected);
});

test("final batch preserves evidence boundaries and devnet separation", () => {
  assert.equal(startups.find((row) => row.id === "STUK-062").technicalState, "Devnet/testnet");
  assert.equal(startups.find((row) => row.id === "STUK-062").technicalEntryPoints[0].network, "Solana Devnet");
  assert.match(startups.find((row) => row.id === "STUK-054").technicalStatus, /Project-claimed/);
  assert.match(startups.find((row) => row.id === "STUK-058").dataQualityNotes.join(" "), /no mint is canonical/i);
  assert.match(startups.find((row) => row.id === "STUK-066").dataQualityNotes.join(" "), /not proof/i);
  for (const row of startups.slice(53)) {
    assert.equal(row.lastReviewed, "2026-09-02");
    for (const key of ["technicalEntryPoints", "completedAnalysis", "outstandingAnalysis", "verifiedMetrics", "projectReportedMetrics", "dataQualityNotes", "sources"]) assert.ok(Array.isArray(row[key]), row.id + " " + key);
  }
});

test("final batch logos are local or have a documented monogram decision", async () => {
  for (const row of startups.slice(53)) {
    assert.ok(row.logoAuditSources.length > 0, row.id);
    if (row.logoPath) await access(new URL("public" + row.logoPath, root));
    else assert.match(row.logoAuditCategory, /^monogram-/);
  }
  assert.equal(startups.find((row) => row.id === "STUK-061").logoAuditCategory, "monogram-identity-unresolved");
});
