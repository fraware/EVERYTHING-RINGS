import type { AcousticFingerprintV1 } from "@everything-rings/dsp";
import { DEFAULT_MODAL_RENDER_CONFIG, renderAcousticFingerprint } from "@everything-rings/synth";
import { createAcousticCardSvg, createAcousticStoryHtml, fingerprintSignature } from "@everything-rings/visual";
import { useEffect, useRef, useState } from "react";
import {
  ConsumerFailure,
  ConsumerLanding,
  ConsumerProgress,
  ConsumerReveal,
} from "./ConsumerExperience";
import {
  clearConsumerHistory,
  createConsumerCaptureRecord,
  loadConsumerHistory,
  persistConsumerHistory,
  prependConsumerCapture,
  removeConsumerCapture,
  type ConsumerCaptureRecord,
  type ConsumerHistoryStorage,
} from "./consumerHistory";
import { failureCopy } from "./failureCopy";
import { captureRingdownAuditionSamples, peakMatchSamples } from "./ringdownPresentation";
import { useStrikeSession } from "./useStrikeSession";

const SOFTWARE_REVISION = ((import.meta as ImportMeta & {
  readonly env?: { readonly VITE_SOFTWARE_REVISION?: string };
}).env?.VITE_SOFTWARE_REVISION ?? "").trim();

function browserHistoryStorage(): ConsumerHistoryStorage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function shareOrDownload(file: File, title: string, text: string): void {
  const shareData: ShareData = { files: [file], title, text };
  if (typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare(shareData)) {
    void navigator.share(shareData).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      downloadFile(file);
    });
    return;
  }
  downloadFile(file);
}

function shareAcousticCard(fingerprint: AcousticFingerprintV1): void {
  const signature = fingerprintSignature(fingerprint);
  const file = new File(
    [createAcousticCardSvg(fingerprint)],
    `everything-rings-${signature}.svg`,
    { type: "image/svg+xml" },
  );
  shareOrDownload(
    file,
    "Everything Rings — Acoustic DNA",
    `${fingerprint.modes.length} measured resonances · ${signature}`,
  );
}

export function ConsumerApp() {
  const session = useStrikeSession();
  const [history, setHistory] = useState<readonly ConsumerCaptureRecord[]>(
    () => loadConsumerHistory(browserHistoryStorage()),
  );
  const historyRef = useRef(history);
  const [historyStatus, setHistoryStatus] = useState<string>();
  const savedFingerprint = useRef<AcousticFingerprintV1 | undefined>(undefined);

  function replaceHistory(next: readonly ConsumerCaptureRecord[]): void {
    historyRef.current = next;
    setHistory(next);
  }

  useEffect(() => {
    const fingerprint = session.fingerprint;
    if (session.state !== "success" || fingerprint === undefined || savedFingerprint.current === fingerprint) return;
    savedFingerprint.current = fingerprint;
    const record = createConsumerCaptureRecord(
      fingerprint,
      new Date().toISOString(),
      SOFTWARE_REVISION,
    );
    const next = prependConsumerCapture(historyRef.current, record);
    replaceHistory(next);
    const persisted = persistConsumerHistory(browserHistoryStorage(), next);
    setHistoryStatus(
      persisted
        ? "Fingerprint saved locally on this device. Microphone audio was not stored."
        : "This fingerprint is available for this session, but local browser storage is unavailable.",
    );
  }, [session.state, session.fingerprint]);

  function retry(): void {
    if (session.state === "error") {
      void session.start();
      return;
    }
    session.reset();
  }

  function hearCapture(): void {
    const capture = session.capture;
    if (capture === undefined) return;
    const audition = peakMatchSamples(
      captureRingdownAuditionSamples(capture),
      DEFAULT_MODAL_RENDER_CONFIG.outputPeak,
    );
    void session.play(audition, capture.sampleRate);
  }

  function hearModel(): void {
    const fingerprint = session.fingerprint;
    if (fingerprint === undefined) return;
    const sampleRate = session.playbackSampleRate() ?? fingerprint.sampleRate;
    void session.play(renderAcousticFingerprint(fingerprint, sampleRate), sampleRate);
  }

  function hearMode(modeIndex: number): void {
    const fingerprint = session.fingerprint;
    const mode = fingerprint?.modes[modeIndex];
    if (fingerprint === undefined || mode === undefined) return;
    const sampleRate = session.playbackSampleRate() ?? fingerprint.sampleRate;
    void session.play(renderAcousticFingerprint({ ...fingerprint, modes: [mode] }, sampleRate), sampleRate);
  }

  function shareCurrentAcousticCard(): void {
    const fingerprint = session.fingerprint;
    if (fingerprint !== undefined) shareAcousticCard(fingerprint);
  }

  function shareAcousticStory(): void {
    const fingerprint = session.fingerprint;
    if (fingerprint === undefined) return;
    const signature = fingerprintSignature(fingerprint);
    const sampleRate = session.playbackSampleRate() ?? fingerprint.sampleRate;
    const model = renderAcousticFingerprint(fingerprint, sampleRate);
    const file = new File(
      [createAcousticStoryHtml(fingerprint, model, sampleRate)],
      `everything-rings-${signature}-story.html`,
      { type: "text/html" },
    );
    shareOrDownload(
      file,
      "Everything Rings — Acoustic Story",
      `${fingerprint.modes.length} measured resonances · animated model · ${signature}`,
    );
  }

  function removeHistoryRecord(id: string): void {
    const next = removeConsumerCapture(historyRef.current, id);
    replaceHistory(next);
    const persisted = persistConsumerHistory(browserHistoryStorage(), next);
    setHistoryStatus(persisted ? "Capture removed from this device." : "Local browser storage could not be updated.");
  }

  function clearHistory(): void {
    replaceHistory([]);
    const cleared = clearConsumerHistory(browserHistoryStorage());
    setHistoryStatus(cleared ? "Local capture history cleared." : "Local browser storage could not be cleared.");
  }

  if (session.state === "idle") {
    return <ConsumerLanding
      onStart={() => void session.start()}
      recentCaptures={history}
      historyStatus={historyStatus}
      onShareCapture={(record) => shareAcousticCard(record.fingerprint)}
      onRemoveCapture={removeHistoryRecord}
      onClearCaptures={clearHistory}
    />;
  }

  if (session.state === "warming" || session.state === "armed" || session.state === "capturing" || session.state === "analyzing") {
    const copy = session.state === "warming" ? "Listening to the room…"
      : session.state === "armed" ? "Hit one object. Once."
      : session.state === "capturing" ? "It rings…"
      : "Finding its resonances…";
    return <ConsumerProgress message={copy} state={session.state} onCancel={session.stop} />;
  }

  if (session.state === "failure" || session.state === "error") {
    return <ConsumerFailure
      message={failureCopy(session.failureReason)}
      onRetry={retry}
      onStartOver={session.stop}
    />;
  }

  const fingerprint = session.fingerprint;
  if (fingerprint === undefined) return null;

  return <ConsumerReveal
    fingerprint={fingerprint}
    instrumentReady={session.instrumentReady}
    instrumentFailure={session.instrumentFailure}
    playbackFailure={session.playbackFailure}
    historyStatus={historyStatus}
    onHearMode={hearMode}
    onHearModel={hearModel}
    onHearCapture={hearCapture}
    onNote={(midiNote) => { session.noteOn(midiNote); }}
    onShareStory={shareAcousticStory}
    onShareDna={shareCurrentAcousticCard}
    onStrikeAnother={session.reset}
  />;
}
