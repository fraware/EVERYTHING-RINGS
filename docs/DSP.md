# DSP contract

A microphone observes the object, impact, room, device transfer function, and noise together. EVERYTHING RINGS estimates **audible resonances in the recorded transient**. It does not claim to recover exact structural eigenmodes.

For a clean resonant decay, the working model is

\[
\hat{x}(t)=\sum_{k=1}^{K} A_k e^{-t/\tau_k}\cos(2\pi f_k t+\phi_k).
\]

Analysis operates at the actual capture sample rate. Algorithms receive `sampleRate` explicitly; no code may assume 48 kHz. Frequencies are stored in hertz and durations in seconds.

The baseline STFT uses an 8192-sample Hann window and 512-sample hop. Frame spectra are streamed through a callback so the production path does not retain a full spectrogram. Frame-level candidates must be local maxima and exceed an 8 dB local prominence threshold computed outside the immediate peak neighborhood. Three-bin quadratic interpolation in log magnitude produces the sub-bin frequency estimate.

All thresholds are explicit configuration values. Peak tracking and decay estimation are separate later stages; a frame peak alone is never treated as a physical resonance.
