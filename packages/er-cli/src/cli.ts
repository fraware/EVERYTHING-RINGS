import {
  FAILURE_EXIT,
  SUCCESS_EXIT,
  USAGE,
  type Io,
} from "./report.ts";
import {
  freezeDatasetCommand,
  hashCommand,
  ingestMeasurementCommand,
  inspectLineageCommand,
  verifyDerivationCommand,
  verifyEvidenceCommand,
  verifyMeasurementCommand,
  verifyRepositoryCommand,
} from "./commands.ts";
import { parseArgv } from "./flags.ts";

const defaultIo: Io = {
  stdout: process.stdout,
  stderr: process.stderr,
};

export async function runCli(argv: readonly string[], io: Io = defaultIo): Promise<number> {
  const args = argv.filter((arg) => arg !== "--");
  const head = args[0];
  if (head === undefined || head === "-h" || head === "--help" || head === "help") {
    io.stdout.write(USAGE);
    return SUCCESS_EXIT;
  }
  if (head === "-v" || head === "--version" || head === "version") {
    io.stdout.write("0.0.0\n");
    return SUCCESS_EXIT;
  }

  try {
    if (head === "hash") {
      const path = requirePath(args[1], "hash <file>", io);
      if (path === undefined) return FAILURE_EXIT;
      return await hashCommand(path, io);
    }
    if (head === "verify") {
      return await dispatchVerify(args.slice(1), io);
    }
    if (head === "freeze") {
      if (args[1] !== "dataset") {
        io.stderr.write("error: expected `er freeze dataset <manifest> [--out <snapshot.json>]`\n");
        return FAILURE_EXIT;
      }
      const { positional, flags } = parseArgv(args.slice(2));
      return await freezeDatasetCommand(positional[0], flags, io);
    }
    if (head === "inspect") {
      if (args[1] !== "lineage") {
        io.stderr.write("error: expected `er inspect lineage <id-or-path> [--from <graph>]`\n");
        return FAILURE_EXIT;
      }
      const { positional, flags } = parseArgv(args.slice(2));
      return await inspectLineageCommand(positional[0], flags, io);
    }
    if (head === "ingest") {
      if (args[1] !== "measurement") {
        io.stderr.write("error: expected `er ingest measurement <evidence> --out <dir> --conversion-tool-revision <40hex> --allow-synthetic-ingest`\n");
        return FAILURE_EXIT;
      }
      const { positional, flags } = parseArgv(args.slice(2));
      return await ingestMeasurementCommand(positional[0], flags, io);
    }
    io.stderr.write(`error: unknown command ${JSON.stringify(head)}\n`);
    io.stderr.write(USAGE);
    return FAILURE_EXIT;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.stderr.write(`error: ${message}\n`);
    return FAILURE_EXIT;
  }
}

async function dispatchVerify(args: readonly string[], io: Io): Promise<number> {
  const kind = args[0];
  if (kind === "evidence") {
    const path = requirePath(args[1], "verify evidence <file>", io);
    if (path === undefined) return FAILURE_EXIT;
    return await verifyEvidenceCommand(path, io);
  }
  if (kind === "measurement") {
    const path = requirePath(args[1], "verify measurement <file>", io);
    if (path === undefined) return FAILURE_EXIT;
    return await verifyMeasurementCommand(path, io);
  }
  if (kind === "derivation") {
    const path = requirePath(args[1], "verify derivation <file>", io);
    if (path === undefined) return FAILURE_EXIT;
    return await verifyDerivationCommand(path, io);
  }
  if (kind === "repository") {
    const path = requirePath(args[1], "verify repository <file>", io);
    if (path === undefined) return FAILURE_EXIT;
    return await verifyRepositoryCommand(path, io);
  }
  io.stderr.write("error: expected `er verify evidence|measurement|derivation|repository <file>`\n");
  return FAILURE_EXIT;
}

function requirePath(path: string | undefined, usage: string, io: Io): string | undefined {
  if (path === undefined || path.length === 0) {
    io.stderr.write(`error: expected \`er ${usage}\`\n`);
    return undefined;
  }
  return path;
}
