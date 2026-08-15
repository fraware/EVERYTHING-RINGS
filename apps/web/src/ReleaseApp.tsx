import {
  buildReleaseVerdict,
  parseValidationEvidenceJson,
  type ValidationEvidenceV3,
} from "@everything-rings/validation";
import { useMemo, useState } from "react";

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
  const [evidence, setEvidence] = useState<ValidationEvidenceV3[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const gateBReviews = useMemo(() => evidence.flatMap((bundle) => bundle.gateBReviews), [evidence]);
  const gateCReviews = useMemo(() => evidence.flatMap((bundle) => bundle.gateCReviews), [evidence]);
  const verdict = useMemo(
    () => buildReleaseVerdict(evidence, gateBReviews, gateCReviews, "preview"),
    [evidence, gateBReviews, gateCReviews],
  );

  async function importFiles(files: FileList | null): Promise<void> {
    if (files === null) return;
    const loaded: ValidationEvidenceV3[] = [];
    const nextErrors: string[] = [];
    for (const file of Array.from(files)) {
      const result = parseValidationEvidenceJson(await file.text());
      if (result.ok) loaded.push(result.evidence);
      else nextErrors.push(`${file.name}: ${result.error}`);
    }
    setEvidence((current) => {
      const bySession = new Map(current.map((bundle) => [bundle.sessionId, bundle]));
      for (const bundle of loaded) bySession.set(bundle.sessionId, bundle);
      return [...bySession.values()].sort((left, right) => left.object.label.localeCompare(right.object.label));
    });
    setErrors(nextErrors);
  }

  function exportVerdict(): void {
    const finalVerdict = buildReleaseVerdict(evidence, gateBReviews, gateCReviews, new Date().toISOString());
    downloadJson(`everything-rings-release-verdict-${Date.now()}.json`, {
      ...finalVerdict,
      evidenceSessions: evidence.map((bundle) => ({
        sessionId: bundle.sessionId,
        object: bundle.object,
        createdAt: bundle.createdAt,
      })),
    });
  }

  return <main className="shell release-shell">
    <header>
      <p className="eyebrow">EVERYTHING RINGS / RELEASE CONSOLE</p>
      <h1>Empirical release gates</h1>
      <p className="lede">Import local validation bundles. The console evaluates the frozen Gate A/B/C contracts without uploading evidence or microphone audio.</p>
    </header>

    <section className="release-import">
      <label className="file-button">IMPORT EVIDENCE<input type="file" accept="application/json,.json" multiple onChange={(event) => { void importFiles(event.currentTarget.files); event.currentTarget.value = ""; }} /></label>
      <button className="secondary" disabled={evidence.length === 0} onClick={() => { setEvidence([]); setErrors([]); }}>CLEAR</button>
      <button disabled={evidence.length === 0} onClick={exportVerdict}>EXPORT VERDICT</button>
      <span className="small">{evidence.length} sessions · {gateBReviews.length} Gate B reviews · {gateCReviews.length} Gate C reviews</span>
    </section>

    {errors.length > 0 ? <section className="import-errors"><h2>Rejected files</h2><Reasons reasons={errors} /></section> : null}

    <section className="release-status">
      <article className="release-card release-overall">
        <div className="release-card-head"><div><p className="eyebrow">RELEASE</p><h2>{verdict.releaseReady ? "Empirically ready" : "Evidence incomplete"}</h2></div><Verdict passed={verdict.releaseReady} /></div>
        <p className="small">Release becomes ready only when Gate A, Gate B, and Gate C all pass their frozen contracts.</p>
      </article>
      <article className="release-card">
        <div className="release-card-head"><div><p className="eyebrow">GATE A / PHYSICAL</p><h2>Repeatable acoustic structure</h2></div><Verdict passed={verdict.gateA.passed} /></div>
        <p className="metric-line">{verdict.gateA.distinctPassingObjectCount} / 5 distinct passing objects</p>
        <Reasons reasons={verdict.gateA.reasons} />
      </article>
      <article className="release-card">
        <div className="release-card-head"><div><p className="eyebrow">GATE B / PERCEPTUAL</p><h2>Reconstruction identity</h2></div><Verdict passed={verdict.gateB.passed} /></div>
        <p className="metric-line">{verdict.gateB.passingObjectCount} / 4 required passing objects</p>
        <Reasons reasons={verdict.gateB.reasons} />
      </article>
      <article className="release-card">
        <div className="release-card-head"><div><p className="eyebrow">GATE C / PLAYABLE</p><h2>Instrument identity</h2></div><Verdict passed={verdict.gateC.passed} /></div>
        <p className="metric-line">{verdict.gateC.passingObjectCount} / 4 objects · {verdict.gateC.distinctDeviceCount} / 2 devices</p>
        <Reasons reasons={verdict.gateC.reasons} />
      </article>
    </section>

    <section className="release-table-wrap">
      <div className="release-card-head"><div><p className="eyebrow">EVIDENCE</p><h2>Object sessions</h2></div></div>
      <div className="release-table" role="table">
        <div className="release-row release-row-head" role="row"><span>object</span><span>material</span><span>strikes</span><span>drift</span><span>B</span><span>C</span><span>A</span></div>
        {evidence.map((bundle) => {
          const sessionVerdict = verdict.gateA.sessions.find((session) => session.sessionId === bundle.sessionId);
          return <div className="release-row" role="row" key={bundle.sessionId}>
            <span>{bundle.object.label}</span>
            <span>{bundle.object.material}</span>
            <span>{bundle.records.length}</span>
            <span>{sessionVerdict?.metrics.sessionMedianDriftCents === null || sessionVerdict?.metrics.sessionMedianDriftCents === undefined ? "—" : `${sessionVerdict.metrics.sessionMedianDriftCents.toFixed(1)}¢`}</span>
            <span>{bundle.gateBReviews.length}</span>
            <span>{bundle.gateCReviews.length}</span>
            <span>{sessionVerdict === undefined ? "—" : sessionVerdict.passed ? "PASS" : "OPEN"}</span>
          </div>;
        })}
      </div>
    </section>

    {verdict.gateA.sessions.length > 0 ? <section className="release-detail-grid">
      {verdict.gateA.sessions.map((session) => <article className="release-detail" key={session.sessionId}>
        <div className="release-card-head"><h3>{session.objectLabel}</h3><Verdict passed={session.passed} /></div>
        <dl>
          <div><dt>stable strikes</dt><dd>{session.metrics.strikesWithStableModes} / 5</dd></div>
          <div><dt>matched comparisons</dt><dd>{session.metrics.comparisonsWithEnoughMatches} / 4</dd></div>
          <div><dt>median drift</dt><dd>{session.metrics.sessionMedianDriftCents === null ? "—" : `${session.metrics.sessionMedianDriftCents.toFixed(1)}¢`}</dd></div>
          <div><dt>worst comparison</dt><dd>{session.metrics.worstComparisonMedianDriftCents === null ? "—" : `${session.metrics.worstComparisonMedianDriftCents.toFixed(1)}¢`}</dd></div>
        </dl>
        <Reasons reasons={session.reasons} />
      </article>)}
    </section> : null}
  </main>;
}
