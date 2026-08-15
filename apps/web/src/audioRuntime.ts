export interface ActivePlayback {
  current?: AudioBufferSourceNode | undefined;
}

export async function resumeAudioContext(context: AudioContext): Promise<boolean> {
  if (context.state === "running") return true;
  if (context.state === "closed") return false;
  try {
    await context.resume();
  } catch {
    return false;
  }
  const resumedState: string = context.state;
  return resumedState === "running";
}

export function stopActivePlayback(playback: ActivePlayback): void {
  const source = playback.current;
  playback.current = undefined;
  if (source === undefined) return;
  try {
    source.stop();
  } catch {
    // The source may already have ended. Disconnect still releases the graph edge.
  }
  try {
    source.disconnect();
  } catch {
    // Disconnect is best-effort for a source whose graph is already gone.
  }
}

export async function playExclusiveSamples(
  context: AudioContext,
  playback: ActivePlayback,
  samples: Float32Array,
  sampleRate: number,
): Promise<boolean> {
  if (!(await resumeAudioContext(context))) return false;

  stopActivePlayback(playback);
  const buffer = context.createBuffer(1, samples.length, sampleRate);
  const copy = new Float32Array(samples.length);
  copy.set(samples);
  buffer.copyToChannel(copy, 0);

  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.onended = () => {
    if (playback.current === source) playback.current = undefined;
    try {
      source.disconnect();
    } catch {
      // The source may already have been disconnected by explicit replacement.
    }
  };
  playback.current = source;
  source.start();
  return true;
}
