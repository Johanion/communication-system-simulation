/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Mathematical Core for Convolution Simulator (Topic E).
 * Supports Continuous-Time (CT) fine-grid numerical integration and
 * Discrete-Time (DT) exact stem summation, safe expression parsing,
 * commutativity swapping, and analytical reference comparison.
 */

export type DomainMode = 'CT' | 'DT';

export type SignalArchetype =
  | 'rect'
  | 'tri'
  | 'step'
  | 'delta'
  | 'exp'
  | 'sin'
  | 'ramp'
  | 'sinc'
  | 'gaussian'
  | 'custom';

export interface SignalDefinition {
  type: SignalArchetype;
  amplitude: number;
  width: number; // Duration / width
  shift: number; // Time shift t0 or n0
  frequency: number; // Frequency in Hz (for sinusoid, sinc)
  decay: number; // Alpha decay rate or base 'a'
  timeScale: number; // Additional time-scale factor
  customExpr: string; // Custom math expression (for CT)
  customSamples: string; // Comma-separated samples e.g. "1, 2, 3, 2, 1" (for DT)
  customStartIndex: number; // Starting index for custom DT samples
}

export const DEFAULT_X_SIGNAL: SignalDefinition = {
  type: 'rect',
  amplitude: 1.0,
  width: 2.0,
  shift: 0.0,
  frequency: 1.0,
  decay: 1.0,
  timeScale: 1.0,
  customExpr: 'exp(-t) * (t >= 0)',
  customSamples: '1, 1, 1, 1',
  customStartIndex: 0,
};

export const DEFAULT_H_SIGNAL: SignalDefinition = {
  type: 'rect',
  amplitude: 1.0,
  width: 2.0,
  shift: 0.0,
  frequency: 1.0,
  decay: 1.0,
  timeScale: 1.0,
  customExpr: 'rect(t / 2)',
  customSamples: '1, 1, 1',
  customStartIndex: 0,
};

/**
 * Safe Math Expression Evaluator for Custom Continuous-Time functions.
 * Does NOT use `eval` or `Function`. Employs a recursive-descent tokenizer/parser.
 */
export function safeEvaluateExpr(exprStr: string, tVal: number): number {
  const sanitized = exprStr.trim();
  if (!sanitized) return 0;

  let pos = 0;
  const s = sanitized.toLowerCase();

  function peek(): string {
    while (pos < s.length && /\s/.test(s[pos])) pos++;
    return pos < s.length ? s[pos] : '';
  }

  function getChar(): string {
    while (pos < s.length && /\s/.test(s[pos])) pos++;
    return pos < s.length ? s[pos++] : '';
  }

  function parseExpression(): number {
    let result = parseLogicalOr();
    return result;
  }

  function parseLogicalOr(): number {
    let left = parseLogicalAnd();
    while (pos < s.length) {
      if (s.startsWith('||', pos)) {
        pos += 2;
        const right = parseLogicalAnd();
        left = left !== 0 || right !== 0 ? 1 : 0;
      } else {
        break;
      }
    }
    return left;
  }

  function parseLogicalAnd(): number {
    let left = parseEquality();
    while (pos < s.length) {
      if (s.startsWith('&&', pos)) {
        pos += 2;
        const right = parseEquality();
        left = left !== 0 && right !== 0 ? 1 : 0;
      } else {
        break;
      }
    }
    return left;
  }

  function parseEquality(): number {
    let left = parseRelational();
    while (pos < s.length) {
      if (s.startsWith('==', pos)) {
        pos += 2;
        left = Math.abs(left - parseRelational()) < 1e-9 ? 1 : 0;
      } else if (s.startsWith('!=', pos)) {
        pos += 2;
        left = Math.abs(left - parseRelational()) >= 1e-9 ? 1 : 0;
      } else {
        break;
      }
    }
    return left;
  }

  function parseRelational(): number {
    let left = parseAddSub();
    while (pos < s.length) {
      if (s.startsWith('<=', pos)) {
        pos += 2;
        left = left <= parseAddSub() + 1e-9 ? 1 : 0;
      } else if (s.startsWith('>=', pos)) {
        pos += 2;
        left = left >= parseAddSub() - 1e-9 ? 1 : 0;
      } else if (peek() === '<') {
        getChar();
        left = left < parseAddSub() ? 1 : 0;
      } else if (peek() === '>') {
        getChar();
        left = left > parseAddSub() ? 1 : 0;
      } else {
        break;
      }
    }
    return left;
  }

  function parseAddSub(): number {
    let left = parseMulDiv();
    while (peek() === '+' || peek() === '-') {
      const op = getChar();
      const right = parseMulDiv();
      if (op === '+') left += right;
      else left -= right;
    }
    return left;
  }

  function parseMulDiv(): number {
    let left = parsePower();
    while (peek() === '*' || peek() === '/') {
      const op = getChar();
      const right = parsePower();
      if (op === '*') left *= right;
      else left = Math.abs(right) < 1e-12 ? 0 : left / right;
    }
    return left;
  }

  function parsePower(): number {
    let base = parseFactor();
    if (peek() === '^') {
      getChar();
      const exponent = parsePower();
      base = Math.pow(base, exponent);
    }
    return base;
  }

  function parseFactor(): number {
    if (peek() === '+') {
      getChar();
      return parseFactor();
    }
    if (peek() === '-') {
      getChar();
      return -parseFactor();
    }
    if (peek() === '!') {
      getChar();
      return parseFactor() === 0 ? 1 : 0;
    }

    if (peek() === '(') {
      getChar();
      const val = parseExpression();
      if (peek() === ')') getChar();
      return val;
    }

    // Number parsing
    if (/[0-9.]/.test(peek())) {
      let numStr = '';
      while (pos < s.length && /[0-9.eE]/.test(s[pos])) {
        numStr += s[pos++];
      }
      return parseFloat(numStr) || 0;
    }

    // Identifiers: t, pi, e, sin, cos, exp, rect, step, u, tri, sinc, abs, sqrt
    if (/[a-z_]/.test(peek())) {
      let id = '';
      while (pos < s.length && /[a-z0-9_]/.test(s[pos])) {
        id += s[pos++];
      }

      if (id === 't') return tVal;
      if (id === 'pi') return Math.PI;
      if (id === 'e') return Math.E;

      // Function calls with parenthesized argument
      if (peek() === '(') {
        getChar();
        const arg = parseExpression();
        if (peek() === ')') getChar();

        switch (id) {
          case 'sin':
            return Math.sin(arg);
          case 'cos':
            return Math.cos(arg);
          case 'exp':
            return Math.exp(arg);
          case 'abs':
            return Math.abs(arg);
          case 'sqrt':
            return arg >= 0 ? Math.sqrt(arg) : 0;
          case 'log':
          case 'ln':
            return arg > 0 ? Math.log(arg) : -10;
          case 'u':
          case 'step':
            return arg >= 0 ? 1 : 0;
          case 'rect':
            return Math.abs(arg) <= 0.5 ? 1 : 0;
          case 'tri':
            return Math.abs(arg) <= 1.0 ? 1.0 - Math.abs(arg) : 0;
          case 'sinc':
            return Math.abs(arg) < 1e-9 ? 1 : Math.sin(Math.PI * arg) / (Math.PI * arg);
          default:
            return arg;
        }
      }
    }

    return 0;
  }

  try {
    const val = parseExpression();
    return isFinite(val) ? val : 0;
  } catch {
    return 0;
  }
}

/**
 * Evaluates CT Signal value at specific time t
 */
export function evalContinuousSignal(def: SignalDefinition, t: number): number {
  const scale = Math.max(1e-4, Math.abs(def.timeScale));
  const effT = (t - def.shift) * scale;
  const A = def.amplitude;
  const W = Math.max(1e-4, def.width);

  switch (def.type) {
    case 'rect':
      return Math.abs(effT) <= W / 2 ? A : 0;

    case 'tri':
      return Math.abs(effT) <= W ? A * (1.0 - Math.abs(effT) / W) : 0;

    case 'step':
      return effT >= 0 ? A : 0;

    case 'delta': {
      // Numerical Dirac delta approximation with unit area
      const eps = 0.12;
      return Math.abs(effT) <= eps / 2 ? A / eps : 0;
    }

    case 'exp': {
      const a = Math.max(0.01, def.decay);
      return effT >= 0 ? A * Math.exp(-a * effT) : 0;
    }

    case 'sin': {
      const f = def.frequency;
      return Math.abs(effT) <= W / 2 ? A * Math.cos(2 * Math.PI * f * effT) : 0;
    }

    case 'ramp':
      return effT >= 0 && effT <= W ? A * (effT / W) : effT > W ? A : 0;

    case 'sinc': {
      const f = def.frequency || 1.0;
      const arg = Math.PI * f * effT;
      return Math.abs(arg) < 1e-6 ? A : A * (Math.sin(arg) / arg);
    }

    case 'gaussian': {
      const sigma = W / 2.5;
      return A * Math.exp(-(effT * effT) / (2 * sigma * sigma));
    }

    case 'custom':
      return A * safeEvaluateExpr(def.customExpr, effT);

    default:
      return 0;
  }
}

/**
 * Evaluates DT Signal value at integer sample index n
 */
export function evalDiscreteSignal(def: SignalDefinition, n: number): number {
  const nShifted = n - Math.round(def.shift);
  const A = def.amplitude;
  const halfW = Math.floor(Math.max(1, Math.round(def.width)) / 2);

  switch (def.type) {
    case 'rect':
      return Math.abs(nShifted) <= halfW ? A : 0;

    case 'tri': {
      const denom = Math.max(1, halfW);
      return Math.abs(nShifted) <= denom ? A * (1.0 - Math.abs(nShifted) / (denom + 1)) : 0;
    }

    case 'step':
      return nShifted >= 0 ? A : 0;

    case 'delta':
      return nShifted === 0 ? A : 0;

    case 'exp': {
      const a = Math.max(-0.99, Math.min(0.99, def.decay));
      return nShifted >= 0 ? A * Math.pow(a, nShifted) : 0;
    }

    case 'sin': {
      const f = def.frequency;
      return Math.abs(nShifted) <= halfW ? A * Math.cos(2 * Math.PI * f * nShifted) : 0;
    }

    case 'ramp': {
      const W = Math.max(1, Math.round(def.width));
      return nShifted >= 0 && nShifted <= W ? A * (nShifted / W) : 0;
    }

    case 'custom': {
      const parsed = def.customSamples
        .split(',')
        .map((s) => parseFloat(s.trim()))
        .filter((v) => !isNaN(v));
      const relIdx = n - def.customStartIndex;
      return relIdx >= 0 && relIdx < parsed.length ? A * parsed[relIdx] : 0;
    }

    default:
      return Math.abs(nShifted) <= halfW ? A : 0;
  }
}

/**
 * Precomputes full convolution results across grid
 */
export interface ConvolutionGridResult {
  tValues: number[];
  xValues: number[];
  hValues: number[];
  yValues: number[];
  startShift: number;
  endShift: number;
  dt: number;
  totalEnergy: number;
  peakValue: number;
  peakShift: number;
}

export function computeFullContinuousConvolution(
  xDef: SignalDefinition,
  hDef: SignalDefinition,
  flipTarget: 'h' | 'x' = 'h',
  tRange = { min: -6, max: 6, dt: 0.04 }
): ConvolutionGridResult {
  const { min, max, dt } = tRange;
  const numSteps = Math.round((max - min) / dt) + 1;

  const tValues: number[] = new Array(numSteps);
  const xValues: number[] = new Array(numSteps);
  const hValues: number[] = new Array(numSteps);
  const yValues: number[] = new Array(numSteps);

  // Pre-sample stationary signals
  for (let i = 0; i < numSteps; i++) {
    const t = min + i * dt;
    tValues[i] = t;
    xValues[i] = evalContinuousSignal(xDef, t);
    hValues[i] = evalContinuousSignal(hDef, t);
  }

  // Numerical convolution grid: integration span for tau [-10, 10]
  const tauMin = min - 3;
  const tauMax = max + 3;
  const dTau = 0.03;
  const tauCount = Math.round((tauMax - tauMin) / dTau) + 1;

  let peakVal = 0;
  let peakT = 0;
  let energySum = 0;

  for (let i = 0; i < numSteps; i++) {
    const tShift = tValues[i];
    let integral = 0;

    for (let k = 0; k < tauCount; k++) {
      const tau = tauMin + k * dTau;
      let valX = 0;
      let valH = 0;

      if (flipTarget === 'h') {
        // x(tau) * h(t - tau)
        valX = evalContinuousSignal(xDef, tau);
        valH = evalContinuousSignal(hDef, tShift - tau);
      } else {
        // h(tau) * x(t - tau)
        valH = evalContinuousSignal(hDef, tau);
        valX = evalContinuousSignal(xDef, tShift - tau);
      }

      const prod = valX * valH;
      integral += prod * dTau;
    }

    yValues[i] = integral;
    energySum += integral * integral * dt;
    if (Math.abs(integral) > Math.abs(peakVal)) {
      peakVal = integral;
      peakT = tShift;
    }
  }

  return {
    tValues,
    xValues,
    hValues,
    yValues,
    startShift: min,
    endShift: max,
    dt,
    totalEnergy: energySum,
    peakValue: peakVal,
    peakShift: peakT,
  };
}

export interface DiscreteStepResult {
  nShift: number;
  kIndices: number[];
  xSamples: number[];
  hFlippedSamples: number[];
  productStems: number[];
  termsText: string;
  sum: number;
}

export function computeDiscreteConvolution(
  xDef: SignalDefinition,
  hDef: SignalDefinition,
  flipTarget: 'h' | 'x' = 'h',
  nRange = { min: -10, max: 10 }
): {
  nValues: number[];
  xValues: number[];
  hValues: number[];
  yValues: number[];
  stepDetails: Map<number, DiscreteStepResult>;
  totalEnergy: number;
  peakValue: number;
  peakShift: number;
} {
  const { min, max } = nRange;
  const count = max - min + 1;

  const nValues: number[] = new Array(count);
  const xValues: number[] = new Array(count);
  const hValues: number[] = new Array(count);
  const yValues: number[] = new Array(count);
  const stepDetails = new Map<number, DiscreteStepResult>();

  for (let i = 0; i < count; i++) {
    const n = min + i;
    nValues[i] = n;
    xValues[i] = evalDiscreteSignal(xDef, n);
    hValues[i] = evalDiscreteSignal(hDef, n);
  }

  // Summation span over k: [-15, 15]
  const kMin = min - 5;
  const kMax = max + 5;
  const kIndices: number[] = [];
  for (let k = kMin; k <= kMax; k++) kIndices.push(k);

  let peakVal = 0;
  let peakN = 0;
  let energySum = 0;

  for (let i = 0; i < count; i++) {
    const nShift = nValues[i];
    let sum = 0;
    const xSamples: number[] = [];
    const hFlippedSamples: number[] = [];
    const productStems: number[] = [];
    const activeTerms: string[] = [];

    for (const k of kIndices) {
      let xK = 0;
      let hShifted = 0;

      if (flipTarget === 'h') {
        xK = evalDiscreteSignal(xDef, k);
        hShifted = evalDiscreteSignal(hDef, nShift - k);
      } else {
        hShifted = evalDiscreteSignal(hDef, k);
        xK = evalDiscreteSignal(xDef, nShift - k);
      }

      const prod = xK * hShifted;
      sum += prod;

      xSamples.push(xK);
      hFlippedSamples.push(hShifted);
      productStems.push(prod);

      if (Math.abs(prod) > 1e-4) {
        activeTerms.push(`(${xK.toFixed(2)} · ${hShifted.toFixed(2)})`);
      }
    }

    yValues[i] = sum;
    energySum += sum * sum;
    if (Math.abs(sum) > Math.abs(peakVal)) {
      peakVal = sum;
      peakN = nShift;
    }

    let termsText = activeTerms.join(' + ');
    if (!termsText) termsText = '0 (no overlapping non-zero samples)';

    stepDetails.set(nShift, {
      nShift,
      kIndices,
      xSamples,
      hFlippedSamples,
      productStems,
      termsText,
      sum,
    });
  }

  return {
    nValues,
    xValues,
    hValues,
    yValues,
    stepDetails,
    totalEnergy: energySum,
    peakValue: peakVal,
    peakShift: peakN,
  };
}

/**
 * Curated Preset Configurations
 */
export interface ConvolutionPreset {
  id: string;
  name: string;
  description: string;
  domain: DomainMode;
  x: SignalDefinition;
  h: SignalDefinition;
}

export const CONVOLUTION_PRESETS: ConvolutionPreset[] = [
  {
    id: 'rect_rect_triangle',
    name: 'Rect * Rect = Triangle',
    description: 'Convolution of two identical rectangular pulses yields a symmetric triangular response.',
    domain: 'CT',
    x: { ...DEFAULT_X_SIGNAL, type: 'rect', amplitude: 1.0, width: 2.0, shift: 0.0 },
    h: { ...DEFAULT_H_SIGNAL, type: 'rect', amplitude: 1.0, width: 2.0, shift: 0.0 },
  },
  {
    id: 'exp_step_saturation',
    name: 'Exp * Step (Charging Capacitor)',
    description: 'First-order system impulse response e^(-at)u(t) driven by unit step input.',
    domain: 'CT',
    x: { ...DEFAULT_X_SIGNAL, type: 'step', amplitude: 1.0, shift: 0.0 },
    h: { ...DEFAULT_H_SIGNAL, type: 'exp', amplitude: 1.5, decay: 1.2, shift: 0.0 },
  },
  {
    id: 'moving_average',
    name: 'Moving Average Filter (DT)',
    description: 'Noisy signal smoothed by an unweighted moving average filter h[n] = [1, 1, 1, 1]/4.',
    domain: 'DT',
    x: {
      ...DEFAULT_X_SIGNAL,
      type: 'custom',
      amplitude: 1.0,
      customSamples: '1, 2, 4, 3, 5, 2, 1, 0',
      customStartIndex: 0,
    },
    h: {
      ...DEFAULT_H_SIGNAL,
      type: 'custom',
      amplitude: 0.25,
      customSamples: '1, 1, 1, 1',
      customStartIndex: 0,
    },
  },
  {
    id: 'impulse_response_demo',
    name: 'Impulse Response Identity (x * δ = x)',
    description: 'Convolving any arbitrary signal with the Dirac/Kronecker delta reproduces the exact original signal.',
    domain: 'DT',
    x: {
      ...DEFAULT_X_SIGNAL,
      type: 'custom',
      amplitude: 1.0,
      customSamples: '1, 3, 2, -1, 2',
      customStartIndex: -1,
    },
    h: { ...DEFAULT_H_SIGNAL, type: 'delta', amplitude: 1.0, shift: 0.0 },
  },
  {
    id: 'echo_delta_train',
    name: 'Echo (Delta Train Multipath)',
    description: 'Multipath acoustic delay network: h[n] = δ[n] + 0.6·δ[n-3] + 0.3·δ[n-6].',
    domain: 'DT',
    x: {
      ...DEFAULT_X_SIGNAL,
      type: 'custom',
      amplitude: 1.0,
      customSamples: '2, 3, 1',
      customStartIndex: 0,
    },
    h: {
      ...DEFAULT_H_SIGNAL,
      type: 'custom',
      amplitude: 1.0,
      customSamples: '1, 0, 0, 0.6, 0, 0, 0.3',
      customStartIndex: 0,
    },
  },
];
