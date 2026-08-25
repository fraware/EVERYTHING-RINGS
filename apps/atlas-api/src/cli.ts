import { listenAtlasApi } from "./http";

if (process.env.ATLAS_PUBLIC_HOSTING === "1") {
  throw new Error("Atlas API is an alpha/synthetic service. Do not start it as public hosting.");
}

const port = Number.parseInt(process.env.ATLAS_PORT ?? "8787", 10);
const dataDir = process.env.ATLAS_DATA_DIR?.trim() || null;

const { url } = await listenAtlasApi({
  host: process.env.ATLAS_HOST ?? "127.0.0.1",
  port: Number.isFinite(port) ? port : 8787,
  dataDir,
});

process.stdout.write(`Atlas API alpha-synthetic listening at ${url}\n`);
