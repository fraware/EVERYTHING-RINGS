import {
  empiricalCampaignSignature,
  type MaterialClass,
} from "@everything-rings/validation";
import { useMemo, useState } from "react";
import {
  buildEmpiricalCampaignFromDraft,
  createRecommendedCampaignDraft,
  RECOMMENDED_CAMPAIGN_SLOTS,
  type CampaignAuthoringDraft,
  type CampaignAuthoringSpecimen,
} from "./campaignAuthoring";
import "./campaignAuthor.css";

const SOFTWARE_REVISION = ((import.meta as ImportMeta & { readonly env?: { readonly VITE_SOFTWARE_REVISION?: string } }).env?.VITE_SOFTWARE_REVISION ?? "").trim();
const SOFTWARE_REVISION_VALID = /^[0-9a-f]{40}$/.test(SOFTWARE_REVISION);

const MATERIALS: readonly MaterialClass[] = [
  "metal", "glass", "ceramic", "wood", "stone", "plastic", "composite", "other",
];

function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function CampaignAuthorApp() {
  const [draft, setDraft] = useState<CampaignAuthoringDraft>(() => createRecommendedCampaignDraft(SOFTWARE_REVISION));
  const [createdAt, setCreatedAt] = useState(() => new Date().toISOString());
  const result = useMemo(() => buildEmpiricalCampaignFromDraft(draft, createdAt), [draft, createdAt]);
  const signature = result.ok ? empiricalCampaignSignature(result.campaign) : undefined;

  function updateCampaignId(campaignId: string): void {
    setDraft((current) => ({ ...current, campaignId }));
  }

  function updateSpecimen(index: number, patch: Partial<CampaignAuthoringSpecimen>): void {
    setDraft((current) => ({
      ...current,
      specimens: current.specimens.map((specimen, specimenIndex) => (
        specimenIndex === index ? { ...specimen, ...patch } : specimen
      )),
    }));
  }

  function resetRecommendedPlan(): void {
    setDraft(createRecommendedCampaignDraft(SOFTWARE_REVISION));
    setCreatedAt(new Date().toISOString());
  }

  function exportCampaign(): void {
    const finalCreatedAt = new Date().toISOString();
    const finalResult = buildEmpiricalCampaignFromDraft(draft, finalCreatedAt);
    if (!finalResult.ok) return;
    const finalSignature = empiricalCampaignSignature(finalResult.campaign);
    const safeId = finalResult.campaign.campaignId.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    downloadJson(`everything-rings-${safeId}-${finalSignature}.json`, finalResult.campaign);
    setCreatedAt(finalCreatedAt);
  }

  return <main className="shell campaign-author-shell">
    <header>
      <p className="eyebrow">EVERYTHING RINGS / CAMPAIGN AUTHOR</p>
      <h1>Freeze the experiment before the first strike.</h1>
      <p className="lede">Select the real physical specimens and exact setup now. This page creates the manifest that the campaign collector and Release Console will enforce later.</p>
    </header>

    <section className="campaign-author-header">
      <div className="protocol-heading">
        <div><p className="eyebrow">EMPIRICAL-CAMPAIGN-1</p><h2>12-specimen characterization plan</h2></div>
        <p className="small">Six release-core specimens test the release-critical materials. Six challenge specimens deliberately probe expected failure boundaries. Choose objects before running them through the production analysis pipeline.</p>
      </div>
      <div className="campaign-author-meta">
        <label><span>campaign ID</span><input value={draft.campaignId} onChange={(event) => updateCampaignId(event.currentTarget.value)} /></label>
        <div><span>AUTHORIZED SOFTWARE REVISION</span><strong>{SOFTWARE_REVISION_VALID ? SOFTWARE_REVISION : "UNSTAMPED BUILD"}</strong></div>
        <div><span>MANIFEST STATUS</span><strong>{result.ok && SOFTWARE_REVISION_VALID ? "READY TO FREEZE" : "INCOMPLETE"}</strong></div>
        <div><span>SIGNATURE</span><strong>{signature ?? "computed when complete"}</strong></div>
      </div>
      {!SOFTWARE_REVISION_VALID ? <p className="campaign-error">Campaign authoring is disabled in an unstamped build. Use the deployed revision that will collect the physical evidence.</p> : null}
    </section>

    <section className="campaign-author-instructions">
      <strong>Selection rule</strong>
      <p>Fill each slot with a real object you can physically identify again. Do not audition candidate objects through the production pipeline and then keep only the convenient ones. The exported manifest is the precommitment.</p>
    </section>

    <section className="campaign-author-slots" aria-label="Recommended physical specimen plan">
      {draft.specimens.map((specimen, index) => {
        const slot = RECOMMENDED_CAMPAIGN_SLOTS[index];
        return <article className={`campaign-author-slot campaign-author-slot-${specimen.cohort}`} key={specimen.slotId}>
          <div className="campaign-slot-head">
            <div><span>{specimen.cohort.toUpperCase()} · {String(index + 1).padStart(2, "0")}</span><h2>{specimen.slotId}</h2></div>
            <p>{slot?.selectionCriterion}</p>
          </div>
          <div className="campaign-slot-grid">
            <label><span>specimen ID</span><input value={specimen.specimenId} placeholder="stable physical ID" onChange={(event) => updateSpecimen(index, { specimenId: event.currentTarget.value })} /></label>
            <label><span>object label</span><input value={specimen.label} placeholder="specific physical object" onChange={(event) => updateSpecimen(index, { label: event.currentTarget.value })} /></label>
            <label><span>object family</span><input value={specimen.objectFamily} placeholder="bell, bottle, mug…" onChange={(event) => updateSpecimen(index, { objectFamily: event.currentTarget.value })} /></label>
            <label><span>material</span><select value={specimen.material} onChange={(event) => updateSpecimen(index, { material: event.currentTarget.value as MaterialClass })}>{MATERIALS.map((material) => <option key={material} value={material}>{material}</option>)}</select></label>
            <label><span>target sessions</span><input type="number" min="1" step="1" value={specimen.targetSessions} onChange={(event) => updateSpecimen(index, { targetSessions: Number(event.currentTarget.value) })} /></label>
            <label><span>mic distance</span><div className="input-unit"><input type="number" min="1" step="1" value={specimen.microphoneDistanceCm} onChange={(event) => updateSpecimen(index, { microphoneDistanceCm: Number(event.currentTarget.value) })} /><span>cm</span></div></label>
            <label><span>striker</span><input value={specimen.striker} onChange={(event) => updateSpecimen(index, { striker: event.currentTarget.value })} /></label>
            <label><span>strike location</span><input value={specimen.strikeLocation} placeholder="mark exact point" onChange={(event) => updateSpecimen(index, { strikeLocation: event.currentTarget.value })} /></label>
            <label className="campaign-support-field"><span>support condition</span><input value={specimen.supportCondition} placeholder="exact support / suspension" onChange={(event) => updateSpecimen(index, { supportCondition: event.currentTarget.value })} /></label>
          </div>
        </article>;
      })}
    </section>

    <section className="campaign-author-validation">
      <div className="release-card-head"><div><p className="eyebrow">PRECOMMITMENT CHECK</p><h2>{result.ok ? "Manifest is structurally complete" : `${result.errors.length} fields or constraints remain`}</h2></div><span className={`gate-verdict ${result.ok && SOFTWARE_REVISION_VALID ? "gate-pass" : "gate-open"}`}>{result.ok && SOFTWARE_REVISION_VALID ? "READY" : "OPEN"}</span></div>
      {!result.ok ? <ul className="reason-list campaign-author-errors">{result.errors.slice(0, 24).map((error) => <li key={error}>{error}</li>)}</ul> : <p className="small">Every physical identity and fixed-setup field is specified, specimen IDs are unique, and the manifest passes the same runtime parser used downstream.</p>}
      {!result.ok && result.errors.length > 24 ? <p className="small">{result.errors.length - 24} additional incomplete fields are omitted from this summary.</p> : null}
      <div className="campaign-author-actions">
        <button disabled={!result.ok || !SOFTWARE_REVISION_VALID} onClick={exportCampaign}>FREEZE + EXPORT CAMPAIGN</button>
        <button className="secondary" onClick={resetRecommendedPlan}>RESET 12-SLOT PLAN</button>
        <a href="?campaign=1">open campaign collector</a>
      </div>
    </section>
  </main>;
}
