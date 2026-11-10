/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type DistributionType =
  | 'gaussian'
  | 'uniform'
  | 'bernoulli'
  | 'poisson'
  | 'exponential'
  | 'rayleigh'
  | 'binomial'
  | 'geometric';

export interface DistributionParams {
  // Gaussian (AWGN)
  gaussianMean: number;
  gaussianStd: number;

  // Uniform
  uniformMin: number;
  uniformMax: number;
  uniformIsDiscrete: boolean;

  // Bernoulli (Binary bit error)
  bernoulliP: number;

  // Poisson (Packet arrivals)
  poissonLambda: number;

  // Exponential (Inter-arrival / service time)
  exponentialLambda: number;

  // Rayleigh (Wireless Multipath NLOS Channel Envelope)
  rayleighSigma: number;

  // Binomial (Block code bit errors over N trials)
  binomialN: number;
  binomialP: number;

  // Geometric (ARQ retransmissions until first successful ACK)
  geometricP: number;
}

export const DEFAULT_PARAMS: DistributionParams = {
  gaussianMean: 0,
  gaussianStd: 1.0,

  uniformMin: -2,
  uniformMax: 2,
  uniformIsDiscrete: false,

  bernoulliP: 0.15,

  poissonLambda: 3.5,

  exponentialLambda: 1.0,

  rayleighSigma: 1.0,

  binomialN: 10,
  binomialP: 0.2,

  geometricP: 0.35,
};

export interface DistributionMeta {
  id: DistributionType;
  name: string;
  category: 'Continuous' | 'Discrete';
  tag: string;
  description: string;
  commsRelevance: string;
  formula: {
    mean: string;
    variance: string;
    densityOrMass: string;
    cdf: string;
  };
}

export const DISTRIBUTIONS_META: Record<DistributionType, DistributionMeta> = {
  gaussian: {
    id: 'gaussian',
    name: 'Gaussian (AWGN / Normal)',
    category: 'Continuous',
    tag: 'Receiver Thermal Noise',
    description: 'Fundamental bell curve of Additive White Gaussian Noise (AWGN), central limit theorem.',
    commsRelevance: 'Receiver front-end thermal noise (Johnson-Nyquist kTB), I/Q channel perturbation, SNR estimation.',
    formula: {
      mean: 'μ',
      variance: 'σ²',
      densityOrMass: 'f(x) = (1 / (σ√(2π))) · e^(-(x-μ)² / 2σ²)',
      cdf: 'F(x) = 1/2 · [1 + erf((x-μ) / (σ√2))]',
    },
  },
  uniform: {
    id: 'uniform',
    name: 'Uniform',
    category: 'Continuous', // Can toggle discrete
    tag: 'ADC Roundoff Error',
    description: 'Equally likely probability across all values within interval [a, b].',
    commsRelevance: 'Ideal analog-to-digital converter (ADC) quantization noise with step size Δ = b - a (σ² = Δ²/12).',
    formula: {
      mean: '(a + b) / 2',
      variance: '(b - a)² / 12',
      densityOrMass: 'f(x) = 1 / (b - a) for x ∈ [a, b]',
      cdf: 'F(x) = (x - a) / (b - a)',
    },
  },
  rayleigh: {
    id: 'rayleigh',
    name: 'Rayleigh Fading',
    category: 'Continuous',
    tag: 'NLOS Multipath Envelope',
    description: 'Envelope of two independent orthogonal zero-mean Gaussian channels: R = √(X² + Y²).',
    commsRelevance: 'Non-Line-Of-Sight (NLOS) wireless channel fading envelope in cellular and Wi-Fi propagation.',
    formula: {
      mean: 'σ · √(π / 2) ≈ 1.2533 σ',
      variance: '(2 - π/2) · σ² ≈ 0.4292 σ²',
      densityOrMass: 'f(r) = (r / σ²) · e^(-r² / 2σ²)  (r ≥ 0)',
      cdf: 'F(r) = 1 - e^(-r² / 2σ²)',
    },
  },
  exponential: {
    id: 'exponential',
    name: 'Exponential',
    category: 'Continuous',
    tag: 'Packet Waiting Times',
    description: 'Models continuous time or distance between independent Poisson events with constant rate λ.',
    commsRelevance: 'Packet inter-arrival waiting times in network buffers and message transmission burst durations.',
    formula: {
      mean: '1 / λ',
      variance: '1 / λ²',
      densityOrMass: 'f(x) = λ · e^(-λx) for x ≥ 0',
      cdf: 'F(x) = 1 - e^(-λx)',
    },
  },
  bernoulli: {
    id: 'bernoulli',
    name: 'Bernoulli',
    category: 'Discrete',
    tag: 'BSC Bit Error Rate',
    description: 'Single-trial binary outcome with success probability p (X=1) and failure 1-p (X=0).',
    commsRelevance: 'Single transmitted bit decision and crossover probability in Binary Symmetric Channels (BSC).',
    formula: {
      mean: 'p',
      variance: 'p(1 - p)',
      densityOrMass: 'P(X=1) = p,  P(X=0) = 1 - p',
      cdf: 'F(x) = 0 (x<0), 1-p (0≤x<1), 1 (x≥1)',
    },
  },
  binomial: {
    id: 'binomial',
    name: 'Binomial',
    category: 'Discrete',
    tag: 'Packet Frame Errors',
    description: 'Number of bit errors k observed across n independent transmitted bits with bit error probability p.',
    commsRelevance: 'Block coding error detection (BCH, Reed-Solomon) and packet error rate (PER = 1 - (1-p)ⁿ).',
    formula: {
      mean: 'n · p',
      variance: 'n · p · (1 - p)',
      densityOrMass: 'P(X=k) = C(n, k) · pᵏ · (1-p)ⁿ⁻ᵏ',
      cdf: 'F(k) = Σ C(n, i) · pⁱ · (1-p)ⁿ⁻ⁱ',
    },
  },
  poisson: {
    id: 'poisson',
    name: 'Poisson',
    category: 'Discrete',
    tag: 'Router Queue Arrivals',
    description: 'Counts the number of independent event arrivals in fixed time duration T with average rate λ.',
    commsRelevance: 'M/M/1 queuing packet traffic arrivals at telecommunication switches and router interfaces.',
    formula: {
      mean: 'λ',
      variance: 'λ',
      densityOrMass: 'P(X=k) = (λᵏ · e^(-λ)) / k!',
      cdf: 'F(k) = Σ (λⁱ · e^(-λ)) / i!',
    },
  },
  geometric: {
    id: 'geometric',
    name: 'Geometric',
    category: 'Discrete',
    tag: 'ARQ Retransmissions',
    description: 'Number of transmission attempts k until the first successful acknowledgment (ACK) is received.',
    commsRelevance: 'Automatic Repeat reQuest (ARQ) retransmission overhead in TCP and Stop-and-Wait protocols.',
    formula: {
      mean: '1 / p',
      variance: '(1 - p) / p²',
      densityOrMass: 'P(X=k) = (1 - p)ᵏ⁻¹ · p  (k = 1, 2, ...)',
      cdf: 'F(k) = 1 - (1 - p)ᵏ',
    },
  },
};

/**
 * High-precision approximation for the Gaussian error function erf(z)
 * Abramowitz and Stegun formula 7.1.26 (max error: 1.5e-7)
 */
export function erf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z);

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return sign * y;
}

/**
 * Helper to compute combination C(n, k)
 */
export function combinations(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  const c = Math.min(k, n - k);
  let result = 1;
  for (let i = 1; i <= c; i++) {
    result = (result * (n - i + 1)) / i;
  }
  return result;
}

/**
 * Generate a single random sample given distribution settings
 */
export function generateSingleSample(type: DistributionType, params: DistributionParams): number {
  const u1 = Math.max(1e-12, Math.random());
  const u2 = Math.max(1e-12, Math.random());

  switch (type) {
    case 'gaussian': {
      // Box-Muller transform
      const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
      return params.gaussianMean + params.gaussianStd * z0;
    }

    case 'uniform': {
      const min = Math.min(params.uniformMin, params.uniformMax);
      const max = Math.max(params.uniformMin, params.uniformMax);
      if (params.uniformIsDiscrete) {
        const span = Math.floor(max) - Math.ceil(min) + 1;
        return Math.ceil(min) + Math.floor(Math.random() * span);
      }
      return min + (max - min) * u1;
    }

    case 'rayleigh': {
      // Inversion method: R = σ * sqrt(-2 * ln(u1))
      const sigma = Math.max(0.01, params.rayleighSigma);
      return sigma * Math.sqrt(-2.0 * Math.log(u1));
    }

    case 'exponential': {
      const lambda = Math.max(1e-6, params.exponentialLambda);
      return -Math.log(u1) / lambda;
    }

    case 'bernoulli': {
      return u1 < params.bernoulliP ? 1 : 0;
    }

    case 'binomial': {
      const n = Math.max(1, Math.min(100, Math.round(params.binomialN)));
      const p = Math.max(0, Math.min(1, params.binomialP));
      let successes = 0;
      for (let i = 0; i < n; i++) {
        if (Math.random() < p) successes++;
      }
      return successes;
    }

    case 'poisson': {
      const lambda = Math.max(0.01, params.poissonLambda);
      if (lambda < 30) {
        // Knuth's algorithm for moderate lambda
        const L = Math.exp(-lambda);
        let k = 0;
        let p = 1.0;
        do {
          k++;
          p *= Math.random();
        } while (p > L);
        return k - 1;
      } else {
        // Gaussian approximation for large lambda
        const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * z0));
      }
    }

    case 'geometric': {
      const p = Math.max(0.001, Math.min(0.999, params.geometricP));
      // Inversion method for geometric distribution (k = 1, 2, ...): k = ceil(ln(u1) / ln(1-p))
      return Math.max(1, Math.ceil(Math.log(u1) / Math.log(1 - p)));
    }
  }
}

/**
 * Generate an array of N random samples
 */
export function generateSamples(
  type: DistributionType,
  params: DistributionParams,
  count: number
): number[] {
  const samples = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    samples[i] = generateSingleSample(type, params);
  }
  return Array.from(samples);
}

/**
 * Determine whether the current configuration produces discrete or continuous variables
 */
export function isDiscreteDistribution(type: DistributionType, params: DistributionParams): boolean {
  if (type === 'bernoulli' || type === 'poisson' || type === 'binomial' || type === 'geometric') return true;
  if (type === 'uniform' && params.uniformIsDiscrete) return true;
  return false;
}

/**
 * Calculate Theoretical Mean and Variance
 */
export function getTheoreticalStats(
  type: DistributionType,
  params: DistributionParams
): { mean: number; variance: number; std: number } {
  switch (type) {
    case 'gaussian': {
      const mean = params.gaussianMean;
      const variance = params.gaussianStd ** 2;
      return { mean, variance, std: params.gaussianStd };
    }
    case 'uniform': {
      const a = Math.min(params.uniformMin, params.uniformMax);
      const b = Math.max(params.uniformMin, params.uniformMax);
      if (params.uniformIsDiscrete) {
        const N = Math.floor(b) - Math.ceil(a) + 1;
        const mean = (a + b) / 2;
        const variance = (N ** 2 - 1) / 12;
        return { mean, variance, std: Math.sqrt(variance) };
      } else {
        const mean = (a + b) / 2;
        const variance = (b - a) ** 2 / 12;
        return { mean, variance, std: Math.sqrt(variance) };
      }
    }
    case 'rayleigh': {
      const sigma = Math.max(0.01, params.rayleighSigma);
      const mean = sigma * Math.sqrt(Math.PI / 2);
      const variance = (2 - Math.PI / 2) * (sigma ** 2);
      return { mean, variance, std: Math.sqrt(variance) };
    }
    case 'exponential': {
      const lambda = Math.max(1e-6, params.exponentialLambda);
      const mean = 1 / lambda;
      const variance = 1 / (lambda ** 2);
      return { mean, variance, std: 1 / lambda };
    }
    case 'bernoulli': {
      const p = params.bernoulliP;
      const mean = p;
      const variance = p * (1 - p);
      return { mean, variance, std: Math.sqrt(variance) };
    }
    case 'binomial': {
      const n = Math.max(1, Math.round(params.binomialN));
      const p = params.binomialP;
      const mean = n * p;
      const variance = n * p * (1 - p);
      return { mean, variance, std: Math.sqrt(variance) };
    }
    case 'poisson': {
      const lambda = params.poissonLambda;
      return { mean: lambda, variance: lambda, std: Math.sqrt(lambda) };
    }
    case 'geometric': {
      const p = Math.max(0.001, params.geometricP);
      const mean = 1 / p;
      const variance = (1 - p) / (p ** 2);
      return { mean, variance, std: Math.sqrt(variance) };
    }
  }
}

/**
 * Calculate Sample Statistics: Mean, Variance, Std, Min, Max, Median
 */
export function calculateSampleStats(samples: number[]): {
  mean: number;
  variance: number;
  std: number;
  min: number;
  max: number;
  median: number;
} {
  const n = samples.length;
  if (n === 0) {
    return { mean: 0, variance: 0, std: 0, min: 0, max: 0, median: 0 };
  }

  let sum = 0;
  let min = samples[0];
  let max = samples[0];

  for (let i = 0; i < n; i++) {
    const val = samples[i];
    sum += val;
    if (val < min) min = val;
    if (val > max) max = val;
  }

  const mean = sum / n;

  let sumSqDiff = 0;
  for (let i = 0; i < n; i++) {
    const diff = samples[i] - mean;
    sumSqDiff += diff * diff;
  }

  // Sample variance with Bessel's correction (n - 1) for unbiased estimator if n > 1
  const variance = n > 1 ? sumSqDiff / (n - 1) : 0;
  const std = Math.sqrt(variance);

  // Median calculation (using sorted copy)
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(n / 2);
  const median = n % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  return { mean, variance, std, min, max, median };
}

/**
 * Discrete PMF & CDF Analysis
 */
export interface DiscretePMFEntry {
  k: number;
  label: string;
  count: number;
  empiricalProb: number;
  theoreticalProb: number;
  deltaProb: number;
  empiricalCDF: number;
  theoreticalCDF: number;
}

export function computeDiscretePMF(
  samples: number[],
  type: DistributionType,
  params: DistributionParams
): DiscretePMFEntry[] {
  const n = samples.length;
  if (n === 0) return [];

  // Determine possible discrete outcomes
  const countsMap = new Map<number, number>();
  for (const s of samples) {
    countsMap.set(s, (countsMap.get(s) || 0) + 1);
  }

  let outcomeKeys: number[] = [];
  if (type === 'bernoulli') {
    outcomeKeys = [0, 1];
  } else if (type === 'binomial') {
    const n = Math.max(1, Math.round(params.binomialN));
    outcomeKeys = Array.from({ length: n + 1 }, (_, i) => i);
  } else if (type === 'geometric') {
    const maxSample = Math.max(...samples, 10);
    const limit = Math.max(8, Math.min(maxSample + 2, 24));
    outcomeKeys = Array.from({ length: limit }, (_, i) => i + 1);
  } else if (type === 'poisson') {
    const maxSample = Math.max(...samples, Math.ceil(params.poissonLambda + 4 * Math.sqrt(params.poissonLambda)));
    const limit = Math.max(8, Math.min(maxSample + 2, 25));
    outcomeKeys = Array.from({ length: limit }, (_, i) => i);
  } else if (type === 'uniform') {
    const a = Math.ceil(Math.min(params.uniformMin, params.uniformMax));
    const b = Math.floor(Math.max(params.uniformMin, params.uniformMax));
    outcomeKeys = Array.from({ length: b - a + 1 }, (_, i) => a + i);
  } else {
    outcomeKeys = Array.from(countsMap.keys()).sort((a, b) => a - b);
  }

  const entries: DiscretePMFEntry[] = [];
  let cumEmpirical = 0;
  let cumTheo = 0;

  // Theoretical probability functions
  const getTheoProb = (k: number): number => {
    if (type === 'bernoulli') {
      if (k === 1) return params.bernoulliP;
      if (k === 0) return 1 - params.bernoulliP;
      return 0;
    }
    if (type === 'binomial') {
      const n = Math.max(1, Math.round(params.binomialN));
      const p = Math.max(0, Math.min(1, params.binomialP));
      if (k < 0 || k > n) return 0;
      return combinations(n, k) * (p ** k) * ((1 - p) ** (n - k));
    }
    if (type === 'geometric') {
      const p = Math.max(0.001, Math.min(0.999, params.geometricP));
      if (k < 1) return 0;
      return ((1 - p) ** (k - 1)) * p;
    }
    if (type === 'poisson') {
      if (k < 0) return 0;
      const lambda = params.poissonLambda;
      // Use log space to prevent overflow for large k: e^(k*ln(lambda) - lambda - ln(k!))
      let logFact = 0;
      for (let i = 2; i <= k; i++) logFact += Math.log(i);
      const logProb = k * Math.log(lambda) - lambda - logFact;
      return Math.exp(logProb);
    }
    if (type === 'uniform') {
      const a = Math.ceil(Math.min(params.uniformMin, params.uniformMax));
      const b = Math.floor(Math.max(params.uniformMin, params.uniformMax));
      const span = b - a + 1;
      return k >= a && k <= b ? 1 / span : 0;
    }
    return 0;
  };

  for (const k of outcomeKeys) {
    const count = countsMap.get(k) || 0;
    const empiricalProb = count / n;
    const theoProb = getTheoProb(k);

    cumEmpirical += empiricalProb;
    cumTheo += theoProb;

    entries.push({
      k,
      label: `k = ${k}`,
      count,
      empiricalProb,
      theoreticalProb: theoProb,
      deltaProb: Math.abs(empiricalProb - theoProb),
      empiricalCDF: Math.min(1.0, cumEmpirical),
      theoreticalCDF: Math.min(1.0, cumTheo),
    });
  }

  return entries;
}

/**
 * Continuous PDF & CDF Analysis (Binned Histogram + Kernel Density Estimate + CDF)
 */
export interface ContinuousPDFEntry {
  binIndex: number;
  xStart: number;
  xEnd: number;
  xMid: number;
  count: number;
  empiricalDensity: number;
  theoreticalDensity: number;
  empiricalCDF: number;
  theoreticalCDF: number;
}

export function computeContinuousPDF(
  samples: number[],
  type: DistributionType,
  params: DistributionParams,
  binCount = 30
): {
  bins: ContinuousPDFEntry[];
  rangeMin: number;
  rangeMax: number;
  binWidth: number;
  maxDensity: number;
} {
  const n = samples.length;
  if (n === 0) {
    return { bins: [], rangeMin: -3, rangeMax: 3, binWidth: 0.2, maxDensity: 1 };
  }

  // Determine span
  let rangeMin = 0;
  let rangeMax = 1;

  if (type === 'gaussian') {
    const mu = params.gaussianMean;
    const sigma = params.gaussianStd;
    rangeMin = mu - 3.8 * sigma;
    rangeMax = mu + 3.8 * sigma;
  } else if (type === 'rayleigh') {
    const sigma = Math.max(0.01, params.rayleighSigma);
    rangeMin = 0;
    rangeMax = Math.max(3.0, sigma * 4.2);
  } else if (type === 'exponential') {
    const lambda = params.exponentialLambda;
    rangeMin = 0;
    rangeMax = Math.max(4.0, (1 / lambda) * 4.5);
  } else if (type === 'uniform') {
    const a = Math.min(params.uniformMin, params.uniformMax);
    const b = Math.max(params.uniformMin, params.uniformMax);
    const margin = (b - a) * 0.15;
    rangeMin = a - margin;
    rangeMax = b + margin;
  } else {
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    rangeMin = min - 0.5;
    rangeMax = max + 0.5;
  }

  const binWidth = (rangeMax - rangeMin) / binCount;
  const counts = new Array<number>(binCount).fill(0);

  for (const s of samples) {
    if (s >= rangeMin && s <= rangeMax) {
      const idx = Math.min(binCount - 1, Math.max(0, Math.floor((s - rangeMin) / binWidth)));
      counts[idx]++;
    }
  }

  // Theoretical PDF and CDF functions
  const getTheoreticalPDF = (x: number): number => {
    if (type === 'gaussian') {
      const mu = params.gaussianMean;
      const sigma = params.gaussianStd;
      return (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * (((x - mu) / sigma) ** 2));
    }
    if (type === 'rayleigh') {
      const sigma = Math.max(0.01, params.rayleighSigma);
      if (x < 0) return 0;
      return (x / (sigma ** 2)) * Math.exp(-(x ** 2) / (2 * (sigma ** 2)));
    }
    if (type === 'exponential') {
      const lambda = params.exponentialLambda;
      return x >= 0 ? lambda * Math.exp(-lambda * x) : 0;
    }
    if (type === 'uniform') {
      const a = Math.min(params.uniformMin, params.uniformMax);
      const b = Math.max(params.uniformMin, params.uniformMax);
      return x >= a && x <= b ? 1 / (b - a) : 0;
    }
    return 0;
  };

  const getTheoreticalCDF = (x: number): number => {
    if (type === 'gaussian') {
      const mu = params.gaussianMean;
      const sigma = params.gaussianStd;
      return 0.5 * (1 + erf((x - mu) / (sigma * Math.sqrt(2))));
    }
    if (type === 'rayleigh') {
      const sigma = Math.max(0.01, params.rayleighSigma);
      if (x < 0) return 0;
      return 1 - Math.exp(-(x ** 2) / (2 * (sigma ** 2)));
    }
    if (type === 'exponential') {
      const lambda = params.exponentialLambda;
      return x >= 0 ? 1 - Math.exp(-lambda * x) : 0;
    }
    if (type === 'uniform') {
      const a = Math.min(params.uniformMin, params.uniformMax);
      const b = Math.max(params.uniformMin, params.uniformMax);
      if (x < a) return 0;
      if (x > b) return 1;
      return (x - a) / (b - a);
    }
    return 0;
  };

  const bins: ContinuousPDFEntry[] = [];
  let cumCount = 0;

  for (let i = 0; i < binCount; i++) {
    const xStart = rangeMin + i * binWidth;
    const xEnd = xStart + binWidth;
    const xMid = xStart + binWidth / 2;
    const count = counts[i];
    cumCount += count;

    // Density = count / (N * binWidth)
    const empiricalDensity = count / (n * binWidth);
    const theoreticalDensity = getTheoreticalPDF(xMid);
    const empiricalCDF = cumCount / n;
    const theoreticalCDF = getTheoreticalCDF(xEnd);

    bins.push({
      binIndex: i,
      xStart,
      xEnd,
      xMid,
      count,
      empiricalDensity,
      theoreticalDensity,
      empiricalCDF,
      theoreticalCDF,
    });
  }

  const maxDensity = Math.max(
    ...bins.map((b) => Math.max(b.empiricalDensity, b.theoreticalDensity)),
    0.2
  );

  return { bins, rangeMin, rangeMax, binWidth, maxDensity };
}
