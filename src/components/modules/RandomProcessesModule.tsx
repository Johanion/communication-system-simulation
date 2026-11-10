/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Interactive Signals & Systems Simulator for Random Signals,
 * focusing on Autocorrelation R_xx(τ) and Power Spectral Density (PSD).
 * 
 * Themed to match the scientific laboratory aesthetic:
 * - Dark Teal: #123A36
 * - Deep Teal: #2A7B73
 * - Teal: #55A9A0
 * - Mint: #AAEED3
 * - Pale Yellow: #FFF6B0
 * - Off-White: #F3FAF7
 * - Card Background: #FFFFFF
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Activity,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Sliders,
  BarChart2,
  Waves,
  Download,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Layers,
  TrendingUp,
  Cpu,
  Info,
} from 'lucide-react';
import {
  ProcessType,
  ProcessConfig,
  DEFAULT_PROCESS_CONFIG,
  generateProcessSignal,
  computeAutocorrelation,
  computeLagWorkout,
  computePSDComparison,
  AutocorrResult,
  PSDComparison,
  LagWorkoutStep,
} from '../../math/randomProcesses';

export const RandomProcessesModule: React.FC = () => {
  // Configuration state
  const [config, setConfig] = useState<ProcessConfig>(DEFAULT_PROCESS_CONFIG);
  const [seed, setSeed] = useState<number>(1);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [streamSpeed, setStreamSpeed] = useState<number>(80); // ms per step

  // Autocorrelation interactive state
  const [selectedLag, setSelectedLag] = useState<number>(0);
  const [isSweepingLag, setIsSweepingLag] = useState<boolean>(false);
  const [showNormalizedAutocorr, setShowNormalizedAutocorr] = useState<boolean>(false);

  // PSD view state
  const [psdScale, setPsdScale] = useState<'linear' | 'dB'>('linear');
  const [visiblePsdCurves, setVisiblePsdCurves] = useState<{
    raw: boolean;
    welch: boolean;
    wk: boolean;
  }>({ raw: true, welch: true, wk: true });

  // 5-Stage PSD Evolutionary Animation state
  const [evolutionStage, setEvolutionStage] = useState<number>(1);
  const [isEvolutionPlaying, setIsEvolutionPlaying] = useState<boolean>(false);

  // Active section tab
  const [activeSection, setActiveSection] = useState<'analyzer' | 'autocorr' | 'psd' | 'theory'>('analyzer');

  // Interactive tooltip hover states
  const [timeHover, setTimeHover] = useState<{ x: number; y: number; t: number; val: number } | null>(null);
  const [autocorrHover, setAutocorrHover] = useState<{ lag: number; tauSec: number; val: number } | null>(null);
  const [psdHover, setPsdHover] = useState<{ freq: number; raw: number; welch: number; wk: number } | null>(null);

  // Generate current signal data
  const { signal, timeArray } = useMemo(() => {
    return generateProcessSignal(config);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, seed]);

  // Compute Autocorrelation
  const tauMax = useMemo(() => {
    return Math.min(60, Math.floor(config.sampleCount / 3));
  }, [config.sampleCount]);

  const autocorrResult: AutocorrResult = useMemo(() => {
    return computeAutocorrelation(signal, config.sampleRate, tauMax);
  }, [signal, config.sampleRate, tauMax]);

  // Step-by-step workout calculation for selected lag
  const workoutStep: LagWorkoutStep = useMemo(() => {
    return computeLagWorkout(signal, config.sampleRate, selectedLag, autocorrResult.totalPower);
  }, [signal, config.sampleRate, selectedLag, autocorrResult.totalPower]);

  // Compute PSD Comparison
  const psdResult: PSDComparison = useMemo(() => {
    return computePSDComparison(signal, config.sampleRate, autocorrResult);
  }, [signal, config.sampleRate, autocorrResult]);

  // Ensure selectedLag is within bounds
  useEffect(() => {
    if (selectedLag > tauMax) setSelectedLag(tauMax);
    if (selectedLag < -tauMax) setSelectedLag(-tauMax);
  }, [tauMax, selectedLag]);

  // Real-time streaming simulation effect
  const streamIntervalRef = useRef<number | null>(null);
  useEffect(() => {
    if (isStreaming) {
      streamIntervalRef.current = window.setInterval(() => {
        setSeed((s) => s + 1);
      }, streamSpeed);
    } else {
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
    }
    return () => {
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
    };
  }, [isStreaming, streamSpeed]);

  // Animated lag sweep effect
  const sweepIntervalRef = useRef<number | null>(null);
  useEffect(() => {
    if (isSweepingLag) {
      sweepIntervalRef.current = window.setInterval(() => {
        setSelectedLag((prev) => {
          if (prev >= tauMax) {
            setIsSweepingLag(false);
            return tauMax;
          }
          return prev + 1;
        });
      }, 70);
    } else {
      if (sweepIntervalRef.current) clearInterval(sweepIntervalRef.current);
    }
    return () => {
      if (sweepIntervalRef.current) clearInterval(sweepIntervalRef.current);
    };
  }, [isSweepingLag, tauMax]);

  // 5-Stage PSD Evolution Animation interval
  useEffect(() => {
    let timer: number | null = null;
    if (isEvolutionPlaying) {
      timer = window.setInterval(() => {
        setEvolutionStage((prev) => (prev >= 5 ? 1 : prev + 1));
      }, 2400);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isEvolutionPlaying]);

  // Handler for regenerating signal
  const handleRegenerate = () => {
    setSeed((s) => s + 1);
  };

  // Handler for resetting configs
  const handleReset = () => {
    setConfig(DEFAULT_PROCESS_CONFIG);
    setSelectedLag(0);
    setIsStreaming(false);
    setIsSweepingLag(false);
    setSeed((s) => s + 1);
  };

  // Trigger lag sweep
  const handleStartSweep = () => {
    setSelectedLag(-tauMax);
    setIsSweepingLag(true);
  };

  // Helper for CSV export
  const exportCSV = (type: 'signal' | 'autocorr' | 'psd') => {
    let csvContent = '';
    let filename = '';

    if (type === 'signal') {
      csvContent = 'index,time_sec,amplitude\n' +
        signal.map((val, idx) => `${idx},${timeArray[idx].toFixed(6)},${val.toFixed(6)}`).join('\n');
      filename = `random_signal_${config.type}.csv`;
    } else if (type === 'autocorr') {
      csvContent = 'lag_index,time_lag_sec,Rxx_unnormalized,rho_xx_normalized\n' +
        autocorrResult.lags.map((lag, idx) => `${lag},${autocorrResult.timeLags[idx].toFixed(6)},${autocorrResult.rxx[idx].toFixed(6)},${autocorrResult.rho[idx].toFixed(6)}`).join('\n');
      filename = `autocorrelation_${config.type}.csv`;
    } else {
      csvContent = 'freq_hz,raw_periodogram,welch_smoothed_psd,wiener_khinchin_psd\n' +
        psdResult.frequencies.map((f, idx) => `${f.toFixed(3)},${psdResult.rawPeriodogram[idx].toFixed(6)},${psdResult.welchPSD[idx].toFixed(6)},${psdResult.wienerKhinchinPSD[idx].toFixed(6)}`).join('\n');
      filename = `psd_comparison_${config.type}.csv`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Signal summary statistics
  const stats = useMemo(() => {
    const N = signal.length;
    let sum = 0;
    let sumSq = 0;
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < N; i++) {
      const v = signal[i];
      sum += v;
      sumSq += v * v;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const mean = sum / N;
    const variance = Math.max(0, sumSq / N - mean * mean);
    const rms = Math.sqrt(sumSq / N);
    return { mean, variance, rms, min, max };
  }, [signal]);

  // SVG Chart Dimensions
  const timeSvgWidth = 720;
  const timeSvgHeight = 180;
  const autocorrSvgWidth = 720;
  const autocorrSvgHeight = 220;
  const psdSvgWidth = 720;
  const psdSvgHeight = 260;

  // Render Time Domain waveform points
  const timePoints = useMemo(() => {
    const N = signal.length;
    if (N === 0) return '';
    const yRange = Math.max(0.5, Math.max(Math.abs(stats.min), Math.abs(stats.max)) * 1.15);
    const centerY = timeSvgHeight / 2;

    return signal.map((y, idx) => {
      const x = (idx / (N - 1)) * (timeSvgWidth - 20) + 10;
      const py = centerY - (y / yRange) * (centerY - 16);
      return `${x.toFixed(1)},${py.toFixed(1)}`;
    }).join(' ');
  }, [signal, stats, timeSvgHeight, timeSvgWidth]);

  // Autocorrelation points
  const autocorrPoints = useMemo(() => {
    const values = showNormalizedAutocorr ? autocorrResult.rho : autocorrResult.rxx;
    const count = values.length;
    if (count === 0) return '';

    let maxVal = Math.max(0.1, ...values.map(Math.abs));
    if (showNormalizedAutocorr) maxVal = 1.05;

    const centerY = autocorrSvgHeight / 2;
    return values.map((val, idx) => {
      const x = (idx / (count - 1)) * (autocorrSvgWidth - 30) + 15;
      const y = centerY - (val / maxVal) * (centerY - 22);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }, [autocorrResult, showNormalizedAutocorr, autocorrSvgHeight, autocorrSvgWidth]);

  // Instantaneous product & delayed signal points for the comparative workout
  const { delayedPoints, productPoints, overlapAreaPath } = useMemo(() => {
    const N = signal.length;
    const lag = selectedLag;
    const absLag = Math.abs(lag);
    const overlapCount = Math.max(1, N - absLag);
    const yRange = Math.max(0.5, Math.max(Math.abs(stats.min), Math.abs(stats.max)) * 1.15);
    const prodRange = Math.max(0.5, yRange * yRange * 0.85);

    const delayed: string[] = [];
    const product: string[] = [];
    const areaCoords: { x: number; y: number }[] = [];

    const width = timeSvgWidth - 20;
    const height = 140;
    const centerY = height / 2;

    for (let n = 0; n < overlapCount; n++) {
      const xIdx = lag >= 0 ? n : n - lag;
      const xDelayedIdx = lag >= 0 ? n + lag : n;
      const xVal = signal[xIdx];
      const xDelVal = signal[xDelayedIdx];
      const prodVal = xVal * xDelVal;

      const px = 10 + (n / (N - 1)) * width;
      const pyDel = centerY - (xDelVal / yRange) * (centerY - 14);
      const pyProd = centerY - (prodVal / prodRange) * (centerY - 14);

      delayed.push(`${px.toFixed(1)},${pyDel.toFixed(1)}`);
      product.push(`${px.toFixed(1)},${pyProd.toFixed(1)}`);
      areaCoords.push({ x: px, y: pyProd });
    }

    let areaPath = '';
    if (areaCoords.length > 1) {
      const startX = areaCoords[0].x;
      const endX = areaCoords[areaCoords.length - 1].x;
      areaPath = `M ${startX.toFixed(1)},${centerY} ` +
        areaCoords.map((c) => `L ${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ') +
        ` L ${endX.toFixed(1)},${centerY} Z`;
    }

    return {
      delayedPoints: delayed.join(' '),
      productPoints: product.join(' '),
      overlapAreaPath: areaPath,
    };
  }, [signal, selectedLag, stats, timeSvgWidth]);

  // PSD curves paths
  const { rawPath, welchPath, wkPath } = useMemo(() => {
    const freqs = psdResult.frequencies;
    const count = freqs.length;
    if (count === 0) return { rawPath: '', welchPath: '', wkPath: '', maxPsdVal: 1, minPsdVal: 0 };

    const toPlotVal = (val: number) => {
      if (psdScale === 'dB') {
        return 10 * Math.log10(Math.max(1e-8, val));
      }
      return val;
    };

    const rawVals = psdResult.rawPeriodogram.map(toPlotVal);
    const welchVals = psdResult.welchPSD.map(toPlotVal);
    const wkVals = psdResult.wienerKhinchinPSD.map(toPlotVal);

    let maxVal = Math.max(...welchVals, ...wkVals, ...rawVals);
    let minVal = Math.min(...welchVals, ...wkVals, ...rawVals);

    if (psdScale === 'dB') {
      minVal = Math.max(-60, minVal);
      maxVal = Math.max(minVal + 10, maxVal);
    } else {
      minVal = 0;
      maxVal = Math.max(1e-5, maxVal * 1.15);
    }

    const mapY = (v: number) => {
      const clamped = Math.max(minVal, Math.min(maxVal, v));
      const norm = (clamped - minVal) / (maxVal - minVal);
      return (psdSvgHeight - 25) - norm * (psdSvgHeight - 45);
    };

    const makePath = (vals: number[]) => {
      return vals.map((v, i) => {
        const x = 20 + (i / (count - 1)) * (psdSvgWidth - 40);
        const y = mapY(v);
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');
    };

    return {
      rawPath: makePath(rawVals),
      welchPath: makePath(welchVals),
      wkPath: makePath(wkVals),
      maxPsdVal: maxVal,
      minPsdVal: minVal,
    };
  }, [psdResult, psdScale, psdSvgHeight, psdSvgWidth]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Module Navigation Header */}
      <div className="bg-white rounded-[14px] p-5 shadow-sm border border-[#AAEED3]/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="text-xs font-bold font-mono px-2.5 py-0.5 rounded bg-[#AAEED3]/40 text-[#123A36] border border-[#AAEED3]">
              Topic G
            </span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-[#F3FAF7] text-[#2A7B73] border border-[#AAEED3]/60 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              {isStreaming ? 'Streaming Real-Time' : 'Static Realization'}
            </span>
            <span className="text-xs font-mono px-2.5 py-0.5 rounded bg-[#FFF6B0] text-[#123A36] border border-[#AAEED3]/60">
              Parseval Agreement: {psdResult.parsevalMatchPercent.toFixed(1)}%
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-[#123A36] tracking-tight font-heading">
            Random Processes & Power Spectral Density (PSD)
          </h2>
          <p className="text-xs sm:text-sm text-[#123A36]/70 mt-1 max-w-3xl">
            Interactive Signals & Systems laboratory for stationary random processes, time-lagging autocorrelation R_xx(τ), and the profound Wiener–Khinchin theorem linking correlation to spectral density.
          </p>
        </div>

        {/* Global Action Bar */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setIsStreaming(!isStreaming)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer shadow-xs ${
              isStreaming
                ? 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600'
                : 'bg-[#2A7B73] text-white border-[#2A7B73] hover:bg-[#123A36]'
            }`}
            title={isStreaming ? 'Pause real-time streaming' : 'Stream random signal continuously'}
          >
            {isStreaming ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isStreaming ? 'Pause Stream' : 'Live Stream'}</span>
          </button>

          <button
            type="button"
            onClick={handleRegenerate}
            disabled={isStreaming}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-[#F3FAF7] text-[#2A7B73] border border-[#AAEED3] hover:bg-[#AAEED3]/40 transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
            title="Generate a new stochastic realization"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>New Realization</span>
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-xl bg-white text-[#123A36]/70 border border-[#AAEED3]/60 hover:text-[#123A36] hover:bg-[#F3FAF7] transition-colors cursor-pointer"
            title="Reset to default settings"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-[#AAEED3]/60 bg-white rounded-t-xl px-3 pt-2 overflow-x-auto scrollbar-none gap-2">
        <button
          type="button"
          onClick={() => setActiveSection('analyzer')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
            activeSection === 'analyzer'
              ? 'border-[#2A7B73] text-[#2A7B73] bg-[#F3FAF7] rounded-t-lg'
              : 'border-transparent text-[#123A36]/70 hover:text-[#123A36] hover:border-[#AAEED3]'
          }`}
        >
          <Waves className="w-4 h-4 text-[#2A7B73]" />
          1. Signal Generator & Oscilloscope
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('autocorr')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
            activeSection === 'autocorr'
              ? 'border-[#2A7B73] text-[#2A7B73] bg-[#F3FAF7] rounded-t-lg'
              : 'border-transparent text-[#123A36]/70 hover:text-[#123A36] hover:border-[#AAEED3]'
          }`}
        >
          <Layers className="w-4 h-4 text-[#2A7B73]" />
          2. Autocorrelation & Time Lag Workout
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('psd')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
            activeSection === 'psd'
              ? 'border-[#2A7B73] text-[#2A7B73] bg-[#F3FAF7] rounded-t-lg'
              : 'border-transparent text-[#123A36]/70 hover:text-[#123A36] hover:border-[#AAEED3]'
          }`}
        >
          <BarChart2 className="w-4 h-4 text-[#2A7B73]" />
          3. Power Spectral Density (PSD) & Wiener–Khinchin
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('theory')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
            activeSection === 'theory'
              ? 'border-[#2A7B73] text-[#2A7B73] bg-[#F3FAF7] rounded-t-lg'
              : 'border-transparent text-[#123A36]/70 hover:text-[#123A36] hover:border-[#AAEED3]'
          }`}
        >
          <Sparkles className="w-4 h-4 text-[#2A7B73]" />
          4. Theoretical Duality
        </button>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT COLUMN: Controls & Signal Synthesizer (lg:col-span-4) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Signal Type Selector */}
          <div className="bg-white rounded-[14px] p-5 shadow-sm border border-[#AAEED3]/50">
            <label className="text-xs font-bold text-[#123A36] uppercase tracking-wider block mb-3 flex items-center justify-between">
              <span>Stochastic Signal Model</span>
              <span className="text-[10px] text-[#2A7B73] font-mono bg-[#AAEED3]/30 px-2 py-0.5 rounded">
                5 ARCHETYPES
              </span>
            </label>
            <div className="grid grid-cols-1 gap-2">
              {[
                {
                  id: 'white',
                  label: 'Gaussian White Noise',
                  sub: 'Flat spectrum, delta autocorr R(τ) = σ² δ[τ]',
                  tag: 'Wideband',
                },
                {
                  id: 'colored',
                  label: 'Colored / Pink Noise (AR-1)',
                  sub: 'Correlated memory x[n] = α x[n-1] + w[n]',
                  tag: 'Low-Pass',
                },
                {
                  id: 'telegraph',
                  label: 'Random Telegraph Process',
                  sub: 'Poisson binary transitions ±A, exponential R(τ)',
                  tag: 'Discrete States',
                },
                {
                  id: 'harmonic_noise',
                  label: 'Harmonic Signal + Noise',
                  sub: 'Sinusoid buried in noise with tunable SNR (dB)',
                  tag: 'Periodic Peak',
                },
                {
                  id: 'bandpass',
                  label: 'Bandpass Narrowband Noise',
                  sub: 'Resonant AR(2) filter around center frequency fc',
                  tag: 'Resonant Band',
                },
              ].map((item) => {
                const isActive = config.type === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setConfig({ ...config, type: item.id as ProcessType })}
                    className={`text-left p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                      isActive
                        ? 'bg-[#2A7B73] text-white border-[#2A7B73] shadow-xs'
                        : 'bg-[#FAFCFB] text-[#123A36] border-[#AAEED3]/50 hover:border-[#55A9A0] hover:bg-[#F3FAF7]'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-xs flex items-center gap-1.5">
                        <span>{item.label}</span>
                      </div>
                      <div className={`text-[11px] mt-0.5 ${isActive ? 'text-white/80' : 'text-[#123A36]/65'}`}>
                        {item.sub}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded shrink-0 ml-2 ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-[#AAEED3]/40 text-[#2A7B73]'
                      }`}
                    >
                      {item.tag}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Parameter Sliders */}
          <div className="bg-white rounded-[14px] p-5 shadow-sm border border-[#AAEED3]/50 space-y-4">
            <h3 className="text-xs font-bold text-[#123A36] uppercase tracking-wider flex items-center justify-between">
              <span>Simulation Parameters</span>
              <Sliders className="w-3.5 h-3.5 text-[#2A7B73]" />
            </h3>

            {/* Sampling Frequency fs */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[#123A36]/80 font-medium">Sampling Rate (fs)</span>
                <span className="font-mono font-bold text-[#2A7B73]">{config.sampleRate} Hz</span>
              </div>
              <input
                type="range"
                min={50}
                max={800}
                step={25}
                value={config.sampleRate}
                onChange={(e) => setConfig({ ...config, sampleRate: Number(e.target.value) })}
                className="w-full accent-[#2A7B73] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[#123A36]/60 font-mono mt-0.5">
                <span>50 Hz</span>
                <span>Nyquist = {config.sampleRate / 2} Hz</span>
                <span>800 Hz</span>
              </div>
            </div>

            {/* Sample Count N */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[#123A36]/80 font-medium">Sample Count (N)</span>
                <span className="font-mono font-bold text-[#2A7B73]">{config.sampleCount} pts</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[128, 256, 512, 1024].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setConfig({ ...config, sampleCount: n })}
                    className={`py-1 text-xs font-mono rounded-lg border transition cursor-pointer ${
                      config.sampleCount === n
                        ? 'bg-[#2A7B73] text-white border-[#2A7B73] font-bold shadow-2xs'
                        : 'bg-[#FAFCFB] text-[#123A36] border-[#AAEED3]/60 hover:bg-[#AAEED3]/30'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Variance / Amplitude */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[#123A36]/80 font-medium">Variance (σ²)</span>
                <span className="font-mono font-bold text-[#2A7B73]">{config.variance.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.1}
                max={4.0}
                step={0.1}
                value={config.variance}
                onChange={(e) => setConfig({ ...config, variance: Number(e.target.value) })}
                className="w-full accent-[#2A7B73] cursor-pointer"
              />
            </div>

            {/* DC Offset */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[#123A36]/80 font-medium">DC Offset (μ)</span>
                <span className="font-mono font-bold text-[#2A7B73]">{config.dcOffset.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={-2.0}
                max={2.0}
                step={0.1}
                value={config.dcOffset}
                onChange={(e) => setConfig({ ...config, dcOffset: Number(e.target.value) })}
                className="w-full accent-[#2A7B73] cursor-pointer"
              />
            </div>

            {/* Dynamic Model-Specific Controls */}
            {config.type === 'colored' && (
              <div className="pt-3 border-t border-[#AAEED3]/40 space-y-2 bg-[#F3FAF7] p-3 rounded-xl">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#123A36] font-semibold">AR(1) Memory Coeff (α)</span>
                  <span className="font-mono font-bold text-[#2A7B73]">{config.arCoeff.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0.05}
                  max={0.96}
                  step={0.02}
                  value={config.arCoeff}
                  onChange={(e) => setConfig({ ...config, arCoeff: Number(e.target.value) })}
                  className="w-full accent-[#2A7B73] cursor-pointer"
                />
                <p className="text-[10px] text-[#123A36]/70">
                  Coherence time τ_c ≈ 1 / (1 - α). Higher α generates smooth low-frequency persistence.
                </p>
              </div>
            )}

            {config.type === 'telegraph' && (
              <div className="pt-3 border-t border-[#AAEED3]/40 space-y-2 bg-[#F3FAF7] p-3 rounded-xl">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#123A36] font-semibold">Poisson Switch Rate (λ)</span>
                  <span className="font-mono font-bold text-[#2A7B73]">{config.telegraphRate.toFixed(1)} /s</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={30}
                  step={1}
                  value={config.telegraphRate}
                  onChange={(e) => setConfig({ ...config, telegraphRate: Number(e.target.value) })}
                  className="w-full accent-[#2A7B73] cursor-pointer"
                />
                <p className="text-[10px] text-[#123A36]/70">
                  Autocorrelation decays exponentially as R_xx(τ) = A² · exp(-2λ|τ|).
                </p>
              </div>
            )}

            {config.type === 'harmonic_noise' && (
              <div className="pt-3 border-t border-[#AAEED3]/40 space-y-2 bg-[#F3FAF7] p-3 rounded-xl">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#123A36] font-semibold">Harmonic Frequency (f₀)</span>
                    <span className="font-mono font-bold text-[#2A7B73]">{config.harmonicFreq} Hz</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={Math.min(120, config.sampleRate * 0.45)}
                    step={2}
                    value={config.harmonicFreq}
                    onChange={(e) => setConfig({ ...config, harmonicFreq: Number(e.target.value) })}
                    className="w-full accent-[#2A7B73] cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#123A36] font-semibold">Signal-to-Noise Ratio (SNR)</span>
                    <span className="font-mono font-bold text-[#2A7B73]">{config.snrDb.toFixed(1)} dB</span>
                  </div>
                  <input
                    type="range"
                    min={-10}
                    max={15}
                    step={1}
                    value={config.snrDb}
                    onChange={(e) => setConfig({ ...config, snrDb: Number(e.target.value) })}
                    className="w-full accent-[#2A7B73] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-[#123A36]/60 font-mono">
                    <span>-10 dB (Submerged)</span>
                    <span>0 dB</span>
                    <span>+15 dB (Crisp)</span>
                  </div>
                </div>
              </div>
            )}

            {config.type === 'bandpass' && (
              <div className="pt-3 border-t border-[#AAEED3]/40 space-y-2 bg-[#F3FAF7] p-3 rounded-xl">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#123A36] font-semibold">Center Frequency (fc)</span>
                    <span className="font-mono font-bold text-[#2A7B73]">{config.bandpassCenter} Hz</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={Math.min(150, config.sampleRate * 0.42)}
                    step={2}
                    value={config.bandpassCenter}
                    onChange={(e) => setConfig({ ...config, bandpassCenter: Number(e.target.value) })}
                    className="w-full accent-[#2A7B73] cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#123A36] font-semibold">Resonant Bandwidth (B)</span>
                    <span className="font-mono font-bold text-[#2A7B73]">{config.bandpassBandwidth} Hz</span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={35}
                    step={1}
                    value={config.bandpassBandwidth}
                    onChange={(e) => setConfig({ ...config, bandpassBandwidth: Number(e.target.value) })}
                    className="w-full accent-[#2A7B73] cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* Streaming Speed Control */}
            {isStreaming && (
              <div className="pt-2 border-t border-[#AAEED3]/40">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#2A7B73] font-semibold">Stream Interval</span>
                  <span className="font-mono text-[#123A36] font-bold">{streamSpeed} ms</span>
                </div>
                <input
                  type="range"
                  min={30}
                  max={250}
                  step={10}
                  value={streamSpeed}
                  onChange={(e) => setStreamSpeed(Number(e.target.value))}
                  className="w-full accent-[#2A7B73] cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Quick Metrics & Real-time Telemetry */}
          <div className="bg-white rounded-[14px] p-5 shadow-sm border border-[#AAEED3]/50">
            <h4 className="text-xs font-bold text-[#123A36] uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>Telemetry Statistics</span>
              <Cpu className="w-3.5 h-3.5 text-[#2A7B73]" />
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-[#FAFCFB] p-2.5 rounded-lg border border-[#AAEED3]/50">
                <span className="text-[#123A36]/65 block text-[10px]">Sample Mean μ̂</span>
                <span className="text-[#123A36] font-bold">{stats.mean >= 0 ? '+' : ''}{stats.mean.toFixed(3)}</span>
              </div>
              <div className="bg-[#FAFCFB] p-2.5 rounded-lg border border-[#AAEED3]/50">
                <span className="text-[#123A36]/65 block text-[10px]">Sample Variance s²</span>
                <span className="text-[#123A36] font-bold">{stats.variance.toFixed(3)}</span>
              </div>
              <div className="bg-[#FAFCFB] p-2.5 rounded-lg border border-[#AAEED3]/50">
                <span className="text-[#123A36]/65 block text-[10px]">Total Power R_xx(0)</span>
                <span className="text-[#2A7B73] font-bold">{autocorrResult.totalPower.toFixed(3)} W</span>
              </div>
              <div className="bg-[#FAFCFB] p-2.5 rounded-lg border border-[#AAEED3]/50">
                <span className="text-[#123A36]/65 block text-[10px]">RMS Voltage</span>
                <span className="text-[#2A7B73] font-bold">{stats.rms.toFixed(3)} V</span>
              </div>
            </div>

            {/* Export buttons */}
            <div className="mt-4 pt-3 border-t border-[#AAEED3]/40 flex items-center justify-between">
              <span className="text-[11px] text-[#123A36]/70 font-medium">Export Data (CSV):</span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => exportCSV('signal')}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-[#F3FAF7] hover:bg-[#AAEED3]/40 text-[#2A7B73] border border-[#AAEED3] rounded-lg flex items-center gap-1 transition cursor-pointer shadow-2xs"
                  title="Export time series to CSV"
                >
                  <Download className="w-3 h-3 text-[#2A7B73]" />
                  x[n]
                </button>
                <button
                  type="button"
                  onClick={() => exportCSV('autocorr')}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-[#F3FAF7] hover:bg-[#AAEED3]/40 text-[#2A7B73] border border-[#AAEED3] rounded-lg flex items-center gap-1 transition cursor-pointer shadow-2xs"
                  title="Export autocorrelation to CSV"
                >
                  <Download className="w-3 h-3 text-[#2A7B73]" />
                  R_xx
                </button>
                <button
                  type="button"
                  onClick={() => exportCSV('psd')}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-[#F3FAF7] hover:bg-[#AAEED3]/40 text-[#2A7B73] border border-[#AAEED3] rounded-lg flex items-center gap-1 transition cursor-pointer shadow-2xs"
                  title="Export PSD to CSV"
                >
                  <Download className="w-3 h-3 text-[#2A7B73]" />
                  S_xx
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Interactive Visualizers (lg:col-span-8) */}
        <div className="lg:col-span-8 space-y-6">

          {/* VIEW 1: OSCILLOSCOPE TIME DOMAIN WAVEFORM */}
          {(activeSection === 'analyzer' || activeSection === 'autocorr') && (
            <div className="bg-white rounded-[14px] p-5 shadow-sm border border-[#AAEED3]/50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-2 border-b border-[#AAEED3]/40 gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#2A7B73]" />
                  <h3 className="text-sm sm:text-base font-bold text-[#123A36] font-heading">
                    Continuous Stochastic Waveform Realization x(t)
                  </h3>
                </div>
                <div className="flex items-center gap-3 text-xs font-mono text-[#123A36]/70">
                  <span>Duration: {(config.sampleCount / config.sampleRate).toFixed(2)}s</span>
                  <span>|</span>
                  <span>Range: [{stats.min.toFixed(2)}, {stats.max.toFixed(2)}]</span>
                </div>
              </div>

              {/* Time plot SVG */}
              <div className="relative w-full overflow-hidden bg-[#FAFCFB] rounded-xl p-2 border border-[#AAEED3]/60 shadow-2xs">
                <svg
                  viewBox={`0 0 ${timeSvgWidth} ${timeSvgHeight}`}
                  className="w-full h-44 sm:h-52 overflow-visible"
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const relX = (e.clientX - rect.left) / rect.width;
                    const idx = Math.min(signal.length - 1, Math.max(0, Math.floor(relX * signal.length)));
                    setTimeHover({
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top,
                      t: timeArray[idx],
                      val: signal[idx],
                    });
                  }}
                  onMouseLeave={() => setTimeHover(null)}
                >
                  {/* Horizontal grid lines */}
                  <line x1="10" y1="20" x2={timeSvgWidth - 10} y2="20" stroke="#E2E8F0" strokeDasharray="3 3" />
                  <line x1="10" y1={timeSvgHeight / 2} x2={timeSvgWidth - 10} y2={timeSvgHeight / 2} stroke="#CBD5E1" strokeWidth="1.2" />
                  <line x1="10" y1={timeSvgHeight - 20} x2={timeSvgWidth - 10} y2={timeSvgHeight - 20} stroke="#E2E8F0" strokeDasharray="3 3" />

                  {/* Mean Line indicator */}
                  {Math.abs(stats.mean) > 0.05 && (
                    <line
                      x1="10"
                      y1={timeSvgHeight / 2 - (stats.mean / Math.max(0.5, Math.max(Math.abs(stats.min), Math.abs(stats.max)) * 1.15)) * (timeSvgHeight / 2 - 16)}
                      x2={timeSvgWidth - 10}
                      y2={timeSvgHeight / 2 - (stats.mean / Math.max(0.5, Math.max(Math.abs(stats.min), Math.abs(stats.max)) * 1.15)) * (timeSvgHeight / 2 - 16)}
                      stroke="#D97706"
                      strokeDasharray="4 4"
                      strokeWidth="1.2"
                    />
                  )}

                  {/* Waveform polyline */}
                  <polyline
                    fill="none"
                    stroke="#2A7B73"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    points={timePoints}
                  />

                  {/* Sample points dots */}
                  {config.sampleCount <= 256 && (
                    signal.map((y, idx) => {
                      if (idx % 2 !== 0 && config.sampleCount > 128) return null;
                      const yRange = Math.max(0.5, Math.max(Math.abs(stats.min), Math.abs(stats.max)) * 1.15);
                      const px = (idx / (signal.length - 1)) * (timeSvgWidth - 20) + 10;
                      const py = timeSvgHeight / 2 - (y / yRange) * (timeSvgHeight / 2 - 16);
                      return (
                        <circle
                          key={idx}
                          cx={px}
                          cy={py}
                          r={2}
                          fill="#55A9A0"
                        />
                      );
                    })
                  )}
                </svg>

                {/* Tooltip Overlay */}
                {timeHover && (
                  <div
                    className="absolute pointer-events-none bg-[#123A36] text-white rounded-lg px-2.5 py-1 text-[11px] font-mono shadow-lg border border-[#2A7B73]"
                    style={{
                      left: Math.min(window.innerWidth > 640 ? 550 : 200, timeHover.x + 12),
                      top: Math.max(8, timeHover.y - 30),
                    }}
                  >
                    <span>t = {timeHover.t.toFixed(4)}s</span> |{' '}
                    <span className="text-[#AAEED3] font-bold">x(t) = {timeHover.val.toFixed(3)}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center text-[11px] text-[#123A36]/70 font-mono mt-2">
                <span>t = 0.000s</span>
                <span className="text-[#2A7B73] font-semibold">Sample Mean μ̂ = {stats.mean.toFixed(2)}</span>
                <span>t = {(config.sampleCount / config.sampleRate).toFixed(3)}s</span>
              </div>
            </div>
          )}

          {/* VIEW 2: AUTOCORRELATION & TIME LAGGING WORKOUT */}
          {(activeSection === 'analyzer' || activeSection === 'autocorr') && (
            <div className="bg-white rounded-[14px] p-5 shadow-sm border border-[#AAEED3]/50 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#AAEED3]/40 gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#0D9488]" />
                    <h3 className="text-sm sm:text-base font-bold text-[#123A36] font-heading">
                      Autocorrelation Function R_xx(τ) & Time Lagging Workout
                    </h3>
                  </div>
                  <p className="text-xs text-[#123A36]/70 mt-0.5">
                    Measuring internal statistical coherence by lagging x(t) against delayed x(t - τ).
                  </p>
                </div>

                {/* Lag Sweep Controls */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleStartSweep}
                    disabled={isSweepingLag}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#2A7B73] text-white hover:bg-[#123A36] transition cursor-pointer disabled:opacity-50 shadow-2xs"
                  >
                    <FastForward className="w-3.5 h-3.5" />
                    <span>{isSweepingLag ? 'Sweeping...' : 'Sweep -τ to +τ'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowNormalizedAutocorr(!showNormalizedAutocorr)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium bg-[#F3FAF7] text-[#2A7B73] border border-[#AAEED3] hover:bg-[#AAEED3]/30 transition cursor-pointer"
                  >
                    {showNormalizedAutocorr ? 'Normalized ρ(τ)' : 'Unnormalized R(τ)'}
                  </button>
                </div>
              </div>

              {/* Interactive Lag Slider */}
              <div className="bg-[#FAFCFB] p-3.5 rounded-xl border border-[#AAEED3]/60">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-[#123A36] font-semibold flex items-center gap-1.5">
                    <span>Selected Lag τ:</span>
                    <span className="font-mono text-[#2A7B73] font-bold bg-[#AAEED3]/30 px-2 py-0.5 rounded border border-[#AAEED3]">
                      {selectedLag >= 0 ? `+${selectedLag}` : selectedLag} samples ({(selectedLag / config.sampleRate * 1000).toFixed(1)} ms)
                    </span>
                  </span>
                  <span className="text-[11px] font-mono text-[#123A36]/70">
                    Overlap: {workoutStep.overlapCount} samples
                  </span>
                </div>
                <input
                  type="range"
                  min={-tauMax}
                  max={tauMax}
                  step={1}
                  value={selectedLag}
                  onChange={(e) => setSelectedLag(Number(e.target.value))}
                  className="w-full accent-[#2A7B73] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[#123A36]/60 font-mono mt-1">
                  <span>-τ_max = -{tauMax}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedLag(0)}
                    className="text-[#2A7B73] hover:underline font-bold cursor-pointer"
                  >
                    τ = 0 (Total Power Peak)
                  </button>
                  <span>+τ_max = +{tauMax}</span>
                </div>
              </div>

              {/* Autocorrelation Plot SVG */}
              <div className="relative w-full bg-[#FAFCFB] rounded-xl p-2 border border-[#AAEED3]/60 shadow-2xs">
                <svg
                  viewBox={`0 0 ${autocorrSvgWidth} ${autocorrSvgHeight}`}
                  className="w-full h-48 sm:h-52 overflow-visible"
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const relX = (e.clientX - rect.left) / rect.width;
                    const idx = Math.min(autocorrResult.lags.length - 1, Math.max(0, Math.floor(relX * autocorrResult.lags.length)));
                    setAutocorrHover({
                      lag: autocorrResult.lags[idx],
                      tauSec: autocorrResult.timeLags[idx],
                      val: showNormalizedAutocorr ? autocorrResult.rho[idx] : autocorrResult.rxx[idx],
                    });
                  }}
                  onMouseLeave={() => setAutocorrHover(null)}
                >
                  {/* Grid Lines */}
                  <line x1="15" y1="20" x2={autocorrSvgWidth - 15} y2="20" stroke="#E2E8F0" strokeDasharray="3 3" />
                  <line x1="15" y1={autocorrSvgHeight / 2} x2={autocorrSvgWidth - 15} y2={autocorrSvgHeight / 2} stroke="#CBD5E1" strokeWidth="1.2" />
                  <line x1="15" y1={autocorrSvgHeight - 20} x2={autocorrSvgWidth - 15} y2={autocorrSvgHeight - 20} stroke="#E2E8F0" strokeDasharray="3 3" />

                  {/* Vertical zero-lag reference center line */}
                  <line
                    x1={autocorrSvgWidth / 2}
                    y1="10"
                    x2={autocorrSvgWidth / 2}
                    y2={autocorrSvgHeight - 10}
                    stroke="#55A9A0"
                    strokeDasharray="2 2"
                    strokeWidth="1.2"
                  />

                  {/* Curve polyline */}
                  <polyline
                    fill="none"
                    stroke="#2A7B73"
                    strokeWidth="2.2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    points={autocorrPoints}
                  />

                  {/* Active Selected Lag vertical cursor */}
                  {(() => {
                    const count = autocorrResult.lags.length;
                    const idx = autocorrResult.lags.indexOf(selectedLag);
                    if (idx >= 0) {
                      const curX = (idx / (count - 1)) * (autocorrSvgWidth - 30) + 15;
                      const val = showNormalizedAutocorr ? workoutStep.normalizedRho : workoutStep.calculatedRxx;
                      let maxVal = Math.max(0.1, ...(showNormalizedAutocorr ? autocorrResult.rho : autocorrResult.rxx).map(Math.abs));
                      if (showNormalizedAutocorr) maxVal = 1.05;
                      const curY = autocorrSvgHeight / 2 - (val / maxVal) * (autocorrSvgHeight / 2 - 22);

                      return (
                        <g>
                          <line
                            x1={curX}
                            y1="10"
                            x2={curX}
                            y2={autocorrSvgHeight - 10}
                            stroke="#E11D48"
                            strokeWidth="1.5"
                            strokeDasharray="3 2"
                          />
                          <circle cx={curX} cy={curY} r={5} fill="#E11D48" stroke="#ffffff" strokeWidth="2" />
                        </g>
                      );
                    }
                    return null;
                  })()}
                </svg>

                {/* Autocorr Tooltip */}
                {autocorrHover && (
                  <div className="absolute top-2 right-4 bg-[#123A36] text-white px-3 py-1.5 rounded-lg text-xs font-mono pointer-events-none shadow-md border border-[#2A7B73]">
                    <span>Lag: {autocorrHover.lag}</span> |{' '}
                    <span>τ: {(autocorrHover.tauSec * 1000).toFixed(1)}ms</span> |{' '}
                    <span className="text-[#AAEED3] font-bold">{showNormalizedAutocorr ? 'ρ' : 'R'}: {autocorrHover.val.toFixed(3)}</span>
                  </div>
                )}
              </div>

              {/* TRIPLE COMPARATIVE GRAPH: x(t), delayed x(t-tau), and product x(t)*x(t-tau) */}
              <div className="bg-[#FAFCFB] rounded-xl p-4 border border-[#AAEED3]/60 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#123A36] flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#0D9488] inline-block" />
                    Comparative Time Lag Workout: x(t) vs. x(t - τ) & Product Area
                  </span>
                  <span className="text-[11px] font-mono text-[#2A7B73]">
                    Net Integral Area = ∫ x(t)·x(t - τ) dt
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs font-mono">
                  <div className="p-2 rounded-lg bg-white border border-[#AAEED3]/50 flex items-center gap-2 shadow-2xs">
                    <span className="w-2.5 h-0.5 bg-[#2A7B73] inline-block" />
                    <span className="text-[#123A36] font-medium">Original x(t)</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-[#AAEED3]/50 flex items-center gap-2 shadow-2xs">
                    <span className="w-2.5 h-0.5 bg-[#D97706] inline-block" />
                    <span className="text-[#D97706] font-medium">Delayed x(t - τ)</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-[#AAEED3]/50 flex items-center gap-2 shadow-2xs">
                    <span className="w-2.5 h-0.5 bg-[#0D9488] inline-block" />
                    <span className="text-[#0D9488] font-medium">Product x(t) · x(t - τ)</span>
                  </div>
                </div>

                {/* Comparative Mini Graph */}
                <div className="w-full bg-white rounded-lg p-2 border border-[#AAEED3]/50 shadow-2xs">
                  <svg viewBox={`0 0 ${timeSvgWidth} 140`} className="w-full h-32 overflow-visible">
                    <line x1="10" y1="70" x2={timeSvgWidth - 10} y2="70" stroke="#CBD5E1" strokeWidth="1" />
                    
                    {/* Shaded Area for Product */}
                    {overlapAreaPath && (
                      <path
                        d={overlapAreaPath}
                        fill="rgba(85, 169, 160, 0.28)"
                        stroke="none"
                      />
                    )}

                    {/* Delayed signal polyline */}
                    {delayedPoints && (
                      <polyline
                        fill="none"
                        stroke="#D97706"
                        strokeWidth="1.4"
                        strokeDasharray="4 2"
                        points={delayedPoints}
                      />
                    )}

                    {/* Instantaneous product polyline */}
                    {productPoints && (
                      <polyline
                        fill="none"
                        stroke="#0D9488"
                        strokeWidth="1.8"
                        points={productPoints}
                      />
                    )}
                  </svg>
                </div>

                {/* Step-by-Step Mathematical Workout Calculation Box */}
                <div className="p-3.5 bg-white rounded-xl border border-[#AAEED3]/50 text-xs space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between text-[#123A36] font-bold border-b border-[#AAEED3]/40 pb-1.5">
                    <span className="flex items-center gap-1.5 text-[#2A7B73]">
                      <TrendingUp className="w-3.5 h-3.5" />
                      Step-by-Step Unbiased Estimator Workout at τ = {selectedLag}:
                    </span>
                    <span className="font-mono text-[#123A36] font-bold bg-[#AAEED3]/30 px-2 py-0.5 rounded">
                      R̂_xx({selectedLag}) = {workoutStep.calculatedRxx.toFixed(4)}
                    </span>
                  </div>

                  <div className="font-mono text-[11px] text-[#123A36] leading-relaxed bg-[#F3FAF7] p-3 rounded-lg border border-[#AAEED3]/40 space-y-1">
                    <div className="text-[#123A36]/70">
                      1. Estimator Formula: R̂_xx[τ] = (1 / (N - |τ|)) · ∑ x[n] · x[n + |τ|]
                    </div>
                    <div>
                      2. Overlap Count: N - |τ| = {config.sampleCount} - {Math.abs(selectedLag)} = <strong className="text-[#2A7B73]">{workoutStep.overlapCount}</strong> valid sample pairs.
                    </div>
                    <div>
                      3. Evaluated Product Sum: ∑ x[n]x[n+τ] = <strong className="text-[#2A7B73]">{workoutStep.sumProduct.toFixed(3)}</strong>
                    </div>
                    <div className="text-[#2A7B73] font-semibold">
                      4. Sample Autocorrelation: R̂_xx({selectedLag}) = ({workoutStep.sumProduct.toFixed(3)} / {workoutStep.overlapCount}) = <strong>{workoutStep.calculatedRxx.toFixed(4)}</strong>
                    </div>
                    <div className="text-[#123A36] font-semibold">
                      5. Normalized Coherence: ρ_xx({selectedLag}) = (R_xx({selectedLag}) / R_xx(0)) = <strong className="text-[#2A7B73]">{workoutStep.normalizedRho.toFixed(4)}</strong> ({workoutStep.powerPercent.toFixed(1)}% power retained)
                    </div>
                  </div>

                  {/* Micro sample pairs table */}
                  <div>
                    <span className="text-[10px] text-[#123A36]/70 block mb-1 font-mono uppercase font-semibold">
                      First {workoutStep.samplePairs.length} Overlapping Product Pairs:
                    </span>
                    <div className="overflow-x-auto rounded-lg border border-[#AAEED3]/50">
                      <table className="w-full text-[10px] font-mono text-left text-[#123A36] border-collapse">
                        <thead>
                          <tr className="bg-[#F3FAF7] text-[#123A36]/70 border-b border-[#AAEED3]/50">
                            <th className="p-1.5">Pair n</th>
                            <th className="p-1.5">x[n]</th>
                            <th className="p-1.5">x[n + τ]</th>
                            <th className="p-1.5 text-[#2A7B73]">x[n] · x[n + τ]</th>
                          </tr>
                        </thead>
                        <tbody>
                          {workoutStep.samplePairs.map((p) => (
                            <tr key={p.n} className="border-b border-[#AAEED3]/30 hover:bg-[#F3FAF7]/80">
                              <td className="p-1.5 text-[#123A36]/60">n = {p.n}</td>
                              <td className="p-1.5">{p.xn.toFixed(3)}</td>
                              <td className="p-1.5">{p.xnTau.toFixed(3)}</td>
                              <td className="p-1.5 text-[#2A7B73] font-bold">{p.product >= 0 ? '+' : ''}{p.product.toFixed(4)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 3: POWER SPECTRAL DENSITY & WIENER-KHINCHIN VERIFICATION */}
          {(activeSection === 'analyzer' || activeSection === 'psd') && (
            <div className="bg-white rounded-[14px] p-5 shadow-sm border border-[#AAEED3]/50 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#AAEED3]/40 gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#2A7B73]" />
                    <h3 className="text-sm sm:text-base font-bold text-[#123A36] font-heading">
                      Power Spectral Density (PSD) & Wiener–Khinchin Verification
                    </h3>
                  </div>
                  <p className="text-xs text-[#123A36]/70 mt-0.5">
                    Harmonizing the raw periodogram, Welch ensemble averaging, and F&#123;R_xx(τ)&#125;.
                  </p>
                </div>

                {/* Scale & Curve Selectors */}
                <div className="flex items-center gap-2">
                  <div className="flex bg-[#F3FAF7] p-0.5 rounded-lg border border-[#AAEED3] text-xs font-mono">
                    <button
                      type="button"
                      onClick={() => setPsdScale('linear')}
                      className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                        psdScale === 'linear'
                          ? 'bg-[#2A7B73] text-white font-bold shadow-2xs'
                          : 'text-[#123A36]/70 hover:text-[#123A36]'
                      }`}
                    >
                      Linear (V²/Hz)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPsdScale('dB')}
                      className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                        psdScale === 'dB'
                          ? 'bg-[#2A7B73] text-white font-bold shadow-2xs'
                          : 'text-[#123A36]/70 hover:text-[#123A36]'
                      }`}
                    >
                      Log (dB/Hz)
                    </button>
                  </div>
                </div>
              </div>

              {/* Interactive Curve Legend Toggles */}
              <div className="flex flex-wrap items-center gap-3 text-xs font-mono bg-[#FAFCFB] p-2.5 rounded-xl border border-[#AAEED3]/60">
                <span className="text-[#123A36]/70 text-[11px] uppercase font-bold mr-1">Curves:</span>
                <label className="flex items-center gap-1.5 cursor-pointer text-[#E11D48]">
                  <input
                    type="checkbox"
                    checked={visiblePsdCurves.raw}
                    onChange={(e) => setVisiblePsdCurves({ ...visiblePsdCurves, raw: e.target.checked })}
                    className="accent-[#E11D48]"
                  />
                  <span>1. Raw Periodogram I_N(f)</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer text-[#0D9488]">
                  <input
                    type="checkbox"
                    checked={visiblePsdCurves.welch}
                    onChange={(e) => setVisiblePsdCurves({ ...visiblePsdCurves, welch: e.target.checked })}
                    className="accent-[#0D9488]"
                  />
                  <span>2. Welch Smoothed PSD Ŝ_xx(f)</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer text-[#2563EB]">
                  <input
                    type="checkbox"
                    checked={visiblePsdCurves.wk}
                    onChange={(e) => setVisiblePsdCurves({ ...visiblePsdCurves, wk: e.target.checked })}
                    className="accent-[#2563EB]"
                  />
                  <span>3. Wiener–Khinchin F&#123;R_xx&#125;</span>
                </label>
              </div>

              {/* PSD Chart SVG */}
              <div className="relative w-full bg-[#FAFCFB] rounded-xl p-2 border border-[#AAEED3]/60 shadow-2xs">
                <svg
                  viewBox={`0 0 ${psdSvgWidth} ${psdSvgHeight}`}
                  className="w-full h-56 sm:h-64 overflow-visible"
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const relX = (e.clientX - rect.left) / rect.width;
                    const idx = Math.min(psdResult.frequencies.length - 1, Math.max(0, Math.floor(relX * psdResult.frequencies.length)));
                    setPsdHover({
                      freq: psdResult.frequencies[idx],
                      raw: psdResult.rawPeriodogram[idx],
                      welch: psdResult.welchPSD[idx],
                      wk: psdResult.wienerKhinchinPSD[idx],
                    });
                  }}
                  onMouseLeave={() => setPsdHover(null)}
                >
                  {/* Grid Lines */}
                  <line x1="20" y1="20" x2={psdSvgWidth - 20} y2="20" stroke="#E2E8F0" strokeDasharray="3 3" />
                  <line x1="20" y1={psdSvgHeight / 2} x2={psdSvgWidth - 20} y2={psdSvgHeight / 2} stroke="#E2E8F0" strokeDasharray="3 3" />
                  <line x1="20" y1={psdSvgHeight - 25} x2={psdSvgWidth - 20} y2={psdSvgHeight - 25} stroke="#CBD5E1" strokeWidth="1.2" />

                  {/* 1. Raw Periodogram (High-variance, noisy) */}
                  {visiblePsdCurves.raw && rawPath && (
                    <path
                      d={rawPath}
                      fill="none"
                      stroke="#E11D48"
                      strokeWidth="1.1"
                      strokeOpacity="0.7"
                    />
                  )}

                  {/* 2. Welch Smoothed PSD */}
                  {visiblePsdCurves.welch && welchPath && (
                    <path
                      d={welchPath}
                      fill="none"
                      stroke="#0D9488"
                      strokeWidth="2.5"
                    />
                  )}

                  {/* 3. Wiener-Khinchin Transform */}
                  {visiblePsdCurves.wk && wkPath && (
                    <path
                      d={wkPath}
                      fill="none"
                      stroke="#2563EB"
                      strokeWidth="2"
                      strokeDasharray="5 3"
                    />
                  )}
                </svg>

                {/* Hover info tooltip */}
                {psdHover && (
                  <div className="absolute top-3 right-4 bg-[#123A36] text-white px-3 py-2 rounded-lg text-xs font-mono pointer-events-none shadow-xl space-y-0.5 border border-[#2A7B73]">
                    <div className="text-[#AAEED3] font-bold border-b border-white/20 pb-1">
                      Frequency: {psdHover.freq.toFixed(2)} Hz
                    </div>
                    {visiblePsdCurves.raw && <div className="text-rose-300">Raw: {psdHover.raw.toFixed(5)}</div>}
                    {visiblePsdCurves.welch && <div className="text-emerald-300">Welch: {psdHover.welch.toFixed(5)}</div>}
                    {visiblePsdCurves.wk && <div className="text-sky-300">Wiener–Khinchin: {psdHover.wk.toFixed(5)}</div>}
                  </div>
                )}
              </div>

              {/* Parseval Energy Verification Badge */}
              <div className="p-3.5 bg-[#FAFCFB] rounded-xl border border-[#AAEED3]/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-[#2A7B73] shrink-0" />
                  <div>
                    <h5 className="text-xs font-bold text-[#123A36] flex items-center gap-2">
                      <span>Parseval Energy Conservation:</span>
                      <span className="text-[#2A7B73] font-mono">
                        {psdResult.parsevalMatchPercent.toFixed(1)}% Agreement
                      </span>
                    </h5>
                    <p className="text-[11px] text-[#123A36]/70 mt-0.5">
                      Total Power in Time Domain P_time = R_xx(0) = {psdResult.integratedPowerTime.toFixed(3)} W ≈ Integrated PSD ∫ S_xx(f) df = {psdResult.integratedPowerFreq.toFixed(3)} W.
                    </p>
                  </div>
                </div>

                <div className="px-3 py-1 bg-[#AAEED3]/40 border border-[#AAEED3] rounded-lg text-[11px] font-mono text-[#123A36] font-semibold shrink-0">
                  THEOREM CONFIRMED
                </div>
              </div>

              {/* 5-STAGE PSD EVOLUTIONARY ANIMATION */}
              <div className="p-4 bg-[#FAFCFB] rounded-xl border border-[#AAEED3]/60 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#AAEED3]/40 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#2A7B73]" />
                    <h4 className="text-xs font-bold text-[#123A36] uppercase tracking-wide">
                      Interactive 5-Stage PSD Evolutionary Pipeline
                    </h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEvolutionPlaying(!isEvolutionPlaying)}
                      className="px-3 py-1 text-xs font-semibold rounded-lg bg-[#2A7B73] text-white hover:bg-[#123A36] transition flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      {isEvolutionPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      <span>{isEvolutionPlaying ? 'Pause Evolution' : 'Play Evolution'}</span>
                    </button>
                  </div>
                </div>

                {/* 5 Step Indicator Tabs */}
                <div className="grid grid-cols-5 gap-1.5 text-center">
                  {[
                    { step: 1, label: '1. Raw Signal', desc: 'Realization x[n]' },
                    { step: 2, label: '2. Windowing', desc: 'Hann taper' },
                    { step: 3, label: '3. Fourier', desc: 'Phasor bins' },
                    { step: 4, label: '4. Periodogram', desc: '|X(f)|² / N' },
                    { step: 5, label: '5. Ensemble', desc: 'Welch / WK' },
                  ].map((s) => (
                    <button
                      key={s.step}
                      type="button"
                      onClick={() => {
                        setEvolutionStage(s.step);
                        setIsEvolutionPlaying(false);
                      }}
                      className={`p-2 rounded-lg border text-left transition cursor-pointer ${
                        evolutionStage === s.step
                          ? 'bg-[#2A7B73] text-white border-[#2A7B73] shadow-xs'
                          : 'bg-white text-[#123A36] border-[#AAEED3]/50 hover:bg-[#F3FAF7]'
                      }`}
                    >
                      <div className="text-[11px] font-bold">{s.label}</div>
                      <div className={`text-[9px] truncate ${evolutionStage === s.step ? 'text-white/80' : 'text-[#123A36]/60'}`}>
                        {s.desc}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Active Evolution Stage Narrative & Visual Canvas */}
                <div className="p-3 bg-white rounded-lg border border-[#AAEED3]/50 text-xs shadow-2xs">
                  {evolutionStage === 1 && (
                    <div className="space-y-1">
                      <span className="font-bold text-[#2A7B73]">Stage 1: Raw Stochastic Realization x[n]</span>
                      <p className="text-[#123A36]/80 text-[11px]">
                        A single trajectory drawn from the ensemble of random paths. Because x[n] is infinite-energy in theory, we must analyze its average power over finite observations.
                      </p>
                    </div>
                  )}
                  {evolutionStage === 2 && (
                    <div className="space-y-1">
                      <span className="font-bold text-[#0D9488]">Stage 2: Segmenting & Hann Windowing w[n]</span>
                      <p className="text-[#123A36]/80 text-[11px]">
                        Dividing x[n] into overlapping sub-blocks with smooth tapering (Hann window) suppresses abrupt edge discontinuities, mitigating high-frequency spectral leakage.
                      </p>
                    </div>
                  )}
                  {evolutionStage === 3 && (
                    <div className="space-y-1">
                      <span className="font-bold text-[#2563EB]">Stage 3: Fourier Phasor Projection X[k]</span>
                      <p className="text-[#123A36]/80 text-[11px]">
                        Correlating each block against orthogonal complex sinusoids exp(-j 2π k n / N) decomposes time variations into frequency-domain harmonic weights.
                      </p>
                    </div>
                  )}
                  {evolutionStage === 4 && (
                    <div className="space-y-1">
                      <span className="font-bold text-[#E11D48]">Stage 4: Raw Periodogram |X[k]|² / (N · fs)</span>
                      <p className="text-[#123A36]/80 text-[11px]">
                        Squaring spectral amplitudes produces the raw power periodogram. Notice its high variance: even as N → ∞, the raw periodogram does NOT converge smoothly without ensemble averaging!
                      </p>
                    </div>
                  )}
                  {evolutionStage === 5 && (
                    <div className="space-y-1">
                      <span className="font-bold text-[#2A7B73]">Stage 5: Welch Ensemble Smoothing & Wiener–Khinchin Duality</span>
                      <p className="text-[#123A36]/80 text-[11px]">
                        Averaging across overlapping blocks (Welch method) eliminates variance. The result matches the exact Fourier transform of the autocorrelation sequence S_xx(f) = F&#123;R_xx(τ)&#125;.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* VIEW 4: THEORETICAL FOUNDATIONS & TRI-DOMAIN DUALITY */}
          {(activeSection === 'analyzer' || activeSection === 'theory') && (
            <div className="bg-white rounded-[14px] p-5 shadow-sm border border-[#AAEED3]/50 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-[#AAEED3]/40">
                <Sparkles className="w-4 h-4 text-[#2A7B73]" />
                <h3 className="text-sm sm:text-base font-bold text-[#123A36] font-heading">
                  Theoretical Foundations: The Wiener–Khinchin Theorem
                </h3>
              </div>

              {/* Tri-Domain Duality Visual Diagram */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 bg-[#FAFCFB] rounded-xl border border-[#AAEED3]/60">
                  <span className="text-[10px] uppercase font-mono text-[#2A7B73] block font-bold">1. Time Domain</span>
                  <div className="text-base font-bold text-[#123A36] font-mono mt-1">x(t)</div>
                  <p className="text-[11px] text-[#123A36]/70 mt-1">
                    Instantaneous stochastic waveform with mean μ_x and variance σ²_x.
                  </p>
                </div>

                <div className="p-3.5 bg-[#FAFCFB] rounded-xl border border-[#AAEED3]/60">
                  <span className="text-[10px] uppercase font-mono text-[#2A7B73] block font-bold">2. Lag Domain</span>
                  <div className="text-base font-bold text-[#123A36] font-mono mt-1">R_xx(τ) = E[x(t)·x(t+τ)]</div>
                  <p className="text-[11px] text-[#123A36]/70 mt-1">
                    Statistical memory and coherence. R_xx(0) = P_total is the maximum value.
                  </p>
                </div>

                <div className="p-3.5 bg-[#FAFCFB] rounded-xl border border-[#AAEED3]/60">
                  <span className="text-[10px] uppercase font-mono text-[#2A7B73] block font-bold">3. Spectral Domain</span>
                  <div className="text-base font-bold text-[#123A36] font-mono mt-1">S_xx(f) = F&#123;R_xx(τ)&#125;</div>
                  <p className="text-[11px] text-[#123A36]/70 mt-1">
                    Power Spectral Density showing energy allocation across all frequencies.
                  </p>
                </div>
              </div>

              {/* Fundamental Theorem Equations */}
              <div className="p-4 bg-[#FAFCFB] rounded-xl border border-[#AAEED3]/60 text-xs space-y-3 font-mono">
                <div className="text-[#2A7B73] font-bold border-b border-[#AAEED3]/40 pb-1.5 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" />
                  <span>Continuous Wiener–Khinchin Transform Pair:</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[#123A36] text-[11px]">
                  <div className="bg-white p-3 rounded-lg border border-[#AAEED3]/50 shadow-2xs">
                    <span className="text-[#123A36]/65 block text-[10px] font-semibold">Forward Transform (PSD):</span>
                    S_xx(f) = ∫ R_xx(τ) · exp(-j 2π f τ) dτ
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-[#AAEED3]/50 shadow-2xs">
                    <span className="text-[#123A36]/65 block text-[10px] font-semibold">Inverse Transform (Autocorrelation):</span>
                    R_xx(τ) = ∫ S_xx(f) · exp(+j 2π f τ) df
                  </div>
                </div>

                {/* 4 Pillars of Stochastic Signal Analysis */}
                <div className="space-y-1.5 pt-2 text-[11px] text-[#123A36]/80 font-sans">
                  <div className="flex items-start gap-2">
                    <span className="text-[#2A7B73] font-bold">• Total Power Law:</span>
                    <span>R_xx(0) = ∫ S_xx(f) df = σ_x² + μ_x² = P_avg</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[#2A7B73] font-bold">• Even Symmetry:</span>
                    <span>R_xx(-τ) = R_xx(τ) and S_xx(-f) = S_xx(f) for real-valued random processes.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[#2A7B73] font-bold">• Peak at Origin:</span>
                    <span>|R_xx(τ)| ≤ R_xx(0) for all lags τ. Coherence can never exceed total energy.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[#2A7B73] font-bold">• Non-Negative Spectrum:</span>
                    <span>S_xx(f) ≥ 0 for all frequencies f. Spectral power density cannot be negative.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
