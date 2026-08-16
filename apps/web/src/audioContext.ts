export interface ResumableAudioContext {
  readonly state: AudioContextState;
  resume(): Promise<void>;
}

export async function ensureAudioContextRunning(context: ResumableAudioContext): Promise<boolean> {
  if (context.state === "running") return true;
  if (context.state === "closed") return false;
  try {
    await context.resume();
  } catch {
    return false;
  }
  const stateAfterResume = context.state as AudioContextState;
  return stateAfterResume === "running";
}
