import React, { useMemo, useState } from "react";

import { ChartRenderer, DataComponent, DataTable, MetricCard, useDataApp } from "../../data-app-public.jsx";

const statusSpec = { type: "bar", x: "category", y: "startups", showXAxisLabel: false, showYAxisLabel: false };
const stageSpec = { type: "rankedList", x: "stage", y: "startups", initialVisibleCount: 6 };
const queueColumns = [
  { field: "startup", label: "Startup", presentation: "identity", secondaryField: "currentBrand" },
  { field: "network", label: "Network" },
  { field: "entryPoint", label: "Public entry point" },
  { field: "nextAction", label: "Next action" },
  { field: "status", label: "Status", presentation: "status" },
];
const evidenceTone = {
  "On-chain verified": "verified", "Founder-confirmed": "confirmed", "Publicly observed": "observed",
  "Project-reported": "reported", "Not publicly verifiable": "unverified",
};

function BrandMark() {
  return <div className="brand-mark" aria-hidden="true"><span>ST</span><b>UK</b></div>;
}

function StatusPill({ children, tone = "neutral" }) {
  return <span className={`status-pill status-pill--${tone}`}>{children}</span>;
}

function StartupCard({ startup, selected, onSelect }) {
  const tone = startup.queue === "Mainnet queue" ? "mainnet" : startup.productStatus === "Sunset" ? "sunset" : "research";
  return <button type="button" className={`startup-card${selected ? " startup-card--selected" : ""}`}
    onClick={() => onSelect(startup.id)}>
    <div className="startup-card__top">
      <span className="startup-monogram">{startup.monogram}</span>
      <StatusPill tone={tone}>{startup.queue}</StatusPill>
    </div>
    <div><h3>{startup.startup}</h3><p>{startup.oneLine}</p></div>
    <div className="startup-card__meta"><span>{startup.stage}</span><span>{startup.technicalStatus}</span></div>
  </button>;
}

function EvidenceLedger({ startup }) {
  const rows = [["Product", startup.productEvidence], ["Chain", startup.chainEvidence], ["Users", startup.userEvidence],
    ["Transactions", startup.transactionEvidence], ["Revenue", startup.revenueEvidence]];
  return <div className="evidence-ledger">
    {rows.map(([label, value]) => <div key={label}><span>{label}</span>
      <StatusPill tone={evidenceTone[value] ?? "neutral"}>{value}</StatusPill></div>)}
  </div>;
}

function StartupDetail({ startup }) {
  return <section className="startup-detail" aria-label={`${startup.startup} research record`}>
    <header className="startup-detail__header">
      <div><p className="eyebrow">Research record · {startup.id}</p><h2>{startup.startup}</h2><p>{startup.whatItBuilds}</p></div>
      <StatusPill tone={startup.queue === "Mainnet queue" ? "mainnet" : "research"}>{startup.analysisStatus}</StatusPill>
    </header>
    <dl className="fact-grid">
      <div><dt>Founder</dt><dd>{startup.founder}</dd></div><div><dt>Sector</dt><dd>{startup.sector}</dd></div>
      <div><dt>Stage</dt><dd>{startup.stage}</dd></div><div><dt>Technical state</dt><dd>{startup.technicalStatus}</dd></div>
    </dl>
    <div className="detail-grid">
      <div><h3>What the evidence says</h3><p>{startup.finding}</p></div>
      <div><h3>Next analytical action</h3><p>{startup.nextAction}</p></div>
    </div>
    <h3 className="ledger-title">Evidence confidence</h3><EvidenceLedger startup={startup} />
    {startup.metrics.length > 0 && <div className="reported-metrics">{startup.metrics.map((metric) => <div key={metric.label}>
      <strong>{metric.value}</strong><span>{metric.label}</span><small>{metric.qualifier}</small></div>)}</div>}
  </section>;
}

function PipelineView() {
  const phases = [
    ["01", "Directory intake", "Capture startup, founder, X, website, sector and funding stage."],
    ["02", "Identity verification", "Confirm the correct project, current brand and official public sources."],
    ["03", "Technical classification", "Assign Idea, Off-chain, Devnet, Mainnet, Hybrid or Sunset."],
    ["04", "Queue routing", "Finish off-chain and devnet research first. Hold mainnet projects for address-led analysis."],
    ["05", "Metric extraction", "Collect comparable product, developer and chain metrics without mixing claims with verification."],
    ["06", "Quality control", "Attach evidence level, definition, coverage period, limitations and founder validation."],
    ["07", "Publication", "Merge reviewed records into startup pages, comparisons, visuals and ecosystem findings."],
  ];
  return <section className="pipeline-view">
    <header className="section-intro"><p className="eyebrow">Research architecture</p><h2>One pipeline, two analytical queues.</h2>
      <p>Mainnet products are classified immediately, then analysed deeply after the faster off-chain and devnet census is complete.</p></header>
    <div className="pipeline-track">{phases.map((phase, index) => <article className="pipeline-step" key={phase[0]}>
      <span>{phase[0]}</span><div><h3>{phase[1]}</h3><p>{phase[2]}</p></div>{index < phases.length - 1 && <b aria-hidden="true">→</b>}
    </article>)}</div>
    <div className="queue-split">
      <article><span className="queue-kicker">Queue A · complete first</span><h3>Off-chain and Devnet</h3>
        <p>Product → users → social → GitHub → test transactions → milestones → evidence grade → completed profile</p></article>
      <article><span className="queue-kicker">Queue B · deep analysis</span><h3>Mainnet and Hybrid</h3>
        <p>Official entry point → wallet cluster → raw transactions → entity labels → users → volume → retention → fund flows</p></article>
    </div>
  </section>;
}

export function DashboardContent() {
  const { snapshot, reviewedRows, chartProps } = useDataApp();
  const [view, setView] = useState("overview");
  const startups = reviewedRows("researched_startups");
  const summary = reviewedRows("research_summary")[0];
  const [selectedId, setSelectedId] = useState(startups[0]?.id);
  const selected = useMemo(() => startups.find((item) => item.id === selectedId) ?? startups[0], [startups, selectedId]);
  const statusRows = reviewedRows("technical_status");
  const stageRows = reviewedRows("researched_stages");
  const queueRows = reviewedRows("mainnet_queue");

  return <article className="page startup-archive" aria-label="Superteam UK startup intelligence"><div className="archive-frame">
    <aside className="archive-rail" aria-label="Archive sections"><BrandMark />
      <button className={view === "overview" ? "active" : ""} onClick={() => setView("overview")} aria-label="Overview">⌂</button>
      <button className={view === "archive" ? "active" : ""} onClick={() => setView("archive")} aria-label="Startup archive">▦</button>
      <button className={view === "pipeline" ? "active" : ""} onClick={() => setView("pipeline")} aria-label="Research pipeline">↳</button>
    </aside>
    <div className="archive-main">
      <header className="archive-header"><div><p className="eyebrow">Independent ecosystem intelligence · Prototype 01</p>
        <h1>Startup <em>archive.</em></h1></div>
        <div className="header-actions" role="tablist" aria-label="Views">
          <button className={view === "overview" ? "active" : ""} onClick={() => setView("overview")}>Overview</button>
          <button className={view === "archive" ? "active" : ""} onClick={() => setView("archive")}>5 startups</button>
          <button className={view === "pipeline" ? "active" : ""} onClick={() => setView("pipeline")}>Pipeline</button>
        </div></header>
      {view === "overview" && <>
        <section className="metric-strip" aria-label="Research progress">
          <MetricCard id="directory-size" queryId="research_summary" sourceRows={[summary]} title="Directory universe" value="66" description="Published startup records." />
          <MetricCard id="researched" queryId="research_summary" sourceRows={[summary]} title="Researched" value={String(summary.researched)} description="Profiles currently classified." />
          <MetricCard id="non-mainnet" queryId="research_summary" sourceRows={[summary]} title="Queue A" value={String(summary.nonMainnet)} description="Off-chain, devnet or testnet." />
          <MetricCard id="mainnet" queryId="research_summary" sourceRows={[summary]} title="Queue B" value={String(summary.mainnetQueue)} description="Mainnet analysis pending." />
        </section>
        <section className="overview-grid">
          <DataComponent id="technical-status-chart" variant="card" queryId="technical_status" sourceRows={statusRows} title="Technical status of researched startups" kind="chart">
            <ChartRenderer spec={statusSpec} rows={statusRows} height={300} {...chartProps("technical-status-chart")} /></DataComponent>
          <DataComponent id="stage-chart" variant="card" queryId="researched_stages" sourceRows={stageRows} title="Funding stage in the current sample" kind="chart">
            <ChartRenderer spec={stageSpec} rows={stageRows} height={300} {...chartProps("stage-chart")} /></DataComponent>
        </section>
        <section className="insight-banner"><div><span>Current finding</span><h2>Public presence does not equal measurable on-chain activity.</h2></div>
          <p>Four of the first five startups can be documented primarily through off-chain or test activity. Fanplay/WTF Games is routed to the mainnet queue because its operational wallet is not publicly documented.</p></section>
        <DataComponent id="mainnet-queue-table" variant="card" queryId="mainnet_queue" sourceRows={queueRows} title="Mainnet analysis queue" kind="table">
          <DataTable rows={queueRows} columns={queueColumns} /></DataComponent>
      </>}
      {view === "archive" && <section className="archive-browser"><div className="startup-list">
        {startups.map((startup) => <StartupCard key={startup.id} startup={startup} selected={startup.id === selected?.id} onSelect={setSelectedId} />)}
      </div>{selected && <StartupDetail startup={selected} />}</section>}
      {view === "pipeline" && <PipelineView />}
      <footer className="archive-footer"><span>Evidence-led research by Olamilekan Alaga</span>
        <span>Data cutoff · {snapshot.report?.asOf ?? "2026-09-02"}</span></footer>
    </div>
  </div></article>;
}
