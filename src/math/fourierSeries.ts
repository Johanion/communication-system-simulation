/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Fourier Series Mathematical Engine for Topic C
 * Supports exact analytical calculation of Fourier Series coefficients (a0, an, bn, cn, phase),
 * signal reconstruction with K harmonics, MSE error evaluation, and Gibbs overshoot.
 */

export type PeriodicWaveformType =
  | 'square'
  | 'sawtooth'
  | 'triangle'
  | 'pulse'
  | 'half_wave_rect'
  | 'full_wave_rect';

export interface HarmonicCoeff {
  n: number; // harmonic index 1, 2, 3...
  freq: number; // n * f0
  an: number; // cosine coefficient
  bn: number; // sine coefficient
  cn: number; // magnitude sqrt(an^2 + bn^2)
  phaseRad: number; // atan2(-bn, an)
  powerPercent: number; // fraction of power in this harmonic
}

export interface FourierSeriesModel {
  type: PeriodicWaveformType;
  title: string;
  description: string;
  a0: number; // DC offset / 2
  analyticalFormula: {
    a0: string;
    an: string;
    bn: string;
    series: string;
  };
  totalPower: number; // average power of the original signal P = (1/T) integral x^2(t) dt
  evalOriginal: (t: number, f0: number, duty: number, amp: number) => number;
  computeCoeffs: (K: number, f0: number, duty: number, amp: number) => {
    a0: number;
    harmonics: HarmonicCoeff[];
  };
}

export const FOURIER_SERIES_MODELS: Record<PeriodicWaveformType, FourierSeriesModel> = {
  square: {
    type: 'square',
    title: 'Bipolar Square Wave',
    description: 'Odd harmonics decaying as 1/n. Exhibits classic Gibbs phenomenon (~17.9% overshoot) at step edges.',
    a0: 0,
    analyticalFormula: {
      a0: 'a₀ = 0',
      an: 'aₙ = 0',
      bn: 'bₙ = 4A / (π·n)  [for odd n, 0 for even]',
      series: 'x(t) = (4A/π) · ∑ [1/(2k-1)] · sin(2π(2k-1)f₀t)',
    },
    totalPower: 1.0, // A^2 for unit amplitude
    evalOriginal: (t, f0, _duty, amp) => {
      const tau = (t * f0) % 1;
      const normT = tau < 0 ? tau + 1 : tau;
      return normT < 0.5 ? amp : -amp;
    },
    computeCoeffs: (K, f0, _duty, amp) => {
      const harmonics: HarmonicCoeff[] = [];
      const totalP = amp * amp;
      for (let n = 1; n <= K; n++) {
        let bn = 0;
        if (n % 2 !== 0) {
          bn = (4 * amp) / (Math.PI * n);
        }
        const an = 0;
        const cn = Math.abs(bn);
        const powerInHarmonic = 0.5 * cn * cn;
        harmonics.push({
          n,
          freq: n * f0,
          an,
          bn,
          cn,
          phaseRad: Math.atan2(-bn, an),
          powerPercent: totalP > 0 ? (powerInHarmonic / totalP) * 100 : 0,
        });
      }
      return { a0: 0, harmonics };
    },
  },

  sawtooth: {
    type: 'sawtooth',
    title: 'Sawtooth Wave',
    description: 'Contains ALL integer harmonics (both odd and even) decaying as 1/n. Reverses sign on alternating harmonics.',
    a0: 0,
    analyticalFormula: {
      a0: 'a₀ = 0',
      an: 'aₙ = 0',
      bn: 'bₙ = 2A / (π·n) · (-1)ⁿ⁺¹',
      series: 'x(t) = (2A/π) · ∑ [(-1)ⁿ⁺¹ / n] · sin(2π n f₀ t)',
    },
    totalPower: 1 / 3, // A^2 / 3 for unit amplitude ramp
    evalOriginal: (t, f0, _duty, amp) => {
      const tau = (t * f0) % 1;
      const normT = tau < 0 ? tau + 1 : tau;
      return amp * (2 * normT - 1);
    },
    computeCoeffs: (K, f0, _duty, amp) => {
      const harmonics: HarmonicCoeff[] = [];
      const totalP = (amp * amp) / 3;
      for (let n = 1; n <= K; n++) {
        const sign = n % 2 === 0 ? -1 : 1;
        const bn = (2 * amp * sign) / (Math.PI * n);
        const an = 0;
        const cn = Math.abs(bn);
        const powerInHarmonic = 0.5 * cn * cn;
        harmonics.push({
          n,
          freq: n * f0,
          an,
          bn,
          cn,
          phaseRad: Math.atan2(-bn, an),
          powerPercent: totalP > 0 ? (powerInHarmonic / totalP) * 100 : 0,
        });
      }
      return { a0: 0, harmonics };
    },
  },

  triangle: {
    type: 'triangle',
    title: 'Symmetric Triangle Wave',
    description: 'Continuous with slope discontinuities. Odd harmonics decay rapidly as 1/n² with alternating signs.',
    a0: 0,
    analyticalFormula: {
      a0: 'a₀ = 0',
      an: 'aₙ = 0',
      bn: 'bₙ = (8A / (π²·n²)) · (-1)^((n-1)/2)  [for odd n]',
      series: 'x(t) = (8A/π²) · ∑ [(-1)ᵏ / (2k+1)²] · sin(2π(2k+1)f₀t)',
    },
    totalPower: 1 / 3,
    evalOriginal: (t, f0, _duty, amp) => {
      const tau = (t * f0) % 1;
      const normT = tau < 0 ? tau + 1 : tau;
      if (normT < 0.25) return amp * (4 * normT);
      if (normT < 0.75) return amp * (2 - 4 * normT);
      return amp * (4 * normT - 4);
    },
    computeCoeffs: (K, f0, _duty, amp) => {
      const harmonics: HarmonicCoeff[] = [];
      const totalP = (amp * amp) / 3;
      for (let n = 1; n <= K; n++) {
        let bn = 0;
        if (n % 2 !== 0) {
          const k = (n - 1) / 2;
          const sign = k % 2 === 0 ? 1 : -1;
          bn = (8 * amp * sign) / (Math.PI * Math.PI * n * n);
        }
        const an = 0;
        const cn = Math.abs(bn);
        const powerInHarmonic = 0.5 * cn * cn;
        harmonics.push({
          n,
          freq: n * f0,
          an,
          bn,
          cn,
          phaseRad: Math.atan2(-bn, an),
          powerPercent: totalP > 0 ? (powerInHarmonic / totalP) * 100 : 0,
        });
      }
      return { a0: 0, harmonics };
    },
  },

  pulse: {
    type: 'pulse',
    title: 'Rectangular Pulse Train',
    description: 'Periodic pulse with tunable duty cycle D. Harmonic amplitudes follow the sinc envelope sinc(n·D).',
    a0: 0.5,
    analyticalFormula: {
      a0: 'a₀ = 2A · D',
      an: 'aₙ = (2A / (π·n)) · sin(n·π·D)',
      bn: 'bₙ = 0  (even function centered at origin)',
      series: 'x(t) = A·D + ∑ [2A·sin(nπD)/(nπ)] · cos(2π n f₀ t)',
    },
    totalPower: 0.5, // D * A^2
    evalOriginal: (t, f0, duty, amp) => {
      const tau = (t * f0) % 1;
      const normT = tau < 0 ? tau + 1 : tau;
      // Centered at 0: pulse in [-D/2, D/2]
      const halfD = duty / 2;
      return normT <= halfD || normT >= 1 - halfD ? amp : 0;
    },
    computeCoeffs: (K, f0, duty, amp) => {
      const a0 = 2 * amp * duty;
      const totalP = duty * amp * amp;
      const harmonics: HarmonicCoeff[] = [];
      for (let n = 1; n <= K; n++) {
        const an = (2 * amp * Math.sin(n * Math.PI * duty)) / (n * Math.PI);
        const bn = 0;
        const cn = Math.abs(an);
        const powerInHarmonic = 0.5 * cn * cn;
        harmonics.push({
          n,
          freq: n * f0,
          an,
          bn,
          cn,
          phaseRad: Math.atan2(-bn, an),
          powerPercent: totalP > 0 ? (powerInHarmonic / totalP) * 100 : 0,
        });
      }
      return { a0, harmonics };
    },
  },

  half_wave_rect: {
    type: 'half_wave_rect',
    title: 'Half-Wave Rectified Sine',
    description: 'Rectified sinusoidal waveform x(t) = max(0, sin(2πf₀t)). Contains fundamental plus even harmonic cosines.',
    a0: 1 / Math.PI,
    analyticalFormula: {
      a0: 'a₀ = 2A / π',
      an: 'aₙ = 2A / (π·(1 - n²))  [for even n, 0 for odd n>1]',
      bn: 'b₁ = A / 2,  bₙ = 0  [for n > 1]',
      series: 'x(t) = A/π + (A/2)sin(ω₀t) - (2A/π) ∑ [cos(2kω₀t) / (4k² - 1)]',
    },
    totalPower: 0.25, // A^2 / 4
    evalOriginal: (t, f0, _duty, amp) => {
      const val = amp * Math.sin(2 * Math.PI * f0 * t);
      return Math.max(0, val);
    },
    computeCoeffs: (K, f0, _duty, amp) => {
      const a0 = (2 * amp) / Math.PI;
      const totalP = (amp * amp) / 4;
      const harmonics: HarmonicCoeff[] = [];
      for (let n = 1; n <= K; n++) {
        let an = 0;
        let bn = 0;
        if (n === 1) {
          bn = amp / 2;
        } else if (n % 2 === 0) {
          an = (2 * amp) / (Math.PI * (1 - n * n));
        }
        const cn = Math.sqrt(an * an + bn * bn);
        const powerInHarmonic = 0.5 * cn * cn;
        harmonics.push({
          n,
          freq: n * f0,
          an,
          bn,
          cn,
          phaseRad: Math.atan2(-bn, an),
          powerPercent: totalP > 0 ? (powerInHarmonic / totalP) * 100 : 0,
        });
      }
      return { a0, harmonics };
    },
  },

  full_wave_rect: {
    type: 'full_wave_rect',
    title: 'Full-Wave Rectified Sine',
    description: 'Absolute value |sin(2πf₀t)|. Frequency effectively doubles; contains DC and even harmonics only.',
    a0: 4 / Math.PI,
    analyticalFormula: {
      a0: 'a₀ = 4A / π',
      an: 'aₙ = 4A / (π·(1 - n²))  [for even n, 0 for odd]',
      bn: 'bₙ = 0  [for all n]',
      series: 'x(t) = 2A/π - (4A/π) ∑ [cos(2kω₀t) / (4k² - 1)]',
    },
    totalPower: 0.5, // A^2 / 2
    evalOriginal: (t, f0, _duty, amp) => {
      return amp * Math.abs(Math.sin(2 * Math.PI * f0 * t));
    },
    computeCoeffs: (K, f0, _duty, amp) => {
      const a0 = (4 * amp) / Math.PI;
      const totalP = (amp * amp) / 2;
      const harmonics: HarmonicCoeff[] = [];
      for (let n = 1; n <= K; n++) {
        let an = 0;
        if (n % 2 === 0) {
          an = (4 * amp) / (Math.PI * (1 - n * n));
        }
        const bn = 0;
        const cn = Math.abs(an);
        const powerInHarmonic = 0.5 * cn * cn;
        harmonics.push({
          n,
          freq: n * f0,
          an,
          bn,
          cn,
          phaseRad: Math.atan2(-bn, an),
          powerPercent: totalP > 0 ? (powerInHarmonic / totalP) * 100 : 0,
        });
      }
      return { a0, harmonics };
    },
  },
};

/**
 * Reconstructs waveform and computes comparison metrics
 */
export function reconstructFourierSignal(
  type: PeriodicWaveformType,
  K: number,
  samples: number = 300,
  periods: number = 2,
  f0: number = 1.0,
  duty: number = 0.5,
  amp: number = 1.0,
  timeOffset: number = 0.0
): {
  timeArray: number[];
  originalSignal: number[];
  reconstructedSignal: number[];
  errorSignal: number[];
  a0: number;
  harmonics: HarmonicCoeff[];
  mse: number;
  rmse: number;
  maxAbsoluteError: number;
  powerAccumulatedPercent: number;
  gibbsOvershootPercent: number;
} {
  const model = FOURIER_SERIES_MODELS[type];
  const { a0, harmonics } = model.computeCoeffs(K, f0, duty, amp);

  const duration = periods / f0;
  const dt = duration / (samples - 1);

  const timeArray = new Float64Array(samples);
  const originalSignal = new Float64Array(samples);
  const reconstructedSignal = new Float64Array(samples);
  const errorSignal = new Float64Array(samples);

  let sumSqErr = 0;
  let maxAbsErr = 0;

  for (let i = 0; i < samples; i++) {
    const t = i * dt;
    const effT = t + timeOffset;
    timeArray[i] = t;

    // 1. Original target waveform
    const origVal = model.evalOriginal(effT, f0, duty, amp);
    originalSignal[i] = origVal;

    // 2. Synthesized harmonic sum
    let synthVal = a0 / 2;
    for (const h of harmonics) {
      if (h.cn > 1e-7) {
        const angle = 2 * Math.PI * h.n * f0 * effT;
        synthVal += h.an * Math.cos(angle) + h.bn * Math.sin(angle);
      }
    }
    reconstructedSignal[i] = synthVal;

    // 3. Error
    const err = origVal - synthVal;
    errorSignal[i] = err;
    sumSqErr += err * err;
    const absErr = Math.abs(err);
    if (absErr > maxAbsErr) maxAbsErr = absErr;
  }

  const mse = sumSqErr / samples;
  const rmse = Math.sqrt(mse);

  // Total power accounted for in the first K harmonics:
  // Parseval: P_approx = (a0/2)^2 + (1/2) * sum(cn^2)
  const dcPower = (a0 / 2) * (a0 / 2);
  let acPower = 0;
  for (const h of harmonics) {
    acPower += 0.5 * h.cn * h.cn;
  }
  const totalPowerApprox = dcPower + acPower;
  const theoreticalTotalP = model.totalPower * amp * amp;
  const powerAccumulatedPercent =
    theoreticalTotalP > 0
      ? Math.min(100, Math.max(0, (totalPowerApprox / theoreticalTotalP) * 100))
      : 100;

  // Gibbs overshoot calculation for square wave
  let peakVal = 0;
  if (type === 'square') {
    for (let i = 0; i < Math.floor(samples / periods); i++) {
      if (reconstructedSignal[i] > peakVal) peakVal = reconstructedSignal[i];
    }
  }
  const gibbsOvershootPercent =
    type === 'square' && peakVal > amp ? ((peakVal - amp) / amp) * 100 : 0;

  return {
    timeArray: Array.from(timeArray),
    originalSignal: Array.from(originalSignal),
    reconstructedSignal: Array.from(reconstructedSignal),
    errorSignal: Array.from(errorSignal),
    a0,
    harmonics,
    mse,
    rmse,
    maxAbsoluteError: maxAbsErr,
    powerAccumulatedPercent,
    gibbsOvershootPercent: +gibbsOvershootPercent.toFixed(2),
  };
}

/**
 * Node in the chain of rotating phasor epicycles
 */
export interface EpicycleNode {
  n: number;
  radius: number;
  centerX: number;
  centerY: number;
  tipX: number;
  tipY: number;
  an: number;
  bn: number;
  cn: number;
  phaseRad: number;
  freq: number;
}

/**
 * Computes exact rotating epicycle phasor centers and tip positions
 */
export function calculateEpicycleChain(
  harmonics: HarmonicCoeff[],
  a0: number,
  t: number,
  f0: number,
  originX: number,
  originY: number,
  scale: number
): {
  nodes: EpicycleNode[];
  finalTipX: number;
  finalTipY: number;
  dcOffsetY: number;
} {
  const dcOffsetY = -(a0 / 2) * scale;
  let currX = originX;
  let currY = originY + dcOffsetY;
  const nodes: EpicycleNode[] = [];

  for (const h of harmonics) {
    if (h.cn < 1e-6) continue;
    const r = h.cn * scale;
    const angle = 2 * Math.PI * h.n * f0 * t;
    const dx = (h.bn * Math.cos(angle) - h.an * Math.sin(angle)) * scale;
    const dy = -(h.an * Math.cos(angle) + h.bn * Math.sin(angle)) * scale;
    const nextX = currX + dx;
    const nextY = currY + dy;

    nodes.push({
      n: h.n,
      radius: r,
      centerX: currX,
      centerY: currY,
      tipX: nextX,
      tipY: nextY,
      an: h.an,
      bn: h.bn,
      cn: h.cn,
      phaseRad: h.phaseRad,
      freq: h.freq,
    });

    currX = nextX;
    currY = nextY;
  }

  return {
    nodes,
    finalTipX: currX,
    finalTipY: currY,
    dcOffsetY,
  };
}

/**
 * Generates dynamic mathematical series formula string updated with current N and amplitude
 */
export function getLiveAnalyticalFormula(
  type: PeriodicWaveformType,
  K: number,
  amp: number,
  f0: number,
  duty: number = 0.5
): {
  category: string;
  shortSeries: string;
  expandedSeries: string;
} {
  const A = amp.toFixed(2);
  const f = f0.toFixed(1);
  const D = Math.round(duty * 100);

  switch (type) {
    case 'square': {
      const oddTermsCount = Math.ceil(K / 2);
      const maxOdd = 2 * oddTermsCount - 1;
      return {
        category: 'Odd Harmonics Only (1/n decay, Gibbs ~17.9%)',
        shortSeries: `x_${K}(t) = (4A/π) · ∑_{k=1}^{${oddTermsCount}} [1/(2k-1)] · sin(2π(2k-1)f₀t)`,
        expandedSeries: `x_${K}(t) = (4·${A}/π) · [ sin(2π·${f}t) + (1/3)sin(6π·${f}t) + (1/5)sin(10π·${f}t) + ... + (1/${maxOdd})sin(2π·${maxOdd}·${f}t) ]`,
      };
    }
    case 'sawtooth': {
      return {
        category: 'All Integer Harmonics (1/n alternating signs)',
        shortSeries: `x_${K}(t) = (2A/π) · ∑_{n=1}^{${K}} [(-1)ⁿ⁺¹ / n] · sin(2π n f₀ t)`,
        expandedSeries: `x_${K}(t) = (2·${A}/π) · [ sin(2π·${f}t) - (1/2)sin(4π·${f}t) + (1/3)sin(6π·${f}t) - ... + ((-1)^${K + 1}/${K})sin(2π·${K}·${f}t) ]`,
      };
    }
    case 'triangle': {
      const oddTermsCount = Math.ceil(K / 2);
      const maxOdd = 2 * oddTermsCount - 1;
      return {
        category: 'Odd Harmonics (Rapid 1/n² quadratic decay)',
        shortSeries: `x_${K}(t) = (8A/π²) · ∑_{k=0}^{${oddTermsCount - 1}} [(-1)ᵏ / (2k+1)²] · sin(2π(2k+1)f₀t)`,
        expandedSeries: `x_${K}(t) = (8·${A}/π²) · [ sin(2π·${f}t) - (1/9)sin(6π·${f}t) + (1/25)sin(10π·${f}t) + ... + ((-1)^${oddTermsCount - 1}/${maxOdd}²)sin(2π·${maxOdd}·${f}t) ]`,
      };
    }
    case 'pulse': {
      return {
        category: `Tunable Duty Cycle D = ${D}% (Sinc Envelope Sampling)`,
        shortSeries: `x_${K}(t) = A·D + (2A/π) · ∑_{n=1}^{${K}} [sin(nπD)/n] · cos(2π n f₀ t)`,
        expandedSeries: `x_${K}(t) = ${(amp * duty).toFixed(2)} + ∑_{n=1}^{${K}} [2·${A}·sin(n·π·${duty.toFixed(2)}) / (nπ)] · cos(2π·n·${f}t)`,
      };
    }
    case 'half_wave_rect': {
      const evenTerms = Math.floor(K / 2);
      return {
        category: 'DC + Fundamental + Even Harmonic Cosines',
        shortSeries: `x_${K}(t) = A/π + (A/2)sin(2πf₀t) - (2A/π) ∑_{k=1}^{${Math.max(1, evenTerms)}} [cos(4π k f₀ t) / (4k² - 1)]`,
        expandedSeries: `x_${K}(t) = ${(amp / Math.PI).toFixed(2)} + ${(amp / 2).toFixed(2)}sin(2π·${f}t) - (2·${A}/π)[ (1/3)cos(4π·${f}t) + (1/15)cos(8π·${f}t) + ... ]`,
      };
    }
    case 'full_wave_rect': {
      const evenTerms = Math.floor(K / 2);
      return {
        category: 'DC + Even Harmonics (Frequency Doubled |sin|)',
        shortSeries: `x_${K}(t) = (2A/π) - (4A/π) ∑_{k=1}^{${Math.max(1, evenTerms)}} [cos(4π k f₀ t) / (4k² - 1)]`,
        expandedSeries: `x_${K}(t) = ${((2 * amp) / Math.PI).toFixed(2)} - (4·${A}/π)[ (1/3)cos(4π·${f}t) + (1/15)cos(8π·${f}t) + ... ]`,
      };
    }
  }
}
