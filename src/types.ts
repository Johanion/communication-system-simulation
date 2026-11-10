/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type {
  TransformResult,
  Complex,
  WindingState,
} from './math/fourier';

export type ActiveTab = 'analyzer' | 'animator' | 'explain';

export type SignalPreset =
  | 'pure-tone'
  | 'two-tones'
  | 'square-wave'
  | 'sawtooth-wave'
  | 'noisy-signal'
  | 'aliasing-demo'
  | 'sine'
  | 'multi-tone'
  | 'square'
  | 'sawtooth'
  | 'pulse'
  | 'chirp'
  | 'damped';

export type SignalType = 'sine' | 'multi-tone' | 'square' | 'sawtooth';

export type WindowFunction = 'rectangular' | 'hann' | 'hamming' | 'blackman';

export type AlgorithmMode = 'fft' | 'dft' | 'both';

export type MagnitudeScale = 'linear' | 'normalized' | 'db';

export interface MultiToneComponent {
  id: string;
  frequency: number; // in Hz
  amplitude: number; // 0 to 2.5
  phaseDeg: number;  // 0 to 360 degrees
}

export interface SignalConfig {
  preset: SignalPreset;
  signalType: SignalType;
  sampleCount: number; // N: 64, 128, 256, 512, 1024
  sampleRate: number;  // fs in Hz: 20 to 2000 Hz
  f1: number;
  a1: number;
  phase1Deg: number;
  f2: number;
  a2: number;
  f3: number;
  a3: number;
  tones: MultiToneComponent[];
  noiseLevel: number; // 0 to 1.0
  windowType: WindowFunction;
  algorithm: AlgorithmMode;
  scale: MagnitudeScale;
  showPhase: boolean;
  showIDFT: boolean;
  pulseWidth: number;
}

export type TopicModuleId =
  | 'signals_ops'
  | 'eulers_identity'
  | 'fourier_series'
  | 'fourier_transform'
  | 'convolution'
  | 'random_variables'
  | 'random_processes';

export interface TopicModuleMeta {
  id: TopicModuleId;
  code: string;
  title: string;
  subtitle: string;
  description: string;
}

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type?: 'success' | 'info' | 'warning';
}

export interface AlgorithmBenchmark {
  dftTimeMs: number;
  fftTimeMs: number;
  speedup: number;
  sampleCount: number;
}
