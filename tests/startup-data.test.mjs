import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const snapshot=JSON.parse(await readFile(new URL("../src/data.json",import.meta.url),"utf8"));
const source=await readFile(new URL("../src/content/dashboard/DashboardContent.jsx",import.meta.url),"utf8");
const css=await readFile(new URL("../src/content/dashboard/dashboard.css",import.meta.url),"utf8");
const awaitTheme=await readFile(new URL("../src/theme.css",import.meta.url),"utf8");
const startups=snapshot.queries.researched_startups.rows,mainnet=startups.filter(r=>r.queue==="Mainnet Analysis Queue");
const slug=r=>(r.displayAlias?r.startup+"-"+r.displayAlias:r.currentBrand?r.startup+"-"+r.currentBrand:r.startup).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");
test("canonical research contains STUK-001 through STUK-043",()=>assert.deepEqual(startups.map(r=>r.id),Array.from({length:43},(_,i)=>"STUK-"+String(i+1).padStart(3,"0"))));
test("derived totals are 43 researched, 23 remaining, 65.2%, and 20/23 split",()=>{const q=snapshot.queries.research_summary.rows[0];assert.equal(q.directoryStartups,66);assert.equal(startups.length,43);assert.equal(66-startups.length,23);assert.equal(Number(((startups.length/66)*100).toFixed(1)),65.2);assert.equal(mainnet.length,20);assert.equal(startups.length-mainnet.length,23)});
test("exact mainnet list is prior 14 plus six approved records and excludes Altify",()=>assert.deepEqual(mainnet.map(r=>r.startup),["Fanplay","Fundl","Purebet","AgriDex","Makina Finance","HawkFi","Zynta","Agant","BananaZone","Saga Monkes","Pyra","dWallet Labs","LivingIP","Poll.fun","Reflect","Rise of the Gorecats","Legion","ReFi Hub","Raiku","Otus"]));
test("IDs and public profile slugs are unique",()=>{assert.equal(new Set(startups.map(r=>r.id)).size,43);assert.equal(new Set(startups.map(slug)).size,43)});
test("all 43 records map cards to dedicated routes and complete profiles",()=>{for(const r of startups){assert.ok(r.monogram);assert.ok(slug(r));for(const k of ["technicalEntryPoints","completedAnalysis","outstandingAnalysis","verifiedMetrics","projectReportedMetrics","dataQualityNotes","sources"])assert.ok(Array.isArray(r[k]),r.id+" "+k)}assert.match(source,/startupPath = \(startup\) => "\/startups\/" \+ startupSlug\(startup\)/);assert.match(source,/onSelect=\{openStartup\}/)});
test("list and selected profile are mutually exclusive",()=>assert.match(source,/selected\s*\?\s*<StartupDetail[\s\S]*?:\s*<section className="startup-directory"/));
test("routes, safe links and fallback logos are implemented",()=>{assert.match(source,/history\.pushState/);assert.match(source,/addEventListener\("popstate"/);assert.match(source,/onError=\{\(\) => setFailed\(true\)\}/);assert.match(source,/target="_blank" rel="noopener noreferrer"/)});
test("testnet is never classified as mainnet",()=>{for(const r of mainnet)assert.doesNotMatch(r.technicalState,/testnet|devnet/i);assert.equal(startups.find(r=>r.id==="STUK-039").queue,"Non-Mainnet Research")});
test("project claims are labelled and unknowns are not encoded as zero",()=>{for(const r of startups)for(const m of r.projectReportedMetrics)assert.match(m.qualifier,/reported|claim/i,r.id);assert.equal(JSON.stringify(startups).includes('"value": 0'),false)});
test("Yauga remains unresolved and has no logo asset",()=>{const y=startups.find(r=>r.id==="STUK-042");assert.equal(y.classification,"Identity Verification Required");assert.equal(y.logoPath,null);assert.equal(y.sources.length,0);assert.equal(y.founder,"Not verified")});
test("six-theme infrastructure parity and mobile two-column metrics/startups are preserved",()=>{assert.match(source,/useDataApp\(\)/);assert.match(css,/\.metric-strip \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);assert.match(css,/\.startup-list \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);assert.doesNotMatch(source,/theme/i)});
test("mobile layout contains overflow safeguards",()=>{assert.match(css,/min-width: 0/);assert.match(css,/overflow-wrap: anywhere/);assert.match(css,/@media \(max-width: 720px\)/)});


test("compact directory cards use one shared route-aware component", () => {
  assert.match(source, /function StartupCard\(\{ startup, onSelect \}\)/);
  assert.match(source, /href=\{startupPath\(startup\)\}/);
  assert.match(source, /onKeyDown=\{handleKeyDown\}/);
  assert.match(source, /startup-card__identity/);
  assert.match(source, /startup-card__action/);
});

test("compact cards exclude long research content while profiles retain it", () => {
  const cardBlock = source.slice(source.indexOf("function StartupCard"), source.indexOf("function EvidenceLedger"));
  assert.doesNotMatch(cardBlock, /summary \?\?|oneLine|whatItBuilds|canonicalFinding|technicalStatus|directoryStage|founder/);
  const profileBlock = source.slice(source.indexOf("function StartupDetail"), source.indexOf("const internalResearchPipeline"));
  assert.match(profileBlock, /whatItBuilds/);
  assert.match(profileBlock, /canonicalFinding/);
  assert.doesNotMatch(cardBlock, /startup\.id|STUK-/);
});

test("compact status mappings cover public classifications", () => {
  for (const label of ["Mainnet","Historical","Devnet","Testnet","Off-chain","Infrastructure","Pre-launch","Wound down","Acquired","Unverified"]) {
    assert.ok(source.includes('label: "' + label + '"'), label);
  }
});

test("cards use semantic theme tokens, square geometry and reduced-motion support", () => {
  for (const token of ["--card-background","--card-border","--card-shadow","--card-shadow-hover","--card-text","--card-muted-text","--card-focus-ring"]) assert.ok(awaitTheme.includes(token), token);
  assert.match(css, /\.startup-card[\s\S]*aspect-ratio: 1 \/ 1/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\.startup-card:focus-visible/);
});
