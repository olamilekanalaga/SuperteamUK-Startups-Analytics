import React from "react";
import { ChartRenderer, DataComponent, DataTable, MetricCard, ReportSection, RichNarrative, useDataApp } from "../../data-app-public.jsx";

const verticalSpec = { type: "rankedList", x: "vertical", y: "startups" };
const disciplineSpec = { type: "bar", x: "discipline", y: "members" };
const stageSpec = { type: "rankedList", x: "stage", y: "startups" };
const startupColumns = [
  { field: "startup", label: "Startup", presentation: "identity", secondaryField: "stage" },
  { field: "verticals", label: "Verticals" },
  { field: "linkedPeople", label: "Member-directory people" },
  { field: "linkage", label: "Linkage", presentation: "status" },
];
const missingColumns = [
  { field: "item", label: "Record", presentation: "identity" },
  { field: "profileEvidence", label: "Stored evidence" },
  { field: "directoryResult", label: "Directory result" },
  { field: "storedRegistration", label: "Registration detail" },
  { field: "finding", label: "Finding", presentation: "status" },
];

export function ReportContent() {
  const { snapshot, chartProps, canEdit, mode, appTitle, setAppTitle } = useDataApp();
  const q = snapshot.queries;
  const summary = q.directory_summary.rows[0];
  const verticals = q.startup_verticals.rows;
  const disciplines = q.member_disciplines.rows;
  const stages = q.startup_stages.rows;
  const startups = q.startup_linkage.rows;
  const missing = q.missing_registration.rows;
  return <article className="report-content" aria-label="Superteam UK directory report">
    <header className="report-hero">
      <h1 data-data-app-title contentEditable={canEdit && mode === "edit"} suppressContentEditableWarning
        onBlur={canEdit && mode === "edit" ? e => setAppTitle(e.currentTarget.textContent.trim() || appTitle) : undefined}>{appTitle}</h1>
      <RichNarrative id="report:intro" className="report-deck" label="Edit introduction" value="A live, authenticated review of the Superteam UK Member and Startup directories. The report separates unique records from multi-label category assignments and treats founder linkage as a directory-data relationship—not an assumption." />
    </header>

    <ReportSection id="summary" queryId="directory_summary" sourceRows={q.directory_summary.rows} showHeading={false}>
      <RichNarrative id="summary:body" label="Edit executive finding" value={`## The live directory contains 66 startups, not 70

The Startup Directory currently exposes **${summary.listedStartups} startup cards** and the Member Directory exposes **${summary.listedMembers} searchable member profiles**. Against the verbally stated figure of 70 startups, the visible directory is **4 records lower (5.7%)**. That difference cannot be explained from the interface: it may represent pending, rejected, duplicated, unpublished or removed records.

Vertical and discipline totals are multi-label. The 66 startups carry **${summary.verticalAssignments} vertical assignments**, while 149 members carry **${summary.disciplineAssignments} discipline assignments**.`} />
    </ReportSection>

    <div className="report-facts" aria-label="Directory metrics">
      <MetricCard id="metric-startups" queryId="directory_summary" sourceRows={q.directory_summary.rows} title="Listed startups" value="66" description="Unique visible startup cards." />
      <MetricCard id="metric-members" queryId="directory_summary" sourceRows={q.directory_summary.rows} title="Listed members" value="149" description="Visible searchable profiles, not all created accounts." />
      <MetricCard id="metric-linked" queryId="directory_summary" sourceRows={q.directory_summary.rows} title="Founder-role linked" value="24 / 66" comparison="36.4% of startups" description="Company match plus founder or CEO-type role." />
      <MetricCard id="metric-gap" queryId="directory_summary" sourceRows={q.directory_summary.rows} title="Gap vs stated 70" value="−4" comparison="−5.7%" negative description="Reported benchmark versus live directory." />
    </div>

    <section className="report-section">
      <ReportSection id="vertical-analysis" queryId="startup_verticals" sourceRows={verticals} showHeading={false}>
        <RichNarrative id="vertical-analysis:body" label="Edit vertical analysis" value="## Startup verticals

**DeFi (27)** and **Consumer (26)** are the largest verticals, followed by **Infra (18)**, **Gaming (14)** and **AI (13)**. Categories overlap, so the figures describe ecosystem exposure rather than mutually exclusive market share." />
      </ReportSection>
      <DataComponent id="vertical-chart" variant="card" queryId="startup_verticals" sourceRows={verticals} title="Startups by vertical" kind="chart" chart={verticalSpec}>
        <ChartRenderer spec={verticalSpec} rows={verticals} height={570} {...chartProps("vertical-chart")} />
      </DataComponent>
    </section>

    <div className="report-two-up">
      <section className="report-section">
        <ReportSection id="discipline-analysis" queryId="member_disciplines" sourceRows={disciplines} showHeading={false}>
          <RichNarrative id="discipline-analysis:body" label="Edit member analysis" value="## Member disciplines

Business is dominant (94), followed by Engineering (45) and Creator (37). Members can select several disciplines." />
        </ReportSection>
        <DataComponent id="discipline-chart" variant="card" queryId="member_disciplines" sourceRows={disciplines} title="Members by discipline" kind="chart" chart={disciplineSpec}>
          <ChartRenderer spec={disciplineSpec} rows={disciplines} height={300} {...chartProps("discipline-chart")} />
        </DataComponent>
      </section>
      <section className="report-section">
        <ReportSection id="stage-analysis" queryId="startup_stages" sourceRows={stages} showHeading={false}>
          <RichNarrative id="stage-analysis:body" label="Edit stage analysis" value="## Startup stages

Twenty startups are raising pre-seed and 14 are self-funded. Four wound-down and one exited project remain listed, so this is a portfolio inventory—not a count of active startups." />
        </ReportSection>
        <DataComponent id="stage-chart" variant="card" queryId="startup_stages" sourceRows={stages} title="Startups by stage" kind="chart" chart={stageSpec}>
          <ChartRenderer spec={stageSpec} rows={stages} height={360} {...chartProps("stage-chart")} />
        </DataComponent>
      </section>
    </div>

    <section className="report-section">
      <ReportSection id="linkage-summary" queryId="startup_linkage" queryIds={["startup_linkage","directory_summary"]} sourceRowsByQuery={{startup_linkage:startups,directory_summary:q.directory_summary.rows}} showHeading={false}>
        <RichNarrative id="linkage-summary:body" label="Edit linkage analysis" value="## Founder and member linkage is incomplete

Company-name matching connects **27 of 66 startups (40.9%)** to at least one Member Directory profile. Only **24 startups (36.4%)** have a matched person with a founder or CEO-type role. The other 39 startups should be recorded as **no directory-linked member found**, not as founderless." />
      </ReportSection>
      <DataComponent id="linkage-table" variant="card" queryId="startup_linkage" sourceRows={startups} title="All 66 startups: verticals and linked people" kind="table" className="wide-table">
        <DataTable rows={startups} columns={startupColumns} />
      </DataComponent>
    </section>

    <section className="report-section">
      <ReportSection id="missing-analysis" queryId="missing_registration" sourceRows={missing} showHeading={false}>
        <RichNarrative id="missing-analysis:body" label="Edit missing registration analysis" value="## Olamilekan and Aladdin are registered but unpublished

Olamilekan Alaga’s authenticated profile is **100% complete**, identifies him as **Data Scientist · Aladdin**, and stores Aladdin as an attached Startup organisation with its website, `@TradeAladdin`, **Infra** vertical and **Cooking** stage. Nevertheless, neither Olamilekan nor Aladdin appears in the corresponding directory search.

The profile’s **Directory visibility** section exists but is blank. The strongest supported conclusion is a publication-status, approval or synchronisation gap. The interface exposes no approval state, rejection reason or visibility control, so the root cause cannot be confirmed from the member view." />
      </ReportSection>
      <DataComponent id="missing-table" variant="card" queryId="missing_registration" sourceRows={missing} title="Missing-listing evidence" kind="table" className="wide-table">
        <DataTable rows={missing} columns={missingColumns} />
      </DataComponent>
    </section>

    <ReportSection id="recommendations" queryId="directory_summary" sourceRows={q.directory_summary.rows} showHeading={false}>
      <RichNarrative id="recommendations:body" label="Edit recommendations" value="## Recommended directory fixes

1. Rename the Startup Directory counter from **founders** to **startups**, or show both separately.
2. Add submission states: **draft, pending review, approved, rejected, unpublished and archived**.
3. Show a working Directory visibility control and hold/rejection reason.
4. Link startup records to member IDs and label founder roles explicitly.
5. Reconcile the stated 70 startups against the 66 visible records and publish the inclusion rule.
6. Review Olamilekan and Aladdin because their registration data is stored but neither record is published." />
    </ReportSection>
    <RichNarrative id="methods" className="report-disclosure" label="Edit methods note" value="**Method.** Read-only authenticated snapshot on 31 August 2026. Counts came from live directory counters, all startup profiles, member discipline filters, exact searches and normalized company-name matching. No backend approval queue was accessible. Personal contact details are excluded." />
  </article>;
}
