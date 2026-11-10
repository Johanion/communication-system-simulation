import { test } from 'node:test';
import assert from 'node:assert';
import {
  computeFullContinuousConvolution,
  computeDiscreteConvolution,
  DEFAULT_X_SIGNAL,
  DEFAULT_H_SIGNAL,
} from './convolution';

test('Continuous convolution of two rect pulses produces triangular peak', () => {
  const result = computeFullContinuousConvolution(
    { ...DEFAULT_X_SIGNAL, type: 'rect', width: 2, amplitude: 1 },
    { ...DEFAULT_H_SIGNAL, type: 'rect', width: 2, amplitude: 1 },
    'h',
    { min: -4, max: 4, dt: 0.05 }
  );

  assert.ok(result.peakValue > 1.8 && result.peakValue <= 2.1, `Expected peak ~2.0, got ${result.peakValue}`);
  assert.ok(Math.abs(result.peakShift) < 0.2, `Expected peak near t=0, got ${result.peakShift}`);
});

test('Discrete convolution of [1, 1, 1] with [1, 1, 1] yields peak 3 at n=0', () => {
  const result = computeDiscreteConvolution(
    { ...DEFAULT_X_SIGNAL, type: 'custom', customSamples: '1, 1, 1', customStartIndex: -1 },
    { ...DEFAULT_H_SIGNAL, type: 'custom', customSamples: '1, 1, 1', customStartIndex: -1 },
    'h',
    { min: -5, max: 5 }
  );

  assert.strictEqual(result.peakValue, 3);
  assert.strictEqual(result.peakShift, 0);
});
