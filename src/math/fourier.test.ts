import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDFT,
  computeFFTRadix2,
  computeIDFT,
  computeWindingPhasor,
  discreteConvolve,
  synthesizeFourierSeries,
  generateSignal,
} from './fourier';

test('DFT detects single sine tone at exact bin frequency', () => {
  const N = 64;
  const fs = 64; // 1 second duration, bin spacing = 1 Hz
  const targetFreq = 4; // 4 Hz -> bin index 4
  const signal = new Array(N);
  for (let n = 0; n < N; n++) {
    signal[n] = 2.0 * Math.sin((2 * Math.PI * targetFreq * n) / fs);
  }

  const dft = computeDFT(signal, fs);
  // Bin 4 should have normalized magnitude = 2.0
  assert.ok(Math.abs(dft.normalizedMagnitude[targetFreq] - 2.0) < 1e-4);
  // Off-peak bin (e.g. bin 10) should be near zero
  assert.ok(dft.normalizedMagnitude[10] < 1e-4);
});

test('Radix-2 FFT matches DFT on multi-tone signal for N=128', () => {
  const N = 128;
  const { rawSignal } = generateSignal('multi-tone', {
    sampleCount: N,
    sampleRate: N,
    f1: 3,
    a1: 1.0,
    f2: 9,
    a2: 0.7,
    f3: 15,
    a3: 0.4,
  });

  const dft = computeDFT(rawSignal, N);
  const fft = computeFFTRadix2(rawSignal, undefined, N);

  for (let k = 0; k < N; k++) {
    assert.ok(
      Math.abs(dft.real[k] - fft.real[k]) < 1e-6,
      `Real mismatch at bin ${k}: dft=${dft.real[k]}, fft=${fft.real[k]}`
    );
    assert.ok(
      Math.abs(dft.imag[k] - fft.imag[k]) < 1e-6,
      `Imag mismatch at bin ${k}: dft=${dft.imag[k]}, fft=${fft.imag[k]}`
    );
  }
});

test('Winding phasor center of mass peaks at resonance frequency', () => {
  const N = 64;
  const fs = 64;
  const targetFreq = 7;
  const signal = new Array(N);
  for (let n = 0; n < N; n++) {
    signal[n] = 3.0 * Math.cos((2 * Math.PI * targetFreq * n) / fs);
  }

  const resonantWinding = computeWindingPhasor(signal, targetFreq, fs);
  const nonResonantWinding = computeWindingPhasor(signal, 13, fs);

  // At resonant frequency, center of mass pulls strongly away from origin
  assert.ok(resonantWinding.centerOfMass.magnitude > 1.2);
  // At non-resonant frequency, points cancel out symmetrically
  assert.ok(nonResonantWinding.centerOfMass.magnitude < 0.1);
});

test('Discrete convolution produces correct length and values', () => {
  const x = [1, 2, 3];
  const h = [1, 1];
  // Expected convolution: [1*1, 1*1+2*1, 2*1+3*1, 3*1] = [1, 3, 5, 3]
  const conv = discreteConvolve(x, h);
  assert.equal(conv.output.length, 4);
  assert.deepEqual(conv.output, [1, 3, 5, 3]);
});

test('Fourier series square wave exhibits expected Gibbs overshoot', () => {
  const result = synthesizeFourierSeries('square', 25, 256);
  assert.equal(result.synthesized.length, 256);
  // Theoretical Gibbs overshoot for a square wave is (2/pi)*Si(pi) - 1 ≈ 17.898% above unit amplitude (or ~8.95% of peak-to-peak)
  assert.ok(
    result.gibbsOvershootPercent >= 16 && result.gibbsOvershootPercent <= 20,
    `Gibbs overshoot was ${result.gibbsOvershootPercent}%, expected ~17.9%`
  );
});
