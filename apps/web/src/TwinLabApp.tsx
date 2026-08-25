import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import {
  benchmarkSonicTwinRetrieval,
  buildSonicTwinIndex,
  buildTwinVerificationPairs,
  compareFingerprintToObjectModel,
  fitAndEvaluateHeldOutCalibration,
  retrieveSonicTwin,
  validateTwinBenchmarkCorpus,
  type AcousticObjectObservationV1,
  type NuisanceMetadataV1,
  type PartitionedSimilarityScoreV1,
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

const SPECIMENS = [
  { id: "digital-bell-a", frequencies: [440, 880, 1320, 1760] },
  { id: "digital-bell-b", frequencies: [470, 940, 1410, 1880] },
  { id: "digital-plate-c", frequencies: [620, 1010, 1670, 2510] },
  { id: "digital-bell-d", frequencies: [523, 1046, 1570, 2093] },
  { id: "digital-plate-e", frequencies: [710, 1190, 1860, 2740] },
  { id: "digital-bowl-f", frequencies: [355, 760, 1285, 2010] },
] as const;

const OBSERVATIONS: readonly AcousticObjectObservationV1[] = SPECIMENS.flatMap((specimen) => [
  { observationId: `${specimen.id}-1`, specimenId: specimen.id, fingerprint: fp(specimen.frequencies) },
  { observationId: `${specimen.id}-2`, specimenId: specimen.id, fingerprint: fp(specimen.frequencies.map((frequency, index) => frequency * (1 + 0.0015 + index * 0.00015))) },
]);

function objectFamily(specimenId: string): string {
  if (specimenId.includes("plate")) return "plate";
  if (specimenId.includes("bowl")) return "bowl";
  return "bell";
}

function corpus(): TwinBenchmarkCorpusV1 {
  return {
    schemaVersion: 1,
    corpusContractVersion: "sonic-twin-benchmark-corpus-1",
    corpusId: "built-in-digital-twin-demo-2",
    createdAt: "2026-08-24T15:30:00.000Z",
    observations: OBSERVATIONS.map((observation, index) => ({
      ...observation,
      objectFamily: objectFamily(observation.specimenId),
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
    const queries = SPECIMENS.map((specimen, indexValue) => ({
      queryId: `query-${specimen.id}`,
      trueSpecimenId: specimen.id,
      fingerprint: fp(specimen.frequencies.map((frequency, modeIndex) => frequency * (1 + 0.0007 + indexValue * 0.00005 + modeIndex * 0.00003))),
    }));
    const ranking = retrieveSonicTwin(queries[0]!.fingerprint, index);
    const retrievalMetrics = benchmarkSonicTwinRetrieval(queries, index);
    const pairs = buildTwinVerificationPairs(benchmarkCorpus, 60);
    const scores: PartitionedSimilarityScoreV1[] = queries.flatMap((query, queryIndex) => index.entries.map((entry) => ({
      pairId: `${query.queryId}::${entry.specimenId}`,
      groupId: query.trueSpecimenId,
      partition: queryIndex < 3 ? "calibration" as const : "evaluation" as const,
      score: compareFingerprintToObjectModel(query.fingerprint, entry.model).evidenceScore,
      samePhysicalSpecimen: query.trueSpecimenId === entry.specimenId,
    })));
    const heldOutCalibration = fitAndEvaluateHeldOutCalibration(
      scores,
      "built-in-digital-calibration-population-2",
      "built-in-digital-held-out-population-2",
    );
    return { validation, index, ranking, retrievalMetrics, pairs, heldOutCalibration };
  }, []);

  return <main className="shell release-shell">
    <header>
      <p className="eyebrow">EVERYTHING RINGS / SONIC TWIN LAB</p>
      <h1>Object models, retrieval, held-out calibration, abstention</h1>
      <p className="lede">A local software-only qualification surface. Every result on this page is synthetic. This is not a network, not a physical-identity product, and not evidence that two real objects are the same.</p>
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
        <p className="eyebrow">HELD-OUT CALIBRATION / DIGITAL POPULATION</p>
        <h2>Brier {report.heldOutCalibration.metrics.brierScore?.toFixed(3) ?? "—"}</h2>
        <p className="metric-line">AUC {report.heldOutCalibration.metrics.rocAuc?.toFixed(3) ?? "—"} · {report.heldOutCalibration.evaluationGroups.length} held-out groups</p>
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
      <article className="release-detail"><h3>Risk / coverage</h3><p>{report.heldOutCalibration.riskCoverage.map((point) => `${point.minimumConfidence.toFixed(2)}→${point.coverage.toFixed(2)}`).join(" · ")}</p></article>
      <article className="release-detail"><h3>Boundary</h3><p>No built-in result is a calibrated claim about physical objects. Scores are ranking and software-qualification numbers only. They are not the probability that two physical objects are the same, and this lab does not publish or join a Resonance Atlas network.</p></article>
    </section>
  </main>;
}
