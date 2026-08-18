import { spawn } from "node:child_process";
import { rmSync } from "node:fs";

const browser = process.env.BROWSER;
const baseUrl = process.env.BASE_URL;
if (!browser || !baseUrl) throw new Error("BROWSER and BASE_URL are required");

const profileDir = `/tmp/everything-rings-permission-${process.pid}`;
const debuggingPort = 9600 + (process.pid % 250);
const chrome = spawn(browser, [
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  "--deny-permission-prompts",
  "--use-fake-device-for-media-stream",
  `--remote-debugging-port=${debuggingPort}`,
  `--user-data-dir=${profileDir}`,
  `${baseUrl}/`,
], { stdio: ["ignore", "ignore", "pipe"] });

let stderr = "";
chrome.stderr.on("data", (chunk) => { stderr += String(chunk); });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function browserTarget() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${debuggingPort}/json`);
      const targets = await response.json();
      const target = targets.find((candidate) => candidate.type === "page" && candidate.url.startsWith(baseUrl));
      if (target?.webSocketDebuggerUrl) return target;
    } catch {
      // Browser is still starting.
    }
    await sleep(100);
  }
  throw new Error(`Could not connect to permission-test browser. ${stderr}`);
}

const target = await browserTarget();
const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
let nextId = 1;

socket.addEventListener("message", (event) => {
  const message = JSON.parse(String(event.data));
  if (typeof message.id !== "number") return;
  const handler = pending.get(message.id);
  if (!handler) return;
  pending.delete(message.id);
  if (message.error) handler.reject(new Error(message.error.message));
  else handler.resolve(message.result);
});

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

function command(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression, userGesture = false) {
  const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? "Browser evaluation failed");
  return result.result?.value;
}

async function waitFor(expression, label, timeoutMs = 6_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(expression)) return;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${label}: ${await evaluate("document.body?.innerText ?? ''")}`);
}

try {
  await command("Runtime.enable");
  await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await waitFor(`document.body?.innerText.includes("START LISTENING") ?? false`, "landing page");
  await evaluate(`Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("START LISTENING"))?.click()`, true);
  await waitFor(`document.body?.innerText.includes("Microphone access is blocked") ?? false`, "permission recovery");

  const text = await evaluate("document.body.innerText");
  if (!text.includes("TRY AGAIN") || !text.includes("START OVER")) {
    throw new Error(`Permission failure does not expose both recovery actions: ${text}`);
  }
  if (text.includes("NotAllowedError") || text.includes("PermissionDeniedError")) {
    throw new Error(`Raw browser permission error leaked into user-facing copy: ${text}`);
  }

  await evaluate(`Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("START OVER"))?.click()`, true);
  await waitFor(`document.body?.innerText.includes("START LISTENING") ?? false`, "landing recovery");
  console.log("Permission E2E passed: denied microphone → clear recovery → start over.");
} finally {
  try { socket.close(); } catch { /* already closed */ }
  chrome.kill("SIGTERM");
  await sleep(100);
  rmSync(profileDir, { recursive: true, force: true });
}
