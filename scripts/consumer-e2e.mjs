import { spawn } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const browser = process.env.BROWSER;
const baseUrl = process.env.BASE_URL;
if (!browser || !baseUrl) throw new Error("BROWSER and BASE_URL are required");

const workDir = `/tmp/everything-rings-e2e-${process.pid}`;
const audioPath = join(workDir, "impact.wav");
const downloadDir = join(workDir, "downloads");
const profileDir = join(workDir, "profile");
mkdirSync(downloadDir, { recursive: true });
mkdirSync(profileDir, { recursive: true });

function createImpactWav(path) {
  const sampleRate = 48_000;
  const durationSeconds = 6;
  const strikeSeconds = 1.15;
  const sampleCount = sampleRate * durationSeconds;
  const samples = new Float32Array(sampleCount);
  const modes = [
    { frequencyHz: 440, amplitude: 0.40, decaySeconds: 1.2 },
    { frequencyHz: 997, amplitude: 0.24, decaySeconds: 0.7 },
    { frequencyHz: 2413, amplitude: 0.14, decaySeconds: 0.38 },
  ];
  for (let index = 0; index < sampleCount; index += 1) {
    const absoluteTime = index / sampleRate;
    const ringTime = absoluteTime - strikeSeconds;
    let value = 0;
    if (ringTime >= 0 && ringTime <= 3.2) {
      for (const mode of modes) {
        value += mode.amplitude
          * Math.exp(-ringTime / mode.decaySeconds)
          * Math.cos(2 * Math.PI * mode.frequencyHz * ringTime);
      }
    }
    samples[index] = Math.max(-0.92, Math.min(0.92, value));
  }

  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * bytesPerSample, 28);
  buffer.writeUInt16LE(bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let index = 0; index < samples.length; index += 1) {
    buffer.writeInt16LE(Math.round(samples[index] * 32767), 44 + index * bytesPerSample);
  }
  writeFileSync(path, buffer);
}

createImpactWav(audioPath);

const debuggingPort = 9300 + (process.pid % 300);
const chrome = spawn(browser, [
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  "--mute-audio",
  "--use-fake-ui-for-media-stream",
  "--use-fake-device-for-media-stream",
  `--use-file-for-fake-audio-capture=${audioPath}`,
  "--autoplay-policy=no-user-gesture-required",
  `--remote-debugging-port=${debuggingPort}`,
  `--user-data-dir=${profileDir}`,
  `${baseUrl}/`,
], { stdio: ["ignore", "ignore", "pipe"] });
const chromeExit = new Promise((resolve) => chrome.once("exit", resolve));

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
  throw new Error(`Could not connect to browser debugging target. ${stderr}`);
}

const target = await browserTarget();
const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
const diagnostics = [];
let nextId = 1;
let targetCrashed = false;

function diagnosticText(value) {
  if (typeof value === "string") return value;
  try { return JSON.stringify(value); } catch { return String(value); }
}

socket.addEventListener("message", (event) => {
  const message = JSON.parse(String(event.data));
  if (typeof message.id === "number") {
    const handler = pending.get(message.id);
    if (!handler) return;
    pending.delete(message.id);
    if (message.error) handler.reject(new Error(message.error.message));
    else handler.resolve(message.result);
    return;
  }
  if (message.method === "Inspector.targetCrashed") {
    targetCrashed = true;
    diagnostics.push("renderer target crashed");
  }
  if (message.method === "Runtime.exceptionThrown") {
    diagnostics.push(`exception: ${message.params?.exceptionDetails?.exception?.description ?? message.params?.exceptionDetails?.text ?? "unknown"}`);
  }
  if (message.method === "Runtime.consoleAPICalled") {
    const values = (message.params?.args ?? []).map((arg) => arg.value ?? arg.description).map(diagnosticText);
    diagnostics.push(`console ${message.params?.type ?? "log"}: ${values.join(" ")}`);
  }
  if (message.method === "Log.entryAdded" && message.params?.entry?.level === "error") {
    diagnostics.push(`browser log: ${message.params.entry.text}`);
  }
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
  if (targetCrashed) throw new Error(`Browser renderer crashed. ${diagnostics.join(" | ")}`);
  const result = await command("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
    userGesture,
  });
  if (result.exceptionDetails) {
    const description = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? "Browser evaluation failed";
    throw new Error(description);
  }
  return result.result?.value;
}

async function pageSnapshot() {
  try {
    return await evaluate(`(() => ({
      href: location.href,
      readyState: document.readyState,
      visibility: document.visibilityState,
      text: document.body?.innerText ?? null,
      html: document.body?.innerHTML?.slice(0, 1200) ?? null,
      buttons: Array.from(document.querySelectorAll("button")).map((button) => ({ text: button.textContent?.trim(), disabled: button.disabled })),
    }))()`);
  } catch (error) {
    return { snapshotError: error instanceof Error ? error.message : String(error) };
  }
}

async function waitFor(expression, label, timeoutMs = 18_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(expression)) return;
    const failed = await evaluate(`document.body?.innerText.includes("TRY THAT AGAIN") ?? false`);
    if (failed) {
      throw new Error(`Consumer flow entered failure state while waiting for ${label}. ${JSON.stringify(await pageSnapshot())}`);
    }
    await sleep(150);
  }
  const snapshot = await pageSnapshot();
  const diagnosticTail = diagnostics.slice(-12).join(" | ");
  const stderrTail = stderr.slice(-2000);
  throw new Error(`Timed out waiting for ${label}. Snapshot: ${JSON.stringify(snapshot)}. Diagnostics: ${diagnosticTail}. Browser stderr: ${stderrTail}`);
}

async function terminateChrome() {
  if (chrome.exitCode !== null || chrome.signalCode !== null) return;
  chrome.kill("SIGTERM");
  const exitedGracefully = await Promise.race([
    chromeExit.then(() => true),
    sleep(2_000).then(() => false),
  ]);
  if (exitedGracefully) return;
  chrome.kill("SIGKILL");
  await Promise.race([chromeExit, sleep(1_000)]);
}

try {
  await command("Runtime.enable");
  await command("Page.enable");
  await command("Log.enable");
  await command("Inspector.enable");
  await command("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await command("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloadDir });

  await waitFor(`document.body?.innerText.includes("START LISTENING") ?? false`, "landing page", 8_000);
  const landingCopyOk = await evaluate(`document.body.innerText.includes("allow microphone access") && document.body.innerText.includes("one clean strike")`);
  if (!landingCopyOk) throw new Error("First-use microphone guidance is missing");

  await evaluate(`Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("START LISTENING"))?.click()`, true);
  await waitFor(`document.body?.innerText.includes("You found") ?? false`, "successful resonance reveal");

  const revealText = await evaluate("document.body.innerText");
  if (!/You found \d+ resonances\./.test(revealText)) throw new Error("Reveal did not expose a resonance count");

  const layout = await evaluate(`(() => {
    const visibleButtons = Array.from(document.querySelectorAll("button")).filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    });
    return {
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      undersized: visibleButtons.filter((button) => button.getBoundingClientRect().height < 43.5).map((button) => button.textContent?.trim()),
    };
  })()`);
  if (layout.overflow > 1) throw new Error(`Mobile reveal has ${layout.overflow}px horizontal overflow`);
  if (layout.undersized.length > 0) throw new Error(`Undersized touch targets: ${layout.undersized.join(", ")}`);

  await waitFor(`Array.from(document.querySelectorAll("button")).some((button) => button.textContent?.includes("PLAY IT") || button.textContent?.includes("PLAY UNAVAILABLE"))`, "realtime instrument outcome", 8_000);
  const playUnavailable = await evaluate(`Array.from(document.querySelectorAll("button")).some((button) => button.textContent?.includes("PLAY UNAVAILABLE"))`);
  if (playUnavailable) {
    throw new Error(`Realtime instrument failed to initialize. ${JSON.stringify(await pageSnapshot())}. Diagnostics: ${diagnostics.slice(-12).join(" | ")}`);
  }

  await evaluate(`Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("HEAR CAPTURE"))?.click()`, true);
  await evaluate(`Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("WATCH + HEAR MODEL"))?.click()`, true);
  await sleep(250);
  const playbackError = await evaluate(`document.querySelector(".consumer-playback-error")?.textContent ?? ""`);
  if (playbackError) throw new Error(`Playback recovery failed during capture/model comparison: ${playbackError}`);

  await evaluate(`Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("PLAY IT"))?.click()`, true);
  await waitFor(`document.querySelectorAll("#consumer-playable-keys button").length === 13`, "playable keyboard", 3_000);
  await evaluate(`document.querySelector("#consumer-playable-keys button")?.click()`, true);
  await sleep(100);
  const notePlaybackError = await evaluate(`document.querySelector(".consumer-playback-error")?.textContent ?? ""`);
  if (notePlaybackError) throw new Error(`Playable note failed: ${notePlaybackError}`);

  await evaluate(`Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("SHARE STORY"))?.click()`, true);
  await evaluate(`Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("SHARE DNA"))?.click()`, true);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const files = readdirSync(downloadDir).filter((name) => !name.endsWith(".crdownload"));
    if (files.some((name) => name.endsWith("-story.html")) && files.some((name) => name.endsWith(".svg"))) break;
    await sleep(100);
  }
  const downloads = readdirSync(downloadDir).filter((name) => !name.endsWith(".crdownload"));
  if (!downloads.some((name) => name.endsWith("-story.html"))) throw new Error("Acoustic Story download fallback did not produce a file");
  if (!downloads.some((name) => name.endsWith(".svg"))) throw new Error("Acoustic DNA download fallback did not produce a file");

  await evaluate(`Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("STRIKE ANOTHER"))?.click()`, true);
  await waitFor(`document.body?.innerText.includes("Listening to the room") || document.body?.innerText.includes("Hit one object")`, "second-strike recovery", 5_000);

  console.log("Consumer E2E passed: microphone → reveal → compare → play → share → strike again on 390×844 viewport.");
} finally {
  try { socket.close(); } catch { /* already closed */ }
  await terminateChrome();
  rmSync(workDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
