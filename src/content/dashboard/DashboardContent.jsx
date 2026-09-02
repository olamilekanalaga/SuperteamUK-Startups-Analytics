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
const displayName = (startup) => startup.displayAlias ? startup.startup + " / " + startup.displayAlias : startup.currentBrand ? startup.startup + " / " + startup.currentBrand : startup.startup;
const startupSlug = (startup) => displayName(startup).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const startupPath = (startup) => "/startups/" + startupSlug(startup);
const isMainnet = (startup) => startup.queue === "Mainnet Analysis Queue" || startup.queue === "Mainnet queue";
const publicValue = (value) => value && String(value).trim() ? value : "Not verified";
const currentPathname = () => globalThis.location?.pathname ?? "/";
const profileSlugFromPath = (pathname) => pathname.match(/^\/startups\/([^/]+)\/?$/)?.[1] ?? "";
const routeFromPathname = (pathname, startups) => {
  if (pathname === "/" || pathname === "") return { view: "overview", startup: null, notFound: false };
  if (pathname === "/startups" || pathname === "/startups/") return { view: "archive", startup: null, notFound: false };
  if (pathname === "/insights" || pathname === "/insights/") return { view: "insights", startup: null, notFound: false };
  const slug = profileSlugFromPath(pathname);
  if (slug) {
    const startup = startups.find((item) => startupSlug(item) === slug) ?? null;
    return { view: "archive", startup, notFound: !startup };
  }
  return { view: "not-found", startup: null, notFound: true };
};
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
      ? <img src={startup.logoPath} alt={`${startup.startup} logo`} loading={profile ? "eager" : "lazy"} onError={() => setFailed(true)} />
      : <span aria-hidden="true">{startup.monogram}</span>}
  </span>;
}

const compactStatus = (startup) => {
  const value = String(startup.classification ?? startup.technicalState ?? startup.queue ?? "").toLowerCase();
  if (value.includes("historical mainnet")) return { label: "Historical", tone: "historical" };
  if (value.includes("mainnet")) return { label: "Mainnet", tone: "mainnet" };
  if (value.includes("devnet")) return { label: "Devnet", tone: "devnet" };
  if (value.includes("testnet")) return { label: "Testnet", tone: "testnet" };
  if (value.includes("infrastructure")) return { label: "Infrastructure", tone: "infrastructure" };
  if (value.includes("pre-launch")) return { label: "Pre-launch", tone: "prelaunch" };
  if (value.includes("wound") || value.includes("inactive")) return { label: "Wound down", tone: "sunset" };
  if (value.includes("acquired") || value.includes("exited")) return { label: "Acquired", tone: "acquired" };
  if (value.includes("identity") || value.includes("unverified")) return { label: "Unverified", tone: "unverified" };
  if (value.includes("off-chain")) return { label: "Off-chain", tone: "offchain" };
  return { label: isMainnet(startup) ? "Mainnet" : "Reviewed", tone: isMainnet(startup) ? "mainnet" : "research" };
};

const sectorTags = (startup) => String(startup.sector ?? "").split(/\s*(?:\/|;|,)\s*/u).filter(Boolean);

function StartupCard({ startup, onNavigate }) {
  const status = compactStatus(startup);
  const openProfile = (event) => {
    if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      onNavigate(startupPath(startup));
    }
  };
  const sectors = sectorTags(startup);
  return <a className={`startup-card startup-card--${status.tone}`} href={startupPath(startup)} onClick={openProfile} aria-label={"View " + displayName(startup) + " profile"}>
    <div className="startup-card__identity">
      <ProjectLogo startup={startup} />
      <h3>{displayName(startup)}</h3>
    </div>
    <p className="startup-card__description">{startup.oneLine ?? startup.summary ?? startup.whatItBuilds}</p>
    <div className="startup-card__tags" aria-label="Startup attributes">
      <span>{normalizedStage(startup.directoryStage ?? startup.stage)}</span>
      {sectors.slice(0, 2).map((sector) => <span key={sector}>{sector}</span>)}
      {sectors.length > 2 && <span>+{sectors.length - 2} more</span>}
    </div>
  </a>;
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
        <a href={entry.explorerUrl} target="_blank" rel="noopener noreferrer">{entry.address}</a>
        <p>{entry.attributionStatus}</p>
        {entry.orbUrl && <a className="secondary-link" href={entry.orbUrl} target="_blank" rel="noopener noreferrer">View Anchor IDL</a>}
      </article>)}</div>}
  </section>;
}

function AnalysisChecklist({ title, items = [], completed = false }) {
  return <section className="profile-section checklist-section"><h3>{title}</h3>
    {items.length ? <ul>{items.map((item) => <li key={item}><span aria-hidden="true">{completed ? "\u2713" : "\u25CB"}</span>{item}</li>)}</ul>
      : <p className="empty-evidence">Not recorded for this research pass.</p>}
  </section>;
}

function MetricSection({ title, metrics = [] }) {
  return <section className="profile-section"><h3>{title}</h3>{metrics.length
    ? <div className="reported-metrics">{metrics.map((metric) => <div key={metric.label + metric.value}><strong>{metric.value}</strong><span>{metric.label}</span><small>{metric.qualifier}</small>{metric.sourceUrl && <a href={metric.sourceUrl} target="_blank" rel="noopener noreferrer">Source</a>}</div>)}</div>
    : <p className="empty-evidence">Not verified.</p>}</section>;
}
function TextList({ title, items = [] }) {
  if (!items.length) return null;
  return <section className="profile-section data-warnings"><h3>{title}</h3><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></section>;
}
function SourceLinks({ startup }) {
  const links = [...new Set([startup.website, startup.xAccount, ...(startup.sources ?? [])].filter(Boolean))];
  return <section className="profile-section"><h3>Sources</h3>{links.length
    ? <ul className="source-links">{links.map((url) => <li key={url}><a href={url} target="_blank" rel="noopener noreferrer">{url}</a></li>)}</ul>
    : <p className="empty-evidence">Not verified.</p>}</section>;
}
function StartupDetail({ startup, onBack }) {
  return <section className="startup-profile" aria-label={displayName(startup) + " profile"}>
    <button type="button" className="profile-back" onClick={onBack}>&larr; Back to startups</button>
    <header className="startup-detail__header">
      <ProjectLogo startup={startup} profile />
      <div><p className="eyebrow">{startup.sector}</p><h2>{displayName(startup)}</h2><p>{startup.whatItBuilds ?? startup.summary}</p></div>
      <StatusPill tone={isMainnet(startup) ? "mainnet" : "research"}>{startup.analysisStatus}</StatusPill>
    </header>
    <dl className="fact-grid">
      <div><dt>Founder</dt><dd>{publicValue(startup.founder ?? startup.directoryFounder)}</dd></div><div><dt>Sector</dt><dd>{publicValue(startup.sector)}</dd></div>
      <div><dt>Directory stage</dt><dd>{publicValue(startup.directoryStage ?? startup.stage)}</dd></div><div><dt>Observed status</dt><dd>{publicValue(startup.observedStatus ?? startup.productStatus)}</dd></div><div><dt>Technical state</dt><dd>{publicValue(startup.technicalStatus)}</dd></div><div><dt>Classification</dt><dd>{publicValue(startup.classification)}</dd></div>
    </dl>
    <div className="detail-grid">
      <div><h3>Canonical finding</h3><p>{startup.canonicalFinding ?? startup.finding}</p></div>
      {startup.evidenceBoundary && <div><h3>Evidence boundary</h3><p>{startup.evidenceBoundary}</p></div>}
      <div><h3>Next analytical action</h3><p>{startup.nextAction}</p></div>
    </div>
    <TechnicalEntryPoints startup={startup} />
    <div className="analysis-checklists">
      <AnalysisChecklist title="Completed analysis" items={startup.completedAnalysis} completed />
      <AnalysisChecklist title="Outstanding analysis" items={startup.outstandingAnalysis} />
    </div>
    <section className="profile-section"><h3 className="ledger-title">Evidence confidence</h3><EvidenceLedger startup={startup} /></section>
    <MetricSection title="Verified metrics" metrics={startup.verifiedMetrics?.length ? startup.verifiedMetrics : (startup.metrics ?? []).filter((metric) => !/reported|claim/i.test(metric.qualifier ?? ""))} />
    <MetricSection title="Project-reported metrics" metrics={[...(startup.projectReportedMetrics ?? []), ...(startup.metrics ?? []).filter((metric) => /reported|claim/i.test(metric.qualifier ?? ""))]} />
    <TextList title="Data-quality warnings" items={startup.dataQualityNotes ?? []} />
    <SourceLinks startup={startup} />
    <p className="last-reviewed">Last reviewed Ã‚Â· {publicValue(startup.lastReviewed)}</p>
  </section>;
}

const internalResearchPipeline = ["Directory intake", "Identity verification", "Product research", "Technical classification", "Evidence collection", "Queue assignment", "Publication"];

function QueueList({ rows }) {
  return <section className="mainnet-queue" aria-label="Mainnet analysis queue"><h2>Mainnet analysis queue</h2><div>{rows.map((row) => <article key={row.profilePath}><div><h3>{row.startup}</h3><p>{row.network}</p></div><StatusPill tone={row.entryPoint.startsWith("Missing") || row.entryPoint.startsWith("Historical") ? "outstanding" : "verified"}>{row.entryPoint}</StatusPill><p>{row.nextAction}</p><a href={row.profilePath}>Open startup profile</a></article>)}</div></section>;
}
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
    <QueueList rows={queueRows} />
    <div className="queue-split"><article><span className="queue-kicker">Queue A &middot; complete first</span><h3>Off-chain and Devnet</h3><p>Product &rarr; users &rarr; social &rarr; GitHub &rarr; test transactions &rarr; milestones &rarr; evidence grade &rarr; completed profile</p></article><article><span className="queue-kicker">Queue B &middot; deep analysis</span><h3>Mainnet and Hybrid</h3><p>Official entry point &rarr; wallet cluster &rarr; raw transactions &rarr; entity labels &rarr; users &rarr; volume &rarr; retention &rarr; fund flows</p></article></div>
  </section>;
}

export function DashboardContent() {
  const { snapshot, reviewedRows, chartProps } = useDataApp();
  const startups = reviewedRows("researched_startups");
  const [pathname, setPathname] = useState(currentPathname);
  const route = useMemo(() => routeFromPathname(pathname, startups), [pathname, startups]);
  const view = route.view;
  const selected = route.startup;
  const summarySource = reviewedRows("research_summary")[0];
  const summary = useMemo(() => ({
    directoryStartups: summarySource.directoryStartups,
    researched: startups.length,
    nonMainnet: startups.filter((item) => !isMainnet(item)).length,
    mainnetQueue: startups.filter(isMainnet).length,
    completionRate: startups.length / summarySource.directoryStartups,
  }), [startups, summarySource.directoryStartups]);

  const statusRows = useMemo(() => distributionRows(startups.map((item) => item.technicalState), "category"), [startups]);
  const stageRows = useMemo(() => distributionRows(startups.map((item) => normalizedStage(item.directoryStage ?? item.stage)), "stage"), [startups]);
  const queueRows = useMemo(() => startups.filter(isMainnet).map((item) => ({
    startup: displayName(item),
    currentBrand: item.currentBrand ?? "",
    network: item.technicalStatus,
    entryPoint: item.technicalEntryPoints?.[0]?.address ?? (item.classification?.includes("Historical") ? "Historical entry point missing" : "Missing Ã¢â‚¬â€ attribution required"),
    nextAction: item.nextAction,
    status: "Queued",
    profilePath: startupPath(item),
  })), [startups]);

  useEffect(() => {
    const syncFromLocation = () => setPathname(currentPathname());
    globalThis.addEventListener("popstate", syncFromLocation);
    return () => globalThis.removeEventListener("popstate", syncFromLocation);
  }, []);

  const navigateTo = (nextPath) => {
    const url = new URL(globalThis.location.href);
    url.pathname = nextPath;
    globalThis.history.pushState({}, "", url);
    setPathname(url.pathname);
  };
  const navigateView = (nextView) => navigateTo(nextView === "archive" ? "/startups" : nextView === "insights" ? "/insights" : "/");

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
      {view === "archive" && !route.notFound && (selected
        ? <StartupDetail startup={selected} onBack={() => navigateTo("/startups")} />
        : <section className="startup-directory" aria-label="Startup directory"><div className="startup-list">
          {startups.map((startup) => <StartupCard key={startup.id} startup={startup} onNavigate={navigateTo} />)}
        </div></section>)}
      {view === "insights" && <InsightsView statusRows={statusRows} stageRows={stageRows} queueRows={queueRows} chartProps={chartProps} researchedCount={summary.researched} />}
      {route.notFound && <section className="route-not-found" role="status"><p className="eyebrow">Not found</p><h2>Startup profile unavailable.</h2><p>The URL does not match a verified startup profile.</p><button type="button" onClick={() => navigateTo("/startups")}>Return to startups</button></section>}
      <footer className="archive-footer"><span>Evidence-led research by Olamilekan Alaga</span>
        <span>Data cutoff &middot; {snapshot.report?.asOf ?? "2026-09-02"}</span></footer>
    </div>
  </div></article>;
}
