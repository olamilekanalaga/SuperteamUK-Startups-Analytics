import React, { useEffect, useMemo, useState } from "react";

import { ChartRenderer, DataComponent, DataTable, MetricCard, RichNarrative, useDataApp } from "../../data-app-public.jsx";
import { CANONICAL_STAGE, attributionState, canonicalStageLabel, canonicalStageTone, canonicalStartupStage, deriveEcosystemStageCounts } from "./startup-stage.js";
import { buildStartupMeasurementStatus } from "../../../analytics/measurement/startup-contract.js";

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
  if (pathname === "/ask-dandy" || pathname === "/ask-dandy/") return { view: "ask-dandy", startup: null, notFound: false };
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

const sectorTags = (startup) => String(startup.sector ?? "").split(/\s*(?:\/|;|,)\s*/u).filter(Boolean);
const researchStatus = (startup) => {
  const value = String(startup.researchStatus ?? startup.analysisStatus ?? "").toLowerCase();
  if (value.includes("complete") || value.includes("shared")) return "Completed";
  if (value.includes("founder") || value.includes("identity verification")) return "Awaiting founder";
  if (value.includes("progress") || value.includes("outstanding") || value.includes("awaiting") || value.includes("required")) return "In progress";
  return "Not started";
};
const technicalGroup = (startup) => canonicalStageLabel[canonicalStartupStage(startup)];
const verifiedMetricsFor = (startup) => startup.verifiedMetrics?.length
  ? startup.verifiedMetrics
  : (startup.metrics ?? []).filter((metric) => !/reported|claim|preliminary/iu.test(metric.qualifier ?? ""));
const projectMetricsFor = (startup) => [
  ...(startup.projectReportedMetrics ?? []),
  ...(startup.metrics ?? []).filter((metric) => /reported|claim/iu.test(metric.qualifier ?? "")),
];

const cardDescription = (startup) => { const value = String(startup.whatItBuilds ?? startup.oneLine ?? startup.summary ?? "Project description not verified.").trim(); return value.match(/^.*?[.!?](?:\s|$)/u)?.[0].trim() ?? value; };
function StartupCard({ startup, onNavigate }) {
  const stage = canonicalStartupStage(startup);
  const network = { label: canonicalStageLabel[stage], tone: canonicalStageTone[stage] };
  const description = cardDescription(startup);
  const openProfile = (event) => {
    if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      onNavigate(startupPath(startup));
    }
  };
  const headlineMetric = [CANONICAL_STAGE.MAINNET, CANONICAL_STAGE.DEVNET].includes(stage) ? (startup.headlineKpis ?? [])[0] : null;
  return <a className={"startup-card startup-card--" + (network?.tone ?? "neutral")} href={startupPath(startup)} onClick={openProfile} aria-label={"View " + displayName(startup) + " profile. " + description} title={description}>
    <div className="startup-card__identity"><ProjectLogo startup={startup} /><div><h3>{displayName(startup)}</h3><p>{sectorTags(startup)[0] ?? "Sector not verified"}</p></div>{network && <div className="startup-card__network"><StatusPill tone={network.tone}>{network.label}</StatusPill></div>}</div>
    <p className="startup-card__description">{description}</p>
    {headlineMetric && <p className="startup-card__performance"><span>{stage === CANONICAL_STAGE.DEVNET ? "Devnet milestone" : "Latest measured"}</span><strong>{headlineMetric.value}</strong> {headlineMetric.label}</p>}
  </a>;
}

function EvidenceLedger({ startup }) {
  const rows = [["Product", startup.productEvidence], ["Chain", startup.chainEvidence], ["Users", startup.userEvidence],
    ["Transactions", startup.transactionEvidence], ["Revenue", startup.revenueEvidence]];
  return <div className="evidence-ledger">
    {rows.map(([label, value]) => <div key={label}><span>{label}</span>
      <StatusPill tone={evidenceTone[value] ?? "neutral"}>{publicValue(value)}</StatusPill></div>)}
  </div>;
}

function TechnicalEntryPoints({ startup }) {
  const entries = startup.technicalEntryPoints ?? [];
  return <section className="profile-section"><h3>On-chain evidence</h3>
    {entries.length === 0
      ? <p className="empty-evidence">{canonicalStartupStage(startup) === CANONICAL_STAGE.DEVNET ? "No attributable mainnet deployment was verified during this research period." : "No attributable on-chain deployment was verified during this research period."}</p>
      : <div className="entry-point-list">{entries.map((entry) => <article key={entry.address}>
        <div><strong>{entry.name}</strong><span>{entry.network} &middot; {entry.type}</span></div>
        <a href={entry.explorerUrl} target="_blank" rel="noopener noreferrer">{entry.address}</a>
        <p>{entry.attributionStatus}</p>
        {entry.orbUrl && <a className="secondary-link" href={entry.orbUrl} target="_blank" rel="noopener noreferrer">View Anchor IDL</a>}
      </article>)}</div>}
  </section>;
}

function AnalysisChecklist({ title, items = [], completed = false }) {
  if (!items.length) return null;
  return <section className="profile-section checklist-section"><h3>{title}</h3>
    <ul>{items.map((item) => <li key={item}><span aria-hidden="true">{completed ? "\u2713" : "\u25CB"}</span>{item}</li>)}</ul>
  </section>;
}

function MetricSection({ title, metrics = [], reported = false }) {
  if (!metrics.length) return null;
  return <section className={`profile-section${reported ? " reported-evidence" : ""}`}><h3>{title}</h3>
    <div className="reported-metrics">{metrics.map((metric) => <div key={metric.label + metric.value}><strong>{metric.value}</strong><span>{metric.label}</span><small>{metric.qualifier}</small>{metric.sourceUrl && <a href={metric.sourceUrl} target="_blank" rel="noopener noreferrer">Source</a>}</div>)}</div>
  </section>;
}
function TextList({ title, items = [], className = "" }) {
  if (!items.length) return null;
  return <section className={`profile-section ${className}`}><h3>{title}</h3><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></section>;
}
const founderIsDisplayable = (startup) => {
  const founder = startup.founder ?? startup.directoryFounder;
  if (!founder || /not (?:publicly )?verified|not listed|no directory|requires confirmation/iu.test(founder)) return false;
  return Boolean(startup.founderContacts?.length) || !/not verified|requires confirmation/iu.test(startup.founderVerification ?? "");
};
const projectLinksFor = (startup) => {
  const links = [];
  const add = (label, url) => { if (url && !links.some((item) => item.url === url)) links.push({ label, url }); };
  add("Website", startup.website);
  add("Project X", startup.xAccount);
  (startup.xAccounts ?? []).forEach((url, index) => add(index ? "Project X " + (index + 1) : "Project X", url));
  add("Project Telegram", startup.projectTelegram);
  add("Discord", startup.discord);
  add("GitHub", startup.github);
  add("Documentation", startup.docs ?? startup.documentation);
  return links;
};
function ReportIntroductionLinks({ startup }) {
  const founderContacts = startup.founderContacts ?? [];
  const projectLinks = projectLinksFor(startup);
  const showFounder = founderIsDisplayable(startup);
  if (!showFounder && !founderContacts.length && !projectLinks.length) return null;
  return <section className="report-links" aria-label="Founder and project links">
    {(showFounder || founderContacts.length > 0) && <div className="report-links__group"><p className="report-links__label">Founder contact</p>{showFounder && <strong>{startup.founder ?? startup.directoryFounder}</strong>}<div className="report-link-buttons">{founderContacts.map((contact) => <a key={contact.url} href={contact.url} target="_blank" rel="noopener noreferrer" aria-label={contact.label + ": " + contact.handle} title={contact.label + ": " + contact.handle}>{contact.label}<span>{contact.handle}</span></a>)}</div></div>}
    {projectLinks.length > 0 && <div className="report-links__group"><p className="report-links__label">Official project links</p><div className="report-link-buttons report-link-buttons--project">{projectLinks.map((link) => <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" aria-label={link.label} title={link.label}>{link.label}</a>)}</div></div>}
  </section>;
}
function SourceLinks({ startup }) {
  const links = [...new Map([startup.website, startup.xAccount, ...(startup.sources ?? [])].filter(Boolean).map((source) => {
    const item = typeof source === "string" ? { url: source } : source;
    return [item.url, item];
  })).values()];
  if (!links.length && !startup.methodologyNotes?.length && !startup.dataCutoff && !startup.lastReviewed) return null;
  return <section className="profile-section source-methodology-panel"><h3>Sources and methodology</h3>
    {links.length > 0 && <ul className="source-links">{links.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.label ?? source.url}</a>{source.note && <span>{source.note}</span>}</li>)}</ul>}
    {startup.methodologyNotes?.length > 0 && <ul className="methodology-notes">{startup.methodologyNotes.map((note) => <li key={note}>{note}</li>)}</ul>}
    <p className="last-reviewed">Data cutoff - {publicValue(startup.dataCutoff ?? startup.lastReviewed)}</p>
  </section>;
}

function isDevelopmentReport(startup) {
  return canonicalStartupStage(startup) === CANONICAL_STAGE.DEVNET;
}
function DevelopmentNotice({ startup }) {
  if (!isDevelopmentReport(startup)) return null;
  return <aside className="development-notice" role="note"><strong>Development environment</strong><p>This report measures development and testing activity. Devnet/Testnet transactions do not establish customer adoption, commercial usage or revenue.</p></aside>;
}
function DevelopmentProgress({ startup }) {
  const steps = startup.developmentProgress ?? [];
  if (!steps.length) return null;
  return <section className="report-section development-progress" aria-labelledby={`${startupSlug(startup)}-progress-title`}>
    <h3 id={`${startupSlug(startup)}-progress-title`}>Technical progression</h3>
    <p className="chart-summary">Evidence states are categorical and do not represent funnel conversion or commercial adoption.</p>
    <div className="development-progress__grid" role="list">{steps.map((step) => <article key={step.label} role="listitem" className={`development-progress__item development-progress__item--${step.state}`}><span>{step.stateLabel}</span><h4>{step.label}</h4><p>{step.detail}</p></article>)}</div>
  </section>;
}

function DevelopmentDisclosure({ startup, label, children }) {
  if (!isDevelopmentReport(startup)) return children;
  return <details className="development-disclosure" open><summary>{label}</summary><div className="development-disclosure__content">{children}</div></details>;
}

function ReportKpis({ startup }) {
  const metrics = startup.headlineKpis ?? verifiedMetricsFor(startup).slice(0, 6);
  if (!metrics.length) return null;
  return <section id="metrics" className="report-section"><h3>KPI dashboard</h3><div className="report-kpi-grid">{metrics.map((metric, index) => <MetricCard key={metric.label} id={`${startupSlug(startup)}-kpi-${index}`} queryId="researched_startups" sourceRows={[startup]} title={metric.label} value={metric.value} description={metric.qualifier} />)}</div></section>;
}
function ReportChart({ startup, chart, chartProps }) {
  return <DataComponent id={`${startupSlug(startup)}-${chart.id}`} variant="card" queryId="researched_startups" sourceRows={chart.rows} title={chart.title} kind="chart">
    <p className="chart-summary">{chart.summary}</p><ChartRenderer spec={chart.spec} rows={chart.rows} height={chart.height ?? 310} {...chartProps(`${startupSlug(startup)}-${chart.id}`)} />
  </DataComponent>;
}
function ReportCharts({ startup, chartProps }) {
  if (!startup.reportCharts?.length) return null;
  return <section className="report-section report-charts" aria-label="Main charts">{startup.reportCharts.map((chart) => <ReportChart key={chart.id} startup={startup} chart={chart} chartProps={chartProps} />)}</section>;
}
function ReportTables({ startup }) {
  if (!startup.reportTables?.length) return null;
  return <section className="report-section report-tables" aria-label="Supporting evidence tables">{startup.reportTables.map((table) => <DataComponent key={table.id} id={`${startupSlug(startup)}-${table.id}`} variant="card" queryId="researched_startups" sourceRows={table.rows} title={table.title} kind="table"><p className="chart-summary">{table.summary}</p><DataTable rows={table.rows} columns={table.columns} /></DataComponent>)}</section>;
}

function NarrativeSection({ startup, id, title, value }) {
  if (!value) return null;
  return <section className="report-section narrative-section"><RichNarrative id={`${startupSlug(startup)}-${id}`} value={`## ${title}\n\n${value}`} /></section>;
}
function ReportEvidence({ startup }) {
  return <section className="report-section report-evidence" aria-label="Evidence context">
    <section className="profile-section"><h3>Off-chain context</h3><p>{startup.whatItBuilds ?? startup.summary ?? startup.oneLine}</p><EvidenceLedger startup={startup} /></section>
    {startup.founderConfirmations?.length > 0 && <section className="profile-section founder-confirmations"><h3>Founder-confirmed context</h3><ul>{startup.founderConfirmations.map((item) => <li key={item.statement}>{item.statement}<small>{item.evidenceType}</small></li>)}</ul></section>}
    <TechnicalEntryPoints startup={startup} />
    {startup.nextAction && <section className="profile-section"><h3>Further research required</h3><p>{startup.nextAction}</p></section>}
    <div className="analysis-checklists"><AnalysisChecklist title="Completed research" items={startup.completedAnalysis} completed /><AnalysisChecklist title="Outstanding analysis" items={startup.outstandingAnalysis} /></div>
  </section>;
}
function EvidenceLimitations({ startup }) {
  const items = [...new Set([...(startup.evidenceBoundary ? [startup.evidenceBoundary] : []), ...(startup.limitations ?? []), ...(startup.dataQualityNotes ?? [])].filter(Boolean))];
  if (!items.length) return null;
  return <TextList title="Evidence limitations" items={items} className="data-warnings evidence-limitations" />;
}
const csvEscape = (value) => {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/u.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
};
const reportExportRows = (startup) => {
  const rows = [];
  const push = (row) => rows.push({ section: "", dataset: "", date: "", entity: displayName(startup), metric: "", value: "", unit: "", evidence_type: "", source: "", notes: "", ...row });
  const kpis = startup.headlineKpis ?? verifiedMetricsFor(startup).slice(0, 6);
  kpis.forEach((metric) => push({ section: "kpi", dataset: "headline_kpis", metric: metric.label, value: metric.value, unit: metric.unit ?? "", evidence_type: metric.qualifier ?? "", source: metric.sourceUrl ?? "", notes: metric.notes ?? "" }));
  (startup.reportCharts ?? []).forEach((chart) => chart.rows.forEach((row) => {
    const date = row.date ?? row.month ?? row.period ?? row.firstTransaction ?? "";
    const entity = row.wallet ?? row.walletLabel ?? row.program ?? row.group ?? row.market ?? displayName(startup);
    Object.entries(row).filter(([field]) => !["date", "month", "period", "wallet", "walletLabel", "program", "group", "market"].includes(field)).forEach(([metric, value]) => push({ section: "chart", dataset: chart.id, date, entity, metric, value, unit: chart.unit ?? "", evidence_type: chart.evidenceType ?? "", source: chart.sourceUrl ?? "", notes: chart.summary ?? "" }));
  }));
  (startup.reportTables ?? []).forEach((table) => table.rows.forEach((row) => {
    const date = row.date ?? row.month ?? row.period ?? row.firstTransaction ?? "";
    const entity = row.wallet ?? row.program ?? row.group ?? displayName(startup);
    Object.entries(row).filter(([field]) => !["date", "month", "period", "wallet", "program", "group"].includes(field)).forEach(([metric, value]) => push({ section: "table", dataset: table.id, date, entity, metric, value, unit: table.unit ?? "", evidence_type: table.evidenceType ?? "", source: table.sourceUrl ?? "", notes: table.summary ?? "" }));
  }));
  (startup.technicalEntryPoints ?? []).filter((entry) => entry.address).forEach((entry) => push({ section: "evidence", dataset: "technical_entry_points", entity: entry.name, metric: entry.type, value: entry.address, unit: entry.network, evidence_type: entry.attributionStatus, source: entry.explorerUrl ?? "", notes: "" }));
  (startup.founderConfirmations ?? []).forEach((item) => push({ section: "evidence", dataset: "founder_confirmations", metric: "Founder confirmation", value: item.statement, evidence_type: item.evidenceType, notes: "" }));
  return rows;
};
function ReportCsvExport({ startup }) {
  const rows = reportExportRows(startup);
  if (!rows.length) return null;
  const download = () => {
    const columns = ["section", "dataset", "date", "entity", "metric", "value", "unit", "evidence_type", "source", "notes"];
    const csv = [columns.join(","), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(","))].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = startupSlug(startup) + "-report-data.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };
  return <section className="report-export" aria-label="Report data export"><button type="button" onClick={download}>Download report data · CSV</button></section>;
}

const shortAddress = (address) => address.length > 14 ? address.slice(0, 6) + "..." + address.slice(-4) : address;
function StartupProgression({ stage }) {
  const current = stage === CANONICAL_STAGE.HISTORICAL_MAINNET ? CANONICAL_STAGE.MAINNET : stage;
  const journey = [CANONICAL_STAGE.BUILDING, CANONICAL_STAGE.DEVNET, CANONICAL_STAGE.MAINNET, "GROWTH"];
  return <section className="startup-progress" aria-label="Startup progression">
    <span>Startup progression</span>
    <ol>{journey.map((item) => <li key={item} aria-current={item === current ? "step" : undefined} className={item === current ? "current" : ""}>{item === "GROWTH" ? "Growth" : canonicalStageLabel[item]}</li>)}</ol>
  </section>;
}
function PublicPerformanceStatus({ startup, contract }) {
  const hasPerformance = Boolean((startup.headlineKpis ?? []).length || verifiedMetricsFor(startup).length);
  if (hasPerformance) return <section className="performance-intro"><div><p className="eyebrow">Performance</p><h3>What the startup is doing on-chain.</h3></div><p>Reviewed results are shown with their evidence limits and research cutoff.</p></section>;
  const stage = canonicalStartupStage(startup);
  const message = stage === CANONICAL_STAGE.DEVNET
    ? "This startup has reached Devnet. Development activity can be celebrated here, while customer usage, volume and revenue wait for Mainnet."
    : stage === CANONICAL_STAGE.MAINNET && contract?.attributionState === "awaiting_attribution"
      ? "This startup is on Mainnet, but independent performance is not published until an official on-chain source can be attributed to it."
      : stage === CANONICAL_STAGE.MAINNET
        ? "This startup is on Mainnet. Performance will appear here when a reviewed measurement cycle is available."
        : "Performance tracking begins when the startup reaches an attributable on-chain milestone.";
  return <section className="performance-empty"><p className="eyebrow">Performance</p><h3>Metrics are not published yet.</h3><p>{message}</p></section>;
}
function ResearchDetails({ startup }) {
  return <details className="research-details"><summary><span>Research, evidence and methodology</span><small>Addresses, verification, limitations and sources</small></summary><div className="research-details__content">
    <ReportEvidence startup={startup} />
    <EvidenceLimitations startup={startup} />
    <ReportCsvExport startup={startup} />
    <SourceLinks startup={startup} />
  </div></details>;
}
function MeasurementStatus({ startup, contract }) {
  if (!contract) return null;
  return <section className="measurement-status" aria-labelledby={startupSlug(startup) + "-measurement-title"}>
    <div className="measurement-status__heading"><div><p className="eyebrow">Measurement system</p><h3 id={startupSlug(startup) + "-measurement-title"}>Measurement status</h3></div></div>
    <div className="measurement-status__grid measurement-status__grid--coverage-first">
      <section className="measurement-panel"><h4>Data coverage</h4><ul className="measurement-coverage">{contract.coverage.map((item) => <li key={item.label}><span>{item.label}</span><strong data-status={item.status}>{item.statusLabel}</strong></li>)}</ul></section>
      <section className="measurement-panel"><h4>Known on-chain infrastructure</h4>{contract.sources.length ? <ul className="measurement-sources">{contract.sources.map((source) => <li key={source.label + source.address}><div><strong>{source.label}</strong><span>{source.confirmation}</span></div>{source.explorerUrl ? <a href={source.explorerUrl} target="_blank" rel="noopener noreferrer" title={source.address} aria-label={source.label + ": " + source.address}>{shortAddress(source.address)}</a> : <code title={source.address}>{shortAddress(source.address)}</code>}</li>)}</ul> : <p className="measurement-empty">{contract.sourceEmptyMessage}</p>}</section>
    </div>
    <section className="measurement-panel measurement-performance"><h4>Performance</h4><div className="measurement-metrics">{contract.metrics.map((metric) => <article key={metric.label}><span>{metric.label}</span><strong aria-label={metric.label + " value unavailable"}>—</strong><small>{metric.statusLabel}</small></article>)}</div></section>
    <p className="measurement-status__note">No live pipeline values are connected. Research aggregates elsewhere in this report are not promoted into this measurement contract.</p>
  </section>;
}
function StartupDetail({ startup, onBack, chartProps }) {
  const narrative = startup.reportNarrative ?? {};
  const finding = startup.canonicalFinding ?? startup.finding;
  const continuity = narrative.retention ?? narrative.testingContinuity ?? narrative.continuity;
  const stage = canonicalStartupStage(startup);
  const contract = buildStartupMeasurementStatus(startup, { stage, attributionState: attributionState(startup) });
  return <section className={"startup-profile startup-profile--" + technicalGroup(startup).toLowerCase().replace(/[^a-z]+/g, "-")} aria-label={displayName(startup) + " profile"}>
    <button type="button" className="profile-back" onClick={onBack}>&larr; Back to All Startups</button>
    <header className="startup-detail__header startup-intelligence-hero">
      <ProjectLogo startup={startup} profile />
      <div><p className="eyebrow">{startup.sector}</p><h2>{displayName(startup)}</h2><p>{startup.whatItBuilds ?? startup.summary}</p><div className="startup-hero__actions"><StatusPill tone={canonicalStageTone[stage]}>{canonicalStageLabel[stage]}</StatusPill>{projectLinksFor(startup).slice(0, 2).map((link) => <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer">{link.label} ↗</a>)}</div></div>
    </header>
    <StartupProgression stage={stage} />
    <PublicPerformanceStatus startup={startup} contract={contract} />
    <ReportKpis startup={startup} />
    <section className="canonical-finding"><p className="eyebrow">Canonical finding</p><RichNarrative id={startupSlug(startup) + "-canonical-finding"} value={finding} /></section>
    <DevelopmentNotice startup={startup} />
    <DevelopmentProgress startup={startup} />
    <ReportCharts startup={startup} chartProps={chartProps} />
    <ReportTables startup={startup} />
    <NarrativeSection startup={startup} id="what-happened" title="What happened" value={narrative.whatHappened} />
    <NarrativeSection startup={startup} id="drivers" title="What drove the observable activity" value={narrative.whatDroveIt} />
    <NarrativeSection startup={startup} id="testing-drivers" title="Who or which wallets or cohorts drove it" value={narrative.whoDroveIt ?? narrative.testingDrivers} />
    <NarrativeSection startup={startup} id="continuity" title="Whether activity continued or users returned" value={continuity} />
    <NarrativeSection startup={startup} id="evidence-demonstrates" title="What the test activity demonstrates" value={narrative.whatEvidenceDemonstrates} />
    <NarrativeSection startup={startup} id="implication" title="Superteam implication" value={narrative.superteamImplication} />
    <ResearchDetails startup={startup} />
    {isDevelopmentReport(startup) && <p className="static-research-notice">This report reflects evidence available up to the stated data cutoff. Metrics are not continuously updated unless a new research cycle is completed.</p>}
  </section>;
}const internalResearchPipeline = ["Directory intake", "Identity verification", "Product research", "Technical classification", "Evidence collection", "Queue assignment", "Publication"];

function QueueList({ rows }) {
  return <section className="mainnet-queue" aria-label="Mainnet analysis queue"><h2>Mainnet analysis queue</h2><div>{rows.map((row) => <article key={row.profilePath}><div><h3>{row.startup}</h3><p>{row.network}</p></div><StatusPill tone={row.addressStatus === "Verified address - ready for analysis" ? "verified" : "outstanding"}>{row.addressStatus}</StatusPill>{row.entryPoint && <a href={row.entryPointUrl} target="_blank" rel="noopener noreferrer">{row.entryPoint}</a>}<p>{row.nextAction}</p><a href={row.profilePath}>Open startup profile</a></article>)}</div></section>;
}

const addressStatus = (startup) => {
  const entries = (startup.technicalEntryPoints ?? []).filter((entry) => entry.address);
  if (!entries.length) return "On-chain address needed";
  const officiallyAttributed = entries.some((entry) => {
    const attribution = String(entry.attributionStatus ?? "");
    const explicitlyUnconfirmed = /not yet|unconfirmed|candidate|probable|third-party|verification needed|requires? confirmation/iu.test(attribution);
    return !explicitlyUnconfirmed && /official(?:ly)?|founder-confirmed|verified attribution/iu.test(attribution);
  });
  return officiallyAttributed ? "Verified address - ready for analysis" : "Address found - verification needed";
};
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

function AskDandyView() {
  return <section className="ask-dandy" aria-labelledby="ask-dandy-title"><p className="eyebrow">Ask Dandy</p><h2 id="ask-dandy-title">Research assistant coming soon.</h2><p>This placeholder reserves the approved Superteam research-assistant location. No chatbot backend or live answer generation is enabled yet.</p></section>;
}
function DirectoryControls({ search, setSearch, technical, setTechnical, sector, setSector, sort, setSort, sectors }) {
  return <section className="directory-controls" aria-label="Startup directory controls">
    <label className="directory-search"><span>Search startups</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, founder, sector or address" /></label>
    <label><span>Technical stage</span><select value={technical} onChange={(event) => setTechnical(event.target.value)}>{["All", "Off-chain", "Building", "Devnet", "Mainnet", "Historical Mainnet", "Unresolved", "Inactive"].map((value) => <option key={value}>{value}</option>)}</select></label>
    <label><span>Sector</span><select value={sector} onChange={(event) => setSector(event.target.value)}><option>All</option>{sectors.map((value) => <option key={value}>{value}</option>)}</select></label>
    <label><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="directory">Directory order</option><option value="name">Name A-Z</option><option value="technical">Technical stage</option><option value="research">Research status</option></select></label>
  </section>;
}

export function DashboardContent() {
  const { snapshot, reviewedRows, chartProps } = useDataApp();
  const startups = reviewedRows("researched_startups");
  const [pathname, setPathname] = useState(currentPathname);
  const [search, setSearch] = useState("");
  const [technical, setTechnical] = useState("All");
  const [sector, setSector] = useState("All");
  const [sort, setSort] = useState("directory");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
  const ecosystemStages = useMemo(() => deriveEcosystemStageCounts(startups), [startups]);
  const measuredCount = useMemo(() => startups.filter((startup) => canonicalStartupStage(startup) === CANONICAL_STAGE.MAINNET && (startup.headlineKpis ?? []).length > 0).length, [startups]);
  const statusRows = useMemo(() => distributionRows(startups.map((item) => item.technicalState), "category"), [startups]);
  const stageRows = useMemo(() => distributionRows(startups.map((item) => normalizedStage(item.directoryStage ?? item.stage)), "stage"), [startups]);
  const queueRows = useMemo(() => startups.filter(isMainnet).map((item) => ({
    startup: displayName(item), currentBrand: item.currentBrand ?? "", network: item.technicalStatus,
    entryPoint: item.technicalEntryPoints?.[0]?.address ?? null, entryPointUrl: item.technicalEntryPoints?.[0]?.explorerUrl,
    addressStatus: addressStatus(item), nextAction: item.nextAction, status: "Queued", profilePath: startupPath(item),
  })), [startups]);
  const sectors = useMemo(() => [...new Set(startups.flatMap(sectorTags))].sort((a, b) => a.localeCompare(b)), [startups]);
  const visibleStartups = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = startups.filter((startup) => {
      const searchable = [displayName(startup), startup.founder, startup.directoryFounder, startup.sector, startup.oneLine, startup.summary, startup.whatItBuilds, startup.canonicalFinding, startup.technicalStatus, ...(startup.technicalEntryPoints ?? []).map((entry) => entry.address)].filter(Boolean).join(" ").toLowerCase();
      return (!term || searchable.includes(term))
        && (technical === "All" || technicalGroup(startup) === technical)
        && (sector === "All" || sectorTags(startup).includes(sector));
    });
    return [...filtered].sort((a, b) => sort === "name" ? displayName(a).localeCompare(displayName(b))
      : sort === "technical" ? technicalGroup(a).localeCompare(technicalGroup(b))
        : sort === "research" ? researchStatus(a).localeCompare(researchStatus(b))
          : startups.indexOf(a) - startups.indexOf(b));
  }, [search, sector, sort, startups, technical]);

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
    setMobileMenuOpen(false);
  };
  const navClick = (path) => (event) => {
    if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      navigateTo(path);
    }
  };
  const navItems = [
    { view: "overview", path: "/", label: "Overview", icon: "\u2302" },
    { view: "archive", path: "/startups", label: "Startups", icon: "\u25A6" },
    { view: "ask-dandy", path: "/ask-dandy", label: "Ask Dandy", icon: "\u2726" },
  ];

  return <article className="page startup-archive" aria-label="Superteam UK startup analytics"><div className="archive-frame">
    <aside className="archive-rail" aria-label="Analytics sections"><BrandMark />{navItems.map((item) => <a key={item.path} className={view === item.view ? "active" : ""} href={item.path} onClick={navClick(item.path)} aria-label={item.label}><span aria-hidden="true">{item.icon}</span></a>)}</aside>
    <div className="archive-main">
      <header className={`archive-header${view === "archive" && !selected ? " archive-header--directory" : ""}${selected ? " archive-header--profile" : ""}`}><div><p className="eyebrow">Superteam / UK</p><h1>From building<br />to <em>Mainnet.</em></h1><p className="header-description">Follow the startups building in the UK, celebrate each on-chain milestone and see what happens after launch.</p></div><nav className="header-actions" aria-label="Primary views">{navItems.map((item) => <a key={item.path} className={view === item.view ? "active" : ""} href={item.path} onClick={navClick(item.path)}>{item.label}</a>)}</nav><button type="button" className="mobile-menu-trigger" aria-label="Open website navigation" aria-controls="mobile-site-menu" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen((open) => !open)}><span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span></button>{mobileMenuOpen && <nav id="mobile-site-menu" className="mobile-site-menu" aria-label="Website navigation">{navItems.map((item) => <a key={item.path} className={view === item.view ? "active" : ""} href={item.path} onClick={navClick(item.path)}>{item.label}</a>)}</nav>}</header>
      {view === "overview" && <>
        <section className="metric-strip" aria-label="Research progress">
          <MetricCard id="directory-size" queryId="research_summary" sourceRows={[summary]} title="Directory universe" value={String(summary.directoryStartups)} description="Published startup records." />
          <MetricCard id="researched" queryId="research_summary" sourceRows={[summary]} title="Researched" value={`${summary.researched} of ${summary.directoryStartups}`} description={`${Number((summary.completionRate * 100).toFixed(2))}% complete.`} />
          <MetricCard id="non-mainnet" queryId="research_summary" sourceRows={[summary]} title="Queue A" value={String(summary.nonMainnet)} description="Off-chain, devnet or testnet." />
          <MetricCard id="mainnet" queryId="research_summary" sourceRows={[summary]} title="Queue B" value={String(summary.mainnetQueue)} description="Mainnet analysis pending." />
        </section>
        <section className="insight-banner"><div><span>Current finding</span><h2>Public presence does not equal measurable on-chain activity.</h2></div><p>{summary.nonMainnet} of {summary.researched} researched startups are currently classified as devnet/testnet, off-chain, infrastructure or unverified. {summary.mainnetQueue} are routed to address-led mainnet analysis.</p></section>
        <DataComponent id="mainnet-queue-table" variant="card" queryId="mainnet_queue" sourceRows={queueRows} title="Mainnet analysis queue" kind="table"><DataTable rows={queueRows} columns={queueColumns} /></DataComponent>
      </>}
      {view === "archive" && !route.notFound && (selected
        ? <StartupDetail startup={selected} onBack={() => navigateTo("/startups")} chartProps={chartProps} />
        : <section className="startup-directory" aria-label="Startup directory"><section className="ecosystem-stage-summary" aria-label="Ecosystem progression summary"><div className="ecosystem-stage-summary__intro"><p className="eyebrow">The startup journey</p><h2>Ship. Reach Devnet. Launch on Mainnet. Prove growth.</h2><p>Every stage is a milestone worth recognising. Once a startup reaches attributable Mainnet activity, performance tracking can begin.</p></div><div className="ecosystem-stage-summary__primary"><div><span>All startups</span><strong>{ecosystemStages.total}</strong></div><button type="button" className={technical === "Building" ? "active" : ""} onClick={() => setTechnical(technical === "Building" ? "All" : "Building")}><span>Building</span><strong>{ecosystemStages.BUILDING}</strong><small>Preparing to ship</small></button><button type="button" className={technical === "Devnet" ? "active" : ""} onClick={() => setTechnical(technical === "Devnet" ? "All" : "Devnet")}><span>Devnet</span><strong>{ecosystemStages.DEVNET}</strong><small>First on-chain milestone</small></button><button type="button" className={technical === "Mainnet" ? "active" : ""} onClick={() => setTechnical(technical === "Mainnet" ? "All" : "Mainnet")}><span>Mainnet</span><strong>{ecosystemStages.MAINNET}</strong><small>Live on-chain</small></button><div><span>Performance</span><strong>{measuredCount}</strong><small>Reviewed metrics available</small></div></div><p className="ecosystem-stage-summary__secondary"><span>{ecosystemStages.OFFCHAIN} without a verified on-chain deployment</span><span>{ecosystemStages.HISTORICAL_MAINNET} historical</span><span>{ecosystemStages.UNRESOLVED} unresolved</span><span>{ecosystemStages.INACTIVE} inactive</span></p></section><DirectoryControls search={search} setSearch={setSearch} technical={technical} setTechnical={setTechnical} sector={sector} setSector={setSector} sort={sort} setSort={setSort} sectors={sectors} /><p className="directory-result-count" aria-live="polite">Showing {visibleStartups.length} of {startups.length} startups</p><div className="startup-list">{visibleStartups.map((startup) => <StartupCard key={startup.id} startup={startup} onNavigate={navigateTo} />)}</div></section>)}
      {view === "insights" && <InsightsView statusRows={statusRows} stageRows={stageRows} queueRows={queueRows} chartProps={chartProps} researchedCount={summary.researched} />}
      {view === "ask-dandy" && <AskDandyView />}
      {route.notFound && <section className="route-not-found" role="status"><p className="eyebrow">Not found</p><h2>Startup profile unavailable.</h2><p>The URL does not match a verified startup profile.</p><button type="button" onClick={() => navigateTo("/startups")}>Return to startups</button></section>}
      <footer className="archive-footer"><span>Evidence-led research by Olamilekan Alaga</span><span>Data cutoff &middot; {snapshot.report?.asOf ?? "2026-09-02"}</span></footer>
    </div>
  </div></article>;
}
