/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Mathematical engine for Random Processes, Autocorrelation, and Power Spectral Density (PSD).
 * Implements:
 * - Signal generators (Gaussian White Noise, AR(1) Colored Pink Noise, Random Telegraph, Sine + Noise, Bandpass Noise)
 * - Sample Autocorrelation R_xx(tau) and Normalized rho_xx(tau)
 * - Raw Periodogram |X(f)|^2 / N
 * - Welch's Overlapping Segment Averaging PSD
 * - Wiener-Khinchin Transform (FFT of R_xx(tau))
 * - Parseval Energy/Power integration verification
 */

export type ProcessType =
  | 'white'
  | 'colored'
  | 'telegraph'
  | 'harmonic_noise'
  | 'bandpass';

export interface ProcessConfig {
  type: ProcessType;
  sampleRate: number; // fs in Hz
  sampleCount: number; // N
  variance: number; // sigma^2
  dcOffset: number; // mu
  harmonicFreq: number; // f0 for harmonic signal
  harmonicAmp: number; // amplitude A for harmonic
  snrDb: number; // SNR in dB for harmonic in noise
  arCoeff: number; // alpha for AR(1) colored noise (0 to 0.98)
  telegraphRate: number; // lambda for Poisson switching
  bandpassCenter: number; // center frequency in Hz
  bandpassBandwidth: number; // bandwidth in Hz
}

export const DEFAULT_PROCESS_CONFIG: ProcessConfig = {
  type: 'colored',
  sampleRate: 200,
  sampleCount: 512,
  variance: 1.0,
  dcOffset: 0.0,
  harmonicFreq: 25.0,
  harmonicAmp: 1.2,
  snrDb: 3.0,
  arCoeff: 0.85,
  telegraphRate: 8.0,
  bandpassCenter: 35.0,
  bandpassBandwidth: 10.0,
};

/**
 * Standard Box-Muller Gaussian random variable generator
 */
function randomGaussian(mean = 0, std = 1): number {
  const u1 = Math.max(1e-14, Math.random());
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mean + std * z0;
}

/**
 * Generates continuous/discrete random signal realization
 */
export function generateProcessSignal(config: ProcessConfig): {
  signal: number[];
  timeArray: number[];
} {
  const N = config.sampleCount;
  const fs = config.sampleRate;
  const signal = new Float64Array(N);
  const timeArray = new Float64Array(N);

  const std = Math.sqrt(Math.max(0.001, config.variance));
  const mu = config.dcOffset;

  switch (config.type) {
    case 'white': {
      // Independent identically distributed Gaussian white noise
      for (let n = 0; n < N; n++) {
        timeArray[n] = n / fs;
        signal[n] = mu + randomGaussian(0, std);
      }
      break;
    }

    case 'colored': {
      // First-order Autoregressive AR(1) Model: x[n] = alpha * x[n-1] + sqrt(1 - alpha^2) * w[n]
      const alpha = Math.max(0.01, Math.min(0.98, config.arCoeff));
      const innovationScale = Math.sqrt(1 - alpha * alpha) * std;
      let prev = randomGaussian(0, std);

      // Warm-up filter
      for (let w = 0; w < 50; w++) {
        prev = alpha * prev + randomGaussian(0, innovationScale);
      }

      for (let n = 0; n < N; n++) {
        timeArray[n] = n / fs;
        const current = alpha * prev + randomGaussian(0, innovationScale);
        signal[n] = mu + current;
        prev = current;
      }
      break;
    }

    case 'telegraph': {
      // Random Telegraph Process: Poisson switching between +A and -A
      // Transitions occur at rate lambda. P(switch in dt) = lambda * dt
      const dt = 1 / fs;
      const pSwitch = Math.min(0.5, config.telegraphRate * dt);
      const A = Math.max(0.2, std * Math.sqrt(1.5));
      let state = Math.random() < 0.5 ? A : -A;

      for (let n = 0; n < N; n++) {
        timeArray[n] = n / fs;
        if (Math.random() < pSwitch) {
          state = -state;
        }
        signal[n] = mu + state + randomGaussian(0, 0.05); // slight sensor jitter
      }
      break;
    }

    case 'harmonic_noise': {
      // Harmonic signal buried in noise: x[n] = A * sin(2*pi*f0*t + phi) + noise
      // SNR_dB = 10 * log10( P_signal / P_noise ) where P_signal = A^2 / 2
      const f0 = config.harmonicFreq;
      const A = config.harmonicAmp;
      const signalPower = (A * A) / 2;
      // noisePower = signalPower / 10^(SNR_dB / 10)
      const noisePower = signalPower / Math.pow(10, config.snrDb / 10);
      const noiseStd = Math.sqrt(Math.max(1e-6, noisePower));
      const phi = Math.random() * 2 * Math.PI;

      for (let n = 0; n < N; n++) {
        const t = n / fs;
        timeArray[n] = t;
        const harmonic = A * Math.sin(2 * Math.PI * f0 * t + phi);
        const noise = randomGaussian(0, noiseStd);
        signal[n] = mu + harmonic + noise;
      }
      break;
    }

    case 'bandpass': {
      // Second-order Resonant AR(2) Narrowband Process:
      // Bandpass centered at fc with bandwidth B
      const fc = Math.min(fs * 0.45, Math.max(5, config.bandpassCenter));
      const bw = Math.max(2, config.bandpassBandwidth);
      const r = Math.exp((-Math.PI * bw) / fs); // pole radius
      const theta = (2 * Math.PI * fc) / fs; // pole angle
      const a1 = 2 * r * Math.cos(theta);
      const a2 = -r * r;
      const gain = Math.sqrt((1 - r * r) / (1 + r * r)) * std;

      let y1 = 0;
      let y2 = 0;
      // Warm up
      for (let w = 0; w < 100; w++) {
        const next = a1 * y1 + a2 * y2 + randomGaussian(0, gain);
        y2 = y1;
        y1 = next;
      }

      for (let n = 0; n < N; n++) {
        timeArray[n] = n / fs;
        const current = a1 * y1 + a2 * y2 + randomGaussian(0, gain);
        signal[n] = mu + current;
        y2 = y1;
        y1 = current;
      }
      break;
    }
  }

  return {
    signal: Array.from(signal),
    timeArray: Array.from(timeArray),
  };
}

/**
 * Autocorrelation calculation result
 */
export interface AutocorrResult {
  lags: number[]; // integer lags [-tauMax, +tauMax]
  timeLags: number[]; // time lags in seconds
  rxx: number[]; // unnormalized autocorrelation R_xx[tau]
  rho: number[]; // normalized autocorrelation rho_xx[tau]
  totalPower: number; // R_xx(0)
  tauMax: number;
}

/**
 * Computes sample autocorrelation sequence R_xx[tau]
 * Unbiased estimator: R_xx[tau] = 1 / (N - |tau|) * sum_{n} x[n] * x[n + tau]
 */
export function computeAutocorrelation(
  signal: number[],
  sampleRate: number,
  tauMax = 40
): AutocorrResult {
  const N = signal.length;
  const maxLag = Math.min(Math.floor(N / 2), Math.max(5, tauMax));

  const lags: number[] = [];
  const timeLags: number[] = [];
  const rxx: number[] = [];
  const rho: number[] = [];

  // Compute R_xx(0) first
  let r0Sum = 0;
  for (let n = 0; n < N; n++) {
    r0Sum += signal[n] * signal[n];
  }
  const totalPower = r0Sum / N;

  for (let lag = -maxLag; lag <= maxLag; lag++) {
    let sum = 0;
    let count = 0;
    const absLag = Math.abs(lag);

    for (let n = 0; n < N - absLag; n++) {
      if (lag >= 0) {
        sum += signal[n] * signal[n + lag];
      } else {
        sum += signal[n - lag] * signal[n];
      }
      count++;
    }

    const rVal = count > 0 ? sum / count : 0;
    lags.push(lag);
    timeLags.push(lag / sampleRate);
    rxx.push(rVal);
    rho.push(totalPower > 1e-12 ? rVal / totalPower : 0);
  }

  return {
    lags,
    timeLags,
    rxx,
    rho,
    totalPower,
    tauMax: maxLag,
  };
}

/**
 * Detailed step-by-step workout calculation for a specific lag tau
 */
export interface LagWorkoutStep {
  lag: number;
  tauSec: number;
  overlapCount: number;
  sumProduct: number;
  calculatedRxx: number;
  normalizedRho: number;
  powerPercent: number;
  samplePairs: { n: number; xn: number; xnTau: number; product: number }[];
}

export function computeLagWorkout(
  signal: number[],
  sampleRate: number,
  lag: number,
  totalPower: number
): LagWorkoutStep {
  const N = signal.length;
  const absLag = Math.abs(lag);
  const overlapCount = Math.max(1, N - absLag);

  let sumProduct = 0;
  const samplePairs: { n: number; xn: number; xnTau: number; product: number }[] = [];

  for (let n = 0; n < overlapCount; n++) {
    const xn = lag >= 0 ? signal[n] : signal[n - lag];
    const xnTau = lag >= 0 ? signal[n + lag] : signal[n];
    const product = xn * xnTau;
    sumProduct += product;

    if (samplePairs.length < 8) {
      samplePairs.push({
        n,
        xn,
        xnTau,
        product,
      });
    }
  }

  const calculatedRxx = sumProduct / overlapCount;
  const normalizedRho = totalPower > 1e-12 ? calculatedRxx / totalPower : 0;
  const powerPercent = normalizedRho * 100;

  return {
    lag,
    tauSec: lag / sampleRate,
    overlapCount,
    sumProduct,
    calculatedRxx,
    normalizedRho,
    powerPercent,
    samplePairs,
  };
}

/**
 * Power Spectral Density (PSD) calculation container
 */
export interface PSDComparison {
  frequencies: number[]; // in Hz [0, fs/2]
  rawPeriodogram: number[]; // raw I_N(f)
  welchPSD: number[]; // Welch smoothed PSD
  wienerKhinchinPSD: number[]; // FFT of R_xx(tau)
  nyquistFreq: number;
  binWidth: number;
  integratedPowerTime: number; // R_xx(0)
  integratedPowerFreq: number; // integral of S_xx(f) df
  parsevalMatchPercent: number;
}

/**
 * Computes Raw Periodogram, Welch Averaged Periodogram, and Wiener-Khinchin PSD
 */
export function computePSDComparison(
  signal: number[],
  sampleRate: number,
  autocorr: AutocorrResult
): PSDComparison {
  const N = signal.length;
  const nyquistFreq = sampleRate / 2;
  const numBins = 128; // Single-sided frequency bins from 0 to fs/2
  const binWidth = nyquistFreq / (numBins - 1);
  const frequencies = Array.from({ length: numBins }, (_, i) => i * binWidth);

  // 1. Raw Periodogram: I_N(f) = (1 / (N * fs)) * | sum_{n=0}^{N-1} x[n] e^(-j 2pi f n / fs) |^2
  const rawPeriodogram = new Float64Array(numBins);
  for (let k = 0; k < numBins; k++) {
    const f = frequencies[k];
    const omega = (2 * Math.PI * f) / sampleRate;
    let re = 0;
    let im = 0;
    for (let n = 0; n < N; n++) {
      const angle = omega * n;
      const xn = signal[n];
      re += xn * Math.cos(angle);
      im -= xn * Math.sin(angle);
    }
    const magSq = re * re + im * im;
    // Normalized single-sided power spectral density (factor of 2 for positive frequencies, except DC)
    const factor = k === 0 || k === numBins - 1 ? 1.0 : 2.0;
    rawPeriodogram[k] = (factor * magSq) / (N * sampleRate);
  }

  // 2. Welch's Smoothed Ensemble Method:
  // Split signal into overlapping segments (e.g. 50% overlap), window each with Hann, compute periodograms, and average
  const segmentLength = Math.max(32, Math.min(128, Math.floor(N / 4)));
  const step = Math.floor(segmentLength / 2);
  let segmentCount = 0;
  const welchAccum = new Float64Array(numBins);

  // Hann window energy normalization
  let windowEnergy = 0;
  const hann = new Float64Array(segmentLength);
  for (let i = 0; i < segmentLength; i++) {
    hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (segmentLength - 1)));
    windowEnergy += hann[i] * hann[i];
  }

  for (let start = 0; start + segmentLength <= N; start += step) {
    segmentCount++;
    for (let k = 0; k < numBins; k++) {
      const f = frequencies[k];
      const omega = (2 * Math.PI * f) / sampleRate;
      let re = 0;
      let im = 0;
      for (let n = 0; n < segmentLength; n++) {
        const angle = omega * n;
        const xn = signal[start + n] * hann[n];
        re += xn * Math.cos(angle);
        im -= xn * Math.sin(angle);
      }
      const magSq = re * re + im * im;
      const factor = k === 0 || k === numBins - 1 ? 1.0 : 2.0;
      welchAccum[k] += (factor * magSq) / (windowEnergy * sampleRate);
    }
  }

  const welchPSD = Array.from(welchAccum).map((val) =>
    segmentCount > 0 ? val / segmentCount : 0
  );

  // 3. Wiener-Khinchin Transform:
  // S_xx(f) = Delta_tau * sum_{tau = -tauMax}^{tauMax} R_xx(tau) * e^(-j 2pi f tau)
  const wkPSD = new Float64Array(numBins);
  const tauCount = autocorr.lags.length;

  for (let k = 0; k < numBins; k++) {
    const f = frequencies[k];
    let sum = 0;
    for (let i = 0; i < tauCount; i++) {
      const tauSec = autocorr.timeLags[i];
      const r = autocorr.rxx[i];
      // Cosine transform since R_xx is real and even: R_xx(-tau) = R_xx(tau)
      sum += r * Math.cos(2 * Math.PI * f * tauSec) * (1 / sampleRate);
    }
    // Single-sided spectral density: 2 * S_xx_two_sided for f > 0
    const factor = k === 0 ? 1.0 : 2.0;
    wkPSD[k] = Math.max(1e-8, factor * sum);
  }

  // Parseval power integration: sum S(f) * df
  let integratedPowerFreq = 0;
  for (let k = 0; k < numBins; k++) {
    const weight = k === 0 || k === numBins - 1 ? 0.5 : 1.0;
    integratedPowerFreq += welchPSD[k] * binWidth * weight;
  }

  const integratedPowerTime = autocorr.totalPower;
  const matchRatio =
    integratedPowerTime > 0
      ? (integratedPowerFreq / integratedPowerTime) * 100
      : 100;

  return {
    frequencies,
    rawPeriodogram: Array.from(rawPeriodogram),
    welchPSD,
    wienerKhinchinPSD: Array.from(wkPSD),
    nyquistFreq,
    binWidth,
    integratedPowerTime,
    integratedPowerFreq,
    parsevalMatchPercent: Math.min(100, Math.max(0, matchRatio)),
  };
}
