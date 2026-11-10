/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * DSP Simulation Engine - Topic A: Signal Generator & Time-Domain Analysis
 * Complete deterministic signal synthesis, analytical statistics, transformations,
 * and inter-module interchange bus.
 */

export type SignalType =
  | 'sinusoidal'
  | 'cosine'
  | 'square'
  | 'triangular'
  | 'sawtooth'
  | 'unit_step'
  | 'impulse'
  | 'ramp'
  | 'dc'
  | 'exponential'
  | 'rectangular_pulse'
  | 'sinc';

export interface SignalGeneratorParams {
  signalType: SignalType;
  amplitude: number;
  frequencyHz: number;
  phaseDegrees: number;
  dcOffset: number;
  startTimeSeconds: number;
  endTimeSeconds: number;
  samplingFrequencyHz: number;
  t0: number; // time center / delay
  dutyCyclePercent: number;
  pulseWidthSeconds: number;
  alpha: number;
  expoMode: 'decay' | 'growth';
  sincMode: 'normalized' | 'unnormalized';
  // Time & Amplitude Operations: y(t) = A_scale * x( a_scale * (t - shift) )
  timeShift: number; // additional shift
  timeScaling: number; // a in x(a*t)
  ampScale: number; // A in A*x(t)
  isReversed: boolean; // time reversal x(-t)
}

export const DEFAULT_SIGNAL_PARAMS: SignalGeneratorParams = {
  signalType: 'sinusoidal',
  amplitude: 1.0,
  frequencyHz: 5.0,
  phaseDegrees: 0.0,
  dcOffset: 0.0,
  startTimeSeconds: 0.0,
  endTimeSeconds: 1.0,
  samplingFrequencyHz: 1000,
  t0: 0.0,
  dutyCyclePercent: 50,
  pulseWidthSeconds: 0.2,
  alpha: 2.0,
  expoMode: 'decay',
  sincMode: 'normalized',
  timeShift: 0.0,
  timeScaling: 1.0,
  ampScale: 1.0,
  isReversed: false,
};

export interface TheoreticalStats {
  mean: number | string;
  rms: number | string;
  period: string;
}

export interface FormulaMeta {
  equation: string;
  category: string;
  theoretical: TheoreticalStats;
}

export interface GeneratedSignal {
  schemaVersion: string;
  signalId: string;
  signalType: SignalType;
  timestamp: string;
  parameters: SignalGeneratorParams;
  sampling: {
    sampleCount: number;
    timeStepSeconds: number;
    durationSeconds: number;
    nyquistFrequencyHz: number;
  };
  data: {
    timeSeconds: number[];
    amplitude: number[];
    transformed: number[];
  };
  statistics: {
    minimum: number;
    maximum: number;
    peakToPeak: number;
    mean: number;
    rms: number;
  };
  transformedStatistics: {
    minimum: number;
    maximum: number;
    peakToPeak: number;
    mean: number;
    rms: number;
  };
  metadata: {
    formulaString: string;
    category: string;
    hasDiscontinuity: boolean;
    theoretical: TheoreticalStats;
  };
}

export class SignalGenerator {
  /**
   * Evaluates single value of waveform at arbitrary time t
   */
  static evaluateAt(t: number, p: SignalGeneratorParams): number {
    const {
      signalType,
      amplitude,
      frequencyHz,
      phaseDegrees,
      dcOffset,
      t0,
      dutyCyclePercent,
      pulseWidthSeconds,
      alpha,
      expoMode,
      sincMode,
      samplingFrequencyHz,
    } = p;

    const dt = 1.0 / Math.max(1, samplingFrequencyHz);
    const phiRad = (phaseDegrees * Math.PI) / 180.0;
    const omega = 2.0 * Math.PI * frequencyHz;
    const duty = Math.min(Math.max(dutyCyclePercent / 100.0, 0.01), 0.99);

    switch (signalType) {
      case 'sinusoidal':
        return amplitude * Math.sin(omega * t + phiRad) + dcOffset;

      case 'cosine':
        return amplitude * Math.cos(omega * t + phiRad) + dcOffset;

      case 'square': {
        const theta = (omega * t + phiRad) % (2.0 * Math.PI);
        const normTheta = theta < 0 ? theta + 2.0 * Math.PI : theta;
        const threshold = 2.0 * Math.PI * duty;
        return (normTheta < threshold ? amplitude : -amplitude) + dcOffset;
      }

      case 'triangular': {
        const T = 1.0 / Math.max(0.0001, frequencyHz);
        const shiftedTime = t + (phaseDegrees / 360.0) * T;
        let modT = shiftedTime % T;
        if (modT < 0) modT += T;
        return amplitude * (2.0 * Math.abs(2.0 * (modT / T - Math.floor(modT / T + 0.5))) - 1.0) + dcOffset;
      }

      case 'sawtooth': {
        const T = 1.0 / Math.max(0.0001, frequencyHz);
        const shiftedTime = t + (phaseDegrees / 360.0) * T;
        let modT = shiftedTime % T;
        if (modT < 0) modT += T;
        return amplitude * (2.0 * (modT / T) - 1.0) + dcOffset;
      }

      case 'unit_step':
        return (t >= t0 ? amplitude : 0.0) + dcOffset;

      case 'impulse': {
        const isCenterSample = Math.abs(t - t0) <= (dt / 2.0);
        return (isCenterSample ? amplitude / dt : 0.0) + dcOffset;
      }

      case 'ramp':
        return (t >= t0 ? amplitude * (t - t0) : 0.0) + dcOffset;

      case 'dc':
        return amplitude + dcOffset;

      case 'exponential': {
        if (t >= t0) {
          const tau = t - t0;
          const exponent = (expoMode === 'decay' ? -alpha : alpha) * tau;
          return amplitude * Math.exp(exponent) + dcOffset;
        }
        return dcOffset;
      }

      case 'rectangular_pulse': {
        const halfW = pulseWidthSeconds / 2.0;
        return (t >= t0 - halfW && t <= t0 + halfW ? amplitude : 0.0) + dcOffset;
      }

      case 'sinc': {
        const arg = t - t0;
        if (sincMode === 'normalized') {
          const piTerm = Math.PI * frequencyHz * arg;
          return (Math.abs(piTerm) < 1e-12 ? amplitude : (amplitude * Math.sin(piTerm)) / piTerm) + dcOffset;
        } else {
          const wTerm = omega * arg;
          return (Math.abs(wTerm) < 1e-12 ? amplitude : (amplitude * Math.sin(wTerm)) / wTerm) + dcOffset;
        }
      }

      default:
        return dcOffset;
    }
  }

  static generate(params: SignalGeneratorParams): GeneratedSignal {
    const {
      startTimeSeconds,
      endTimeSeconds,
      samplingFrequencyHz,
      timeShift,
      timeScaling,
      ampScale,
      isReversed,
      signalType,
    } = params;

    const Fs = Math.max(1, samplingFrequencyHz);
    const tStart = Math.min(startTimeSeconds, endTimeSeconds);
    const tEnd = Math.max(startTimeSeconds, endTimeSeconds);
    const dt = 1.0 / Fs;

    let N = Math.round((tEnd - tStart) * Fs);
    if (N < 2) N = 2;
    if (N > 5000) N = 5000;

    const time = new Float64Array(N);
    const amplitudeData = new Float64Array(N);
    const transformedData = new Float64Array(N);

    const hasDiscontinuity = [
      'square',
      'sawtooth',
      'unit_step',
      'impulse',
      'exponential',
      'rectangular_pulse',
    ].includes(signalType);

    for (let i = 0; i < N; i++) {
      const t = tStart + i * dt;
      time[i] = t;

      // Base signal
      const baseVal = SignalGenerator.evaluateAt(t, params);
      amplitudeData[i] = baseVal;

      // Transformed signal: y(t) = A * x( (isReversed ? -1 : 1) * a * (t - shift) )
      const aEff = Math.max(0.01, Math.abs(timeScaling));
      const effT = (isReversed ? -1 : 1) * aEff * (t - timeShift);
      const transVal = ampScale * SignalGenerator.evaluateAt(effT, params);
      transformedData[i] = transVal;
    }

    // Numerical stats for base signal
    let min = Infinity;
    let max = -Infinity;
    let sum = 0.0;
    let sumSq = 0.0;

    for (let i = 0; i < N; i++) {
      const v = amplitudeData[i];
      if (v < min) min = v;
      if (v > max) max = v;
      sum += v;
      sumSq += v * v;
    }
    const mean = sum / N;
    const rms = Math.sqrt(sumSq / N);

    // Stats for transformed signal
    let tMin = Infinity;
    let tMax = -Infinity;
    let tSum = 0.0;
    let tSumSq = 0.0;

    for (let i = 0; i < N; i++) {
      const v = transformedData[i];
      if (v < tMin) tMin = v;
      if (v > tMax) tMax = v;
      tSum += v;
      tSumSq += v * v;
    }
    const tMean = tSum / N;
    const tRms = Math.sqrt(tSumSq / N);

    const formulaMeta = SignalGenerator.getFormula(params);

    return {
      schemaVersion: '1.0',
      signalId: 'SIG-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
      signalType,
      timestamp: new Date().toISOString(),
      parameters: { ...params },
      sampling: {
        sampleCount: N,
        timeStepSeconds: dt,
        durationSeconds: tEnd - tStart,
        nyquistFrequencyHz: Fs / 2.0,
      },
      data: {
        timeSeconds: Array.from(time),
        amplitude: Array.from(amplitudeData),
        transformed: Array.from(transformedData),
      },
      statistics: {
        minimum: min,
        maximum: max,
        peakToPeak: max - min,
        mean,
        rms,
      },
      transformedStatistics: {
        minimum: tMin,
        maximum: tMax,
        peakToPeak: tMax - tMin,
        mean: tMean,
        rms: tRms,
      },
      metadata: {
        formulaString: formulaMeta.equation,
        category: formulaMeta.category,
        hasDiscontinuity,
        theoretical: formulaMeta.theoretical,
      },
    };
  }

  static getFormula(p: SignalGeneratorParams): FormulaMeta {
    const A = p.amplitude.toFixed(2);
    const f = p.frequencyHz.toFixed(2);
    const phi = p.phaseDegrees.toFixed(1);
    const C = p.dcOffset >= 0 ? `+ ${p.dcOffset.toFixed(2)}` : `- ${Math.abs(p.dcOffset).toFixed(2)}`;
    const cOffsetVal = p.dcOffset;

    switch (p.signalType) {
      case 'sinusoidal':
        return {
          equation: `x(t) = ${A} · sin(2π · ${f} · t + ${phi}°) ${cOffsetVal !== 0 ? C : ''}`,
          category: 'Periodic Continuous',
          theoretical: {
            mean: cOffsetVal,
            rms: Math.sqrt(0.5 * p.amplitude * p.amplitude + cOffsetVal * cOffsetVal),
            period: (1.0 / p.frequencyHz).toFixed(4) + ' s',
          },
        };
      case 'cosine':
        return {
          equation: `x(t) = ${A} · cos(2π · ${f} · t + ${phi}°) ${cOffsetVal !== 0 ? C : ''}`,
          category: 'Periodic Continuous',
          theoretical: {
            mean: cOffsetVal,
            rms: Math.sqrt(0.5 * p.amplitude * p.amplitude + cOffsetVal * cOffsetVal),
            period: (1.0 / p.frequencyHz).toFixed(4) + ' s',
          },
        };
      case 'square':
        return {
          equation: `x(t) = ${A} · sqw(2π · ${f} · t + ${phi}°, d=${p.dutyCyclePercent}%) ${cOffsetVal !== 0 ? C : ''}`,
          category: 'Periodic Piecewise',
          theoretical: {
            mean: p.amplitude * (2 * (p.dutyCyclePercent / 100) - 1) + cOffsetVal,
            rms: Math.sqrt(p.amplitude * p.amplitude + cOffsetVal * cOffsetVal),
            period: (1.0 / p.frequencyHz).toFixed(4) + ' s',
          },
        };
      case 'triangular':
        return {
          equation: `x(t) = ${A} · tri(2π · ${f} · t + ${phi}°) ${cOffsetVal !== 0 ? C : ''}`,
          category: 'Periodic Continuous',
          theoretical: {
            mean: cOffsetVal,
            rms: Math.sqrt((p.amplitude * p.amplitude) / 3.0 + cOffsetVal * cOffsetVal),
            period: (1.0 / p.frequencyHz).toFixed(4) + ' s',
          },
        };
      case 'sawtooth':
        return {
          equation: `x(t) = ${A} · saw(2π · ${f} · t + ${phi}°) ${cOffsetVal !== 0 ? C : ''}`,
          category: 'Periodic Discontinuous',
          theoretical: {
            mean: cOffsetVal,
            rms: Math.sqrt((p.amplitude * p.amplitude) / 3.0 + cOffsetVal * cOffsetVal),
            period: (1.0 / p.frequencyHz).toFixed(4) + ' s',
          },
        };
      case 'unit_step':
        return {
          equation: `x(t) = ${A} · u(t - ${p.t0.toFixed(2)}s) ${cOffsetVal !== 0 ? C : ''}`,
          category: 'Aperiodic Singular',
          theoretical: { mean: 'Interval dependent', rms: 'Interval dependent', period: 'N/A (Aperiodic)' },
        };
      case 'impulse':
        return {
          equation: `x(t) ≈ ${A} · δ_Δt(t - ${p.t0.toFixed(2)}s) [Area = ${A}]`,
          category: 'Singular Distribution',
          theoretical: { mean: 'Pulse Area / T', rms: 'Approximation dependent', period: 'N/A' },
        };
      case 'ramp':
        return {
          equation: `x(t) = ${A} · (t - ${p.t0.toFixed(2)}) · u(t - ${p.t0.toFixed(2)}) ${cOffsetVal !== 0 ? C : ''}`,
          category: 'Aperiodic Continuous',
          theoretical: { mean: 'Interval dependent', rms: 'Interval dependent', period: 'N/A' },
        };
      case 'dc':
        return {
          equation: `x(t) = ${A} ${cOffsetVal !== 0 ? C : ''} = ${(p.amplitude + cOffsetVal).toFixed(2)} V`,
          category: 'Constant',
          theoretical: { mean: p.amplitude + cOffsetVal, rms: Math.abs(p.amplitude + cOffsetVal), period: 'Infinite' },
        };
      case 'exponential':
        return {
          equation: `x(t) = ${A} · exp(${p.expoMode === 'decay' ? '-' : '+'}${p.alpha.toFixed(1)}(t - ${p.t0.toFixed(2)})) · u(t - t₀)`,
          category: 'Aperiodic Exponential',
          theoretical: { mean: 'Interval dependent', rms: 'Interval dependent', period: 'N/A' },
        };
      case 'rectangular_pulse':
        return {
          equation: `x(t) = ${A} · rect((t - ${p.t0.toFixed(2)}) / ${p.pulseWidthSeconds.toFixed(2)}) ${cOffsetVal !== 0 ? C : ''}`,
          category: 'Aperiodic Pulse',
          theoretical: {
            mean: (p.amplitude * p.pulseWidthSeconds) / (p.endTimeSeconds - p.startTimeSeconds),
            rms: 'Interval dependent',
            period: 'N/A',
          },
        };
      case 'sinc':
        return {
          equation:
            p.sincMode === 'normalized'
              ? `x(t) = ${A} · sinc(π · ${f} · (t - ${p.t0.toFixed(2)}))`
              : `x(t) = ${A} · sin(2π${f}(t - t₀)) / (2π${f}(t - t₀))`,
          category: 'Energy Signal',
          theoretical: { mean: 'Energy Signal (~0)', rms: 'Localized', period: 'N/A' },
        };
      default:
        return { equation: 'x(t) = 0', category: 'Unknown', theoretical: { mean: 0, rms: 0, period: 'N/A' } };
    }
  }
}
