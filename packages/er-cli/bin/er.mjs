#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
let tsxCli;
try {
  tsxCli = require.resolve("tsx/cli");
} catch {
  process.stderr.write("er-cli requires tsx. Run pnpm install from the repository root.\n");
  process.exit(1);
}

const entry = fileURLToPath(new URL("../src/main.ts", import.meta.url));
const child = spawn(process.execPath, [tsxCli, entry, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
});
child.on("error", (error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
