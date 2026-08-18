import { spawn } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const browser = process.env.BROWSER;
const baseUrl = process.env.BASE_URL;
if (!browser || !baseUrl) throw new Error("BROWSER and BASE_URL are required");

const HISTORY_KEY = "everything-rings:consumer-history:v1";
const workDir = `/tmp/everything-rings-history-e2e-${process.pid}`;
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
    const ringTime = index / sampleRate - strikeSeconds;
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

const debuggingPort = 9600 + (process.pid % 250);
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
  throw new Error(`Could not connect to history browser target. ${stderr}`);
}

const target = await browserTarget();
const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
let nextId = 1;

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

socket.addEventListener("message", (event) => {
  const message = JSON.parse(String(event.data));
  if (typeof message.id !== "number") return;
  const handler = pending.get(message.id);
  if (!handler) return;
  pending.delete(message.id);
  if (message.error) handler.reject(new Error(message.error.message));
  else handler.resolve(message.result);
});

function command(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression, userGesture = false) {
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

async function waitFor(expression, label, timeoutMs = 18_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(expression)) return;
    const failed = await evaluate(`document.body?.innerText.includes("TRY THAT AGAIN") ?? false`);
    if (failed) throw new Error(`Consumer entered failure state while waiting for ${label}`);
    await sleep(150);
  }
  throw new Error(`Timed out waiting for ${label}. Body: ${await evaluate("document.body?.innerText ?? ''")}`);
}

async function layoutAudit() {
  return evaluate(`(() => {
    const buttons = Array.from(document.querySelectorAll("button")).filter((button) => {
      const rect = button.getBoundingClientRect();
      const style = getComputedStyle(button);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    });
    return {
      overflow: document.documentElement.scrollWidth - innerWidth,
      undersized: buttons.filter((button) => button.getBoundingClientRect().height < 43.5).map((button) => button.textContent?.trim()),
    };
  })()`);
}

async function interceptMicrophoneCounter(counterName) {
  return evaluate(`(() => {
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices || typeof mediaDevices.getUserMedia !== "function") return false;
    const original = mediaDevices.getUserMedia.bind(mediaDevices);
    window[${JSON.stringify(counterName)}] = 0;
    mediaDevices.getUserMedia = (...args) => {
      window[${JSON.stringify(counterName)}] += 1;
      return original(...args);
    };
    return true;
  })()`);
}

function completedDownloads() {
  return readdirSync(downloadDir).filter((name) => !name.endsWith(".crdownload"));
}

try {
  await command("Runtime.enable");
  await command("Page.enable");
  await command("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await command("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloadDir });

  await waitFor(`document.body?.innerText.includes("START LISTENING") ?? false`, "landing", 8_000);
  await evaluate(`Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("START LISTENING"))?.click()`, true);
  await waitFor(`document.body?.innerText.includes("You found") ?? false`, "successful reveal");
  await waitFor(`localStorage.getItem(${JSON.stringify(HISTORY_KEY)}) !== null`, "history write", 3_000);

  const stored = await evaluate(`(() => {
    const raw = localStorage.getItem(${JSON.stringify(HISTORY_KEY)});
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    const first = parsed.records?.[0];
    return {
      schemaVersion: parsed.schemaVersion,
      count: parsed.records?.length ?? 0,
      containsSamplesField: raw.includes('"samples"'),
      signature: first?.signature ?? null,
      algorithmVersion: first?.fingerprint?.algorithmVersion ?? null,
      softwareRevision: first?.softwareRevision ?? null,
      modeCount: first?.fingerprint?.modes?.length ?? 0,
    };
  })()`);

  if (stored?.schemaVersion !== 1 || stored.count !== 1) throw new Error(`Unexpected history envelope: ${JSON.stringify(stored)}`);
  if (stored.containsSamplesField) throw new Error("Local capture history contains microphone samples");
  if (!/^er1-[0-9a-f]{16}$/.test(stored.signature ?? "")) throw new Error("Local capture signature is invalid");
  if (stored.algorithmVersion !== "er-dsp-2") throw new Error(`Unexpected fingerprint algorithm ${stored.algorithmVersion}`);
  if (!/^[0-9a-f]{40}$/.test(stored.softwareRevision ?? "")) throw new Error("Stamped browser build did not preserve software provenance");
  if (stored.modeCount < 3) throw new Error(`Persisted fingerprint lost modes: ${stored.modeCount}`);

  await evaluate(`Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("STRIKE ANOTHER"))?.click()`, true);
  await waitFor(`document.body?.innerText.includes("Listening to the room") || document.body?.innerText.includes("Hit one object")`, "second-strike recovery", 5_000);
  await evaluate(`Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("CANCEL"))?.click()`, true);
  await waitFor(`document.body?.innerText.includes("RECENT DISCOVERIES") ?? false`, "history landing", 5_000);

  const landingText = await evaluate("document.body.innerText");
  if (!landingText.includes(stored.signature)) throw new Error("Persisted signature is missing from recent captures");
  if (!landingText.includes("Fingerprint history only")) throw new Error("History privacy boundary is missing");

  const layout = await layoutAudit();
  if (layout.overflow > 1) throw new Error(`History landing has ${layout.overflow}px horizontal overflow`);
  if (layout.undersized.length > 0) throw new Error(`History landing has undersized controls: ${layout.undersized.join(", ")}`);

  await command("Page.reload", { ignoreCache: true });
  await waitFor(`document.body?.innerText.includes("RECENT DISCOVERIES") ?? false`, "history after reload", 8_000);
  const reloaded = await evaluate(`(() => ({
    count: JSON.parse(localStorage.getItem(${JSON.stringify(HISTORY_KEY)}) ?? '{"records":[]}').records?.length ?? 0,
    signatureVisible: document.body.innerText.includes(${JSON.stringify(stored.signature)}),
    privacyVisible: document.body.innerText.includes("Fingerprint history only"),
  }))()`);
  if (reloaded.count !== 1 || !reloaded.signatureVisible || !reloaded.privacyVisible) {
    throw new Error(`History did not survive reload: ${JSON.stringify(reloaded)}`);
  }

  const microphoneInterception = await interceptMicrophoneCounter("__everythingRingsSavedCaptureMicCalls");
  if (!microphoneInterception) throw new Error("Could not instrument microphone calls for saved-capture boundary test");

  await evaluate(`Array.from(document.querySelectorAll(".consumer-history-card button")).find((button) => button.textContent?.trim() === "OPEN")?.click()`, true);
  await waitFor(`document.body?.innerText.includes("SAVED CAPTURE") ?? false`, "saved capture view", 5_000);
  const savedText = await evaluate("document.body.innerText");
  if (!savedText.includes("Original microphone audio was not retained")) throw new Error("Saved capture truth boundary is missing");
  if (!savedText.includes("CAPTURE NOT STORED")) throw new Error("Saved capture incorrectly offers original-capture playback");
  if (!savedText.includes(stored.signature)) throw new Error("Saved capture signature provenance is missing");
  if (!savedText.includes(stored.algorithmVersion)) throw new Error("Saved capture algorithm provenance is missing");
  if (!savedText.includes(stored.softwareRevision)) throw new Error("Saved capture software provenance is missing");

  const savedLayout = await layoutAudit();
  if (savedLayout.overflow > 1) throw new Error(`Saved capture view has ${savedLayout.overflow}px horizontal overflow`);
  if (savedLayout.undersized.length > 0) throw new Error(`Saved capture view has undersized controls: ${savedLayout.undersized.join(", ")}`);

  await evaluate(`Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("WATCH + HEAR MODEL"))?.click()`, true);
  await sleep(250);
  let savedPlaybackError = await evaluate(`document.querySelector(".consumer-playback-error")?.textContent ?? ""`);
  if (savedPlaybackError) throw new Error(`Saved model playback failed: ${savedPlaybackError}`);

  await evaluate(`Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("HEAR THIS RING"))?.click()`, true);
  await sleep(150);
  savedPlaybackError = await evaluate(`document.querySelector(".consumer-playback-error")?.textContent ?? ""`);
  if (savedPlaybackError) throw new Error(`Saved mode playback failed: ${savedPlaybackError}`);

  await evaluate(`document.querySelector("#saved-capture-playable-keys button")?.click()`, true);
  await sleep(500);
  savedPlaybackError = await evaluate(`document.querySelector(".consumer-playback-error")?.textContent ?? ""`);
  if (savedPlaybackError) throw new Error(`Saved chromatic playback failed: ${savedPlaybackError}`);
  const microphoneCalls = await evaluate(`window.__everythingRingsSavedCaptureMicCalls ?? -1`);
  if (microphoneCalls !== 0) throw new Error(`Saved capture requested microphone access ${microphoneCalls} time(s)`);

  await evaluate(`Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.includes("BACK TO HISTORY"))?.click()`, true);
  await waitFor(`document.body?.innerText.includes("RECENT DISCOVERIES") ?? false`, "history after saved player", 5_000);
  const countAfterPlayer = await evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(HISTORY_KEY)}) ?? '{"records":[]}').records?.length ?? 0`);
  if (countAfterPlayer !== 1) throw new Error(`Saved player mutated history: ${countAfterPlayer}`);

  const seededComparison = await evaluate(`(() => {
    const raw = localStorage.getItem(${JSON.stringify(HISTORY_KEY)});
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    const first = parsed.records?.[0];
    if (!first) return null;
    const secondCapturedAt = new Date(Date.parse(first.capturedAt) + 1000).toISOString();
    const second = {
      ...first,
      id: secondCapturedAt + "-" + first.signature,
      capturedAt: secondCapturedAt,
    };
    parsed.records = [first, second];
    localStorage.setItem(${JSON.stringify(HISTORY_KEY)}, JSON.stringify(parsed));
    return {
      count: parsed.records.length,
      distinctIds: first.id !== second.id,
      equalSignatures: first.signature === second.signature,
    };
  })()`);
  if (seededComparison?.count !== 2 || !seededComparison.distinctIds || !seededComparison.equalSignatures) {
    throw new Error(`Could not seed distinct equal-signature observations: ${JSON.stringify(seededComparison)}`);
  }

  await command("Page.reload", { ignoreCache: true });
  await waitFor(`document.querySelectorAll(".consumer-history-card").length === 2`, "two-observation history", 8_000);
  const comparisonMicrophoneInterception = await interceptMicrophoneCounter("__everythingRingsComparisonMicCalls");
  if (!comparisonMicrophoneInterception) throw new Error("Could not instrument microphone calls for comparison boundary test");

  await evaluate(`Array.from(document.querySelectorAll(".consumer-history-card"))[0]?.querySelectorAll("button") && Array.from(Array.from(document.querySelectorAll(".consumer-history-card"))[0].querySelectorAll("button")).find((button) => button.textContent?.trim() === "COMPARE")?.click()`, true);
  await waitFor(`document.body?.innerText.includes("Choose a second saved capture for Resonance Diff") ?? false`, "comparison anchor", 3_000);
  await evaluate(`Array.from(Array.from(document.querySelectorAll(".consumer-history-card"))[1]?.querySelectorAll("button") ?? []).find((button) => button.textContent?.trim() === "COMPARE WITH")?.click()`, true);
  await waitFor(`document.body?.innerText.includes("RESONANCE DIFF") ?? false`, "resonance diff", 5_000);

  const comparisonText = await evaluate("document.body.innerText");
  if (!comparisonText.includes("No identity verdict")) throw new Error("Comparison identity boundary is missing");
  if (!comparisonText.includes("Threshold-free and one-to-one")) throw new Error("Comparison pairing contract is missing");
  if (!comparisonText.includes("MUTUAL-NEAREST FREQUENCIES")) throw new Error("Comparison frequency-pair view is missing");
  if (comparisonText.toLowerCase().includes("similarity score")) throw new Error("Comparison exposed a scalar similarity score");

  const comparisonLayout = await layoutAudit();
  if (comparisonLayout.overflow > 1) throw new Error(`Comparison view has ${comparisonLayout.overflow}px horizontal overflow`);
  if (comparisonLayout.undersized.length > 0) throw new Error(`Comparison view has undersized controls: ${comparisonLayout.undersized.join(", ")}`);

  await evaluate(`Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.trim() === "HEAR A MODEL")?.click()`, true);
  await sleep(250);
  let comparisonPlaybackError = await evaluate(`document.querySelector(".consumer-playback-error")?.textContent ?? ""`);
  if (comparisonPlaybackError) throw new Error(`Capture A comparison playback failed: ${comparisonPlaybackError}`);
  await evaluate(`Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.trim() === "HEAR B MODEL")?.click()`, true);
  await sleep(250);
  comparisonPlaybackError = await evaluate(`document.querySelector(".consumer-playback-error")?.textContent ?? ""`);
  if (comparisonPlaybackError) throw new Error(`Capture B comparison playback failed: ${comparisonPlaybackError}`);
  const comparisonMicCalls = await evaluate(`window.__everythingRingsComparisonMicCalls ?? -1`);
  if (comparisonMicCalls !== 0) throw new Error(`Capture comparison requested microphone access ${comparisonMicCalls} time(s)`);

  await evaluate(`Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.trim() === "BACK TO HISTORY")?.click()`, true);
  await waitFor(`document.querySelectorAll(".consumer-history-card").length === 2`, "history after comparison", 5_000);
  const countAfterComparison = await evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(HISTORY_KEY)}) ?? '{"records":[]}').records?.length ?? 0`);
  if (countAfterComparison !== 2) throw new Error(`Comparison mutated history: ${countAfterComparison}`);

  await evaluate(`Array.from(document.querySelectorAll(".consumer-history-card button")).find((button) => button.textContent?.includes("SHARE DNA"))?.click()`, true);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (completedDownloads().some((name) => name.endsWith(".svg"))) break;
    await sleep(100);
  }
  if (!completedDownloads().some((name) => name.endsWith(".svg"))) {
    throw new Error("Persisted DNA share did not produce a download fallback");
  }

  await evaluate(`Array.from(document.querySelectorAll(".consumer-history-card button")).find((button) => button.textContent?.includes("REMOVE"))?.click()`, true);
  await waitFor(`JSON.parse(localStorage.getItem(${JSON.stringify(HISTORY_KEY)}) ?? '{"records":[]}').records?.length === 1`, "first history removal", 3_000);
  await evaluate(`Array.from(document.querySelectorAll(".consumer-history-card button")).find((button) => button.textContent?.includes("REMOVE"))?.click()`, true);
  await waitFor(`!document.body?.innerText.includes("RECENT DISCOVERIES")`, "second history removal", 3_000);
  const removed = await evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(HISTORY_KEY)}) ?? '{"records":[]}').records?.length ?? 0`);
  if (removed !== 0) throw new Error(`Removed captures remain in storage: ${removed}`);

  await command("Page.reload", { ignoreCache: true });
  await waitFor(`document.body?.innerText.includes("START LISTENING") ?? false`, "landing after removal", 8_000);
  const historyReturned = await evaluate(`document.body?.innerText.includes("RECENT DISCOVERIES") ?? false`);
  if (historyReturned) throw new Error("Removed captures returned after reload");

  console.log("Consumer history E2E passed: strike → fingerprint-only storage → reload → saved player → distinct equal-signature observations → Resonance Diff A/B → zero microphone reacquisition → share → remove on 390×844 viewport.");
} finally {
  try { socket.close(); } catch { /* already closed */ }
  chrome.kill("SIGTERM");
  await sleep(100);
  rmSync(workDir, { recursive: true, force: true });
}
