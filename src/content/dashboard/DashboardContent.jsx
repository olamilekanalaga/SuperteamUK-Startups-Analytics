import React, { useEffect, useMemo, useState } from "react";

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
  "Project-reported": "reported", "Project-documented": "documented",
  "Analysis outstanding": "outstanding", "Partially on-chain verified": "partial", "Not publicly verifiable": "unverified",
};
const startupSlug = (startup) => startup.startup.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const startupPath = (startup) => `/startups/${startupSlug(startup)}`;
const pathSlug = () => globalThis.location?.pathname.match(/^\/startups\/([^/]+)\/?$/)?.[1] ?? "";
const normalizedStage = (stage) => ({
  "Raising pre-seed": "Raising Pre-Seed",
  "Self-funded": "Not Raising / Self-Funded",
  "Pre-seed closed": "Pre-Seed Closed",
}[stage] ?? stage);
const distributionRows = (values, key) => Object.entries(values.reduce((counts, value) => {
  counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}, {})).map(([label, startups]) => ({ [key]: label, startups }));

function BrandMark() {
  return <img className="brand-mark" src="/brands/superteam-uk-logo.jpeg" alt="Superteam UK" />;
}

function StatusPill({ children, tone = "neutral" }) {
  return <span className={`status-pill status-pill--${tone}`}>{children}</span>;
}

function ProjectLogo({ startup, profile = false }) {
  const [failed, setFailed] = useState(false);
  const showImage = startup.logoPath && !failed;
  return <span className={`project-logo${profile ? " project-logo--profile" : ""}`} aria-label={showImage ? undefined : `${startup.startup} monogram`}>
    {showImage
      ? <img src={startup.logoPath} alt={`${startup.startup} logo`} onError={() => setFailed(true)} />
      : <span aria-hidden="true">{startup.monogram}</span>}
  </span>;
}

function StartupCard({ startup, onSelect }) {
  const tone = startup.queue === "Mainnet queue" ? "mainnet" : startup.productStatus === "Sunset" ? "sunset" : "research";
  return <button type="button" className="startup-card" onClick={() => onSelect(startup)}>
    <div className="startup-card__top">
      <ProjectLogo startup={startup} />
      <StatusPill tone={tone}>{startup.analysisStatus}</StatusPill>
    </div>
    <div><h3>{startup.startup}</h3><p>{startup.oneLine}</p></div>
    <dl className="startup-card__facts">
      <div><dt>Sector</dt><dd>{startup.sector}</dd></div>
      <div><dt>Stage</dt><dd>{startup.stage}</dd></div>
      <div><dt>Technical status</dt><dd>{startup.technicalStatus}</dd></div>
    </dl>
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

function TechnicalEntryPoints({ startup }) {
  const entries = startup.technicalEntryPoints ?? [];
  return <section className="profile-section"><h3>Technical entry points</h3>
    {entries.length === 0
      ? <p className="empty-evidence">No publicly attributable on-chain entry point has been verified.</p>
      : <div className="entry-point-list">{entries.map((entry) => <article key={entry.address}>
        <div><strong>{entry.name}</strong><span>{entry.network} &middot; {entry.type}</span></div>
        <a href={entry.explorerUrl} target="_blank" rel="noreferrer">{entry.address}</a>
        <p>{entry.attributionStatus}</p>
        {entry.orbUrl && <a className="secondary-link" href={entry.orbUrl} target="_blank" rel="noreferrer">View Anchor IDL</a>}
      </article>)}</div>}
  </section>;
}

function AnalysisChecklist({ title, items = [], completed = false }) {
  return <section className="profile-section checklist-section"><h3>{title}</h3>
    {items.length ? <ul>{items.map((item) => <li key={item}><span aria-hidden="true">{completed ? "\u2713" : "\u25CB"}</span>{item}</li>)}</ul>
      : <p className="empty-evidence">Not recorded for this research pass.</p>}
  </section>;
}

function StartupDetail({ startup, onBack }) {
  return <section className="startup-profile" aria-label={`${startup.startup} profile`}>
    <button type="button" className="profile-back" onClick={onBack}>&larr; Back to startups</button>
    <header className="startup-detail__header">
      <ProjectLogo startup={startup} profile />
      <div><p className="eyebrow">{startup.sector}</p><h2>{startup.startup}</h2><p>{startup.whatItBuilds}</p></div>
      <StatusPill tone={startup.queue === "Mainnet queue" ? "mainnet" : "research"}>{startup.analysisStatus}</StatusPill>
    </header>
    <dl className="fact-grid">
      <div><dt>Founder</dt><dd>{startup.founder}</dd></div><div><dt>Sector</dt><dd>{startup.sector}</dd></div>
      <div><dt>Stage</dt><dd>{startup.stage}</dd></div><div><dt>Technical state</dt><dd>{startup.technicalStatus}</dd></div>
    </dl>
    <div className="detail-grid">
      <div><h3>What the evidence says</h3><p>{startup.finding}</p></div>
      {startup.evidenceBoundary && <div><h3>Evidence boundary</h3><p>{startup.evidenceBoundary}</p></div>}
      <div><h3>Next analytical action</h3><p>{startup.nextAction}</p></div>
    </div>
    <TechnicalEntryPoints startup={startup} />
    <div className="analysis-checklists">
      <AnalysisChecklist title="Completed analysis" items={startup.completedAnalysis} completed />
      <AnalysisChecklist title="Outstanding analysis" items={startup.outstandingAnalysis} />
    </div>
    <section className="profile-section"><h3 className="ledger-title">Evidence confidence</h3><EvidenceLedger startup={startup} /></section>
    {startup.metrics.length > 0 && <div className="reported-metrics">{startup.metrics.map((metric) => <div key={metric.label}>
      <strong>{metric.value}</strong><span>{metric.label}</span><small>{metric.qualifier}</small></div>)}</div>}
  </section>;
}

const internalResearchPipeline = ["Directory intake", "Identity verification", "Product research", "Technical classification", "Evidence collection", "Queue assignment", "Publication"];

function InsightsView({ statusRows, stageRows, queueRows, chartProps, researchedCount }) {
  void internalResearchPipeline;
  return <section className="insights-view">
    <header className="section-intro"><p className="eyebrow">Cross-startup findings</p><h2>What the current sample shows.</h2>
      <p>Descriptive distributions and evidence-led findings from the {researchedCount} completed startup records.</p></header>
    <section className="overview-grid">
      <DataComponent id="technical-status-chart" variant="card" queryId="technical_status" sourceRows={statusRows} title="Technical status of researched startups" kind="chart"><ChartRenderer spec={statusSpec} rows={statusRows} height={300} {...chartProps("technical-status-chart")} /></DataComponent>
      <DataComponent id="stage-chart" variant="card" queryId="researched_stages" sourceRows={stageRows} title="Funding stage in the current sample" kind="chart"><ChartRenderer spec={stageSpec} rows={stageRows} height={300} {...chartProps("stage-chart")} /></DataComponent>
    </section>
    <section className="insight-banner"><div><span>Current finding</span><h2>Public presence does not equal measurable on-chain activity.</h2></div><p>{researchedCount - queueRows.length} of {researchedCount} researched startups are currently classified outside the mainnet analysis queue. The remaining {queueRows.length} require address-led follow-up.</p></section>
    <DataComponent id="mainnet-queue-table" variant="card" queryId="mainnet_queue" sourceRows={queueRows} title="Mainnet analysis queue" kind="table"><DataTable rows={queueRows} columns={queueColumns} /></DataComponent>
    <div className="queue-split"><article><span className="queue-kicker">Queue A &middot; complete first</span><h3>Off-chain and Devnet</h3><p>Product &rarr; users &rarr; social &rarr; GitHub &rarr; test transactions &rarr; milestones &rarr; evidence grade &rarr; completed profile</p></article><article><span className="queue-kicker">Queue B &middot; deep analysis</span><h3>Mainnet and Hybrid</h3><p>Official entry point &rarr; wallet cluster &rarr; raw transactions &rarr; entity labels &rarr; users &rarr; volume &rarr; retention &rarr; fund flows</p></article></div>
  </section>;
}

export function DashboardContent() {
  const { snapshot, reviewedRows, chartProps } = useDataApp();
  const startups = reviewedRows("researched_startups");
  const initialSlug = pathSlug();
  const initialStartup = startups.find((item) => startupSlug(item) === initialSlug);
  const [view, setView] = useState(initialStartup ? "archive" : "overview");
  const [selectedId, setSelectedId] = useState(initialStartup?.id ?? null);
  const summarySource = reviewedRows("research_summary")[0];
  const summary = useMemo(() => ({
    directoryStartups: summarySource.directoryStartups,
    researched: startups.length,
    nonMainnet: startups.filter((item) => item.queue === "Queue A").length,
    mainnetQueue: startups.filter((item) => item.queue === "Mainnet queue").length,
    completionRate: startups.length / summarySource.directoryStartups,
  }), [startups, summarySource.directoryStartups]);
  const selected = useMemo(() => startups.find((item) => item.id === selectedId) ?? null, [startups, selectedId]);
  const statusRows = useMemo(() => distributionRows(startups.map((item) => item.technicalState), "category"), [startups]);
  const stageRows = useMemo(() => distributionRows(startups.map((item) => normalizedStage(item.stage)), "stage"), [startups]);
  const queueRows = useMemo(() => startups.filter((item) => item.queue === "Mainnet queue").map((item) => ({
    startup: item.startup,
    currentBrand: item.currentBrand ?? "",
    network: item.technicalStatus,
    entryPoint: item.technicalEntryPoints?.[0]?.address ?? "Not publicly documented",
    nextAction: item.nextAction,
    status: "Queued",
  })), [startups]);

  useEffect(() => {
    const syncFromLocation = () => {
      const slug = pathSlug();
      const match = startups.find((item) => startupSlug(item) === slug);
      setSelectedId(match?.id ?? null);
      if (match || globalThis.location.pathname === "/startups" || globalThis.location.pathname === "/startups/") setView("archive");
    };
    globalThis.addEventListener("popstate", syncFromLocation);
    return () => globalThis.removeEventListener("popstate", syncFromLocation);
  }, [startups]);

  const navigateView = (nextView) => {
    setView(nextView);
    setSelectedId(null);
    const path = nextView === "archive" ? "/startups" : nextView === "insights" ? "/insights" : "/";
    globalThis.history.pushState({}, "", path);
  };
  const openStartup = (startup) => {
    setView("archive");
    setSelectedId(startup.id);
    globalThis.history.pushState({}, "", startupPath(startup));
  };
  const closeStartup = () => {
    if (pathSlug()) globalThis.history.back();
    else setSelectedId(null);
  };

  return <article className="page startup-archive" aria-label="Superteam UK startup analytics"><div className="archive-frame">
    <aside className="archive-rail" aria-label="Analytics sections"><BrandMark />
      <button className={view === "overview" ? "active" : ""} onClick={() => navigateView("overview")} aria-label="Overview">&#8962;</button>
      <button className={view === "archive" ? "active" : ""} onClick={() => navigateView("archive")} aria-label="Startups">&#9638;</button>
      <button className={view === "insights" ? "active" : ""} onClick={() => navigateView("insights")} aria-label="Insights">&#8618;</button>
    </aside>
    <div className="archive-main">
      <header className="archive-header"><div><p className="eyebrow">Superteam UK Startup Analytics</p>
        <h1>Startup <em>analytics.</em></h1><p className="header-description">Products, evidence, users and activity across the Superteam UK startup ecosystem.</p></div>
        <div className="header-actions" role="tablist" aria-label="Views">
          <button className={view === "overview" ? "active" : ""} onClick={() => navigateView("overview")}>Overview</button>
          <button className={view === "archive" ? "active" : ""} onClick={() => navigateView("archive")}>Startups</button>
          <button className={view === "insights" ? "active" : ""} onClick={() => navigateView("insights")}>Insights</button>
        </div></header>
      {view === "overview" && <>
        <section className="metric-strip" aria-label="Research progress">
          <MetricCard id="directory-size" queryId="research_summary" sourceRows={[summary]} title="Directory universe" value={String(summary.directoryStartups)} description="Published startup records." />
          <MetricCard id="researched" queryId="research_summary" sourceRows={[summary]} title="Researched" value={`${summary.researched} of ${summary.directoryStartups}`} description={`${Number((summary.completionRate * 100).toFixed(2))}% complete.`} />
          <MetricCard id="non-mainnet" queryId="research_summary" sourceRows={[summary]} title="Queue A" value={String(summary.nonMainnet)} description="Off-chain, devnet or testnet." />
          <MetricCard id="mainnet" queryId="research_summary" sourceRows={[summary]} title="Queue B" value={String(summary.mainnetQueue)} description="Mainnet analysis pending." />
        </section>
        <section className="insight-banner"><div><span>Current finding</span><h2>Public presence does not equal measurable on-chain activity.</h2></div>
          <p>{summary.nonMainnet} of {summary.researched} researched startups are currently classified as devnet/testnet, off-chain, infrastructure or unverified. {summary.mainnetQueue} are routed to address-led mainnet analysis.</p></section>
        <DataComponent id="mainnet-queue-table" variant="card" queryId="mainnet_queue" sourceRows={queueRows} title="Mainnet analysis queue" kind="table">
          <DataTable rows={queueRows} columns={queueColumns} /></DataComponent>
      </>}
      {view === "archive" && (selected
        ? <StartupDetail startup={selected} onBack={closeStartup} />
        : <section className="startup-directory" aria-label="Startup directory"><div className="startup-list">
          {startups.map((startup) => <StartupCard key={startup.id} startup={startup} onSelect={openStartup} />)}
        </div></section>)}
      {view === "insights" && <InsightsView statusRows={statusRows} stageRows={stageRows} queueRows={queueRows} chartProps={chartProps} researchedCount={summary.researched} />}
      <footer className="archive-footer"><span>Evidence-led research by Olamilekan Alaga</span>
        <span>Data cutoff &middot; {snapshot.report?.asOf ?? "2026-09-02"}</span></footer>
    </div>
  </div></article>;
}
