import {
  buildCanonicalReleaseVerdictForRevision,
  buildReleaseVerdictForRevision,
  empiricalCampaignSignature,
  evaluateEmpiricalCampaign,
  mergeValidationEvidence,
  parseEmpiricalCampaignJson,
  parseGateBPlanJson,
  parseGateCPlanJson,
  parseValidationEvidenceJson,
  type EmpiricalCampaignV1,
  type GateBPlanV1,
  type GateCPlanV1,
  type ValidationEvidenceV5,
} from "@everything-rings/validation";
import { useMemo, useState } from "react";

const SOFTWARE_REVISION = ((import.meta as ImportMeta & { readonly env?: { readonly VITE_SOFTWARE_REVISION?: string } }).env?.VITE_SOFTWARE_REVISION ?? "").trim();
const SOFTWARE_REVISION_VALID = /^[0-9a-f]{40}$/.test(SOFTWARE_REVISION);

function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function Verdict({ passed }: { readonly passed: boolean }) {
  return <span className={`gate-verdict ${passed ? "gate-pass" : "gate-open"}`}>{passed ? "PASS" : "OPEN"}</span>;
}

function Reasons({ reasons }: { readonly reasons: readonly string[] }) {
  if (reasons.length === 0) return <p className="small">All frozen criteria satisfied.</p>;
  return <ul className="reason-list">{reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>;
}

export function ReleaseApp() {
  const [evidence, setEvidence] = useState<ValidationEvidenceV5[]>([]);
  const [campaign, setCampaign] = useState<EmpiricalCampaignV1>();
  const [gateBPlan, setGateBPlan] = useState<GateBPlanV1>();
  const [gateCPlan, setGateCPlan] = useState<GateCPlanV1>();
  const [errors, setErrors] = useState<string[]>([]);

  const gateBReviews = useMemo(() => evidence.flatMap((bundle) => bundle.gateBReviews), [evidence]);
  const gateCReviews = useMemo(() => evidence.flatMap((bundle) => bundle.gateCReviews), [evidence]);
  const campaignProgress = useMemo(
    () => campaign === undefined ? undefined : evaluateEmpiricalCampaign(campaign, evidence),
    [campaign, evidence],
  );
  const baseVerdict = useMemo(
    () => buildReleaseVerdictForRevision(evidence, gateBReviews, gateCReviews, "preview", SOFTWARE_REVISION),
    [evidence, gateBReviews, gateCReviews],
  );
  const canonicalVerdict = useMemo(
    () => buildCanonicalReleaseVerdictForRevision(
      evidence,
      gateBReviews,
      gateCReviews,
      "preview",
      SOFTWARE_REVISION,
      campaignProgress,
      gateBPlan,
      gateCPlan,
    ),
    [evidence, gateBReviews, gateCReviews, campaignProgress, gateBPlan, gateCPlan],
  );

  function reject(filename: string, error: string): void {
    setErrors((current) => [...current.filter((item) => !item.startsWith(`${filename}:`)), `${filename}: ${error}`]);
  }

  async function importCampaign(file: File | undefined): Promise<void> {
    if (file === undefined) return;
    const parsed = parseEmpiricalCampaignJson(await file.text());
    if (!parsed.ok) return reject(file.name, parsed.error);
    setCampaign(parsed.campaign);
    setErrors((current) => current.filter((error) => !error.startsWith(`${file.name}:`)));
  }

  async function importGateBPlan(file: File | undefined): Promise<void> {
    if (file === undefined) return;
    const parsed = parseGateBPlanJson(await file.text());
    if (!parsed.ok) return reject(file.name, parsed.error);
    setGateBPlan(parsed.plan);
    setErrors((current) => current.filter((error) => !error.startsWith(`${file.name}:`)));
  }

  async function importGateCPlan(file: File | undefined): Promise<void> {
    if (file === undefined) return;
    const parsed = parseGateCPlanJson(await file.text());
    if (!parsed.ok) return reject(file.name, parsed.error);
    setGateCPlan(parsed.plan);
    setErrors((current) => current.filter((error) => !error.startsWith(`${file.name}:`)));
  }

  async function importFiles(files: FileList | null): Promise<void> {
    if (files === null) return;
    const loaded: Array<{ readonly filename: string; readonly evidence: ValidationEvidenceV5 }> = [];
    const nextErrors: string[] = [];
    for (const file of Array.from(files)) {
      const result = parseValidationEvidenceJson(await file.text());
      if (result.ok) loaded.push({ filename: file.name, evidence: result.evidence });
      else nextErrors.push(`${file.name}: ${result.error}`);
    }

    const bySession = new Map(evidence.map((bundle) => [bundle.sessionId, bundle]));
    for (const item of loaded) {
      const existing = bySession.get(item.evidence.sessionId);
      if (existing === undefined) {
        bySession.set(item.evidence.sessionId, item.evidence);
        continue;
      }
      const merged = mergeValidationEvidence(existing, item.evidence);
      if (!merged.ok) nextErrors.push(`${item.filename}: ${merged.error}`);
      else bySession.set(item.evidence.sessionId, merged.evidence);
    }
    setEvidence([...bySession.values()].sort((left, right) => left.object.label.localeCompare(right.object.label)));
    setErrors(nextErrors);
  }

  function clearAll(): void {
    setEvidence([]);
    setCampaign(undefined);
    setGateBPlan(undefined);
    setGateCPlan(undefined);
    setErrors([]);
  }

  function exportVerdict(): void {
    const createdAt = new Date().toISOString();
    const finalVerdict = buildCanonicalReleaseVerdictForRevision(
      evidence,
      gateBReviews,
      gateCReviews,
      createdAt,
      SOFTWARE_REVISION,
      campaignProgress,
      gateBPlan,
      gateCPlan,
    );
    downloadJson(`everything-rings-canonical-release-verdict-${Date.now()}.json`, {
      ...finalVerdict,
      evidenceContractVersion: "validation-evidence-5",
      gateAContractVersion: "gate-a-2",
      gateBPlanContractVersion: "gate-b-plan-1",
      gateCPlanContractVersion: "gate-c-plan-1",
      authorizedCollectionSoftwareRevision: SOFTWARE_REVISION_VALID ? SOFTWARE_REVISION : null,
      empiricalCampaign: campaign === undefined ? null : {
        campaignContractVersion: campaign.campaignContractVersion,
        campaignId: campaign.campaignId,
        campaignSignature: empiricalCampaignSignature(campaign),
        authorizedSoftwareRevision: campaign.authorizedSoftwareRevision,
        progress: campaignProgress,
      },
      gateBPlan: gateBPlan ?? null,
      gateCPlan: gateCPlan ?? null,
      evidenceSessions: evidence.map((bundle) => ({
        sessionId: bundle.sessionId,
        object: bundle.object,
        createdAt: bundle.createdAt,
        softwareRevision: bundle.softwareRevision,
      })),
    });
  }

  const canonicalB = canonicalVerdict.gateB;
  const canonicalC = canonicalVerdict.gateC;

  return <main className="shell release-shell">
    <header>
      <p className="eyebrow">EVERYTHING RINGS / RELEASE CONSOLE</p>
      <h1>Empirical release gates</h1>
      <p className="lede">Canonical release authority requires the complete precommitted campaign, Gate A2, one frozen five-target/two-reviewer Gate B plan, and one frozen four-target/two-reviewer/two-device Gate C plan. All evaluation remains local and microphone PCM is never imported.</p>
    </header>

    <section className="release-import">
      <label className="file-button">IMPORT CAMPAIGN<input type="file" accept="application/json,.json" onChange={(event) => { void importCampaign(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} /></label>
      <label className="file-button">IMPORT EVIDENCE<input type="file" accept="application/json,.json" multiple onChange={(event) => { void importFiles(event.currentTarget.files); event.currentTarget.value = ""; }} /></label>
      <label className="file-button">IMPORT GATE B PLAN<input type="file" accept="application/json,.json" onChange={(event) => { void importGateBPlan(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} /></label>
      <label className="file-button">IMPORT GATE C PLAN<input type="file" accept="application/json,.json" onChange={(event) => { void importGateCPlan(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} /></label>
      <button className="secondary" disabled={evidence.length === 0 && campaign === undefined && gateBPlan === undefined && gateCPlan === undefined} onClick={clearAll}>CLEAR</button>
      <button disabled={evidence.length === 0} onClick={exportVerdict}>EXPORT CANONICAL VERDICT</button>
    </section>

    <p className="small">{campaign === undefined ? "no campaign" : campaign.campaignId} · {evidence.length} sessions · Gate B plan {gateBPlan === undefined ? "missing" : "loaded"} · Gate C plan {gateCPlan === undefined ? "missing" : "loaded"} · {gateBReviews.length} B judgments · {gateCReviews.length} C judgments</p>
    {errors.length > 0 ? <section className="import-errors"><h2>Rejected files</h2><Reasons reasons={errors} /></section> : null}

    <section className="release-status">
      <article className="release-card release-overall">
        <div className="release-card-head"><div><p className="eyebrow">CANONICAL RELEASE / V8</p><h2>{canonicalVerdict.releaseReady ? "Empirically ready" : "Evidence incomplete"}</h2></div><Verdict passed={canonicalVerdict.releaseReady} /></div>
        <p className="small">The older lower-level Gate B/C evaluators remain available for diagnostics, but they cannot make this console release-ready without the exact frozen plans and complete campaign accounting.</p>
        <p className="small">Authorized collection revision: {SOFTWARE_REVISION_VALID ? SOFTWARE_REVISION : "invalid / unset"}</p>
        <Reasons reasons={canonicalVerdict.reasons} />
      </article>

      <article className="release-card">
        <div className="release-card-head"><div><p className="eyebrow">CAMPAIGN</p><h2>Complete accounting</h2></div><Verdict passed={canonicalVerdict.campaignAccounted} /></div>
        <p className="metric-line">{campaignProgress?.conformingCompleteSessionCount ?? 0} / {campaignProgress?.plannedSessionCount ?? 12} complete planned sessions</p>
        <Reasons reasons={campaignProgress?.reasons ?? ["precommitted campaign is missing"]} />
      </article>

      <article className="release-card">
        <div className="release-card-head"><div><p className="eyebrow">GATE A2 / PHYSICAL</p><h2>Repeatable acoustic structure</h2></div><Verdict passed={baseVerdict.gateA.passed} /></div>
        <p className="metric-line">{baseVerdict.gateA.distinctPassingSpecimenCount} distinct passing specimens</p>
        <Reasons reasons={baseVerdict.gateA.reasons} />
      </article>

      <article className="release-card">
        <div className="release-card-head"><div><p className="eyebrow">GATE B / CANONICAL</p><h2>Fixed blinded panel</h2></div><Verdict passed={canonicalB?.passed === true} /></div>
        <p className="metric-line">{canonicalB?.observedJudgmentCount ?? 0} / 10 canonical judgments</p>
        <Reasons reasons={canonicalB?.reasons ?? ["canonical Gate B plan is missing"]} />
      </article>

      <article className="release-card">
        <div className="release-card-head"><div><p className="eyebrow">GATE C / CANONICAL</p><h2>Complete 4×2×2 matrix</h2></div><Verdict passed={canonicalC?.passed === true} /></div>
        <p className="metric-line">{canonicalC?.observedJudgmentCount ?? 0} / 16 canonical judgments</p>
        <Reasons reasons={canonicalC?.reasons ?? ["canonical Gate C plan is missing or Gate B is not evaluable"]} />
      </article>
    </section>

    {campaign !== undefined && campaignProgress !== undefined ? <section className="campaign-panel" aria-label="Precommitted empirical campaign">
      <div className="release-card-head"><div><p className="eyebrow">EMPIRICAL CAMPAIGN / PRECOMMITTED</p><h2>{campaignProgress.collectionComplete ? "Collection accounted for" : "Collection still open"}</h2></div><Verdict passed={campaignProgress.collectionComplete} /></div>
      <div className="campaign-summary">
        <div><span>CAMPAIGN</span><strong>{campaign.campaignId}</strong></div>
        <div><span>SIGNATURE</span><strong className="campaign-signature">{campaignProgress.campaignSignature}</strong></div>
        <div><span>PLANNED</span><strong>{campaignProgress.plannedSpecimenCount}</strong></div>
        <div><span>COMPLETE</span><strong>{campaignProgress.conformingCompleteSessionCount}</strong></div>
        <div><span>A2 PASSING</span><strong>{campaignProgress.passingSessionCount}</strong></div>
        <div><span>ANALYTICAL FAILURES</span><strong>{campaignProgress.analyticalFailureCount}</strong></div>
      </div>
      <p className="small">Campaign revision: {campaign.authorizedSoftwareRevision}{campaign.authorizedSoftwareRevision === SOFTWARE_REVISION ? " · matches this build" : " · differs from this build"}</p>
    </section> : null}

    <section className="release-table-wrap">
      <div className="release-card-head"><div><p className="eyebrow">EVIDENCE</p><h2>Object sessions</h2></div></div>
      <div className="release-table" role="table">
        <div className="release-row release-row-head" role="row"><span>specimen</span><span>object</span><span>material</span><span>attempts</span><span>drift</span><span>B</span><span>C</span><span>A2</span></div>
        {evidence.map((bundle) => {
          const sessionVerdict = baseVerdict.gateA.sessions.find((session) => session.sessionId === bundle.sessionId);
          return <div className="release-row" role="row" key={bundle.sessionId}>
            <span>{bundle.object.specimenId}</span><span>{bundle.object.label}</span><span>{bundle.object.material}</span><span>{bundle.attempts.length}</span>
            <span>{sessionVerdict?.metrics.sessionMedianDriftCents == null ? "—" : `${sessionVerdict.metrics.sessionMedianDriftCents.toFixed(1)}¢`}</span>
            <span>{bundle.gateBReviews.length}</span><span>{bundle.gateCReviews.length}</span><span>{sessionVerdict?.passed ? "PASS" : "OPEN"}</span>
          </div>;
        })}
      </div>
    </section>
  </main>;
}
