import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildStartupMeasurementStatus, MEASUREMENT_READINESS } from "../analytics/measurement/startup-contract.js";
import { attributionState, canonicalStartupStage } from "../src/content/dashboard/startup-stage.js";
const root=new URL("../",import.meta.url);
const data=JSON.parse(await readFile(new URL("src/data.json",root),"utf8"));
const startups=data.queries.researched_startups.rows;
const contractFor=(name)=>{const startup=startups.find((row)=>row.startup===name);return buildStartupMeasurementStatus(startup,{stage:canonicalStartupStage(startup),attributionState:attributionState(startup)});};
test("measurement status applies dynamically to all and only canonical Mainnet startups",()=>{
  const contracts=startups.map((startup)=>buildStartupMeasurementStatus(startup,{stage:canonicalStartupStage(startup),attributionState:attributionState(startup)})).filter(Boolean);
  assert.equal(contracts.length,32);
  assert.equal(buildStartupMeasurementStatus(startups.find((row)=>row.startup==="END Corp"),{stage:"DEVNET",attributionState:"verified"}),null);
});
test("Purebet is partial, fully measurable, source-ready, and empty of live values",()=>{
  const contract=contractFor("Purebet");
  assert.equal(contract.attributionState,"partial");
  assert.equal(contract.readiness,MEASUREMENT_READINESS.FULLY);
  assert.deepEqual(contract.sources.map(({label})=>label),["Current program","Legacy program","Legacy program-data account"]);
  assert.deepEqual(contract.metrics.map(({label})=>label),["Users","Transactions","Betting volume","Retention","Concentration"]);
  assert.ok(contract.metrics.every((metric)=>metric.value===null&&metric.status==="awaiting_live_data"));
  assert.equal(contract.liveValuesConnected,false);
});
test("HawkFi is verified and partially measurable with its three confirmed sources",()=>{
  const contract=contractFor("HawkFi");
  assert.equal(contract.attributionState,"verified");
  assert.equal(contract.readiness,MEASUREMENT_READINESS.PARTIAL);
  assert.deepEqual(contract.sources.map(({label})=>label),["HawkFi Program","HAWK automation / fee signer","HawkFi fee wallet"]);
  assert.equal(contract.sources[0].confirmed,true);
  assert.equal(contract.sources.filter((source)=>source.confirmed).length,1);
  assert.ok(contract.metrics.every((metric)=>metric.value===null));
});
test("AgriDex remains blocked on attribution without fabricated identifiers or values",()=>{
  const contract=contractFor("AgriDex");
  assert.equal(contract.attributionState,"awaiting_attribution");
  assert.equal(contract.readiness,MEASUREMENT_READINESS.NONE);
  assert.deepEqual(contract.sources,[]);
  assert.equal(contract.sourceEmptyMessage,"Attribution required");
  assert.ok(contract.metrics.every((metric)=>metric.value===null&&metric.status==="attribution_required"));
});
test("public frontend keeps measurement machinery internal while exposing evidence-safe public performance",async()=>{
  const source=await readFile(new URL("src/content/dashboard/DashboardContent.jsx",root),"utf8");
  assert.match(source,/function MeasurementStatus\(\{ startup, contract \}\)/u);
  assert.doesNotMatch(source,/<MeasurementStatus startup=\{startup\}/u);
  assert.match(source,/const performanceMetricsFor/u);
  assert.match(source,/metric\?\.value \?\? "—"/u);
  assert.doesNotMatch(source,/92\.6|2026-01-24T23:30/u);
});
test("directory and startup intelligence routes have distinct public hierarchy",async()=>{
  const source=await readFile(new URL("src/content/dashboard/DashboardContent.jsx",root),"utf8");
  assert.match(source,/function DirectoryHome/u);
  assert.match(source,/Industry contribution/u);
  assert.match(source,/Startup directory/u);
  const detail=source.slice(source.indexOf("function StartupDetail"),source.indexOf("const internalResearchPipeline"));
  assert.doesNotMatch(detail,/DirectoryControls|IndustryContribution/u);
  assert.match(detail,/profile-hero/u);
  assert.match(detail,/profile-metric-grid/u);
  assert.match(detail,/Performance over time/u);
  assert.match(detail,/ResearchDetails/u);
  assert.match(detail,/Back to Startup Directory/u);
});
test("ecosystem impact route uses verified counts and empty-safe flywheel metrics",async()=>{
  const source=await readFile(new URL("src/content/dashboard/DashboardContent.jsx",root),"utf8");
  assert.match(source,/pathname === "\/startups\/impact"/u);
  assert.match(source,/How Superteam UK contributes to Solana/u);
  assert.match(source,/Builders.*Apps.*Economic activity.*Revenue.*More builders/su);
  assert.match(source,/Monthly active developers/u);
  assert.match(source,/90-day developer retention/u);
  assert.match(source,/Devnet → Mainnet launches/u);
  assert.match(source,/value="—" detail="No compatible revenue total"/u);
  assert.match(source,/value="—" detail="Comparable funding total unavailable"/u);
  assert.doesNotMatch(source,/\$690K|\$18\.4M|\b124 monthly active developers\b|\b61%\b/u);
});
