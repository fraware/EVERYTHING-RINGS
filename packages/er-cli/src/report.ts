export const USAGE = `er-cli — independent verification tooling for EVERYTHING RINGS

Usage:
  er hash <file>
  er verify evidence <file>
  er verify measurement <file>
  er verify derivation <file>
  er verify repository <file>
  er freeze dataset <manifest> [--out <snapshot.json>]
  er inspect lineage <id-or-path> [--from <graph>]
  er ingest measurement <evidence> --out <dir> --conversion-tool-revision <40hex> --allow-synthetic-ingest

Hashing always uses SHA-256 of the exact on-disk bytes. Source evidence is never
reserialized when an original digest is reported.

freeze dataset creates a research-benchmark-snapshot-1 via validation helpers.
inspect lineage walks derivation-record-1 / derivation-record-2 source graphs.
ingest measurement writes MeasurementRecordV1 + MeasurementSourceLink only to
--out and never mutates the evidence file (synthetic / post-Gate-A2 only).

This tool is not part of the frozen v8 evidence-production path. It must not
change Gate A2/B/C thresholds. E1 exits when Gate A2/B/C status is recorded
under frozen contracts, whether PASS or fail.
`;

export const NOT_IMPLEMENTED_EXIT = 2;
export const FAILURE_EXIT = 1;
export const SUCCESS_EXIT = 0;

export interface Io {
  readonly stdout: { write(data: string): boolean | void };
  readonly stderr: { write(data: string): boolean | void };
}

export function writeJson(io: Io, value: unknown): void {
  io.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
