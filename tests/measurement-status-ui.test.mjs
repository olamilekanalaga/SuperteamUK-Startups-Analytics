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
  assert.equal(contracts.length,30);
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
test("frontend integration reuses one component and does not expose fetched sample data",async()=>{
  const source=await readFile(new URL("src/content/dashboard/DashboardContent.jsx",root),"utf8");
  assert.match(source,/function MeasurementStatus\(\{ startup, contract \}\)/u);
  assert.match(source,/<MeasurementStatus startup=\{startup\} contract=\{contract\} \/>/u);
  assert.doesNotMatch(source,/92\.6|2026-01-24T23:30/u);
  assert.match(source,/No live pipeline values are connected/u);
});
test("directory and startup intelligence routes have distinct information hierarchy",async()=>{
  const source=await readFile(new URL("src/content/dashboard/DashboardContent.jsx",root),"utf8");
  const directoryBranch=source.match(/selected\s*\?\s*<StartupDetail[\s\S]*?:\s*<section className="startup-directory"[\s\S]*?<DirectoryControls/u)?.[0]??"";
  assert.match(directoryBranch,/ecosystem-stage-summary/u);
  assert.match(directoryBranch,/DirectoryControls/u);
  const detail=source.slice(source.indexOf("function StartupDetail"),source.indexOf("const internalResearchPipeline"));
  assert.doesNotMatch(detail,/ecosystem-stage-summary|DirectoryControls/u);
  assert.ok(detail.indexOf("startup-intelligence-hero")<detail.indexOf("<MeasurementStatus startup"));
  assert.ok(detail.indexOf("<MeasurementStatus startup")<detail.indexOf("canonical-finding"));
  assert.match(detail,/Back to All Startups/u);
  assert.match(detail,/StartupProgression/u);
});