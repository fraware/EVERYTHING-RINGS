import { spawn } from "node:child_process";
import { rmSync } from "node:fs";

const browser = process.env.BROWSER;
const baseUrl = process.env.BASE_URL;
if (!browser || !baseUrl) throw new Error("BROWSER and BASE_URL are required");

const routes = [
  { path: "/?campaign-author=1", expected: "Freeze the experiment before the first strike." },
  { path: "/?campaign=1", expected: "Precommitted physical collection" },
  { path: "/?lab=1", expected: "Acoustic analysis lab" },
  { path: "/?release=1", expected: "Empirical release gates" },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function inspectRoute(route, index) {
  const profileDir = `/tmp/everything-rings-mobile-${process.pid}-${index}`;
  const debuggingPort = 9850 + ((process.pid + index) % 120);
  const chrome = spawn(browser, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    `--remote-debugging-port=${debuggingPort}`,
    `--user-data-dir=${profileDir}`,
    `${baseUrl}${route.path}`,
  ], { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  chrome.stderr.on("data", (chunk) => { stderr += String(chunk); });

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
    throw new Error(`Could not connect to mobile surface browser for ${route.path}. ${stderr}`);
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
  async function evaluate(expression) {
    const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? "Browser evaluation failed");
    return result.result?.value;
  }

  try {
    await command("Runtime.enable");
    await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if (await evaluate(`document.body?.innerText.includes(${JSON.stringify(route.expected)}) ?? false`)) break;
      await sleep(100);
    }
    const result = await evaluate(`(() => {
      const interactive = Array.from(document.querySelectorAll("button, input, select, .file-button")).filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      });
      return {
        expectedVisible: document.body?.innerText.includes(${JSON.stringify(route.expected)}) ?? false,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        undersized: interactive.filter((element) => element.getBoundingClientRect().height < 43.5).map((element) => ({
          tag: element.tagName,
          text: element.textContent?.trim() || element.getAttribute("aria-label") || element.getAttribute("name") || "",
          height: element.getBoundingClientRect().height,
        })),
        empty: (document.body?.innerText.trim().length ?? 0) === 0,
      };
    })()`);
    if (!result.expectedVisible) throw new Error(`${route.path} did not render its expected surface`);
    if (result.empty) throw new Error(`${route.path} rendered an empty page`);
    if (result.overflow > 1) throw new Error(`${route.path} has ${result.overflow}px horizontal overflow at 390px`);
    if (result.undersized.length > 0) throw new Error(`${route.path} has undersized controls: ${JSON.stringify(result.undersized)}`);
  } finally {
    try { socket.close(); } catch { /* already closed */ }
    chrome.kill("SIGTERM");
    await sleep(80);
    rmSync(profileDir, { recursive: true, force: true });
  }
}

for (let index = 0; index < routes.length; index += 1) {
  await inspectRoute(routes[index], index);
}
console.log("Mobile surfaces E2E passed for campaign author, collector, lab, and release console at 390×844.");
