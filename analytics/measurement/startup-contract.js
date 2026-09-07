import { PUREBET_CONFIG } from "../purebet/config.js";
export const MEASUREMENT_READINESS=Object.freeze({FULLY:"fully_measurable",PARTIAL:"partially_measurable",NONE:"not_yet_measurable"});
const labels=Object.freeze({verified:"Verified",partial:"Partial attribution",awaiting_attribution:"Awaiting attribution",unknown:"Awaiting attribution"});
const readinessLabels=Object.freeze({[MEASUREMENT_READINESS.FULLY]:"Fully measurable",[MEASUREMENT_READINESS.PARTIAL]:"Partially measurable",[MEASUREMENT_READINESS.NONE]:"Not yet measurable"});
const baseMetrics=["Users","Transactions","Growth"];
function metricCapabilities(startup){
  if(startup.id==="STUK-008")return["Users","Transactions","Betting volume","Retention","Concentration"];
  const sector=String(startup.sector??"").toLowerCase();
  const metrics=[...baseMetrics];
  if(/defi|liquidity|staking|finance|yield|stablecoin|payment|trade|market|bet|gaming|nft|fundrais/.test(sector))metrics.splice(2,0,"Volume");
  if(/defi|liquidity|staking|finance|yield|stablecoin/.test(sector))metrics.splice(3,0,"Fees","TVL / Liquidity","Retention");
  if(/payment|marketplace|fundrais/.test(sector))metrics.splice(3,0,"Revenue");
  return [...new Set(metrics)];
}
function sourceRows(startup){
  if(startup.id==="STUK-008")return PUREBET_CONFIG.sources.map((source)=>({label:source.label,address:source.address,explorerUrl:null,confirmation:"Candidate research evidence",confirmed:false}));
  return(startup.technicalEntryPoints??[]).filter((entry)=>entry.address).map((entry)=>{const status=String(entry.attributionStatus??"");const confirmed=/founder-confirmed|official(?:ly)? confirmed|verified attribution/iu.test(status)&&!/not yet|unconfirmed|candidate|probable|third-party|remains preferable|verification needed|requires? confirmation/iu.test(status);return{label:entry.name,address:entry.address,explorerUrl:entry.explorerUrl??null,confirmation:confirmed?"Confirmed attribution":"Candidate research evidence",confirmed};});
}
export function buildStartupMeasurementStatus(startup,{stage,attributionState}){
  if(stage!=="MAINNET")return null;
  const readiness=startup.id==="STUK-008"?MEASUREMENT_READINESS.FULLY:startup.id==="STUK-019"?MEASUREMENT_READINESS.PARTIAL:MEASUREMENT_READINESS.NONE;
  const sources=sourceRows(startup),blocked=readiness===MEASUREMENT_READINESS.NONE;
  const metricStatus=blocked?"attribution_required":"awaiting_live_data";
  return Object.freeze({
    stage:"Mainnet",attributionState,attributionLabel:labels[attributionState]??labels.unknown,readiness,readinessLabel:readinessLabels[readiness],
    sources,
    sourceEmptyMessage:sources.length?"":"Attribution required",
    metrics:metricCapabilities(startup).map((label)=>Object.freeze({label,value:null,status:metricStatus,statusLabel:blocked?"Attribution required":"Awaiting live data"})),
    coverage:Object.freeze([
      {label:"Sources identified",status:sources.length?"ready":"required",statusLabel:sources.length?"Ready":"Attribution required"},
      {label:"Measurement structure",status:"ready",statusLabel:"Ready"},
      {label:"Live ingestion",status:blocked?"blocked":"not_connected",statusLabel:blocked?"Blocked by attribution":"Not connected"},
      {label:"Metrics",status:blocked?"required":"awaiting",statusLabel:blocked?"Attribution required":"Awaiting data"},
    ]),
    liveValuesConnected:false,
  });
}