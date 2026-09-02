import React, { useMemo, useState } from "react";

import { ChartRenderer, DataComponent, DataTable, MetricCard, useDataApp } from "../../data-app-public.jsx";
import superteamUkLogo from "../assets/superteam-uk-logo.jpg";

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
  return <img className="brand-mark" src={superteamUkLogo} alt="Superteam UK" />;
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

const internalResearchPipeline = ["Directory intake", "Identity verification", "Product research", "Technical classification", "Evidence collection", "Queue assignment", "Publication"];

function InsightsView({ statusRows, stageRows, queueRows, chartProps }) {
  void internalResearchPipeline;
  return <section className="insights-view">
    <header className="section-intro"><p className="eyebrow">Cross-startup findings</p><h2>What the current sample shows.</h2>
      <p>Descriptive distributions and evidence-led findings from the five completed startup records.</p></header>
    <section className="overview-grid">
      <DataComponent id="technical-status-chart" variant="card" queryId="technical_status" sourceRows={statusRows} title="Technical status of researched startups" kind="chart"><ChartRenderer spec={statusSpec} rows={statusRows} height={300} {...chartProps("technical-status-chart")} /></DataComponent>
      <DataComponent id="stage-chart" variant="card" queryId="researched_stages" sourceRows={stageRows} title="Funding stage in the current sample" kind="chart"><ChartRenderer spec={stageSpec} rows={stageRows} height={300} {...chartProps("stage-chart")} /></DataComponent>
    </section>
    <section className="insight-banner"><div><span>Current finding</span><h2>Public presence does not equal measurable on-chain activity.</h2></div><p>Four of the first five startups can be documented primarily through off-chain or test activity. Fanplay/WTF Games remains in the mainnet queue until an operational wallet or verified transaction is discovered.</p></section>
    <DataComponent id="mainnet-queue-table" variant="card" queryId="mainnet_queue" sourceRows={queueRows} title="Mainnet analysis queue" kind="table"><DataTable rows={queueRows} columns={queueColumns} /></DataComponent>
    <div className="queue-split"><article><span className="queue-kicker">Queue A &middot; complete first</span><h3>Off-chain and Devnet</h3><p>Product &rarr; users &rarr; social &rarr; GitHub &rarr; test transactions &rarr; milestones &rarr; evidence grade &rarr; completed profile</p></article><article><span className="queue-kicker">Queue B &middot; deep analysis</span><h3>Mainnet and Hybrid</h3><p>Official entry point &rarr; wallet cluster &rarr; raw transactions &rarr; entity labels &rarr; users &rarr; volume &rarr; retention &rarr; fund flows</p></article></div>
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

  return <article className="page startup-archive" aria-label="Superteam UK startup analytics"><div className="archive-frame">
    <aside className="archive-rail" aria-label="Archive sections"><BrandMark />
      <button className={view === "overview" ? "active" : ""} onClick={() => setView("overview")} aria-label="Overview">⌂</button>
      <button className={view === "archive" ? "active" : ""} onClick={() => setView("archive")} aria-label="Startups">▦</button>
      <button className={view === "insights" ? "active" : ""} onClick={() => setView("insights")} aria-label="Insights">↳</button>
    </aside>
    <div className="archive-main">
      <header className="archive-header"><div><p className="eyebrow">Superteam UK Startup Analytics</p>
        <h1>Startup <em>analytics.</em></h1><p className="header-description">Products, evidence, users and activity across the Superteam UK startup ecosystem.</p></div>
        <div className="header-actions" role="tablist" aria-label="Views">
          <button className={view === "overview" ? "active" : ""} onClick={() => setView("overview")}>Overview</button>
          <button className={view === "archive" ? "active" : ""} onClick={() => setView("archive")}>Startups</button>
          <button className={view === "insights" ? "active" : ""} onClick={() => setView("insights")}>Insights</button>
        </div></header>
      {view === "overview" && <>
        <section className="metric-strip" aria-label="Research progress">
          <MetricCard id="directory-size" queryId="research_summary" sourceRows={[summary]} title="Directory universe" value="66" description="Published startup records." />
          <MetricCard id="researched" queryId="research_summary" sourceRows={[summary]} title="Researched" value={String(summary.researched)} description="Profiles currently classified." />
          <MetricCard id="non-mainnet" queryId="research_summary" sourceRows={[summary]} title="Queue A" value={String(summary.nonMainnet)} description="Off-chain, devnet or testnet." />
          <MetricCard id="mainnet" queryId="research_summary" sourceRows={[summary]} title="Queue B" value={String(summary.mainnetQueue)} description="Mainnet analysis pending." />
        </section>
        <section className="insight-banner"><div><span>Current finding</span><h2>Public presence does not equal measurable on-chain activity.</h2></div>
          <p>Four of the first five startups can be documented primarily through off-chain or test activity. Fanplay/WTF Games is routed to the mainnet queue because its operational wallet is not publicly documented.</p></section>
        <DataComponent id="mainnet-queue-table" variant="card" queryId="mainnet_queue" sourceRows={queueRows} title="Mainnet analysis queue" kind="table">
          <DataTable rows={queueRows} columns={queueColumns} /></DataComponent>
      </>}
      {view === "archive" && <section className="archive-browser"><div className="startup-list">
        {startups.map((startup) => <StartupCard key={startup.id} startup={startup} selected={startup.id === selected?.id} onSelect={setSelectedId} />)}
      </div>{selected && <StartupDetail startup={selected} />}</section>}
      {view === "insights" && <InsightsView statusRows={statusRows} stageRows={stageRows} queueRows={queueRows} chartProps={chartProps} />}
      <footer className="archive-footer"><span>Evidence-led research by Olamilekan Alaga</span>
        <span>Data cutoff · {snapshot.report?.asOf ?? "2026-09-02"}</span></footer>
    </div>
  </div></article>;
}
