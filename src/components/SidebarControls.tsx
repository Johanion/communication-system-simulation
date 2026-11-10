/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  SignalConfig,
  SignalPreset,
  SignalType,
  WindowFunction,
  AlgorithmMode,
  MultiToneComponent,
  AlgorithmBenchmark,
} from '../types';
import {
  Sliders,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Plus,
  Trash2,
  AlertTriangle,
  Zap,
  Cpu,
  Layers,
  Activity,
  Radio,
} from 'lucide-react';

interface SidebarControlsProps {
  config: SignalConfig;
  onChangeConfig: (newConfig: Partial<SignalConfig>) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onApplyPreset: (preset: SignalPreset) => void;
  onResetDefaults: () => void;
  benchmark?: AlgorithmBenchmark;
}

export const SidebarControls: React.FC<SidebarControlsProps> = ({
  config,
  onChangeConfig,
  isCollapsed,
  onToggleCollapse,
  onApplyPreset,
  onResetDefaults,
  benchmark,
}) => {
  const nyquistFreq = config.sampleRate / 2;

  // Determine highest frequency present in signal
  let highestFreq = config.f1;
  if (config.signalType === 'multi-tone' && config.tones.length > 0) {
    highestFreq = Math.max(...config.tones.map((t) => t.frequency));
  }
  const isAliasing = highestFreq > nyquistFreq;

  const presetsList: { id: SignalPreset; label: string; sub: string }[] = [
    { id: 'pure-tone', label: 'Pure Tone', sub: '20 Hz Single Sine' },
    { id: 'two-tones', label: 'Two Tones', sub: '15 Hz + 40 Hz Chord' },
    { id: 'square-wave', label: 'Square Wave', sub: '10 Hz Odd Harmonics' },
    { id: 'sawtooth-wave', label: 'Sawtooth Wave', sub: '12 Hz All Harmonics' },
    { id: 'noisy-signal', label: 'Noisy Signal', sub: 'Gaussian Noise σ = 0.50' },
    { id: 'aliasing-demo', label: 'Aliasing Demo', sub: 'f = 75 Hz > fs/2 (50 Hz)' },
  ];

  // Helper for adding a multi-tone component
  const handleAddTone = () => {
    if (config.tones.length >= 6) return;
    const nextFreq = Math.min(
      nyquistFreq * 0.9,
      config.tones.length > 0
        ? config.tones[config.tones.length - 1].frequency + 15
        : 30
    );
    const newTone: MultiToneComponent = {
      id: `tone-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      frequency: +nextFreq.toFixed(1),
      amplitude: 0.5,
      phaseDeg: 0,
    };
    onChangeConfig({ tones: [...config.tones, newTone] });
  };

  const handleRemoveTone = (id: string) => {
    if (config.tones.length <= 1) return;
    onChangeConfig({ tones: config.tones.filter((t) => t.id !== id) });
  };

  const handleUpdateTone = (
    id: string,
    updates: Partial<MultiToneComponent>
  ) => {
    onChangeConfig({
      tones: config.tones.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    });
  };

  if (isCollapsed) {
    return (
      <div className="bg-white rounded-[14px] p-2 shadow-sm border border-[#AAEED3]/50 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-2 rounded-lg bg-[#F3FAF7] hover:bg-[#AAEED3]/30 text-[#2A7B73] border border-[#AAEED3] transition-colors cursor-pointer"
          title="Expand signal generator sidebar"
          aria-label="Expand controls"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        <span
          className="font-semibold text-xs text-[#2A7B73] uppercase tracking-wider py-4 select-none"
          style={{ writingMode: 'vertical-rl' }}
        >
          Signal Controls
        </span>
      </div>
    );
  }

  return (
    <aside className="w-full lg:w-88 bg-white rounded-[14px] p-5 shadow-sm border border-[#AAEED3]/50 flex flex-col gap-5 transition-all select-none shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#AAEED3]/40">
        <div className="flex items-center gap-2">
          <Sliders className="w-5 h-5 text-[#2A7B73]" />
          <h2 className="font-heading font-bold text-base text-[#123A36]">
            Signal Generator
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onResetDefaults}
            className="p-1.5 rounded-lg text-xs text-[#2A7B73] hover:bg-[#AAEED3]/30 transition-colors cursor-pointer"
            title="Reset signal to default pure tone"
            aria-label="Reset parameters"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg text-[#2A7B73] hover:bg-[#AAEED3]/30 transition-colors hidden lg:block cursor-pointer"
            title="Collapse control panel"
            aria-label="Collapse controls"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Built-in Presets */}
      <div>
        <label className="text-xs font-semibold text-[#123A36] block mb-2">
          Curated Presets:
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {presetsList.map((p) => {
            const isActive = config.preset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onApplyPreset(p.id)}
                className={`text-left p-2 rounded-lg border transition-all text-xs cursor-pointer ${
                  isActive
                    ? 'bg-[#2A7B73] text-white border-[#2A7B73] shadow-xs'
                    : 'bg-[#FAFCFB] text-[#123A36] border-[#AAEED3]/60 hover:bg-[#F3FAF7]'
                }`}
              >
                <div className="font-bold truncate">{p.label}</div>
                <div
                  className={`text-[10px] truncate ${
                    isActive ? 'text-white/80' : 'text-[#123A36]/60'
                  }`}
                >
                  {p.sub}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Signal Type Selector */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-[#123A36] block">
          Waveform Function:
        </label>
        <div className="grid grid-cols-2 gap-1.5 bg-[#F3FAF7] p-1 rounded-xl border border-[#AAEED3]/60">
          {(
            [
              { id: 'sine', label: 'Pure Sine' },
              { id: 'multi-tone', label: 'Multi-Tone' },
              { id: 'square', label: 'Square Wave' },
              { id: 'sawtooth', label: 'Sawtooth' },
            ] as const
          ).map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() =>
                onChangeConfig({ signalType: st.id as SignalType })
              }
              className={`py-1.5 px-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer text-center ${
                config.signalType === st.id
                  ? 'bg-[#2A7B73] text-white shadow-xs'
                  : 'text-[#123A36] hover:bg-[#AAEED3]/40'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Primary Tone Parameters (for Sine, Square, Sawtooth) */}
      {config.signalType !== 'multi-tone' ? (
        <div className="bg-[#FAFCFB] p-3.5 rounded-xl border border-[#AAEED3]/50 space-y-3">
          {/* Fundamental Frequency */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-[#123A36]">
                Frequency (f₁):
              </span>
              <span className="font-mono font-bold text-[#2A7B73] tabular-nums">
                {config.f1.toFixed(1)} Hz
              </span>
            </div>
            <input
              type="range"
              min="1"
              max={Math.max(100, nyquistFreq * 1.5)}
              step="0.5"
              value={config.f1}
              onChange={(e) =>
                onChangeConfig({ f1: parseFloat(e.target.value) })
              }
              className="w-full accent-[#2A7B73] cursor-pointer"
              aria-label="Frequency f1 slider"
            />
            <div className="flex justify-between text-[10px] text-[#123A36]/50 font-mono">
              <span>1 Hz</span>
              <span>Nyquist: {nyquistFreq} Hz</span>
              <span>{(nyquistFreq * 1.5).toFixed(0)} Hz</span>
            </div>
          </div>

          {/* Amplitude */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-[#123A36]">
                Amplitude (A₁):
              </span>
              <span className="font-mono font-bold text-[#2A7B73] tabular-nums">
                {config.a1.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0.1"
              max="2.5"
              step="0.05"
              value={config.a1}
              onChange={(e) =>
                onChangeConfig({ a1: parseFloat(e.target.value) })
              }
              className="w-full accent-[#2A7B73] cursor-pointer"
              aria-label="Amplitude a1 slider"
            />
          </div>

          {/* Phase Offset */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-[#123A36]">
                Phase Offset (φ₁):
              </span>
              <span className="font-mono font-bold text-[#2A7B73] tabular-nums">
                {config.phase1Deg}°
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="360"
              step="5"
              value={config.phase1Deg}
              onChange={(e) =>
                onChangeConfig({ phase1Deg: parseInt(e.target.value, 10) })
              }
              className="w-full accent-[#2A7B73] cursor-pointer"
              aria-label="Phase offset slider"
            />
          </div>
        </div>
      ) : (
        /* Multi-Tone Superposition Controls (Add, remove, adjust components) */
        <div className="bg-[#FAFCFB] p-3.5 rounded-xl border border-[#AAEED3]/50 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#123A36] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#2A7B73]" />
              Harmonic Components ({config.tones.length}/6)
            </span>
            <button
              type="button"
              onClick={handleAddTone}
              disabled={config.tones.length >= 6}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-[#2A7B73] text-white hover:bg-[#123A36] disabled:opacity-40 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Tone</span>
            </button>
          </div>

          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
            {config.tones.map((tone, idx) => (
              <div
                key={tone.id}
                className="p-2.5 rounded-lg bg-white border border-[#AAEED3]/70 space-y-1.5 text-xs shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#123A36] text-[11px]">
                    Component {idx + 1}
                  </span>
                  {config.tones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveTone(tone.id)}
                      className="text-rose-500 hover:text-rose-700 p-0.5 rounded cursor-pointer"
                      title="Remove component"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Tone Frequency */}
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#123A36]/80">Frequency:</span>
                  <span className="font-mono font-bold text-[#2A7B73] tabular-nums">
                    {tone.frequency.toFixed(1)} Hz
                  </span>
                </div>
                <input
                  type="range"
                  min="2"
                  max={Math.max(100, nyquistFreq * 1.5)}
                  step="0.5"
                  value={tone.frequency}
                  onChange={(e) =>
                    handleUpdateTone(tone.id, {
                      frequency: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-[#2A7B73] cursor-pointer"
                />

                {/* Tone Amplitude & Phase in 2 columns */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#AAEED3]/30 text-[10px]">
                  <div>
                    <div className="flex justify-between">
                      <span>Amp:</span>
                      <span className="font-mono font-bold text-[#2A7B73]">
                        {tone.amplitude.toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="2.0"
                      step="0.05"
                      value={tone.amplitude}
                      onChange={(e) =>
                        handleUpdateTone(tone.id, {
                          amplitude: parseFloat(e.target.value),
                        })
                      }
                      className="w-full accent-[#55A9A0] cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between">
                      <span>Phase:</span>
                      <span className="font-mono font-bold text-[#2A7B73]">
                        {tone.phaseDeg}°
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      step="10"
                      value={tone.phaseDeg}
                      onChange={(e) =>
                        handleUpdateTone(tone.id, {
                          phaseDeg: parseInt(e.target.value, 10),
                        })
                      }
                      className="w-full accent-[#55A9A0] cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Aliasing Warning Banner if any frequency exceeds Nyquist */}
      {isAliasing && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Aliasing Condition Detected!</span>
            <span>
              Highest frequency ({highestFreq.toFixed(1)} Hz) exceeds Nyquist limit (
              {nyquistFreq} Hz). Spectral reflections will fold back to |
              {(highestFreq - config.sampleRate).toFixed(1)}| Hz.
            </span>
          </div>
        </div>
      )}

      {/* Gaussian Noise Injection */}
      <div className="space-y-1.5 pt-1">
        <div className="flex justify-between items-center text-xs">
          <span className="font-semibold text-[#123A36]">
            Gaussian Noise Level (σ):
          </span>
          <span className="font-mono font-bold text-[#2A7B73] tabular-nums">
            {config.noiseLevel.toFixed(2)}
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="1.0"
          step="0.05"
          value={config.noiseLevel}
          onChange={(e) =>
            onChangeConfig({ noiseLevel: parseFloat(e.target.value) })
          }
          className="w-full accent-[#2A7B73] cursor-pointer"
          aria-label="Gaussian noise slider"
        />
        <div className="flex justify-between text-[10px] text-[#123A36]/50 font-mono">
          <span>0.00 (Pure)</span>
          <span>0.50 (Moderate)</span>
          <span>1.00 (Heavy)</span>
        </div>
      </div>

      {/* Sampling Controls: fs (20 to 2000 Hz) & N (64, 128, 256, 512, 1024) */}
      <div className="pt-3 border-t border-[#AAEED3]/40 space-y-3">
        <label className="text-xs font-bold text-[#123A36] uppercase tracking-wider block">
          Sampling Configuration:
        </label>

        {/* Sampling Rate fs (20 to 2000 Hz) */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-[#123A36]">
              Sampling Rate (f_s):
            </span>
            <div className="flex items-center gap-1 font-mono text-[#2A7B73]">
              <span className="font-bold text-xs">{config.sampleRate} Hz</span>
              <span className="text-[10px] text-[#123A36]/60">
                (Nyquist: {nyquistFreq} Hz)
              </span>
            </div>
          </div>
          <input
            type="range"
            min="20"
            max="2000"
            step={config.sampleRate < 200 ? 5 : config.sampleRate < 500 ? 10 : 25}
            value={config.sampleRate}
            onChange={(e) =>
              onChangeConfig({ sampleRate: parseInt(e.target.value, 10) })
            }
            className="w-full accent-[#2A7B73] cursor-pointer"
            aria-label="Sampling rate fs slider"
          />
          <div className="flex justify-between text-[10px] text-[#123A36]/50 font-mono">
            <span>20 Hz</span>
            <span>200 Hz</span>
            <span>1000 Hz</span>
            <span>2000 Hz</span>
          </div>
        </div>

        {/* Sample Count N (Powers of 2: 64, 128, 256, 512, 1024) */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-[#123A36]">
              Sample Count (N):
            </span>
            <span className="font-mono text-[11px] text-[#2A7B73]">
              Δf = {(config.sampleRate / config.sampleCount).toFixed(2)} Hz/bin
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1">
            {[64, 128, 256, 512, 1024].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onChangeConfig({ sampleCount: n })}
                className={`py-1 text-xs font-mono font-bold rounded border transition-colors cursor-pointer ${
                  config.sampleCount === n
                    ? 'bg-[#2A7B73] text-white border-[#2A7B73] shadow-xs'
                    : 'bg-[#FAFCFB] text-[#123A36] border-[#AAEED3]/60 hover:bg-[#F3FAF7]'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Window Function */}
        <div className="space-y-1 pt-1">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-[#123A36]">Windowing Function:</span>
            <span className="font-mono text-[#2A7B73] text-[11px] capitalize">
              {config.windowType}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            {(['rectangular', 'hann', 'hamming', 'blackman'] as WindowFunction[]).map(
              (w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => onChangeConfig({ windowType: w })}
                  className={`py-1 px-2 rounded-md font-medium capitalize border transition-all text-left truncate cursor-pointer ${
                    config.windowType === w
                      ? 'bg-[#2A7B73] text-white border-[#2A7B73] shadow-xs'
                      : 'bg-[#FAFCFB] text-[#123A36] border-[#AAEED3]/60 hover:bg-[#F3FAF7]'
                  }`}
                >
                  {w}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Algorithm Selector with Live Execution Timings */}
      <div className="pt-3 border-t border-[#AAEED3]/40 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#123A36] uppercase tracking-wider flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-[#2A7B73]" />
            Algorithm & Timings
          </span>
          {benchmark && (
            <span className="text-[10px] font-mono text-[#2A7B73] font-semibold bg-[#AAEED3]/30 px-1.5 py-0.5 rounded">
              {benchmark.speedup}x speedup
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-1 bg-[#F3FAF7] p-1 rounded-xl border border-[#AAEED3]/60">
          {(
            [
              { id: 'fft', label: 'FFT (Radix-2)' },
              { id: 'dft', label: 'Manual DFT' },
              { id: 'both', label: 'Benchmark' },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() =>
                onChangeConfig({ algorithm: m.id as AlgorithmMode })
              }
              className={`py-1.5 px-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer text-center truncate ${
                config.algorithm === m.id
                  ? 'bg-[#2A7B73] text-white shadow-xs'
                  : 'text-[#123A36] hover:bg-[#AAEED3]/40'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Live execution benchmark box */}
        {benchmark && (
          <div className="bg-[#FAFCFB] p-2.5 rounded-lg border border-[#AAEED3]/60 font-mono text-[11px] space-y-1 text-[#123A36]">
            <div className="flex justify-between">
              <span>Manual DFT O(N²):</span>
              <strong className="text-[#123A36]">
                {benchmark.dftTimeMs.toFixed(3)} ms
              </strong>
            </div>
            <div className="flex justify-between">
              <span>Cooley-Tukey FFT O(N log N):</span>
              <strong className="text-[#2A7B73]">
                {benchmark.fftTimeMs.toFixed(3)} ms
              </strong>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
