import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import {
  benchmarkSonicTwinRetrieval,
  buildAcousticObjectModel,
  buildSonicTwinIndex,
  buildTwinVerificationPairs,
  calibratedPredictions,
  evaluateCalibration,
  fitIsotonicCalibration,
  retrieveSonicTwin,
  riskCoverageCurve,
  validateTwinBenchmarkCorpus,
  type AcousticObjectObservationV1,
  type LabeledSimilarityScoreV1,
  type NuisanceMetadataV1,
  type TwinBenchmarkCorpusV1,
} from "@everything-rings/fingerprint";
import { useMemo } from "react";

function fp(frequencies: readonly number[]): AcousticFingerprintV1 {
  return {
    version: 1,
    algorithmVersion: "er-dsp-2",
    sampleRate: 48_000,
    durationSeconds: 2,
    modes: frequencies.map((frequencyHz, index) => ({
      frequencyHz,
      relativeAmplitude: 1 / (index + 1),
      decaySeconds: 0.9 / (index + 1),
      q: 100,
      confidence: 0.9,
      diagnostics: { prominenceDb: 20, persistenceSeconds: 0.2, frequencyStdCents: 2, decayFitScore: 0.95, observationCount: 12 },
    })),
  };
}

const nuisance: NuisanceMetadataV1 = {
  strikeLocation: "digital-A",
  striker: "digital-impulse",
  support: "digital-fixed",
  microphoneDistanceClass: "digital-20cm",
  room: "digital-room",
  stationId: "digital-station",
  operatorId: "software",
  dayId: "digital-day-1",
};

const OBSERVATIONS: readonly AcousticObjectObservationV1[] = [
  { observationId: "bell-a-1", specimenId: "digital-bell-a", fingerprint: fp([440, 880, 1320, 1760]) },
  { observationId: "bell-a-2", specimenId: "digital-bell-a", fingerprint: fp([441, 882, 1322, 1763]) },
  { observationId: "bell-b-1", specimenId: "digital-bell-b", fingerprint: fp([470, 940, 1410, 1880]) },
  { observationId: "bell-b-2", specimenId: "digital-bell-b", fingerprint: fp([471, 942, 1412, 1883]) },
  { observationId: "plate-c-1", specimenId: "digital-plate-c", fingerprint: fp([620, 1010, 1670, 2510]) },
  { observationId: "plate-c-2", specimenId: "digital-plate-c", fingerprint: fp([621, 1012, 1672, 2512]) },
];

function corpus(): TwinBenchmarkCorpusV1 {
  return {
    schemaVersion: 1,
    corpusContractVersion: "sonic-twin-benchmark-corpus-1",
    corpusId: "built-in-digital-twin-demo-1",
    createdAt: "2026-08-24T15:30:00.000Z",
    observations: OBSERVATIONS.map((observation, index) => ({
      ...observation,
      objectFamily: observation.specimenId.includes("plate") ? "plate" : "bell",
      source: "digital-twin",
      nuisance: { ...nuisance, strikeLocation: index % 2 === 0 ? "digital-A" : "digital-B" },
    })),
  };
}

export function TwinLabApp() {
  const report = useMemo(() => {
    const benchmarkCorpus = corpus();
    const validation = validateTwinBenchmarkCorpus(benchmarkCorpus);
    const index = buildSonicTwinIndex(OBSERVATIONS);
    const query = fp([440.6, 881, 1321, 1761]);
    const ranking = retrieveSonicTwin(query, index);
    const retrievalMetrics = benchmarkSonicTwinRetrieval([
      { queryId: "query-a", trueSpecimenId: "digital-bell-a", fingerprint: query },
      { queryId: "query-b", trueSpecimenId: "digital-bell-b", fingerprint: fp([470.5, 941, 1411, 1881]) },
      { queryId: "query-c", trueSpecimenId: "digital-plate-c", fingerprint: fp([620.5, 1011, 1671, 2511]) },
    ], index);
    const pairs = buildTwinVerificationPairs(benchmarkCorpus, 30);
    const scored: LabeledSimilarityScoreV1[] = pairs.map((pair) => {
      const model = buildAcousticObjectModel(OBSERVATIONS.filter((observation) => observation.specimenId === pair.leftSpecimenId));
      const candidateRanking = retrieveSonicTwin(pair.candidate, { schemaVersion: 1, indexVersion: "sonic-twin-index-1", entries: [{ specimenId: model.specimenId, model }] });
      return { pairId: pair.pairId, score: candidateRanking[0]?.evidenceScore ?? 0, samePhysicalSpecimen: pair.samePhysicalSpecimen };
    });
    const model = fitIsotonicCalibration(scored.length > 0 ? scored : [
      { pairId: "fallback-n", score: 0, samePhysicalSpecimen: false },
      { pairId: "fallback-p", score: 1, samePhysicalSpecimen: true },
    ], "built-in-digital-twin-demo-1");
    const predictions = calibratedPredictions(model, scored);
    const calibration = evaluateCalibration(predictions);
    const riskCoverage = riskCoverageCurve(predictions);
    return { validation, index, ranking, retrievalMetrics, pairs, calibration, riskCoverage };
  }, []);

  return <main className="shell release-shell">
    <header>
      <p className="eyebrow">EVERYTHING RINGS / SONIC TWIN LAB</p>
      <h1>Object models, retrieval, calibration, abstention</h1>
      <p className="lede">A local software-only qualification surface. The built-in corpus is synthetic and is not physical identity evidence.</p>
    </header>

    <section className="release-status">
      <article className="release-card">
        <p className="eyebrow">CORPUS</p>
        <h2>{report.validation.valid ? "VALID" : "INVALID"}</h2>
        <p className="metric-line">{report.validation.observationCount} observations · {report.validation.specimenCount} specimens</p>
      </article>
      <article className="release-card">
        <p className="eyebrow">RETRIEVAL</p>
        <h2>Recall@1 {report.retrievalMetrics.recallAt1?.toFixed(3) ?? "—"}</h2>
        <p className="metric-line">MRR {report.retrievalMetrics.meanReciprocalRank?.toFixed(3) ?? "—"}</p>
      </article>
      <article className="release-card">
        <p className="eyebrow">CALIBRATION / DIGITAL POPULATION</p>
        <h2>Brier {report.calibration.brierScore?.toFixed(3) ?? "—"}</h2>
        <p className="metric-line">AUC {report.calibration.rocAuc?.toFixed(3) ?? "—"}</p>
      </article>
    </section>

    <section className="release-table-wrap">
      <div className="release-card-head"><div><p className="eyebrow">QUERY</p><h2>Ranked specimen models</h2></div></div>
      <div className="release-table" role="table">
        <div className="release-row release-row-head" role="row"><span>rank</span><span>specimen</span><span>score</span><span>distance</span><span>modes</span><span>coverage</span><span>status</span><span>claim</span></div>
        {report.ranking.map((result) => <div className="release-row" role="row" key={result.specimenId}>
          <span>{result.rank}</span><span>{result.specimenId}</span><span>{result.evidenceScore.toFixed(3)}</span><span>{result.normalizedDistance.toFixed(3)}</span><span>{result.matchedModelModes}/{result.modelModeCount}</span><span>digital</span><span>{result.rank === 1 ? "TOP" : ""}</span><span>ranking only</span>
        </div>)}
      </div>
    </section>

    <section className="release-detail-grid">
      <article className="release-detail"><h3>Verification pairs</h3><p>{report.pairs.length} deterministic same-specimen / hard-negative pairs.</p></article>
      <article className="release-detail"><h3>Risk / coverage</h3><p>{report.riskCoverage.map((point) => `${point.minimumConfidence.toFixed(2)}→${point.coverage.toFixed(2)}`).join(" · ")}</p></article>
      <article className="release-detail"><h3>Boundary</h3><p>No built-in result is a calibrated claim about physical objects. Calibration is bound to the named digital population.</p></article>
    </section>
  </main>;
}
