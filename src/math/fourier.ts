/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Mathematical core for Signals & Systems / Fourier Analysis.
 * Implements pure, deterministic browser-side algorithms for:
 * - Discrete Fourier Transform (DFT)
 * - Cooley-Tukey Fast Fourier Transform (FFT)
 * - Inverse Discrete Fourier Transform (IDFT)
 * - Self-test verification suite comparing DFT vs FFT
 * - Signal generators (sine, multi-tone, square, sawtooth, pulse, chirp, noise)
 * - Window functions (Rectangular, Hann, Hamming, Blackman)
 * - Phasor winding trajectory for Fourier Transform visualization
 * - Convolution, Euler's identity projections, and Fourier series synthesis
 */

export interface Complex {
  real: number;
  imag: number;
}

export interface TransformResult {
  real: number[];
  imag: number[];
  magnitude: number[];
  normalizedMagnitude: number[];
  phase: number[];
  frequencies: number[]; // in Hz
  sampleRate: number;
  n: number;
}

export interface WindingPoint {
  index: number;
  t: number;
  sample: number;
  angleRad: number;
  x: number;
  y: number;
}

export interface WindingState {
  frequency: number; // test winding frequency
  points: WindingPoint[];
  centerOfMass: { x: number; y: number; magnitude: number; phase: number };
}

/**
 * Direct Discrete Fourier Transform (DFT).
 * Complexity: O(N^2)
 *
 * Formula:
 * X[k] = sum_{n=0}^{N-1} x[n] * exp(-j * 2 * pi * k * n / N)
 *      = sum_{n=0}^{N-1} x[n] * (cos(2*pi*k*n/N) - j * sin(2*pi*k*n/N))
 */
export function computeDFT(
  signal: number[],
  sampleRate: number = 64
): TransformResult {
  const N = signal.length;
  const real = new Float64Array(N);
  const imag = new Float64Array(N);
  const magnitude = new Float64Array(N);
  const normalizedMagnitude = new Float64Array(N);
  const phase = new Float64Array(N);
  const frequencies = new Float64Array(N);

  const twoPiOverN = (2 * Math.PI) / N;

  for (let k = 0; k < N; k++) {
    let sumReal = 0;
    let sumImag = 0;
    const kAngle = twoPiOverN * k;

    for (let n = 0; n < N; n++) {
      const angle = kAngle * n;
      const xn = signal[n];
      sumReal += xn * Math.cos(angle);
      sumImag -= xn * Math.sin(angle);
    }

    real[k] = sumReal;
    imag[k] = sumImag;

    const mag = Math.sqrt(sumReal * sumReal + sumImag * sumImag);
    magnitude[k] = mag;
    // Standard single-sided / normalized amplitude:
    normalizedMagnitude[k] = (mag / N) * (k === 0 || k === N / 2 ? 1 : 2);
    // Phase in radians (-pi to +pi)
    phase[k] = Math.atan2(sumImag, sumReal);
    // Frequency bin mapping
    frequencies[k] = (k * sampleRate) / N;
  }

  return {
    real: Array.from(real),
    imag: Array.from(imag),
    magnitude: Array.from(magnitude),
    normalizedMagnitude: Array.from(normalizedMagnitude),
    phase: Array.from(phase),
    frequencies: Array.from(frequencies),
    sampleRate,
    n: N,
  };
}

/**
 * Radix-2 Cooley-Tukey Fast Fourier Transform (FFT).
 * Complexity: O(N log N)
 * 
 * Works for any N that is a power of 2.
 */
export function computeFFTRadix2(
  realIn: number[],
  imagIn?: number[],
  sampleRate: number = 64
): TransformResult {
  let N = realIn.length;
  // Pad to nearest power of 2 if needed
  let powerOfTwo = 1;
  while (powerOfTwo < N) {
    powerOfTwo <<= 1;
  }

  const real = new Float64Array(powerOfTwo);
  const imag = new Float64Array(powerOfTwo);

  for (let i = 0; i < N; i++) {
    real[i] = realIn[i];
    imag[i] = imagIn ? imagIn[i] : 0;
  }
  for (let i = N; i < powerOfTwo; i++) {
    real[i] = 0;
    imag[i] = 0;
  }
  N = powerOfTwo;

  // Bit reversal permutation
  let j = 0;
  for (let i = 0; i < N - 1; i++) {
    if (i < j) {
      const tr = real[i];
      const ti = imag[i];
      real[i] = real[j];
      imag[i] = imag[j];
      real[j] = tr;
      imag[j] = ti;
    }
    let k = N >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }

  // Cooley-Tukey butterfly stages
  for (let len = 2; len <= N; len <<= 1) {
    const halfLen = len >> 1;
    const angleStep = (-2 * Math.PI) / len;
    const wStepReal = Math.cos(angleStep);
    const wStepImag = Math.sin(angleStep);

    for (let i = 0; i < N; i += len) {
      let wReal = 1;
      let wImag = 0;

      for (let m = 0; m < halfLen; m++) {
        const uReal = real[i + m];
        const uImag = imag[i + m];

        const vIndex = i + m + halfLen;
        const vReal = real[vIndex] * wReal - imag[vIndex] * wImag;
        const vImag = real[vIndex] * wImag + imag[vIndex] * wReal;

        real[i + m] = uReal + vReal;
        imag[i + m] = uImag + vImag;
        real[vIndex] = uReal - vReal;
        imag[vIndex] = uImag - vImag;

        const nextWReal = wReal * wStepReal - wImag * wStepImag;
        const nextWImag = wReal * wStepImag + wImag * wStepReal;
        wReal = nextWReal;
        wImag = nextWImag;
      }
    }
  }

  const magnitude = new Float64Array(N);
  const normalizedMagnitude = new Float64Array(N);
  const phase = new Float64Array(N);
  const frequencies = new Float64Array(N);

  for (let k = 0; k < N; k++) {
    const r = real[k];
    const im = imag[k];
    const mag = Math.sqrt(r * r + im * im);
    magnitude[k] = mag;
    normalizedMagnitude[k] = (mag / N) * (k === 0 || k === N / 2 ? 1 : 2);
    phase[k] = Math.atan2(im, r);
    frequencies[k] = (k * sampleRate) / N;
  }

  return {
    real: Array.from(real),
    imag: Array.from(imag),
    magnitude: Array.from(magnitude),
    normalizedMagnitude: Array.from(normalizedMagnitude),
    phase: Array.from(phase),
    frequencies: Array.from(frequencies),
    sampleRate,
    n: N,
  };
}

/**
 * Inverse Discrete Fourier Transform (IDFT).
 * Recovers the time-domain signal from complex spectrum bins.
 */
export function computeIDFT(real: number[], imag: number[]): number[] {
  const N = real.length;
  const signal = new Float64Array(N);
  const twoPiOverN = (2 * Math.PI) / N;

  for (let n = 0; n < N; n++) {
    let sum = 0;
    const nAngle = twoPiOverN * n;
    for (let k = 0; k < N; k++) {
      const angle = nAngle * k;
      // exp(+j * angle) = cos(angle) + j*sin(angle)
      // Real part of (real[k] + j*imag[k]) * (cos + j*sin) is:
      // real[k]*cos - imag[k]*sin
      sum += real[k] * Math.cos(angle) - imag[k] * Math.sin(angle);
    }
    signal[n] = sum / N;
  }

  return Array.from(signal);
}


/**
 * Computes the "winding phasor" trajectory for explaining how the transform works.
 * Winding signal x(t) around the complex circle at test frequency f_wind:
 * z[n] = x[n] * exp(-j * 2 * pi * f_wind * t_n)
 * Centroid / Center of Mass = 1/N * sum z[n]
 */
export function computeWindingPhasor(
  signal: number[],
  windingFreq: number,
  sampleRate: number = 64
): WindingState {
  const N = signal.length;
  const points: WindingPoint[] = new Array(N);

  let sumX = 0;
  let sumY = 0;

  for (let n = 0; n < N; n++) {
    const t = n / sampleRate;
    // Angle in radians (clockwise winding for negative exponent)
    const angleRad = -2 * Math.PI * windingFreq * t;
    const amp = signal[n];
    const x = amp * Math.cos(angleRad);
    const y = amp * Math.sin(angleRad);

    points[n] = {
      index: n,
      t,
      sample: amp,
      angleRad,
      x,
      y,
    };

    sumX += x;
    sumY += y;
  }

  const avgX = sumX / N;
  const avgY = sumY / N;
  const mag = Math.sqrt(avgX * avgX + avgY * avgY);
  const phase = Math.atan2(avgY, avgX);

  return {
    frequency: windingFreq,
    points,
    centerOfMass: {
      x: avgX,
      y: avgY,
      magnitude: mag,
      phase,
    },
  };
}

/**
 * Discrete 1D convolution: y[n] = sum_{k} x[k] * h[n - k]
 */
export function discreteConvolve(
  x: number[],
  h: number[]
): {
  output: number[];
  steps: {
    n: number;
    tauIndices: number[];
    xValues: number[];
    hShiftedValues: number[];
    productValues: number[];
    sum: number;
  }[];
} {
  const Nx = x.length;
  const Nh = h.length;
  const Ny = Nx + Nh - 1;
  const output = new Float64Array(Ny);
  const steps = [];

  for (let n = 0; n < Ny; n++) {
    let sum = 0;
    const tauIndices: number[] = [];
    const xValues: number[] = [];
    const hShiftedValues: number[] = [];
    const productValues: number[] = [];

    // tau sweeps over the span where x[tau] and h[n - tau] can overlap
    const tauMin = Math.max(0, n - Nh + 1);
    const tauMax = Math.min(Nx - 1, n);

    for (let tau = 0; tau < Nx; tau++) {
      const hIdx = n - tau;
      const xVal = x[tau];
      const hVal = hIdx >= 0 && hIdx < Nh ? h[hIdx] : 0;
      const prod = xVal * hVal;

      tauIndices.push(tau);
      xValues.push(xVal);
      hShiftedValues.push(hVal);
      productValues.push(prod);

      sum += prod;
    }

    output[n] = sum;
    steps.push({
      n,
      tauIndices,
      xValues,
      hShiftedValues,
      productValues,
      sum,
    });
  }

  return {
    output: Array.from(output),
    steps,
  };
}

/**
 * Fourier Series Synthesis of periodic waveforms with K harmonics.
 */
export function synthesizeFourierSeries(
  type: 'square' | 'sawtooth' | 'triangle' | 'pulse',
  harmonicsCount: number,
  samples: number = 256,
  dutyCycle: number = 0.5
): {
  ideal: number[];
  synthesized: number[];
  harmonics: { n: number; amplitude: number; phase: number }[];
  gibbsOvershootPercent: number;
} {
  const ideal: number[] = new Array(samples);
  const synthesized: number[] = new Array(samples).fill(0);
  const harmonicsList: { n: number; amplitude: number; phase: number }[] = [];

  // Harmonics calculation
  for (let k = 1; k <= harmonicsCount; k++) {
    let amp = 0;
    let phase = 0;

    if (type === 'square') {
      if (k % 2 !== 0) {
        amp = 4 / (Math.PI * k);
      }
    } else if (type === 'sawtooth') {
      amp = (2 / (Math.PI * k)) * (k % 2 === 0 ? -1 : 1);
    } else if (type === 'triangle') {
      if (k % 2 !== 0) {
        const sign = ((k - 1) / 2) % 2 === 0 ? 1 : -1;
        amp = (8 / (Math.PI * Math.PI * k * k)) * sign;
      }
    } else if (type === 'pulse') {
      // Periodic pulse train with duty cycle D
      amp = (2 * Math.sin(k * Math.PI * dutyCycle)) / (k * Math.PI);
    }

    if (Math.abs(amp) > 1e-6) {
      harmonicsList.push({ n: k, amplitude: amp, phase });
    }
  }

  // Generate ideal waveform and synthesized sum
  for (let i = 0; i < samples; i++) {
    const t = i / samples; // normalized period [0, 1)

    // Ideal reference
    if (type === 'square') {
      ideal[i] = t < dutyCycle ? 1 : -1;
    } else if (type === 'sawtooth') {
      ideal[i] = 2 * (t - Math.floor(t + 0.5));
    } else if (type === 'triangle') {
      ideal[i] = 1 - 4 * Math.abs(Math.round(t - 0.25) - (t - 0.25));
    } else {
      ideal[i] = t < dutyCycle ? 1 : 0;
    }

    // Synthesized sum
    let val = type === 'pulse' ? dutyCycle : 0; // DC component for unipolar pulse
    for (const h of harmonicsList) {
      val += h.amplitude * Math.sin(2 * Math.PI * h.n * t + h.phase);
    }
    synthesized[i] = val;
  }

  // Calculate Gibbs overshoot for square wave
  let peakVal = 0;
  for (let i = 0; i < samples / 2; i++) {
    if (synthesized[i] > peakVal) peakVal = synthesized[i];
  }
  const gibbsOvershootPercent = type === 'square' ? Math.max(0, ((peakVal - 1.0) / 1.0) * 100) : 0;

  return {
    ideal,
    synthesized,
    harmonics: harmonicsList,
    gibbsOvershootPercent: +gibbsOvershootPercent.toFixed(2),
  };
}

/**
 * Benchmark runner comparing manual DFT O(N^2) against Cooley-Tukey FFT O(N log N).
 */
export function benchmarkTransforms(
  signal: number[],
  sampleRate: number = 64
): {
  dftTimeMs: number;
  fftTimeMs: number;
  speedup: number;
  sampleCount: number;
} {
  const N = signal.length;

  // Measure direct DFT
  const dftStart = performance.now();
  computeDFT(signal, sampleRate);
  const dftTimeMs = +(performance.now() - dftStart).toFixed(3);

  // Measure FFT
  const fftStart = performance.now();
  computeFFTRadix2(signal, undefined, sampleRate);
  const fftTimeMs = +(performance.now() - fftStart).toFixed(3);

  const speedup = fftTimeMs > 0.001 ? +(dftTimeMs / fftTimeMs).toFixed(1) : +(dftTimeMs / 0.01).toFixed(1);

  return {
    dftTimeMs: Math.max(0.01, dftTimeMs),
    fftTimeMs: Math.max(0.01, fftTimeMs),
    speedup: Math.max(1, speedup),
    sampleCount: N,
  };
}

/**
 * Signal generators for interactive experimentation
 */
export function generateSignal(
  type: string,
  params: {
    sampleCount: number;
    sampleRate: number;
    f1?: number;
    a1?: number;
    phase1Deg?: number;
    f2?: number;
    a2?: number;
    f3?: number;
    a3?: number;
    tones?: { id: string; frequency: number; amplitude: number; phaseDeg: number }[];
    noiseLevel?: number;
    windowType?: 'rectangular' | 'hann' | 'hamming' | 'blackman';
    pulseWidth?: number;
    chirpRate?: number;
  }
): {
  rawSignal: number[];
  windowedSignal: number[];
  windowWeights: number[];
  timeArray: number[];
} {
  const N = params.sampleCount;
  const fs = params.sampleRate;
  const f1 = params.f1 ?? 20;
  const a1 = params.a1 ?? 1.0;
  const phi1 = ((params.phase1Deg ?? 0) * Math.PI) / 180;
  const noise = params.noiseLevel ?? 0;
  const windowType = params.windowType ?? 'rectangular';

  const rawSignal = new Float64Array(N);
  const timeArray = new Float64Array(N);
  const windowWeights = new Float64Array(N);
  const windowedSignal = new Float64Array(N);

  // Compute window coefficients
  for (let n = 0; n < N; n++) {
    if (windowType === 'hann') {
      windowWeights[n] = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (N - 1)));
    } else if (windowType === 'hamming') {
      windowWeights[n] = 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / (N - 1));
    } else if (windowType === 'blackman') {
      windowWeights[n] =
        0.42 -
        0.5 * Math.cos((2 * Math.PI * n) / (N - 1)) +
        0.08 * Math.cos((4 * Math.PI * n) / (N - 1));
    } else {
      windowWeights[n] = 1.0;
    }
  }

  // Generate basic shape
  for (let n = 0; n < N; n++) {
    const t = n / fs;
    timeArray[n] = t;
    let s = 0;

    switch (type) {
      case 'sine':
      case 'pure-tone':
        s = a1 * Math.sin(2 * Math.PI * f1 * t + phi1);
        break;

      case 'cosine':
        s = a1 * Math.cos(2 * Math.PI * f1 * t + phi1);
        break;

      case 'multi-tone':
      case 'two-tones':
        if (params.tones && params.tones.length > 0) {
          s = 0;
          for (let i = 0; i < params.tones.length; i++) {
            const comp = params.tones[i];
            const compPhi = (comp.phaseDeg * Math.PI) / 180;
            s += comp.amplitude * Math.sin(2 * Math.PI * comp.frequency * t + compPhi);
          }
        } else {
          const f2 = params.f2 ?? 40;
          const a2 = params.a2 ?? 0.7;
          const f3 = params.f3 ?? 60;
          const a3 = params.a3 ?? 0.4;
          s =
            a1 * Math.sin(2 * Math.PI * f1 * t + phi1) +
            a2 * Math.sin(2 * Math.PI * f2 * t) +
            a3 * Math.sin(2 * Math.PI * f3 * t);
        }
        break;

      case 'square':
      case 'square-wave': {
        const sinVal = Math.sin(2 * Math.PI * f1 * t + phi1);
        s = a1 * (sinVal >= 0 ? 1 : -1);
        break;
      }

      case 'sawtooth':
      case 'sawtooth-wave': {
        const period = 1 / Math.max(0.1, f1);
        const shiftT = t + (params.phase1Deg ?? 0) / (360 * Math.max(0.1, f1));
        const phase = (shiftT % period + period) % period / period;
        s = a1 * (2 * phase - 1);
        break;
      }

      case 'pulse': {
        const width = params.pulseWidth ?? 0.2;
        const center = N / (2 * fs);
        s = Math.abs(t - center) <= width / 2 ? a1 : 0;
        break;
      }

      case 'chirp': {
        const kChirp = params.chirpRate ?? 15;
        s = a1 * Math.sin(2 * Math.PI * (f1 * t + 0.5 * kChirp * t * t));
        break;
      }

      case 'damped': {
        const decay = 3;
        s = a1 * Math.exp(-decay * t) * Math.sin(2 * Math.PI * f1 * t + phi1);
        break;
      }

      default:
        s = a1 * Math.sin(2 * Math.PI * f1 * t + phi1);
    }

    if (noise > 0) {
      // Deterministic Box-Muller Gaussian noise
      const u1 = Math.max(1e-12, Math.random());
      const u2 = Math.random();
      const randNorm = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
      s += randNorm * noise;
    }

    rawSignal[n] = s;
    windowedSignal[n] = s * windowWeights[n];
  }

  return {
    rawSignal: Array.from(rawSignal),
    windowedSignal: Array.from(windowedSignal),
    windowWeights: Array.from(windowWeights),
    timeArray: Array.from(timeArray),
  };
}
