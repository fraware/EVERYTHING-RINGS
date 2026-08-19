import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { rmSync } from "node:fs";

const browser = process.env.BROWSER;
const baseUrl = process.env.BASE_URL;
const revision = process.env.VITE_SOFTWARE_REVISION;
if (!browser || !baseUrl || !revision || !/^[0-9a-f]{40}$/.test(revision)) {
  throw new Error("BROWSER, BASE_URL, and a 40-hex VITE_SOFTWARE_REVISION are required");
}

const fingerprint = {
  version: 1,
  algorithmVersion: "er-dsp-2",
  sampleRate: 48000,
  durationSeconds: 1,
  modes: [
    { frequencyHz: 440, relativeAmplitude: 1, decaySeconds: 0.8, q: 1100, confidence: 0.96, diagnostics: { prominenceDb: 24, persistenceSeconds: 0.7, frequencyStdCents: 2, decayFitScore: 0.95, observationCount: 18 } },
    { frequencyHz: 880, relativeAmplitude: 0.6, decaySeconds: 0.6, q: 1600, confidence: 0.93, diagnostics: { prominenceDb: 21, persistenceSeconds: 0.5, frequencyStdCents: 2, decayFitScore: 0.93, observationCount: 16 } },
    { frequencyHz: 1320, relativeAmplitude: 0.4, decaySeconds: 0.45, q: 1800, confidence: 0.9, diagnostics: { prominenceDb: 18, persistenceSeconds: 0.4, frequencyStdCents: 3, decayFitScore: 0.9, observationCount: 14 } },
  ],
};

const quality = { score: 1, snrDb: 30, clippedFraction: 0, peakAmplitude: 0.2, secondaryTransientRatio: 0.1 };
const evidence = {
  schemaVersion: 5,
  evidenceContractVersion: "validation-evidence-5",
  gateAContractVersion: "gate-a-2",
  sessionId: "browser-review-session-01",
  createdAt: "2026-08-19T00:00:00.000Z",
  softwareRevision: revision,
  object: { specimenId: "core-metal-1--inv-003", label: "metal bowl", material: "metal" },
  protocol: { fixedSetup: true, microphoneDistanceCm: 20, striker: "wooden dowel", strikeLocation: "rim A", supportCondition: "three felt points" },
  captureSettings: { sampleRate: 48000 },
  realtimeAudioTiming: null,
  attemptCount: 5,
  medianModalDriftCents: 0,
  recurrence: [],
  attempts: Array.from({ length: 5 }, (_, index) => ({ id: index + 1, quality, analysis: { status: "success", fingerprint } })),
  gateBReviews: [],
  gateCReviews: [],
  rawMicrophoneSamplesIncluded: false,
};

const releaseBase = {
  schemaVersion: 1,
  softwareRevision: revision,
  empiricalCampaign: { authorizedSoftwareRevision: revision, progress: { collectionComplete: true } },
  gateA: {
    passed: true,
    sessions: [{ sessionId: evidence.sessionId, specimenId: evidence.object.specimenId, passed: true, reviewAttemptId: 5 }],
  },
};
const gateARelease = { ...releaseBase, gateB: { passed: false, objects: [] } };
const gateBRelease = {
  ...releaseBase,
  gateB: {
    passed: true,
    objects: [{ specimenId: evidence.object.specimenId, passed: true, selectedTarget: { sessionId: evidence.sessionId, attemptId: 5 } }],
  },
};
const wrongGateBRelease = {
  ...gateBRelease,
  gateB: {
    ...gateBRelease.gateB,
    objects: [{ specimenId: evidence.object.specimenId, passed: true, selectedTarget: { sessionId: evidence.sessionId, attemptId: 4 } }],
  },
};

const rawSamples = [0, 0.125, -0.25, 0.5, -0.75];
const audioBytes = Buffer.alloc(rawSamples.length * 4);
rawSamples.forEach((sample, index) => audioBytes.writeFloatLE(sample, index * 4));
const sha256 = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const companion = {
  schemaVersion: 1,
  companionContractVersion: "gate-b-listening-companion-1",
  createdAt: "2026-08-19T01:00:00.000Z",
  softwareRevision: revision,
  specimenId: evidence.object.specimenId,
  sessionId: evidence.sessionId,
  attemptId: 5,
  sampleRate: 48000,
  sampleCount: rawSamples.length,
  sampleEncoding: "float32-le-base64",
  audioSha256: sha256(audioBytes),
  fingerprintSha256: sha256(Buffer.from(JSON.stringify(fingerprint), "utf8")),
  containsLocalMicrophoneSamples: true,
  audioPayloadBase64: audioBytes.toString("base64"),
};
const tamperedCompanion = { ...companion, audioSha256: `sha256:${"0".repeat(64)}` };

const profileDir = `/tmp/everything-rings-post-review-${process.pid}`;
const debuggingPort = 9900 + (process.pid % 80);
const chrome = spawn(browser, [
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  "--autoplay-policy=no-user-gesture-required",
  `--remote-debugging-port=${debuggingPort}`,
  `--user-data-dir=${profileDir}`,
  "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });

let stderr = "";
chrome.stderr.on("data", (chunk) => { stderr += String(chunk); });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function browserTarget() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${debuggingPort}/json`);
      const targets = await response.json();
      const target = targets.find((candidate) => candidate.type === "page");
      if (target?.webSocketDebuggerUrl) return target;
    } catch {
      // Browser is still starting.
    }
    await sleep(100);
  }
  throw new Error(`Could not connect to review-test browser. ${stderr}`);
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

async function waitFor(expression, label, timeoutMs = 8_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(expression)) return;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${label}: ${await evaluate("document.body?.innerText ?? ''")}`);
}

async function navigate(path, expected) {
  await command("Page.navigate", { url: `${baseUrl}${path}` });
  await waitFor(`document.body?.innerText.includes(${JSON.stringify(expected)}) ?? false`, expected);
}

async function importJsonFile(index, filename, value) {
  const content = JSON.stringify(value);
  await evaluate(`(() => {
    const input = document.querySelectorAll('input[type="file"]')[${index}];
    if (!(input instanceof HTMLInputElement)) throw new Error('missing file input ${index}');
    const transfer = new DataTransfer();
    transfer.items.add(new File([${JSON.stringify(content)}], ${JSON.stringify(filename)}, { type: 'application/json' }));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
}

async function setInput(placeholder, value) {
  await evaluate(`(() => {
    const input = document.querySelector('input[placeholder=${JSON.stringify(placeholder)}]');
    if (!(input instanceof HTMLInputElement)) throw new Error('missing input');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
}

async function clickButton(text) {
  await evaluate(`(() => {
    const button = Array.from(document.querySelectorAll('button')).find((candidate) => candidate.textContent?.includes(${JSON.stringify(text)}));
    if (!(button instanceof HTMLButtonElement)) throw new Error('missing button: ${text}');
    if (button.disabled) throw new Error('button disabled: ${text}');
    button.click();
    return true;
  })()`, true);
}

try {
  await command("Runtime.enable");
  await command("Page.enable");
  await command("Page.addScriptToEvaluateOnNewDocument", {
    source: `window.__reviewGetUserMediaCalls = 0;
      const replacement = async () => { window.__reviewGetUserMediaCalls += 1; throw new Error('review route requested microphone'); };
      try {
        if (navigator.mediaDevices) Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: replacement });
        else Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: replacement } });
      } catch {}`,
  });

  await navigate("/?gate-b=1", "Post-collection blinded reconstruction");
  await importJsonFile(0, "gate-a-release.json", gateARelease);
  await importJsonFile(1, "evidence.json", evidence);
  await importJsonFile(2, "tampered-companion.json", tamperedCompanion);
  await waitFor(`document.body?.innerText.includes("audio payload SHA-256 does not match") ?? false`, "tampered companion rejection");
  await importJsonFile(2, "companion.json", companion);
  await waitFor(`document.body?.innerText.includes("SHA-256 + target match") ?? false`, "valid companion binding");
  await setInput("reviewer-01", "reviewer-browser-01");
  await clickButton("START BLIND TRIAL");
  await waitFor(`document.body?.innerText.includes("PLAY A") && document.body?.innerText.includes("PLAY B")`, "blinded A/B controls");
  await clickButton("SUBMIT BLIND REVIEW");
  await waitFor(`document.body?.innerText.includes("1 reviews in this evidence copy") ?? false`, "Gate B review submission");
  if (await evaluate("window.__reviewGetUserMediaCalls") !== 0) throw new Error("Gate B route accessed the microphone");

  await navigate("/?gate-c=1", "Post-Gate-B playable identity");
  await importJsonFile(0, "wrong-gate-b-release.json", wrongGateBRelease);
  await importJsonFile(1, "evidence.json", evidence);
  await waitFor(`document.body?.innerText.includes("does not inherit the canonical Gate B target") ?? false`, "Gate C target substitution rejection");
  await importJsonFile(0, "gate-b-release.json", gateBRelease);
  await waitFor(`document.body?.innerText.includes("authorized target ${evidence.sessionId} / attempt 5") ?? false`, "Gate C exact target authorization");
  const enabledKeys = await evaluate("document.querySelectorAll('.post-review-keyboard button:not(:disabled)').length");
  if (enabledKeys !== 13) throw new Error(`Expected 13 enabled Gate C keys, got ${enabledKeys}`);
  await setInput("reviewer-01", "reviewer-browser-02");
  await setInput("iphone-safari-01", "mobile-browser-01");
  await clickButton("SUBMIT DEVICE REVIEW");
  await waitFor(`document.body?.innerText.includes("1 reviews in this evidence copy") ?? false`, "Gate C review submission");
  if (await evaluate("window.__reviewGetUserMediaCalls") !== 0) throw new Error("Gate C route accessed the microphone");

  console.log("Post-collection review E2E passed: tamper rejection → exact Gate B binding → blinded review → Gate C target inheritance → zero microphone access.");
} finally {
  try { socket.close(); } catch { /* already closed */ }
  chrome.kill("SIGTERM");
  await sleep(150);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      rmSync(profileDir, { recursive: true, force: true });
      break;
    } catch {
      await sleep(100);
    }
  }
}
