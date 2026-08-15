import type {
  DeviceClass,
  GateBPresentationOrder,
  GateBReview,
  GateCReview,
  Score1To5,
} from "@everything-rings/validation";
import { useState } from "react";

const SCORES: readonly Score1To5[] = [1, 2, 3, 4, 5];
const DEVICE_CLASSES: readonly DeviceClass[] = ["desktop", "mobile", "tablet", "other"];

function createReviewId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function ScoreField({ label, value, onChange }: {
  readonly label: string;
  readonly value: Score1To5;
  readonly onChange: (value: Score1To5) => void;
}) {
  return <label><span>{label}</span><select value={value} onChange={(event) => onChange(Number(event.target.value) as Score1To5)}>{SCORES.map((score) => <option key={score} value={score}>{score}</option>)}</select></label>;
}

export function GateReviewPanel({
  objectLabel,
  canListen,
  instrumentReady,
  playOriginal,
  playModel,
  gateBReviews,
  gateCReviews,
  onGateBReview,
  onGateCReview,
}: {
  readonly objectLabel: string;
  readonly canListen: boolean;
  readonly instrumentReady: boolean;
  readonly playOriginal: () => void;
  readonly playModel: () => void;
  readonly gateBReviews: readonly GateBReview[];
  readonly gateCReviews: readonly GateCReview[];
  readonly onGateBReview: (review: GateBReview) => void;
  readonly onGateCReview: (review: GateCReview) => void;
}) {
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

  const objectReady = objectLabel.trim().length > 0;
  const reviewerReady = reviewerId.trim().length > 0;

  function startBlindTrial(): void {
    setPresentationOrder(Math.random() < 0.5 ? "original-model" : "model-original");
  }

  function playBlind(side: "A" | "B"): void {
    if (presentationOrder === undefined) return;
    const aIsOriginal = presentationOrder === "original-model";
    const original = side === "A" ? aIsOriginal : !aIsOriginal;
    if (original) playOriginal(); else playModel();
  }

  function submitGateB(): void {
    if (!objectReady || !reviewerReady || presentationOrder === undefined) return;
    onGateBReview({
      reviewId: createReviewId("gate-b"),
      reviewerId: reviewerId.trim(),
      objectLabel: objectLabel.trim(),
      blinded: true,
      presentationOrder,
      identity,
      brightness,
      decayCharacter,
      artifactSeverity,
    });
    setPresentationOrder(undefined);
  }

  function submitGateC(): void {
    if (!objectReady || !reviewerReady || deviceId.trim().length === 0) return;
    onGateCReview({
      reviewId: createReviewId("gate-c"),
      reviewerId: reviewerId.trim(),
      objectLabel: objectLabel.trim(),
      deviceId: deviceId.trim(),
      deviceClass,
      identityAcrossRange: rangeIdentity,
      timbreContinuity,
      usefulSemitoneSpan,
      latencyAcceptable,
    });
  }

  return <section className="review-stack">
    <div className="review-identity">
      <label><span>reviewer ID</span><input value={reviewerId} onChange={(event) => setReviewerId(event.target.value)} placeholder="reviewer-01" /></label>
      <p className="small">Use the same reviewer ID across objects. No account or personal identifier is required.</p>
    </div>

    <article className="review-card">
      <div className="review-head"><div><p className="eyebrow">GATE B / BLINDED</p><h3>Original / reconstruction identity</h3></div><strong>{gateBReviews.length} reviews</strong></div>
      <p className="small">Start a trial, listen to A and B in any order, then score whether they preserve the same object identity. The mapping remains hidden during scoring.</p>
      {presentationOrder === undefined
        ? <button disabled={!canListen || !objectReady || !reviewerReady} onClick={startBlindTrial}>START BLIND TRIAL</button>
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
    </article>

    <article className="review-card">
      <div className="review-head"><div><p className="eyebrow">GATE C / DEVICE</p><h3>Playable identity review</h3></div><strong>{gateCReviews.length} reviews</strong></div>
      <p className="small">Play the chromatic keyboard across the useful range first. Record this judgment on the device that produced the audio.</p>
      <div className="review-grid">
        <label><span>device ID</span><input value={deviceId} onChange={(event) => setDeviceId(event.target.value)} placeholder="iphone-safari-01" /></label>
        <label><span>device class</span><select value={deviceClass} onChange={(event) => setDeviceClass(event.target.value as DeviceClass)}>{DEVICE_CLASSES.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <ScoreField label="identity across range" value={rangeIdentity} onChange={setRangeIdentity} />
        <ScoreField label="timbre continuity" value={timbreContinuity} onChange={setTimbreContinuity} />
        <label><span>useful range</span><div className="input-unit"><input type="number" min="0" step="1" value={usefulSemitoneSpan} onChange={(event) => setUsefulSemitoneSpan(Number(event.target.value))} /><span>semitones</span></div></label>
        <label className="check-field"><input type="checkbox" checked={latencyAcceptable} onChange={(event) => setLatencyAcceptable(event.target.checked)} /><span>note-on latency acceptable</span></label>
      </div>
      <button disabled={!instrumentReady || !objectReady || !reviewerReady || deviceId.trim().length === 0} onClick={submitGateC}>SUBMIT DEVICE REVIEW</button>
    </article>
  </section>;
}
