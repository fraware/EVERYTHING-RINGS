import type { AcousticMode } from "@everything-rings/dsp";
import {
  deriveEvidenceRecurrence,
  deriveMedianModalDriftCents,
  empiricalCampaignSignature,
  evaluateGateASession,
  parseEmpiricalCampaignJson,
  type EmpiricalCampaignV1,
  type ValidationEvidenceV5,
} from "@everything-rings/validation";
import { useMemo, useState } from "react";
import { AcousticDnaView } from "./AcousticDnaView";
import {
  campaignRevisionMatches,
  campaignSelectionCanArm,
  findCampaignSpecimen,
  setupFromCampaignSpecimen,
  type CampaignBoundSetup,
} from "./campaignBinding";
import { failureCopy } from "./failureCopy";
import { createGateBListeningCompanion } from "./gateBListeningCompanion";
import { useStrikeSession } from "./useStrikeSession";
import "./campaignCollection.css";

const SOFTWARE_REVISION = ((import.meta as ImportMeta & { readonly env?: { readonly VITE_SOFTWARE_REVISION?: string } }).env?.VITE_SOFTWARE_REVISION ?? "").trim();
const SOFTWARE_REVISION_VALID = /^[0-9a-f]{40}$/.test(SOFTWARE_REVISION);

function createSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `campaign-session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function safeSpecimenId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "specimen";
}

function ModeSummary({ modes }: { readonly modes: readonly AcousticMode[] }) {
  return <div className="campaign-mode-list" aria-label="Estimated acoustic modes">
    {modes.map((mode, index) => <span key={`${mode.frequencyHz}-${index}`}>
      <strong>{mode.frequencyHz.toFixed(1)} Hz</strong>
      <small>{mode.decaySeconds.toFixed(3)} s · {(mode.confidence * 100).toFixed(0)}%</small>
    </span>)}
  </div>;
}

export function CampaignCollectionApp() {
  const session = useStrikeSession({ maximumQualifiedAttempts: 5 });
  const [campaign, setCampaign] = useState<EmpiricalCampaignV1>();
  const [campaignError, setCampaignError] = useState<string>();
  const [selectedSpecimenId, setSelectedSpecimenId] = useState("");
  const [selectedSessionOrdinal, setSelectedSessionOrdinal] = useState(1);
  const [activeSetup, setActiveSetup] = useState<CampaignBoundSetup>();
  const [sessionId, setSessionId] = useState(createSessionId);
  const [evidenceExported, setEvidenceExported] = useState(false);
  const [listeningCompanionExported, setListeningCompanionExported] = useState(false);
  const [exportError, setExportError] = useState<string>();

  const selectedSpecimen = useMemo(
    () => campaign === undefined ? undefined : findCampaignSpecimen(campaign, selectedSpecimenId),
    [campaign, selectedSpecimenId],
  );
  const signature = campaign === undefined ? undefined : empiricalCampaignSignature(campaign);
  const revisionMatches = campaignRevisionMatches(campaign, SOFTWARE_REVISION);
  const canArm = SOFTWARE_REVISION_VALID
    && campaignSelectionCanArm(campaign, selectedSpecimenId, SOFTWARE_REVISION)
    && selectedSpecimen !== undefined
    && activeSetup === undefined;
  const attemptLimitReached = session.attempts.length >= 5;
  const recurrence = useMemo(() => deriveEvidenceRecurrence(session.attempts), [session.attempts]);
  const drift = useMemo(() => deriveMedianModalDriftCents(session.attempts), [session.attempts]);
  const analyticalFailures = session.attempts.filter((attempt) => attempt.analysis.status === "failure").length;
  const successfulAnalyses = session.attempts.length - analyticalFailures;

  const gateAVerdict = useMemo(() => {
    if (activeSetup === undefined) return undefined;
    const preview: ValidationEvidenceV5 = {
      schemaVersion: 5,
      evidenceContractVersion: "validation-evidence-5",
      gateAContractVersion: "gate-a-2",
      sessionId,
      createdAt: "preview",
      softwareRevision: SOFTWARE_REVISION,
      object: activeSetup.object,
      protocol: activeSetup.protocol,
      captureSettings: session.settings ?? null,
      realtimeAudioTiming: session.audioTiming ?? null,
      attemptCount: session.attempts.length,
      medianModalDriftCents: drift,
      recurrence,
      attempts: session.attempts,
      gateBReviews: [],
      gateCReviews: [],
      rawMicrophoneSamplesIncluded: false,
    };
    return evaluateGateASession(preview);
  }, [activeSetup, sessionId, session.settings, session.audioTiming, session.attempts, drift, recurrence]);

  async function importCampaign(file: File | undefined): Promise<void> {
    if (file === undefined || activeSetup !== undefined) return;
    const result = parseEmpiricalCampaignJson(await file.text());
    if (!result.ok) {
      setCampaign(undefined);
      setSelectedSpecimenId("");
      setCampaignError(result.error);
      return;
    }
    setCampaign(result.campaign);
    setSelectedSpecimenId("");
    setSelectedSessionOrdinal(1);
    setCampaignError(undefined);
  }

  function selectSpecimen(specimenId: string): void {
    if (activeSetup !== undefined) return;
    setSelectedSpecimenId(specimenId);
    setSelectedSessionOrdinal(1);
  }

  function armSelectedSession(): void {
    if (!canArm || selectedSpecimen === undefined) return;
    setActiveSetup(setupFromCampaignSpecimen(selectedSpecimen));
    setSessionId(createSessionId());
    setEvidenceExported(false);
    setListeningCompanionExported(false);
    setExportError(undefined);
    void session.start();
  }

  function evidence(createdAt: string): ValidationEvidenceV5 | undefined {
    if (activeSetup === undefined) return undefined;
    return {
      schemaVersion: 5,
      evidenceContractVersion: "validation-evidence-5",
      gateAContractVersion: "gate-a-2",
      sessionId,
      createdAt,
      softwareRevision: SOFTWARE_REVISION,
      object: activeSetup.object,
      protocol: activeSetup.protocol,
      captureSettings: session.settings ?? null,
      realtimeAudioTiming: session.audioTiming ?? null,
      attemptCount: session.attempts.length,
      medianModalDriftCents: drift,
      recurrence,
      attempts: session.attempts,
      gateBReviews: [],
      gateCReviews: [],
      rawMicrophoneSamplesIncluded: false,
    };
  }

  function exportEvidence(): void {
    const report = evidence(new Date().toISOString());
    if (report === undefined || report.attempts.length === 0) return;
    downloadJson(
      `everything-rings-${safeSpecimenId(report.object.specimenId)}-session-${selectedSessionOrdinal}-${Date.now()}.json`,
      {
        ...report,
        campaignContext: campaign === undefined ? null : {
          campaignId: campaign.campaignId,
          campaignSignature: empiricalCampaignSignature(campaign),
          cohort: activeSetup?.cohort,
          objectFamily: activeSetup?.objectFamily,
          plannedSessionOrdinal: selectedSessionOrdinal,
          targetSessions: activeSetup?.targetSessions,
        },
      },
    );
    setEvidenceExported(true);
    setExportError(undefined);
  }

  async function exportListeningCompanion(): Promise<void> {
    const capture = session.capture;
    const fingerprint = session.fingerprint;
    const report = evidence(new Date().toISOString());
    if (
      report === undefined
      || gateAVerdict?.passed !== true
      || gateAVerdict.reviewAttemptId === null
      || capture === undefined
      || fingerprint === undefined
    ) return;
    try {
      const companion = await createGateBListeningCompanion(
        report,
        capture.samples,
        capture.sampleRate,
        fingerprint,
        new Date().toISOString(),
      );
      downloadJson(
        `everything-rings-${safeSpecimenId(report.object.specimenId)}-session-${selectedSessionOrdinal}-gate-b-companion-${Date.now()}.json`,
        companion,
      );
      setListeningCompanionExported(true);
      setExportError(undefined);
    } catch (error) {
      setListeningCompanionExported(false);
      setExportError(error instanceof Error ? error.message : String(error));
    }
  }

  function resetAttempt(): void {
    setEvidenceExported(false);
    setListeningCompanionExported(false);
    setExportError(undefined);
    session.reset();
  }

  function closePlannedSession(): void {
    const requiresCompanion = gateAVerdict?.passed === true;
    if (!evidenceExported || (requiresCompanion && !listeningCompanionExported)) return;
    session.stop();
    setActiveSetup(undefined);
    setSessionId(createSessionId());
    setEvidenceExported(false);
    setListeningCompanionExported(false);
    setExportError(undefined);
  }

  const canStartNextAttempt = (session.state === "success" || session.state === "failure") && !attemptLimitReached;
  const activeFingerprint = session.fingerprint;
  const passingTargetAvailable = attemptLimitReached
    && gateAVerdict?.passed === true
    && gateAVerdict.reviewAttemptId !== null
    && session.capture !== undefined
    && session.fingerprint !== undefined;
  const passingExportsComplete = evidenceExported && listeningCompanionExported;
  const closeReady = activeSetup !== undefined
    && evidenceExported
    && (gateAVerdict?.passed !== true || listeningCompanionExported);
  const stopWouldLoseRequiredTarget = passingTargetAvailable && !passingExportsComplete;

  return <main className="shell campaign-collection-shell">
    <header>
      <p className="eyebrow">EVERYTHING RINGS / EMPIRICAL CAMPAIGN</p>
      <h1>Precommitted physical collection</h1>
      <p className="lede">Load one frozen campaign, select a planned specimen, and collect its exact five-attempt session without editing the precommitted identity or setup.</p>
    </header>

    <section className="campaign-collector-manifest">
      <div className="release-card-head">
        <div><p className="eyebrow">EMPIRICAL-CAMPAIGN-1</p><h2>{campaign === undefined ? "Load the frozen manifest" : campaign.campaignId}</h2></div>
        {campaign !== undefined ? <span className={`gate-verdict ${revisionMatches ? "gate-pass" : "gate-open"}`}>{revisionMatches ? "REVISION MATCH" : "REVISION MISMATCH"}</span> : null}
      </div>
      <div className="campaign-collector-actions">
        <label className={`file-button${activeSetup !== undefined ? " file-button-disabled" : ""}`}>IMPORT CAMPAIGN<input disabled={activeSetup !== undefined} type="file" accept="application/json,.json" onChange={(event) => { void importCampaign(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} /></label>
        {campaign !== undefined && activeSetup === undefined ? <button className="secondary" onClick={() => { setCampaign(undefined); setSelectedSpecimenId(""); setCampaignError(undefined); }}>CLEAR CAMPAIGN</button> : null}
      </div>
      {campaignError !== undefined ? <p className="campaign-error">{campaignError}</p> : null}
      {campaign !== undefined ? <div className="campaign-collector-meta">
        <div><span>SIGNATURE</span><strong>{signature}</strong></div>
        <div><span>AUTHORIZED REVISION</span><strong>{campaign.authorizedSoftwareRevision}</strong></div>
        <div><span>RUNNING REVISION</span><strong>{SOFTWARE_REVISION_VALID ? SOFTWARE_REVISION : "unstamped"}</strong></div>
        <div><span>PLANNED SPECIMENS</span><strong>{campaign.specimens.length}</strong></div>
      </div> : null}
      {campaign !== undefined && !revisionMatches ? <p className="validation-note">This build cannot collect conforming campaign evidence. Open the exact authorized revision shown in the manifest.</p> : null}
    </section>

    {campaign !== undefined ? <section className="campaign-collector-selection">
      <div className="protocol-heading">
        <div><p className="eyebrow">PLANNED SPECIMEN</p><h2>Select the physical object in front of you</h2></div>
        <p className="small">Selection loads the exact precommitted identity and fixed setup. These fields cannot be edited in campaign collection.</p>
      </div>
      <div className="campaign-selection-grid">
        <label><span>specimen</span><select disabled={activeSetup !== undefined} value={selectedSpecimenId} onChange={(event) => selectSpecimen(event.currentTarget.value)}><option value="">Select planned specimen…</option>{campaign.specimens.map((specimen) => <option key={specimen.specimenId} value={specimen.specimenId}>{specimen.specimenId} — {specimen.label}</option>)}</select></label>
        <label><span>planned session</span><select disabled={activeSetup !== undefined || selectedSpecimen === undefined} value={selectedSessionOrdinal} onChange={(event) => setSelectedSessionOrdinal(Number(event.currentTarget.value))}>{Array.from({ length: selectedSpecimen?.targetSessions ?? 1 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1} / {selectedSpecimen?.targetSessions ?? 1}</option>)}</select></label>
      </div>
      {selectedSpecimen !== undefined ? <div className="campaign-setup-lock">
        <div><span>COHORT</span><strong>{selectedSpecimen.cohort}</strong></div>
        <div><span>OBJECT FAMILY</span><strong>{selectedSpecimen.objectFamily}</strong></div>
        <div><span>SPECIMEN ID</span><strong>{selectedSpecimen.specimenId}</strong></div>
        <div><span>OBJECT</span><strong>{selectedSpecimen.label}</strong></div>
        <div><span>MATERIAL</span><strong>{selectedSpecimen.material}</strong></div>
        <div><span>MIC DISTANCE</span><strong>{selectedSpecimen.protocol.microphoneDistanceCm} cm</strong></div>
        <div><span>STRIKER</span><strong>{selectedSpecimen.protocol.striker}</strong></div>
        <div><span>STRIKE LOCATION</span><strong>{selectedSpecimen.protocol.strikeLocation}</strong></div>
        <div><span>SUPPORT</span><strong>{selectedSpecimen.protocol.supportCondition}</strong></div>
      </div> : null}
    </section> : null}

    <section className="control-panel campaign-control-panel">
      <div>
        <span className={`status status-${session.state}`}>{session.state}</span>
        <p className="instruction">
          {session.state === "idle" && activeSetup === undefined && campaign === undefined && "Import the frozen campaign manifest."}
          {session.state === "idle" && activeSetup === undefined && campaign !== undefined && selectedSpecimen === undefined && "Select one planned physical specimen."}
          {session.state === "idle" && activeSetup === undefined && selectedSpecimen !== undefined && revisionMatches && "Verify the physical setup, then arm this planned session."}
          {session.state === "idle" && activeSetup === undefined && selectedSpecimen !== undefined && !revisionMatches && "Collection is blocked because the software revision does not match the manifest."}
          {session.state === "idle" && activeSetup !== undefined && "Session stopped. Required exports must be complete before this planned session can close."}
          {session.state === "warming" && "Measuring the room noise floor…"}
          {session.state === "armed" && `Ready for qualified attempt ${Math.min(5, session.attempts.length + 1)}. Strike exactly as precommitted.`}
          {session.state === "capturing" && "Capturing the decay…"}
          {session.state === "analyzing" && "Qualified attempt locked. Running deterministic analysis…"}
          {session.state === "success" && !attemptLimitReached && `${activeFingerprint?.modes.length ?? 0} resonances found. This outcome is retained.`}
          {session.state === "success" && attemptLimitReached && (gateAVerdict?.passed ? "Five qualified attempts complete. Export evidence and the local Gate B companion before stopping." : "Five qualified attempts complete. This planned session remains a campaign result and cannot be replaced.")}
          {(session.state === "failure" || session.state === "error") && failureCopy(session.failureReason)}
        </p>
      </div>
      <div className="actions">
        {session.state === "idle" && activeSetup === undefined ? <button disabled={!canArm} onClick={armSelectedSession}>ARM PLANNED SESSION</button> : null}
        {session.state !== "idle" ? <button disabled={!canStartNextAttempt} onClick={resetAttempt}>NEW QUALIFIED ATTEMPT</button> : null}
        {activeSetup !== undefined && session.attempts.length > 0 ? <button onClick={exportEvidence}>{evidenceExported ? "EVIDENCE EXPORTED" : "EXPORT EVIDENCE"}</button> : null}
        {passingTargetAvailable ? <button onClick={() => { void exportListeningCompanion(); }}>{listeningCompanionExported ? "COMPANION EXPORTED" : "EXPORT LOCAL GATE B COMPANION"}</button> : null}
        {session.state !== "idle" ? <button className="secondary" disabled={stopWouldLoseRequiredTarget} onClick={session.stop}>STOP</button> : null}
        {session.state === "idle" && activeSetup !== undefined ? <button className="secondary" disabled={!closeReady} onClick={closePlannedSession}>CLOSE PLANNED SESSION</button> : null}
      </div>
    </section>

    {exportError !== undefined ? <p className="campaign-error" role="alert">Listening companion export failed: {exportError}</p> : null}
    {session.state === "error" ? <p className="validation-note">Internal session failure terminates this physical session. Export every retained attempt. A restart with the same specimen creates another session and will remain visible to campaign accounting.</p> : null}
    {attemptLimitReached && !gateAVerdict?.passed ? <p className="validation-note">Do not collect a sixth attempt and do not substitute another object. Export this result exactly as observed.</p> : null}
    {passingTargetAvailable ? <p className="validation-note">The local Gate B companion contains the exact attempt-5 microphone samples and stays outside validation evidence. Keep it local, hash it in the operator ledger, and never import it into the Release Console. Stopping is blocked until both required exports have been invoked.</p> : null}

    {activeSetup !== undefined ? <section className="campaign-session-status">
      <div className="release-card-head"><div><p className="eyebrow">ACTIVE PRECOMMITMENT</p><h2>{activeSetup.object.label}</h2></div><span className="gate-verdict">SESSION {selectedSessionOrdinal} / {activeSetup.targetSessions}</span></div>
      <div className="campaign-session-metrics">
        <div><span>QUALIFIED ATTEMPTS</span><strong>{session.attempts.length} / 5</strong></div>
        <div><span>ANALYSIS SUCCESS</span><strong>{successfulAnalyses} / 5</strong></div>
        <div><span>ANALYTICAL FAILURES</span><strong>{analyticalFailures}</strong></div>
        <div><span>MEDIAN DRIFT</span><strong>{drift === null ? "—" : `${drift.toFixed(1)}¢`}</strong></div>
        <div><span>GATE A2</span><strong>{attemptLimitReached ? gateAVerdict?.passed ? "PASS" : "OPEN" : "COLLECTING"}</strong></div>
        <div><span>SNR</span><strong>{session.quality === undefined ? "—" : `${session.quality.snrDb.toFixed(1)} dB`}</strong></div>
        <div><span>EVIDENCE EXPORT</span><strong>{evidenceExported ? "DONE" : "PENDING"}</strong></div>
        <div><span>GATE B COMPANION</span><strong>{gateAVerdict?.passed ? listeningCompanionExported ? "DONE" : "PENDING" : "NOT ELIGIBLE"}</strong></div>
      </div>
    </section> : null}

    {activeFingerprint !== undefined ? <section className="result campaign-result">
      <div className="result-head"><div><p className="eyebrow">{activeFingerprint.algorithmVersion}</p><h2>Latest retained fingerprint</h2></div><strong>{activeFingerprint.modes.length}</strong></div>
      <AcousticDnaView fingerprint={activeFingerprint} />
      <ModeSummary modes={activeFingerprint.modes} />
    </section> : null}

    <footer className="campaign-collector-footer"><a href="?lab=1">general validation lab</a><a href="?release=1">release console</a><a href="?gate-b=1">Gate B review</a><a href="?gate-c=1">Gate C review</a></footer>
  </main>;
}
