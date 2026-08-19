import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import {
  parseValidationEvidenceJson,
  type DeviceClass,
  type GateBPresentationOrder,
  type GateBReview,
  type GateCReview,
  type ReviewTarget,
  type Score1To5,
  type ValidationEvidenceV5,
} from "@everything-rings/validation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  parseGateBListeningCompanionJson,
  validateGateBListeningCompanionBinding,
  type GateBListeningCompanionV1,
} from "./gateBListeningCompanion";
import { PostCollectionReviewAudioController } from "./postCollectionReviewAudio";
import { authorizeGateBReview, authorizeGateCReview } from "./reviewAuthorization";
import { playbackFailureCopy } from "./sessionErrors";
import instrumentWorkletUrl from "./instrument-processor.ts?worker&url";

const SCORES: readonly Score1To5[] = [1, 2, 3, 4, 5];
const DEVICE_CLASSES: readonly DeviceClass[] = ["desktop", "mobile", "tablet", "other"];
const KEYBOARD_NOTES = [
  { midi: 60, label: "C4" }, { midi: 61, label: "C♯4" }, { midi: 62, label: "D4" },
  { midi: 63, label: "D♯4" }, { midi: 64, label: "E4" }, { midi: 65, label: "F4" },
  { midi: 66, label: "F♯4" }, { midi: 67, label: "G4" }, { midi: 68, label: "G♯4" },
  { midi: 69, label: "A4" }, { midi: 70, label: "A♯4" }, { midi: 71, label: "B4" },
  { midi: 72, label: "C5" },
] as const;

type ImportSource = "release" | "evidence" | "companion";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

function createReviewId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function randomizedPresentationOrder(): GateBPresentationOrder {
  const random = new Uint8Array(1);
  crypto.getRandomValues(random);
  return ((random[0] ?? 0) & 1) === 0 ? "original-model" : "model-original";
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

function safeFilePart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "review";
}

function targetFingerprint(
  evidence: ValidationEvidenceV5 | undefined,
  target: ReviewTarget | undefined,
): AcousticFingerprintV1 | undefined {
  if (evidence === undefined || target === undefined || evidence.sessionId !== target.sessionId) return undefined;
  const attempt = evidence.attempts.find((candidate) => candidate.id === target.attemptId);
  return attempt?.analysis.status === "success" ? attempt.analysis.fingerprint : undefined;
}

function ScoreField({ label, value, onChange }: {
  readonly label: string;
  readonly value: Score1To5;
  readonly onChange: (value: Score1To5) => void;
}) {
  return <label><span>{label}</span><select value={value} onChange={(event) => onChange(Number(event.currentTarget.value) as Score1To5)}>{SCORES.map((score) => <option key={score} value={score}>{score}</option>)}</select></label>;
}

function statusText(value: { readonly ok: boolean; readonly error?: string } | undefined, ready: string): string {
  if (value === undefined) return "not loaded";
  return value.ok ? ready : value.error ?? "invalid";
}

export function PostCollectionReviewApp({ mode }: { readonly mode: "gate-b" | "gate-c" }) {
  const [evidence, setEvidence] = useState<ValidationEvidenceV5>();
  const [evidenceFilename, setEvidenceFilename] = useState<string>();
  const [releaseVerdict, setReleaseVerdict] = useState<unknown>();
  const [releaseFilename, setReleaseFilename] = useState<string>();
  const [companion, setCompanion] = useState<GateBListeningCompanionV1>();
  const [companionSamples, setCompanionSamples] = useState<Float32Array>();
  const [companionFilename, setCompanionFilename] = useState<string>();
  const [companionBinding, setCompanionBinding] = useState<{ readonly ok: boolean; readonly error?: string }>();
  const [importErrors, setImportErrors] = useState<Partial<Record<ImportSource, string>>>({});
  const [playbackFailure, setPlaybackFailure] = useState<string>();
  const audio = useRef<{ readonly key: string; readonly controller: PostCollectionReviewAudioController } | undefined>(undefined);

  const [reviewerId, setReviewerId] = useState("");
  const [presentationOrder, setPresentationOrder] = useState<GateBPresentationOrder>();
  const [identity, setIdentity] = useState<Score1To5>(4);
  const [brightness, setBrightness] = useState<Score1To5>(4);
  const [decayCharacter, setDecayCharacter] = useState<Score1To5>(4);
  const [artifactSeverity, setArtifactSeverity] = useState<Score1To5>(2);

  const [deviceId, setDeviceId] = useState("");
  const [deviceClass, setDeviceClass] = useState<DeviceClass>("desktop");
  const [rangeIdentity, setRangeIdentity] = useState<Score1To5>(4);
  const [timbreContinuity, setTimbreContinuity] = useState<Score1To5>(4);
  const [usefulSemitoneSpan, setUsefulSemitoneSpan] = useState(12);
  const [latencyAcceptable, setLatencyAcceptable] = useState(true);

  const authorization = useMemo(() => {
    if (evidence === undefined || releaseVerdict === undefined) return undefined;
    return mode === "gate-b"
      ? authorizeGateBReview(releaseVerdict, evidence)
      : authorizeGateCReview(releaseVerdict, evidence);
  }, [mode, evidence, releaseVerdict]);
  const target = authorization?.ok ? authorization.target : undefined;
  const fingerprint = targetFingerprint(evidence, target);
  const visibleImportErrors = Object.values(importErrors).filter((value): value is string => value !== undefined);

  function setImportError(source: ImportSource, error: string | undefined): void {
    setImportErrors((current) => {
      const next = { ...current };
      if (error === undefined) delete next[source];
      else next[source] = error;
      return next;
    });
  }

  function disposeAudio(): void {
    audio.current?.controller.dispose();
    audio.current = undefined;
  }

  function controller(): PostCollectionReviewAudioController | undefined {
    if (evidence === undefined || target === undefined || fingerprint === undefined) return undefined;
    const key = `${evidence.sessionId}\u0000${target.attemptId}\u0000${JSON.stringify(fingerprint)}`;
    if (audio.current?.key !== key) {
      disposeAudio();
      audio.current = {
        key,
        controller: new PostCollectionReviewAudioController(fingerprint, {
          workletUrl: instrumentWorkletUrl,
          createContext: () => new AudioContext(),
          createInstrumentNode: (context) => new AudioWorkletNode(context, "everything-rings-instrument", {
            numberOfInputs: 0,
            numberOfOutputs: 1,
            outputChannelCount: [1],
          }),
        }),
      };
    }
    return audio.current.controller;
  }

  useEffect(() => {
    let active = true;
    if (mode !== "gate-b" || evidence === undefined || companion === undefined) {
      setCompanionBinding(undefined);
      return () => { active = false; };
    }
    void validateGateBListeningCompanionBinding(companion, evidence).then((result) => {
      if (!active) return;
      setCompanionBinding(result.ok ? { ok: true } : { ok: false, error: result.error });
    });
    return () => { active = false; };
  }, [mode, evidence, companion]);

  useEffect(() => {
    const handlePageHide = (): void => audio.current?.controller.silence();
    const handleVisibility = (): void => {
      if (document.visibilityState === "hidden") audio.current?.controller.silence();
    };
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibility);
      disposeAudio();
    };
  }, []);

  async function importEvidence(file: File | undefined): Promise<void> {
    if (file === undefined) return;
    const parsed = parseValidationEvidenceJson(await file.text());
    if (!parsed.ok) {
      setImportError("evidence", `${file.name}: ${parsed.error}`);
      return;
    }
    disposeAudio();
    setEvidence(parsed.evidence);
    setEvidenceFilename(file.name);
    setCompanion(undefined);
    setCompanionSamples(undefined);
    setCompanionFilename(undefined);
    setCompanionBinding(undefined);
    setPresentationOrder(undefined);
    setPlaybackFailure(undefined);
    setImportError("evidence", undefined);
  }

  async function importReleaseVerdict(file: File | undefined): Promise<void> {
    if (file === undefined) return;
    try {
      const value = JSON.parse(await file.text()) as unknown;
      if (!isRecord(value)) throw new TypeError("release verdict must be a JSON object");
      setReleaseVerdict(value);
      setReleaseFilename(file.name);
      setPresentationOrder(undefined);
      setImportError("release", undefined);
    } catch (error) {
      setImportError("release", `${file.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function importCompanion(file: File | undefined): Promise<void> {
    if (file === undefined) return;
    const parsed = await parseGateBListeningCompanionJson(await file.text());
    if (!parsed.ok) {
      setImportError("companion", `${file.name}: ${parsed.error}`);
      setCompanion(undefined);
      setCompanionSamples(undefined);
      setCompanionFilename(undefined);
      return;
    }
    setCompanion(parsed.companion);
    setCompanionSamples(parsed.samples);
    setCompanionFilename(file.name);
    setImportError("companion", undefined);
  }

  function runAudio(action: (player: PostCollectionReviewAudioController) => Promise<boolean>): void {
    const player = controller();
    if (player === undefined) return;
    setPlaybackFailure(undefined);
    void action(player).then((played) => {
      if (!played) setPlaybackFailure(playbackFailureCopy());
    }).catch(() => setPlaybackFailure(playbackFailureCopy()));
  }

  const gateBReady = mode === "gate-b"
    && authorization?.ok === true
    && companionBinding?.ok === true
    && companionSamples !== undefined
    && fingerprint !== undefined;
  const gateCReady = mode === "gate-c"
    && authorization?.ok === true
    && fingerprint !== undefined;
  const reviewerKey = normalized(reviewerId);
  const gateBSubmitted = evidence !== undefined && target !== undefined && evidence.gateBReviews.some((review) => (
    normalized(review.reviewerId) === reviewerKey
    && review.sessionId === target.sessionId
    && review.attemptId === target.attemptId
  ));
  const gateCSubmitted = evidence !== undefined && target !== undefined && evidence.gateCReviews.some((review) => (
    normalized(review.reviewerId) === reviewerKey
    && normalized(review.deviceId) === normalized(deviceId)
    && review.sessionId === target.sessionId
    && review.attemptId === target.attemptId
  ));

  function startBlindTrial(): void {
    if (!gateBReady || reviewerId.trim().length === 0 || gateBSubmitted) return;
    audio.current?.controller.silence();
    setPresentationOrder(randomizedPresentationOrder());
  }

  function playBlind(side: "A" | "B"): void {
    if (!gateBReady || presentationOrder === undefined || companionSamples === undefined || companion === undefined) return;
    const aIsOriginal = presentationOrder === "original-model";
    const original = side === "A" ? aIsOriginal : !aIsOriginal;
    if (original) runAudio((player) => player.playOriginal(companionSamples, companion.sampleRate));
    else runAudio((player) => player.playModel());
  }

  function submitGateB(): void {
    if (
      evidence === undefined
      || target === undefined
      || !gateBReady
      || reviewerId.trim().length === 0
      || gateBSubmitted
      || presentationOrder === undefined
    ) return;
    const review: GateBReview = {
      reviewId: createReviewId("gate-b"),
      reviewerId: reviewerId.trim(),
      objectLabel: evidence.object.label,
      sessionId: target.sessionId,
      attemptId: target.attemptId,
      blinded: true,
      presentationOrder,
      identity,
      brightness,
      decayCharacter,
      artifactSeverity,
    };
    setEvidence({
      ...evidence,
      createdAt: new Date().toISOString(),
      gateBReviews: [...evidence.gateBReviews, review],
    });
    setPresentationOrder(undefined);
    setIdentity(4);
    setBrightness(4);
    setDecayCharacter(4);
    setArtifactSeverity(2);
    audio.current?.controller.silence();
  }

  function submitGateC(): void {
    if (
      evidence === undefined
      || target === undefined
      || !gateCReady
      || reviewerId.trim().length === 0
      || deviceId.trim().length === 0
      || gateCSubmitted
    ) return;
    const review: GateCReview = {
      reviewId: createReviewId("gate-c"),
      reviewerId: reviewerId.trim(),
      objectLabel: evidence.object.label,
      sessionId: target.sessionId,
      attemptId: target.attemptId,
      deviceId: deviceId.trim(),
      deviceClass,
      identityAcrossRange: rangeIdentity,
      timbreContinuity,
      usefulSemitoneSpan,
      latencyAcceptable,
    };
    setEvidence({
      ...evidence,
      createdAt: new Date().toISOString(),
      gateCReviews: [...evidence.gateCReviews, review],
    });
    audio.current?.controller.silence();
  }

  function exportReviewedEvidence(): void {
    if (evidence === undefined) return;
    const gate = mode === "gate-b" ? "gate-b" : "gate-c";
    downloadJson(
      `everything-rings-${safeFilePart(evidence.object.specimenId)}-${gate}-reviewed-${Date.now()}.json`,
      evidence,
    );
  }

  const title = mode === "gate-b" ? "Post-collection blinded reconstruction" : "Post-Gate-B playable identity";
  const gateLabel = mode === "gate-b" ? "GATE B / POST-COLLECTION" : "GATE C / POST-COLLECTION";
  const authorizationText = authorization === undefined
    ? "load release verdict + evidence"
    : authorization.ok ? `authorized target ${authorization.target.sessionId} / attempt ${authorization.target.attemptId}` : authorization.error;

  return <main className="shell post-collection-review-shell">
    <header>
      <p className="eyebrow">EVERYTHING RINGS / {gateLabel}</p>
      <h1>{title}</h1>
      <p className="lede">Review one frozen measurement target without reopening the microphone. Upstream release verdicts and exact target binding are checked locally before review controls unlock.</p>
    </header>

    <section className="protocol-panel" aria-label="Review authorization inputs">
      <div className="protocol-heading">
        <div><p className="eyebrow">AUTHORIZATION</p><h2>Bind the canonical target</h2></div>
        <p className="small">No file is uploaded. Review outputs remain schema-v5 evidence copies with raw microphone samples excluded.</p>
      </div>
      <div className="release-import">
        <label className="file-button">IMPORT RELEASE VERDICT<input type="file" accept="application/json,.json" onChange={(event) => { void importReleaseVerdict(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} /></label>
        <label className="file-button">IMPORT EVIDENCE<input type="file" accept="application/json,.json" onChange={(event) => { void importEvidence(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} /></label>
        {mode === "gate-b" ? <label className="file-button">IMPORT LOCAL COMPANION<input type="file" accept="application/json,.json" onChange={(event) => { void importCompanion(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} /></label> : null}
        <button className="secondary" disabled={evidence === undefined} onClick={exportReviewedEvidence}>EXPORT REVIEWED EVIDENCE</button>
      </div>
      {visibleImportErrors.length > 0 ? <div className="import-errors" role="alert"><ul>{visibleImportErrors.map((error) => <li key={error}>{error}</li>)}</ul></div> : null}
      <div className="review-provenance-grid">
        <div><span>RELEASE VERDICT</span><strong>{releaseFilename ?? "—"}</strong></div>
        <div><span>EVIDENCE</span><strong>{evidenceFilename ?? "—"}</strong></div>
        {mode === "gate-b" ? <div><span>LOCAL COMPANION</span><strong>{companionFilename ?? "—"}</strong></div> : null}
        <div><span>AUTHORIZATION</span><strong>{authorizationText}</strong></div>
        {mode === "gate-b" ? <div><span>COMPANION BINDING</span><strong>{statusText(companionBinding, "SHA-256 + target match")}</strong></div> : null}
        <div><span>MICROPHONE</span><strong>NOT USED</strong></div>
      </div>
      {evidence !== undefined ? <p className="small">Specimen <code>{evidence.object.specimenId}</code> · revision <code>{evidence.softwareRevision}</code> · evidence remains PCM-free.</p> : null}
    </section>

    {playbackFailure !== undefined ? <p className="consumer-playback-error" role="alert">{playbackFailure}</p> : null}

    <section className="review-identity">
      <label><span>reviewer ID</span><input value={reviewerId} onChange={(event) => { setReviewerId(event.currentTarget.value); setPresentationOrder(undefined); }} placeholder="reviewer-01" /></label>
      <p className="small">Use one stable reviewer ID across specimens. A reviewer/target judgment is immutable after submission.</p>
    </section>

    {mode === "gate-b" ? <section className="review-card">
      <div className="review-head"><div><p className="eyebrow">GATE B / BLINDED</p><h2>Original / reconstruction identity</h2></div><strong>{evidence?.gateBReviews.length ?? 0} reviews in this evidence copy</strong></div>
      <p className="small">The original comes only from the hash-verified local companion for the exact attempt-5 target. The reconstruction is rendered from that target fingerprint. A/B mapping is generated with browser cryptographic randomness and remains hidden during scoring.</p>
      {presentationOrder === undefined
        ? <button disabled={!gateBReady || reviewerId.trim().length === 0 || gateBSubmitted} onClick={startBlindTrial}>{gateBSubmitted ? "REVIEW SUBMITTED" : "START BLIND TRIAL"}</button>
        : <div className="blind-trial">
          <div className="actions"><button onClick={() => playBlind("A")}>PLAY A</button><button onClick={() => playBlind("B")}>PLAY B</button></div>
          <div className="review-grid">
            <ScoreField label="same-object identity" value={identity} onChange={setIdentity} />
            <ScoreField label="brightness match" value={brightness} onChange={setBrightness} />
            <ScoreField label="decay match" value={decayCharacter} onChange={setDecayCharacter} />
            <ScoreField label="artifact severity" value={artifactSeverity} onChange={setArtifactSeverity} />
          </div>
          <p className="small">Scores: 1 = low, 5 = high. For artifact severity, 1 = none and 5 = severe.</p>
          <button onClick={submitGateB}>SUBMIT BLIND REVIEW</button>
        </div>}
    </section> : <section className="review-card">
      <div className="review-head"><div><p className="eyebrow">GATE C / DEVICE</p><h2>Playable identity on this output device</h2></div><strong>{evidence?.gateCReviews.length ?? 0} reviews in this evidence copy</strong></div>
      <p className="small">This instrument is synthesized from the exact Gate B-selected fingerprint. It opens no microphone or acquisition graph. Play across the useful range on the device producing the audio before scoring.</p>
      <div className="keyboard post-review-keyboard" role="group" aria-label="Chromatic Gate C review keys">
        {KEYBOARD_NOTES.map((note) => <button
          key={note.midi}
          type="button"
          disabled={!gateCReady}
          aria-label={`${note.label}, MIDI ${note.midi}`}
          onClick={() => runAudio((player) => player.noteOn(note.midi))}
        >{note.label}</button>)}
      </div>
      <div className="review-grid">
        <label><span>device ID</span><input value={deviceId} onChange={(event) => setDeviceId(event.currentTarget.value)} placeholder="iphone-safari-01" /></label>
        <label><span>device class</span><select value={deviceClass} onChange={(event) => setDeviceClass(event.currentTarget.value as DeviceClass)}>{DEVICE_CLASSES.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <ScoreField label="identity across range" value={rangeIdentity} onChange={setRangeIdentity} />
        <ScoreField label="timbre continuity" value={timbreContinuity} onChange={setTimbreContinuity} />
        <label><span>useful range</span><div className="input-unit"><input type="number" min="0" step="1" value={usefulSemitoneSpan} onChange={(event) => setUsefulSemitoneSpan(Number(event.currentTarget.value))} /><span>semitones</span></div></label>
        <label className="check-field"><input type="checkbox" checked={latencyAcceptable} onChange={(event) => setLatencyAcceptable(event.currentTarget.checked)} /><span>note-on latency acceptable</span></label>
      </div>
      <button disabled={!gateCReady || reviewerId.trim().length === 0 || deviceId.trim().length === 0 || gateCSubmitted} onClick={submitGateC}>{gateCSubmitted ? "DEVICE REVIEW SUBMITTED" : "SUBMIT DEVICE REVIEW"}</button>
    </section>}

    <footer className="campaign-collector-footer"><a href="?release=1">release console</a><a href="?campaign=1">campaign collector</a></footer>
  </main>;
}
