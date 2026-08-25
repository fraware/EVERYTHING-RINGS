import { runCli } from "./cli.ts";

process.exitCode = await runCli(process.argv.slice(2));
