import { spawn } from "node:child_process";
import { rmSync } from "node:fs";

const browser = process.env.BROWSER;
const baseUrl = process.env.BASE_URL;
if (!browser || !baseUrl) throw new Error("BROWSER and BASE_URL are required");

const HISTORY_KEY = "everything-rings:consumer-history:v1";
const fingerprint = {
  version: 1,
  algorithmVersion: "er-dsp-2",
  sampleRate: 48_000,
  durationSeconds: 3.2,
  modes: [
    {
      frequencyHz: 440.25,
      relativeAmplitude: 1,
      decaySeconds: 1.21,
      q: 1673,
      confidence: 0.94,
      diagnostics: { prominenceDb: 19.4, persistenceSeconds: 1.08, frequencyStdCents: 3.8, decayFitScore: 0.92, observationCount: 18 },
    },
    {
      frequencyHz: 997.4,
      relativeAmplitude: 0.61,
      decaySeconds: 0.72,
      q: 2256,
      confidence: 0.88,
      diagnostics: { prominenceDb: 14.2, persistenceSeconds: 0.68, frequencyStdCents: 6.1, decayFitScore: 0.86, observationCount: 13 },
    },
    {
      frequencyHz: 2413.2,
      relativeAmplitude: 0.34,
      decaySeconds: 0.39,
      q: 2956,
      confidence: 0.81,
      diagnostics: { prominenceDb: 10.8, persistenceSeconds: 0.36, frequencyStdCents: 8.9, decayFitScore: 0.79, observationCount: 9 },
    },
  ],
};

function signatureFor(candidate) {
  const canonical = [...candidate.modes]
    .filter((mode) => mode.frequencyHz > 0 && Number.isFinite(mode.frequencyHz))
    .sort((left, right) => left.frequencyHz - right.frequencyHz)
    .map((mode) => {
      const frequencyCents = Math.round(1200 * Math.log2(mode.frequencyHz));
      const decayMilliseconds = Math.round(mode.decaySeconds * 1000);
      const amplitudeMilli = Math.round(mode.relativeAmplitude * 1000);
      const confidenceMilli = Math.round(mode.confidence * 1000);
      return `${frequencyCents},${decayMilliseconds},${amplitudeMilli},${confidenceMilli}`;
    })
    .join(";");
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= BigInt(canonical.charCodeAt(index));
    hash = (hash * prime) & mask;
  }
  return `er1-${hash.toString(16).padStart(16, "0")}`;
}

function encodeWireFingerprint(candidate) {
  const wire = {
    v: 1,
    a: candidate.algorithmVersion,
    r: candidate.sampleRate,
    d: candidate.durationSeconds,
    s: signatureFor(candidate),
    m: candidate.modes.map((mode) => [
      mode.frequencyHz,
      mode.relativeAmplitude,
      mode.decaySeconds,
      mode.q,
      mode.confidence,
      mode.diagnostics.prominenceDb,
      mode.diagnostics.persistenceSeconds,
      mode.diagnostics.frequencyStdCents,
      mode.diagnostics.decayFitScore,
      mode.diagnostics.observationCount,
    ]),
  };
  return Buffer.from(JSON.stringify(wire), "ascii").toString("base64url");
}

const signature = signatureFor(fingerprint);
const capturedAt = "2026-08-18T12:00:00.000Z";
const historyEnvelope = {
  schemaVersion: 1,
  records: [{
    schemaVersion: 1,
    id: `${capturedAt}-${signature}`,
    capturedAt,
    softwareRevision: "60fe9913e6c0d90719c85028ee279942f35996d3",
    signature,
    fingerprint,
  }],
};

const profileDir = `/tmp/everything-rings-capsule-${process.pid}`;
const debuggingPort = 9970 + (process.pid % 120);
const chrome = spawn(browser, [
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  "--mute-audio",
  "--autoplay-policy=no-user-gesture-required",
  "--use-fake-ui-for-media-stream",
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
  throw new Error(`Could not connect to Acoustic Capsule browser target. ${stderr}`);
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
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? "Browser evaluation failed");
  }
  return result.result?.value;
}

async function waitFor(expression, label, timeoutMs = 10_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(expression)) return;
    await sleep(120);
  }
  throw new Error(`Timed out waiting for ${label}. URL: ${await evaluate("location.href")}. Body: ${await evaluate("document.body?.innerText ?? ''")}`);
}

async function clickButton(label) {
  const clicked = await evaluate(`(() => {
    const button = Array.from(document.querySelectorAll("button")).find((candidate) => candidate.textContent?.trim() === ${JSON.stringify(label)});
    if (!button) return false;
    button.click();
    return true;
  })()`, true);
  if (!clicked) throw new Error(`Could not click ${label}`);
}

async function layoutAudit() {
  return evaluate(`(() => {
    const interactive = Array.from(document.querySelectorAll("button, a")).filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    });
    return {
      overflow: document.documentElement.scrollWidth - innerWidth,
      undersized: interactive.filter((element) => element.getBoundingClientRect().height < 43.5).map((element) => ({
        text: element.textContent?.trim() ?? "",
        height: element.getBoundingClientRect().height,
      })),
    };
  })()`);
}

async function assertRecipient(signatureToFind) {
  await waitFor(`document.body?.innerText.includes("SHARED RING") && document.body?.innerText.includes(${JSON.stringify(signatureToFind)})`, "recipient surface");
  const text = await evaluate("document.body.innerText");
  if (!text.includes("A fingerprint, not the original recording")) throw new Error("Recipient recording boundary is missing");
  if (!text.includes("does not identify a physical object")) throw new Error("Recipient identity boundary is missing");
  if (!text.includes("not authenticated capture provenance")) throw new Error("Recipient provenance boundary is missing");
  if ((await evaluate("window.__everythingRingsCapsuleMicCalls ?? -1")) !== 0) throw new Error("Opening a capsule requested microphone access");

  const layout = await layoutAudit();
  if (layout.overflow > 1) throw new Error(`Recipient has ${layout.overflow}px horizontal overflow`);
  if (layout.undersized.length > 0) throw new Error(`Recipient has undersized controls: ${JSON.stringify(layout.undersized)}`);
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
  await command("Page.addScriptToEvaluateOnNewDocument", {
    source: `(() => {
      window.__everythingRingsCapsuleShares = [];
      window.__everythingRingsCapsuleMicCalls = 0;
      const mediaDevices = navigator.mediaDevices;
      if (mediaDevices && typeof mediaDevices.getUserMedia === "function") {
        const originalGetUserMedia = mediaDevices.getUserMedia.bind(mediaDevices);
        mediaDevices.getUserMedia = (...args) => {
          window.__everythingRingsCapsuleMicCalls += 1;
          return originalGetUserMedia(...args);
        };
      }
      try {
        Object.defineProperty(navigator, "share", {
          configurable: true,
          value: async (data) => {
            window.__everythingRingsCapsuleShares.push({ title: data?.title ?? null, text: data?.text ?? null, url: data?.url ?? null });
          },
        });
      } catch {
        navigator.share = async (data) => {
          window.__everythingRingsCapsuleShares.push({ title: data?.title ?? null, text: data?.text ?? null, url: data?.url ?? null });
        };
      }
    })();`,
  });

  await command("Page.reload", { ignoreCache: true });
  await waitFor(`document.body?.innerText.includes("START LISTENING") ?? false`, "initial landing");
  await evaluate(`localStorage.setItem(${JSON.stringify(HISTORY_KEY)}, ${JSON.stringify(JSON.stringify(historyEnvelope))})`);
  await command("Page.reload", { ignoreCache: true });
  await waitFor(`document.body?.innerText.includes("RECENT DISCOVERIES") && document.body?.innerText.includes(${JSON.stringify(signature)})`, "seeded history");

  await clickButton("SHARE LINK");
  await waitFor(`(window.__everythingRingsCapsuleShares?.length ?? 0) >= 1`, "creator share");
  const creatorShare = await evaluate(`window.__everythingRingsCapsuleShares.at(-1)`);
  if (typeof creatorShare?.url !== "string") throw new Error(`Creator share did not contain a URL: ${JSON.stringify(creatorShare)}`);
  const sharedUrl = new URL(creatorShare.url);
  if (sharedUrl.search !== "") throw new Error(`Acoustic Capsule leaked route/query state: ${sharedUrl.search}`);
  if (!sharedUrl.hash.startsWith("#ring=")) throw new Error(`Acoustic Capsule is not fragment-only: ${sharedUrl.hash}`);
  if (sharedUrl.origin !== new URL(baseUrl).origin) throw new Error("Acoustic Capsule unexpectedly changed origin");

  await command("Page.navigate", { url: sharedUrl.toString() });
  await assertRecipient(signature);
  const historyBeforeRecipient = await evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(HISTORY_KEY)}) ?? '{"records":[]}').records?.length ?? 0`);
  if (historyBeforeRecipient !== 1) throw new Error(`Recipient navigation mutated history: ${historyBeforeRecipient}`);

  await clickButton("HEAR THIS RING");
  await sleep(250);
  if ((await evaluate("window.__everythingRingsCapsuleMicCalls ?? -1")) !== 0) throw new Error("Model playback requested microphone access");
  if (await evaluate(`document.querySelector('[role="alert"]') !== null`)) throw new Error(`Recipient model playback surfaced an error: ${await evaluate("document.body.innerText")}`);

  await clickButton("PLAY IT");
  await waitFor(`document.querySelector('#shared-capsule-playable-keys') !== null`, "recipient keyboard");
  const keyGeometry = await evaluate(`(() => {
    const buttons = Array.from(document.querySelectorAll('#shared-capsule-playable-keys button'));
    return {
      count: buttons.length,
      minimumWidth: Math.min(...buttons.map((button) => button.getBoundingClientRect().width)),
      minimumHeight: Math.min(...buttons.map((button) => button.getBoundingClientRect().height)),
    };
  })()`);
  if (keyGeometry.count !== 13 || keyGeometry.minimumWidth < 43.5 || keyGeometry.minimumHeight < 43.5) {
    throw new Error(`Recipient keyboard is not phone-playable: ${JSON.stringify(keyGeometry)}`);
  }
  await evaluate(`document.querySelector('#shared-capsule-playable-keys button')?.click()`, true);
  await sleep(200);
  if ((await evaluate("window.__everythingRingsCapsuleMicCalls ?? -1")) !== 0) throw new Error("Chromatic shared playback requested microphone access");
  if (await evaluate(`document.querySelector('[role="alert"]') !== null`)) throw new Error(`Recipient chromatic playback surfaced an error: ${await evaluate("document.body.innerText")}`);

  const shareCountBefore = await evaluate("window.__everythingRingsCapsuleShares?.length ?? 0");
  await clickButton("SHARE AGAIN");
  await waitFor(`(window.__everythingRingsCapsuleShares?.length ?? 0) > ${shareCountBefore}`, "recipient reshare");
  const recipientShare = await evaluate(`window.__everythingRingsCapsuleShares.at(-1)`);
  if (recipientShare?.url !== sharedUrl.toString()) throw new Error("Recipient reshare did not preserve the capsule URL");

  const secondFingerprint = {
    ...fingerprint,
    modes: fingerprint.modes.map((mode, index) => index === 0 ? { ...mode, frequencyHz: 466.16 } : mode),
  };
  const secondSignature = signatureFor(secondFingerprint);
  const secondUrl = new URL(sharedUrl);
  secondUrl.hash = `ring=${encodeWireFingerprint(secondFingerprint)}`;
  await command("Page.navigate", { url: secondUrl.toString() });
  await assertRecipient(secondSignature);
  if (await evaluate(`document.body?.innerText.includes(${JSON.stringify(signature)}) ?? false`)) {
    throw new Error("Recipient retained the prior capsule signature after fragment replacement");
  }
  await clickButton("HEAR THIS RING");
  await sleep(250);
  if ((await evaluate("window.__everythingRingsCapsuleMicCalls ?? -1")) !== 0) throw new Error("Replacement capsule playback requested microphone access");

  await clickButton("TRY YOUR OWN");
  await waitFor(`location.hash === ""`, "capsule fragment removal", 3_000);
  await waitFor(`document.body?.innerText.includes("Listening to the room") || document.body?.innerText.includes("Hit one object")`, "one-tap acquisition handoff", 8_000);
  const micCallsAfterTry = await evaluate("window.__everythingRingsCapsuleMicCalls ?? 0");
  if (micCallsAfterTry !== 1) throw new Error(`TRY YOUR OWN should request microphone exactly once, observed ${micCallsAfterTry}`);
  await clickButton("CANCEL");
  await waitFor(`document.body?.innerText.includes("START LISTENING") ?? false`, "landing after capsule handoff");

  await command("Page.navigate", { url: `${baseUrl}/#ring=%%%` });
  await waitFor(`location.hash === "#ring=%%%" && document.body?.innerText.includes("shared ring link could not be opened") && document.body?.innerText.includes("START LISTENING")`, "malformed capsule recovery");

  const oversizedUrl = `${baseUrl}/#ring=${"A".repeat(8_300)}`;
  await command("Page.navigate", { url: oversizedUrl });
  await waitFor(`location.hash.length > 8192 && document.body?.innerText.includes("shared ring link could not be opened") && document.body?.innerText.includes("START LISTENING")`, "oversized capsule recovery");

  const historyAfterRecipient = await evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(HISTORY_KEY)}) ?? '{"records":[]}').records?.length ?? 0`);
  if (historyAfterRecipient !== 1) throw new Error(`Capsule journey mutated local capture history: ${historyAfterRecipient}`);

  console.log("Acoustic Capsule E2E passed: creator link → recipient DNA → output-only hear/play → reshare → live capsule replacement → one-tap try-own → malformed/oversized recovery at 390×844.");
} finally {
  try { socket.close(); } catch { /* already closed */ }
  chrome.kill("SIGTERM");
  await sleep(100);
  rmSync(profileDir, { recursive: true, force: true });
}
