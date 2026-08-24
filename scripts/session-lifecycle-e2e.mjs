import { spawn } from "node:child_process";
import { rmSync } from "node:fs";

const browser = process.env.BROWSER;
const baseUrl = process.env.BASE_URL;
if (!browser || !baseUrl) throw new Error("BROWSER and BASE_URL are required");

const profileDir = `/tmp/everything-rings-empirical-lifecycle-${process.pid}`;
const debuggingPort = 10300 + (process.pid % 100);
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
  throw new Error(`Could not connect to empirical lifecycle browser target. ${stderr}`);
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
    await sleep(100);
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

async function assertLanding(label) {
  await waitFor(`document.body?.innerText.includes("START LISTENING") ?? false`, label);
  const body = await evaluate("document.body?.innerText ?? ''");
  if (body.includes("microphone could not be started")) {
    throw new Error(`${label} surfaced cancellation as a microphone failure`);
  }
}

async function dispatchPageHide() {
  await evaluate(`(() => {
    window.dispatchEvent(new Event("pagehide"));
    return true;
  })()`);
}

try {
  await command("Runtime.enable");
  await command("Page.enable");
  await command("Page.addScriptToEvaluateOnNewDocument", {
    source: `(() => {
      const mediaDevices = navigator.mediaDevices;
      window.__everythingRingsLifecycle = { calls: 0, streams: [], gate: null, release: null };
      window.__everythingRingsHoldNextMic = () => {
        let release;
        const promise = new Promise((resolve) => { release = resolve; });
        window.__everythingRingsLifecycle.gate = promise;
        window.__everythingRingsLifecycle.release = release;
      };
      window.__everythingRingsReleaseMic = () => {
        const release = window.__everythingRingsLifecycle.release;
        window.__everythingRingsLifecycle.release = null;
        if (typeof release === "function") release();
      };
      if (mediaDevices && typeof mediaDevices.getUserMedia === "function") {
        const originalGetUserMedia = mediaDevices.getUserMedia.bind(mediaDevices);
        mediaDevices.getUserMedia = async (...args) => {
          window.__everythingRingsLifecycle.calls += 1;
          const gate = window.__everythingRingsLifecycle.gate;
          window.__everythingRingsLifecycle.gate = null;
          if (gate) await gate;
          const stream = await originalGetUserMedia(...args);
          window.__everythingRingsLifecycle.streams.push(stream);
          return stream;
        };
      }
    })();`,
  });

  await command("Page.reload", { ignoreCache: true });
  await assertLanding("initial landing");

  await evaluate("window.__everythingRingsHoldNextMic()");
  await clickButton("START LISTENING");
  await waitFor(`document.body?.innerText.includes("Listening to the room") ?? false`, "pending microphone startup");
  await clickButton("CANCEL");
  await assertLanding("landing after cancelling unresolved microphone");
  await evaluate("window.__everythingRingsReleaseMic()");
  await waitFor(`window.__everythingRingsLifecycle.streams.length === 1`, "late first microphone resolution");
  await waitFor(`window.__everythingRingsLifecycle.streams[0].getTracks().every((track) => track.readyState === "ended")`, "late first microphone cleanup");
  await assertLanding("landing after late first microphone cleanup");

  await clickButton("START LISTENING");
  await waitFor(`window.__everythingRingsLifecycle.calls === 2`, "second microphone request");
  await waitFor(`window.__everythingRingsLifecycle.streams.length === 2`, "second microphone stream");
  await waitFor(`window.__everythingRingsLifecycle.streams[1].getTracks().some((track) => track.readyState === "live")`, "second session owns a live microphone");
  await clickButton("CANCEL");
  await assertLanding("landing after second-session cancel");
  await waitFor(`window.__everythingRingsLifecycle.streams[1].getTracks().every((track) => track.readyState === "ended")`, "second-session cleanup");

  await evaluate("window.__everythingRingsHoldNextMic()");
  await clickButton("START LISTENING");
  await waitFor(`window.__everythingRingsLifecycle.calls === 3`, "third microphone request");
  await dispatchPageHide();
  await assertLanding("landing after pagehide during unresolved startup");
  await evaluate("window.__everythingRingsReleaseMic()");
  await waitFor(`window.__everythingRingsLifecycle.streams.length === 3`, "late pagehide microphone resolution");
  await waitFor(`window.__everythingRingsLifecycle.streams[2].getTracks().every((track) => track.readyState === "ended")`, "late pagehide microphone cleanup");
  await assertLanding("landing after late pagehide cleanup");

  await clickButton("START LISTENING");
  await waitFor(`window.__everythingRingsLifecycle.calls === 4`, "fourth microphone request");
  await waitFor(`window.__everythingRingsLifecycle.streams.length === 4`, "fourth microphone stream");
  await waitFor(`window.__everythingRingsLifecycle.streams[3].getTracks().some((track) => track.readyState === "live")`, "fourth session owns a live microphone");
  await dispatchPageHide();
  await assertLanding("landing after active pagehide");
  await waitFor(`window.__everythingRingsLifecycle.streams[3].getTracks().every((track) => track.readyState === "ended")`, "active pagehide microphone cleanup");

  const body = await evaluate("document.body?.innerText ?? ''");
  if (body.includes("microphone could not be started")) throw new Error("Lifecycle cancellation surfaced as microphone startup failure");

  console.log("Empirical session lifecycle E2E passed: unresolved start → cancel → late cleanup → new owner → cancel → pagehide teardown → zero stale microphone state.");
} finally {
  try { socket.close(); } catch { /* already closed */ }
  chrome.kill("SIGTERM");
  await Promise.race([chromeExit, sleep(2_000)]);
  try {
    rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } catch {
    // Runner-local browser profile cleanup is not an empirical assertion.
  }
}
