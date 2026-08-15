# DSP contract

A microphone observes the object, impact, room, device transfer function, and noise together. EVERYTHING RINGS estimates **audible resonances in the recorded transient**. It does not claim to recover exact structural eigenmodes.

For a clean resonant decay, the working model is

\[
\hat{x}(t)=\sum_{k=1}^{K} A_k e^{-t/\tau_k}\cos(2\pi f_k t+\phi_k).
\]

Analysis operates at the actual capture sample rate. Algorithms receive `sampleRate` explicitly; no code may assume 48 kHz. Frequencies are stored in hertz and durations in seconds.

The numerical foundation provides a replaceable real-FFT backend, cached Hann windows, windowed magnitude spectra in dB, local maximum search, three-bin quadratic interpolation in log magnitude, and deterministic synthetic modal fixtures.
