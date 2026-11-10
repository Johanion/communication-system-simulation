/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * DSP Workbench - Module A: Signal Generator & Time-Domain Analysis
 * Deterministic Signal Synthesis, Time Transformations, and Interactive Playback.
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

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Activity,
  Play,
  Pause,
  RotateCcw,
  Shuffle,
  Waves,
  Sliders,
  Zap,
  Layers,
  ZoomIn,
  ZoomOut,
  ChevronDown,
  Check,
  Sparkles,
} from 'lucide-react';
import {
  SignalType,
  SignalGeneratorParams,
  DEFAULT_SIGNAL_PARAMS,
  SignalGenerator,
  GeneratedSignal,
} from '../../math/signalGenerator';
import { SignalCombinerSimulator } from './SignalCombinerSimulator';

// Five categorized waveform groups in specified order
interface WaveformOption {
  value: SignalType;
  label: string;
}

interface WaveformCategory {
  category: string;
  options: WaveformOption[];
}

const WAVEFORM_CATEGORIES: WaveformCategory[] = [
  {
    category: 'Periodic',
    options: [
      { value: 'sinusoidal', label: '1. Sinusoidal [A·sin(2πft + φ)]' },
      { value: 'cosine', label: '2. Cosine [A·cos(2πft + φ)]' },
      { value: 'square', label: '3. Square Wave (with Duty Cycle)' },
      { value: 'triangular', label: '4. Triangular Wave' },
      { value: 'sawtooth', label: '5. Sawtooth Wave' },
    ],
  },
  {
    category: 'Singularity and Step',
    options: [
      { value: 'unit_step', label: '6. Unit Step [A·u(t - t₀)]' },
      { value: 'impulse', label: '7. Unit Impulse Approximation' },
      { value: 'ramp', label: '8. Ramp Signal [A·(t - t₀)u(t - t₀)]' },
    ],
  },
  {
    category: 'Pulses and Sinc',
    options: [
      { value: 'rectangular_pulse', label: '11. Rectangular Pulse' },
      { value: 'sinc', label: '12. Sinc Signal [Normalized / Sinc]' },
    ],
  },
  {
    category: 'Exponential and Sweeps',
    options: [
      { value: 'exponential', label: '10. Exponential Growth / Decay' },
    ],
  },
  {
    category: 'Multitone',
    options: [
      { value: 'dc', label: '9. DC Signal [A + C]' },
    ],
  },
];

type ParameterSection = 'waveform' | 'operations' | 'sampling';

export const SignalsOpsModule: React.FC = () => {
  // Primary view tabs: 'synthesizer' (default) vs 'combiner'
  const [activePage, setActivePage] = useState<'synthesizer' | 'combiner'>('synthesizer');

  const handleSwitchPage = (page: 'synthesizer' | 'combiner') => {
    if (page === activePage) return;
    if (activePage === 'synthesizer' && isPlaying) {
      setIsPlaying(false);
    }
    setActivePage(page);
  };

  // Parameters state
  const [params, setParams] = useState<SignalGeneratorParams>(DEFAULT_SIGNAL_PARAMS);
  const [viewMode, setViewMode] = useState<'both' | 'curve' | 'stems'>('both');
  const [showTransformed, setShowTransformed] = useState<boolean>(true);

  // Zoom scale state for canvas
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);

  // Interactive inspection hover
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Parameter Section active tab
  const [activeParamSection, setActiveParamSection] = useState<ParameterSection>('waveform');

  // Animation sweep playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0); // 0.5x, 1x, 2x
  const [playProgress, setPlayProgress] = useState<number>(0); // 0 to 1

  // Dropdown open states
  const [isWaveformOpen, setIsWaveformOpen] = useState<boolean>(false);
  const [waveformPlacement, setWaveformPlacement] = useState<'down' | 'up'>('down');
  const waveformBtnRef = useRef<HTMLButtonElement>(null);
  const waveformMenuRef = useRef<HTMLDivElement>(null);

  const [isActionsOpen, setIsActionsOpen] = useState<boolean>(false);
  const [actionsPlacement, setActionsPlacement] = useState<'down' | 'up'>('down');
  const actionsBtnRef = useRef<HTMLButtonElement>(null);
  const actionsMenuRef = useRef<HTMLDivElement>(null);

  const [isSectionOpen, setIsSectionOpen] = useState<boolean>(false);
  const [sectionPlacement, setSectionPlacement] = useState<'down' | 'up'>('down');
  const sectionBtnRef = useRef<HTMLButtonElement>(null);
  const sectionMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        waveformMenuRef.current &&
        !waveformMenuRef.current.contains(target) &&
        !waveformBtnRef.current?.contains(target)
      ) {
        setIsWaveformOpen(false);
      }
      if (
        actionsMenuRef.current &&
        !actionsMenuRef.current.contains(target) &&
        !actionsBtnRef.current?.contains(target)
      ) {
        setIsActionsOpen(false);
      }
      if (
        sectionMenuRef.current &&
        !sectionMenuRef.current.contains(target) &&
        !sectionBtnRef.current?.contains(target)
      ) {
        setIsSectionOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsWaveformOpen(false);
        setIsActionsOpen(false);
        setIsSectionOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Compute placement helper
  const updateMenuPlacement = (btnEl: HTMLElement | null, setPlacement: (p: 'down' | 'up') => void, menuHeight = 260) => {
    if (!btnEl) return;
    const rect = btnEl.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
      setPlacement('up');
    } else {
      setPlacement('down');
    }
  };

  // Toggle handlers
  const toggleWaveform = () => {
    updateMenuPlacement(waveformBtnRef.current, setWaveformPlacement, 280);
    setIsWaveformOpen((prev) => !prev);
  };

  const toggleActions = () => {
    updateMenuPlacement(actionsBtnRef.current, setActionsPlacement, 180);
    setIsActionsOpen((prev) => !prev);
  };

  const toggleSection = () => {
    updateMenuPlacement(sectionBtnRef.current, setSectionPlacement, 160);
    setIsSectionOpen((prev) => !prev);
  };

  // Generate signal based on active parameters
  const generatedSignal: GeneratedSignal = useMemo(() => {
    return SignalGenerator.generate(params);
  }, [params]);

  // Shannon-Nyquist limit check
  const isNyquistViolated = useMemo(() => {
    const isPeriodic = [
      'sinusoidal',
      'cosine',
      'square',
      'triangular',
      'sawtooth',
      'sinc',
    ].includes(params.signalType);
    return isPeriodic && params.frequencyHz >= params.samplingFrequencyHz / 2.0;
  }, [params.signalType, params.frequencyHz, params.samplingFrequencyHz]);

  // Quick preset handlers
  const handleQuickSine = () => {
    setParams({
      ...DEFAULT_SIGNAL_PARAMS,
      signalType: 'sinusoidal',
      amplitude: 1.0,
      frequencyHz: 5.0,
      phaseDegrees: 0.0,
      startTimeSeconds: 0.0,
      endTimeSeconds: 1.0,
    });
    setIsActionsOpen(false);
  };

  const handleQuickPulse = () => {
    setParams({
      ...DEFAULT_SIGNAL_PARAMS,
      signalType: 'rectangular_pulse',
      amplitude: 2.0,
      t0: 0.5,
      pulseWidthSeconds: 0.2,
      startTimeSeconds: 0.0,
      endTimeSeconds: 1.0,
    });
    setIsActionsOpen(false);
  };

  const handleReset = () => {
    setParams(DEFAULT_SIGNAL_PARAMS);
    setZoomLevel(1.0);
    setIsActionsOpen(false);
  };

  const handleRandomize = () => {
    const types: SignalType[] = [
      'sinusoidal',
      'cosine',
      'square',
      'triangular',
      'sawtooth',
      'exponential',
      'rectangular_pulse',
      'sinc',
    ];
    const randType = types[Math.floor(Math.random() * types.length)];
    setParams({
      ...params,
      signalType: randType,
      amplitude: +(Math.random() * 4 + 0.5).toFixed(1),
      frequencyHz: +(Math.random() * 15 + 1).toFixed(1),
      phaseDegrees: Math.floor(Math.random() * 360 - 180),
      dcOffset: +(Math.random() * 2 - 1).toFixed(1),
      t0: +(Math.random() * 0.6).toFixed(2),
      pulseWidthSeconds: +(Math.random() * 0.4 + 0.05).toFixed(2),
    });
    setIsActionsOpen(false);
  };

  // Playback Animation Loop
  useEffect(() => {
    if (!isPlaying) return;

    // Respect user's reduced-motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) {
      setIsPlaying(false);
      return;
    }

    let animId: number;
    let lastTime = performance.now();
    // 3.0s base duration for 1x sweep
    const baseDuration = 3.0;

    const loop = (currentTime: number) => {
      const dt = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      setPlayProgress((prev) => {
        const next = prev + (dt * playbackSpeed) / baseDuration;
        return next >= 1.0 ? 0 : next;
      });

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, playbackSpeed]);

  // SVG Chart Dimensions
  const svgWidth = 800;
  const svgHeight = 280;
  const padLeft = 55;
  const padRight = 25;
  const padTop = 30;
  const padBottom = 40;
  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;

  const time = generatedSignal.data.timeSeconds;
  const amp = generatedSignal.data.amplitude;
  const trans = generatedSignal.data.transformed;

  const tStart = params.startTimeSeconds;
  const tEnd = params.endTimeSeconds;
  const tSpan = Math.max(1e-5, (tEnd - tStart) / zoomLevel);

  // Amplitude limits
  const peakVal = Math.max(
    0.5,
    Math.max(...amp.map(Math.abs)),
    showTransformed ? Math.max(...trans.map(Math.abs)) : 0
  );
  const yLimit = +(peakVal * 1.25).toFixed(2);

  const getX = (t: number) => {
    return padLeft + ((t - tStart) / tSpan) * plotW;
  };

  const getY = (val: number) => {
    return padTop + plotH / 2 - (val / yLimit) * (plotH / 2);
  };

  // Build SVG Paths
  const baseLinePoints = useMemo(() => {
    if (time.length === 0) return '';
    return time.map((t, idx) => {
      const px = getX(t);
      const py = getY(amp[idx]);
      return `${px.toFixed(1)},${py.toFixed(1)}`;
    }).join(' ');
  }, [time, amp, yLimit, tSpan]);

  const transLinePoints = useMemo(() => {
    if (!showTransformed || time.length === 0) return '';
    return time.map((t, idx) => {
      const px = getX(t);
      const py = getY(trans[idx]);
      return `${px.toFixed(1)},${py.toFixed(1)}`;
    }).join(' ');
  }, [showTransformed, time, trans, yLimit, tSpan]);

  // Playback Progressive Sweep Slices
  const sweepIndex = useMemo(() => {
    if (!isPlaying || time.length === 0) return time.length - 1;
    return Math.max(1, Math.min(time.length - 1, Math.round(playProgress * (time.length - 1))));
  }, [isPlaying, playProgress, time.length]);

  const activeSweepBasePoints = useMemo(() => {
    if (!isPlaying || time.length === 0) return baseLinePoints;
    return time.slice(0, sweepIndex + 1).map((t, idx) => {
      const px = getX(t);
      const py = getY(amp[idx]);
      return `${px.toFixed(1)},${py.toFixed(1)}`;
    }).join(' ');
  }, [isPlaying, sweepIndex, time, amp, yLimit, tSpan, baseLinePoints]);

  const activeSweepTransPoints = useMemo(() => {
    if (!isPlaying || !showTransformed || time.length === 0) return transLinePoints;
    return time.slice(0, sweepIndex + 1).map((t, idx) => {
      const px = getX(t);
      const py = getY(trans[idx]);
      return `${px.toFixed(1)},${py.toFixed(1)}`;
    }).join(' ');
  }, [isPlaying, showTransformed, sweepIndex, time, trans, yLimit, tSpan, transLinePoints]);

  // Downsampled stems for smooth rendering
  const stemIndices = useMemo(() => {
    const maxStems = 120;
    const step = Math.max(1, Math.ceil(time.length / maxStems));
    const indices: number[] = [];
    for (let i = 0; i < time.length; i += step) {
      indices.push(i);
    }
    return indices;
  }, [time.length]);

  // Current active label for waveform dropdown button
  const currentWaveformLabel = useMemo(() => {
    for (const cat of WAVEFORM_CATEGORIES) {
      const found = cat.options.find((opt) => opt.value === params.signalType);
      if (found) return found.label;
    }
    return params.signalType;
  }, [params.signalType]);

  // Active section label
  const currentSectionLabel = useMemo(() => {
    switch (activeParamSection) {
      case 'waveform':
        return 'Waveform Parameters';
      case 'operations':
        return 'Time & Amp Operations';
      case 'sampling':
        return 'Sampling & Time Domain';
    }
  }, [activeParamSection]);

  const currentPlayT = isPlaying && time.length > 0 ? time[sweepIndex] : 0;
  const currentPlayAmp = isPlaying && time.length > 0 ? amp[sweepIndex] : 0;
  const currentPlayTrans = isPlaying && time.length > 0 ? trans[sweepIndex] : 0;

  return (
    <div className="space-y-6">
      {/* 1. Merged Top Header & Controls Card (Scaled to 80% size) */}
      <div className="bg-white rounded-[14px] p-4 shadow-sm border border-[#AAEED3]/50 relative z-30 overflow-visible transition-colors">
        {/* Top Header Part */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-7 h-7 rounded-lg bg-[#2A7B73] text-white flex items-center justify-center font-mono font-bold text-sm shadow-xs shrink-0">
              A
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-heading font-bold text-base sm:text-lg text-[#123A36]">
                  Signals & Operations
                </h1>
                <span className="hidden sm:inline text-[11px] font-mono px-2 py-0.5 rounded font-semibold bg-[#AAEED3]/30 text-[#2A7B73] border border-[#AAEED3]">
                  Interactive Topic
                </span>
              </div>
              <p className="text-[11px] text-[#123A36]/75 mt-0.5 leading-snug">
                Synthesis, Shifts, Scaling & Interchange Bus &bull; 12 canonical waveform generators, time transformations y(t) = A·x(a(t-t₀)), Nyquist aliasing checker, analytical statistics, and standard JSON/CSV interchange.
              </p>
            </div>
          </div>

          <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full font-semibold bg-[#AAEED3]/30 text-[#2A7B73] border border-[#AAEED3] shrink-0">
            Group 3 - Project
          </span>
        </div>

        {/* Thin divider */}
        <div className="border-t border-[#AAEED3]/40 my-2.5" />

        {/* Second Part: Tags, Title, Formula, Playback & Quick Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded bg-[#AAEED3]/40 text-[#123A36] border border-[#AAEED3]">
                Topic A
              </span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#F3FAF7] text-[#2A7B73] border border-[#AAEED3]/60 flex items-center gap-1">
                <Zap className="w-3 h-3 text-[#2A7B73]" />
                Deterministic Synthesis & Operations
              </span>
              <span
                className={`text-[11px] font-mono px-2 py-0.5 rounded border flex items-center gap-1.5 ${
                  isNyquistViolated
                    ? 'bg-rose-50 text-rose-700 border-rose-300 font-bold animate-pulse'
                    : 'bg-[#FFF6B0] text-[#123A36] border-[#AAEED3]/60'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isNyquistViolated ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                {isNyquistViolated ? 'Aliasing Warning (f ≥ Fs/2)' : 'Sampling: Verified'}
              </span>
            </div>

            <h2 className="text-base sm:text-lg font-bold text-[#123A36] tracking-tight font-heading leading-tight">
              Signals & Operations: Synthesis, Shifts, Scaling & Interchange Bus
            </h2>
            <p className="text-[11px] sm:text-xs text-[#123A36]/70 mt-0.5 max-w-3xl leading-snug">
              Synthesize 12 canonical continuous/discrete signals, manipulate time transformations{' '}
              <span className="font-mono font-bold text-[#2A7B73]">y(t) = A·x(a(t - t₀))</span>, inspect rigorous mathematical statistics, and interchange signals with downstream modules.
            </p>
          </div>

          {/* Action Toolbar: Play/Pause, Speed & Quick Actions Dropdown */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto shrink-0">
            {/* Play/Pause Button */}
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-[11.5px] text-white transition-all shadow-xs cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2A7B73]"
              style={{ backgroundColor: isPlaying ? 'var(--deep-teal)' : 'var(--teal)' }}
              title={isPlaying ? 'Pause simulation sweep' : 'Run simulator sweep through time'}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              <span>{isPlaying ? 'Pause' : 'Play Sweep'}</span>
            </button>

            {/* Playback Speed (0.5x, 1x, 2x) */}
            <div className="flex items-center rounded-xl bg-[#F3FAF7] border border-[#AAEED3] p-0.5 text-xs">
              {[0.5, 1.0, 2.0].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setPlaybackSpeed(s)}
                  className={`px-2 py-0.5 rounded-lg font-mono text-[11px] font-semibold transition-all cursor-pointer ${
                    playbackSpeed === s
                      ? 'bg-[#2A7B73] text-white shadow-2xs'
                      : 'text-[#123A36]/80 hover:text-[#123A36]'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>

            {/* Quick Actions Custom Dropdown */}
            <div className="relative">
              <button
                ref={actionsBtnRef}
                type="button"
                onClick={toggleActions}
                className="px-3 py-1.5 rounded-xl bg-[#F3FAF7] border border-[#AAEED3] text-[11.5px] font-semibold text-[#123A36] hover:bg-[#AAEED3]/30 transition-all flex items-center gap-1.5 shadow-2xs focus-visible:ring-2 focus-visible:ring-[#2A7B73] focus:outline-none cursor-pointer"
                aria-haspopup="menu"
                aria-expanded={isActionsOpen}
                title="Quick actions presets"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#55A9A0]" />
                <span>Quick actions</span>
                <ChevronDown className={`w-3.5 h-3.5 text-[#2A7B73] transition-transform ${isActionsOpen ? 'rotate-180' : ''}`} />
              </button>

              {isActionsOpen && (
                <div
                  ref={actionsMenuRef}
                  className={`absolute right-0 ${
                    actionsPlacement === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                  } w-48 bg-white rounded-xl shadow-xl border border-[#AAEED3] py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100`}
                  role="menu"
                >
                  <button
                    type="button"
                    onClick={handleQuickSine}
                    className="w-full text-left px-3.5 py-1.5 text-[11.5px] text-[#123A36] hover:bg-[#AAEED3]/20 flex items-center justify-between transition-colors cursor-pointer"
                    role="menuitem"
                  >
                    <span>Quick Sine (5 Hz)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleQuickPulse}
                    className="w-full text-left px-3.5 py-1.5 text-[11.5px] text-[#123A36] hover:bg-[#AAEED3]/20 flex items-center justify-between transition-colors cursor-pointer"
                    role="menuitem"
                  >
                    <span>Test Pulse</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRandomize}
                    className="w-full text-left px-3.5 py-1.5 text-[11.5px] text-[#123A36] hover:bg-[#AAEED3]/20 flex items-center gap-2 transition-colors cursor-pointer"
                    role="menuitem"
                  >
                    <Shuffle className="w-3.5 h-3.5 text-[#55A9A0]" />
                    <span>Random</span>
                  </button>

                  <div className="border-t border-[#AAEED3]/40 my-1" />

                  <button
                    type="button"
                    onClick={handleReset}
                    className="w-full text-left px-3.5 py-1.5 text-[11.5px] text-[#123A36]/80 hover:bg-[#AAEED3]/20 hover:text-[#123A36] flex items-center gap-2 transition-colors cursor-pointer"
                    role="menuitem"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#2A7B73]" />
                    <span>Reset</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Primary Page Switcher: Waveform Synthesizer vs Signal Combination & Operations */}
      <div className="flex items-center justify-start">
        <div
          role="tablist"
          aria-label="Topic A Views"
          className="inline-flex p-1 bg-[#F3FAF7] border border-[#AAEED3] rounded-2xl shadow-2xs gap-1"
        >
          <button
            id="topic-a-tab-synth"
            role="tab"
            aria-selected={activePage === 'synthesizer'}
            aria-controls="topic-a-panel-synth"
            tabIndex={activePage === 'synthesizer' ? 0 : -1}
            onClick={() => handleSwitchPage('synthesizer')}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                handleSwitchPage('combiner');
                document.getElementById('topic-a-tab-combiner')?.focus();
              }
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2A7B73] ${
              activePage === 'synthesizer'
                ? 'bg-[#2A7B73] text-white shadow-xs'
                : 'text-[#123A36]/80 hover:text-[#123A36] hover:bg-[#AAEED3]/30'
            }`}
          >
            <Waves className="w-4 h-4" />
            <span>Waveform Synthesizer</span>
          </button>

          <button
            id="topic-a-tab-combiner"
            role="tab"
            aria-selected={activePage === 'combiner'}
            aria-controls="topic-a-panel-combiner"
            tabIndex={activePage === 'combiner' ? 0 : -1}
            onClick={() => handleSwitchPage('combiner')}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                handleSwitchPage('synthesizer');
                document.getElementById('topic-a-tab-synth')?.focus();
              }
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2A7B73] ${
              activePage === 'combiner'
                ? 'bg-[#2A7B73] text-white shadow-xs'
                : 'text-[#123A36]/80 hover:text-[#123A36] hover:bg-[#AAEED3]/30'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Signal Combination & Operations</span>
          </button>
        </div>
      </div>

      {/* Page 1: Waveform Synthesizer */}
      <div
        id="topic-a-panel-synth"
        role="tabpanel"
        aria-labelledby="topic-a-tab-synth"
        aria-hidden={activePage !== 'synthesizer'}
        className={activePage === 'synthesizer' ? 'block animate-in fade-in duration-150' : 'hidden'}
      >
        {/* Main Grid Content: Left Selector & Merged Parameters | Right Oscilloscope */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* LEFT PANEL: Merged Waveform Selector & Controls Card (lg:col-span-4) */}
          <div className="lg:col-span-4">

            {/* Merged Single Card: Waveform Type + Controls */}
            <div className="bg-white rounded-[14px] p-5 shadow-sm border border-[#AAEED3]/50 relative z-20 overflow-visible transition-colors">
              <label className="text-xs font-bold text-[#123A36] uppercase tracking-wider block mb-2.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Waves className="w-3.5 h-3.5 text-[#2A7B73]" /> Signal Waveform Type
              </span>
              <span className="text-[10px] text-[#2A7B73] font-mono bg-[#AAEED3]/30 px-2 py-0.5 rounded font-semibold">
                12 CANONICAL
              </span>
            </label>

            {/* Custom Categorized Dropdown */}
            <div className="relative">
              <button
                ref={waveformBtnRef}
                type="button"
                onClick={toggleWaveform}
                className="w-full bg-[#FAFCFB] border border-[#AAEED3] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#123A36] font-bold hover:bg-[#AAEED3]/20 transition-all flex items-center justify-between shadow-2xs focus-visible:ring-2 focus-visible:ring-[#2A7B73] focus:outline-none cursor-pointer"
                aria-haspopup="listbox"
                aria-expanded={isWaveformOpen}
                title="Select signal waveform"
              >
                <span className="truncate pr-2">{currentWaveformLabel}</span>
                <ChevronDown className={`w-4 h-4 text-[#2A7B73] shrink-0 transition-transform ${isWaveformOpen ? 'rotate-180' : ''}`} />
              </button>

              {isWaveformOpen && (
                <div
                  ref={waveformMenuRef}
                  className={`absolute left-0 right-0 ${
                    waveformPlacement === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                  } bg-white rounded-xl shadow-xl border border-[#AAEED3] py-1.5 z-50 max-h-72 overflow-y-auto animate-in fade-in zoom-in-95 duration-100`}
                  role="listbox"
                >
                  {WAVEFORM_CATEGORIES.map((cat, catIdx) => (
                    <div key={cat.category}>
                      {/* Group Header */}
                      <div className={`text-[10px] uppercase tracking-wider font-bold text-[#2A7B73] px-3 pt-2 pb-1 ${catIdx > 0 ? 'border-t border-[#AAEED3]/30 mt-1' : ''}`}>
                        {cat.category}
                      </div>

                      {/* Group Options */}
                      {cat.options.map((opt) => {
                        const isSelected = params.signalType === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              setParams({ ...params, signalType: opt.value });
                              setIsWaveformOpen(false);
                            }}
                            className={`w-full text-left px-3.5 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-[#AAEED3]/30 text-[#2A7B73] font-bold'
                                : 'text-[#123A36] hover:bg-[#AAEED3]/15'
                            }`}
                            role="option"
                            aria-selected={isSelected}
                          >
                            <span className="truncate pr-2">{opt.label}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-[#2A7B73] shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Thin divider separating Waveform Selector and Controls */}
            <div className="border-t border-[#AAEED3]/40 my-4" />

            {/* Section Chooser Dropdown at Top */}
            <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-[#AAEED3]/40 gap-2">
              <span className="text-xs font-bold text-[#123A36] uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-[#2A7B73]" /> Controls
              </span>

              {/* Custom Section Dropdown */}
              <div className="relative">
                <button
                  ref={sectionBtnRef}
                  type="button"
                  onClick={toggleSection}
                  className="px-3 py-1.5 rounded-xl bg-[#F3FAF7] border border-[#AAEED3] text-xs font-bold text-[#123A36] hover:bg-[#AAEED3]/30 transition-all flex items-center gap-1.5 shadow-2xs focus-visible:ring-2 focus-visible:ring-[#2A7B73] focus:outline-none cursor-pointer"
                  aria-haspopup="listbox"
                  aria-expanded={isSectionOpen}
                  title="Choose parameter section to display"
                >
                  <span className="text-[#2A7B73] font-semibold">Section:</span>
                  <span>{currentSectionLabel}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-[#2A7B73] transition-transform ${isSectionOpen ? 'rotate-180' : ''}`} />
                </button>

                {isSectionOpen && (
                  <div
                    ref={sectionMenuRef}
                    className={`absolute right-0 ${
                      sectionPlacement === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                    } w-56 bg-white rounded-xl shadow-xl border border-[#AAEED3] py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100`}
                    role="listbox"
                  >
                    {[
                      { id: 'waveform' as const, label: 'Waveform Parameters' },
                      { id: 'operations' as const, label: 'Time & Amp Operations' },
                      { id: 'sampling' as const, label: 'Sampling & Time Domain' },
                    ].map((sec) => (
                      <button
                        key={sec.id}
                        type="button"
                        onClick={() => {
                          setActiveParamSection(sec.id);
                          setIsSectionOpen(false);
                        }}
                        className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                          activeParamSection === sec.id
                            ? 'bg-[#AAEED3]/30 text-[#2A7B73] font-bold'
                            : 'text-[#123A36] hover:bg-[#AAEED3]/15'
                        }`}
                        role="option"
                        aria-selected={activeParamSection === sec.id}
                      >
                        <span>{sec.label}</span>
                        {activeParamSection === sec.id && <Check className="w-3.5 h-3.5 text-[#2A7B73]" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* SECTION 1: Waveform Parameters */}
            {activeParamSection === 'waveform' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Amplitude A */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#123A36]/80 font-medium">Amplitude (A):</span>
                    <span className="font-mono font-bold text-[#2A7B73]">{params.amplitude.toFixed(2)} V</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0.1}
                      max={10.0}
                      step={0.1}
                      value={params.amplitude}
                      onChange={(e) => setParams({ ...params, amplitude: Number(e.target.value) })}
                      className="w-full accent-[#2A7B73] cursor-pointer"
                    />
                    <input
                      type="number"
                      step={0.1}
                      value={params.amplitude}
                      onChange={(e) => setParams({ ...params, amplitude: Number(e.target.value) })}
                      className="w-16 bg-[#FAFCFB] border border-[#AAEED3] rounded px-1.5 py-0.5 text-xs text-right font-mono"
                    />
                  </div>
                </div>

                {/* Frequency f (Periodic & Sinc) */}
                {['sinusoidal', 'cosine', 'square', 'triangular', 'sawtooth', 'sinc'].includes(params.signalType) && (
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#123A36]/80 font-medium">Frequency (f):</span>
                      <span className="font-mono font-bold text-[#2A7B73]">{params.frequencyHz.toFixed(2)} Hz</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0.1}
                        max={80.0}
                        step={0.1}
                        value={params.frequencyHz}
                        onChange={(e) => setParams({ ...params, frequencyHz: Number(e.target.value) })}
                        className="w-full accent-[#2A7B73] cursor-pointer"
                      />
                      <input
                        type="number"
                        step={0.1}
                        value={params.frequencyHz}
                        onChange={(e) => setParams({ ...params, frequencyHz: Number(e.target.value) })}
                        className="w-16 bg-[#FAFCFB] border border-[#AAEED3] rounded px-1.5 py-0.5 text-xs text-right font-mono"
                      />
                    </div>
                    <div className="text-[10px] text-[#2A7B73] font-mono mt-0.5">
                      ω = {(2 * Math.PI * params.frequencyHz).toFixed(2)} rad/s
                    </div>
                  </div>
                )}

                {/* Phase phi (Periodic) */}
                {['sinusoidal', 'cosine', 'square', 'triangular', 'sawtooth'].includes(params.signalType) && (
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#123A36]/80 font-medium">Phase (φ):</span>
                      <span className="font-mono font-bold text-[#2A7B73]">{params.phaseDegrees.toFixed(1)}°</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={-180}
                        max={180}
                        step={1}
                        value={params.phaseDegrees}
                        onChange={(e) => setParams({ ...params, phaseDegrees: Number(e.target.value) })}
                        className="w-full accent-[#2A7B73] cursor-pointer"
                      />
                      <input
                        type="number"
                        step={1}
                        value={params.phaseDegrees}
                        onChange={(e) => setParams({ ...params, phaseDegrees: Number(e.target.value) })}
                        className="w-16 bg-[#FAFCFB] border border-[#AAEED3] rounded px-1.5 py-0.5 text-xs text-right font-mono"
                      />
                    </div>
                  </div>
                )}

                {/* DC Offset C */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#123A36]/80 font-medium">DC Offset (C):</span>
                    <span className="font-mono font-bold text-[#2A7B73]">{params.dcOffset.toFixed(2)} V</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={-5.0}
                      max={5.0}
                      step={0.1}
                      value={params.dcOffset}
                      onChange={(e) => setParams({ ...params, dcOffset: Number(e.target.value) })}
                      className="w-full accent-[#2A7B73] cursor-pointer"
                    />
                    <input
                      type="number"
                      step={0.1}
                      value={params.dcOffset}
                      onChange={(e) => setParams({ ...params, dcOffset: Number(e.target.value) })}
                      className="w-16 bg-[#FAFCFB] border border-[#AAEED3] rounded px-1.5 py-0.5 text-xs text-right font-mono"
                    />
                  </div>
                </div>

                {/* Time delay t0 */}
                {['unit_step', 'impulse', 'ramp', 'exponential', 'rectangular_pulse', 'sinc'].includes(params.signalType) && (
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#123A36]/80 font-medium">Time Center / Delay (t₀):</span>
                      <span className="font-mono font-bold text-[#2A7B73]">{params.t0.toFixed(2)} s</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={-2.0}
                        max={2.0}
                        step={0.05}
                        value={params.t0}
                        onChange={(e) => setParams({ ...params, t0: Number(e.target.value) })}
                        className="w-full accent-[#2A7B73] cursor-pointer"
                      />
                      <input
                        type="number"
                        step={0.05}
                        value={params.t0}
                        onChange={(e) => setParams({ ...params, t0: Number(e.target.value) })}
                        className="w-16 bg-[#FAFCFB] border border-[#AAEED3] rounded px-1.5 py-0.5 text-xs text-right font-mono"
                      />
                    </div>
                  </div>
                )}

                {/* Duty Cycle (Square wave) */}
                {params.signalType === 'square' && (
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#123A36]/80 font-medium">Duty Cycle:</span>
                      <span className="font-mono font-bold text-[#2A7B73]">{params.dutyCyclePercent}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={1}
                        max={99}
                        step={1}
                        value={params.dutyCyclePercent}
                        onChange={(e) => setParams({ ...params, dutyCyclePercent: Number(e.target.value) })}
                        className="w-full accent-[#2A7B73] cursor-pointer"
                      />
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={params.dutyCyclePercent}
                        onChange={(e) => setParams({ ...params, dutyCyclePercent: Number(e.target.value) })}
                        className="w-16 bg-[#FAFCFB] border border-[#AAEED3] rounded px-1.5 py-0.5 text-xs text-right font-mono"
                      />
                    </div>
                  </div>
                )}

                {/* Pulse Width (Rectangular pulse) */}
                {params.signalType === 'rectangular_pulse' && (
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#123A36]/80 font-medium">Pulse Width (τ):</span>
                      <span className="font-mono font-bold text-[#2A7B73]">{params.pulseWidthSeconds.toFixed(2)} s</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0.02}
                        max={2.0}
                        step={0.02}
                        value={params.pulseWidthSeconds}
                        onChange={(e) => setParams({ ...params, pulseWidthSeconds: Number(e.target.value) })}
                        className="w-full accent-[#2A7B73] cursor-pointer"
                      />
                      <input
                        type="number"
                        step={0.01}
                        value={params.pulseWidthSeconds}
                        onChange={(e) => setParams({ ...params, pulseWidthSeconds: Number(e.target.value) })}
                        className="w-16 bg-[#FAFCFB] border border-[#AAEED3] rounded px-1.5 py-0.5 text-xs text-right font-mono"
                      />
                    </div>
                  </div>
                )}

                {/* Exponential Alpha & Growth/Decay */}
                {params.signalType === 'exponential' && (
                  <div className="space-y-2 bg-[#F3FAF7] p-3 rounded-xl border border-[#AAEED3]/50">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#123A36] font-semibold">Rate Constant (α):</span>
                      <span className="font-mono font-bold text-[#2A7B73]">{params.alpha.toFixed(2)} s⁻¹</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0.1}
                        max={10.0}
                        step={0.1}
                        value={params.alpha}
                        onChange={(e) => setParams({ ...params, alpha: Number(e.target.value) })}
                        className="w-full accent-[#2A7B73] cursor-pointer"
                      />
                      <input
                        type="number"
                        step={0.1}
                        value={params.alpha}
                        onChange={(e) => setParams({ ...params, alpha: Number(e.target.value) })}
                        className="w-16 bg-white border border-[#AAEED3] rounded px-1.5 py-0.5 text-xs text-right font-mono"
                      />
                    </div>
                    <div className="flex items-center gap-4 text-xs font-medium text-[#123A36] pt-1">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="expo_mode"
                          checked={params.expoMode === 'decay'}
                          onChange={() => setParams({ ...params, expoMode: 'decay' })}
                          className="accent-[#2A7B73]"
                        />
                        <span>Decay [e^(-αt)]</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="expo_mode"
                          checked={params.expoMode === 'growth'}
                          onChange={() => setParams({ ...params, expoMode: 'growth' })}
                          className="accent-[#2A7B73]"
                        />
                        <span>Growth [e^(+αt)]</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Sinc Mode */}
                {params.signalType === 'sinc' && (
                  <div className="flex items-center gap-4 text-xs font-medium text-[#123A36] bg-[#F3FAF7] p-3 rounded-xl border border-[#AAEED3]/50">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="sinc_mode"
                        checked={params.sincMode === 'normalized'}
                        onChange={() => setParams({ ...params, sincMode: 'normalized' })}
                        className="accent-[#2A7B73]"
                      />
                      <span>Normalized [sin(πft)/(πft)]</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="sinc_mode"
                        checked={params.sincMode === 'unnormalized'}
                        onChange={() => setParams({ ...params, sincMode: 'unnormalized' })}
                        className="accent-[#2A7B73]"
                      />
                      <span>Unnorm [sin(t)/t]</span>
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* SECTION 2: Time & Amp Operations */}
            {activeParamSection === 'operations' && (
              <div className="space-y-3.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#123A36]/70">
                    Transform waveform via <span className="font-mono font-bold text-[#2A7B73]">y(t) = A·x(a(t - t₀))</span>:
                  </span>
                  <label className="text-[11px] text-[#2A7B73] font-medium flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showTransformed}
                      onChange={(e) => setShowTransformed(e.target.checked)}
                      className="accent-[#2A7B73]"
                    />
                    <span>Overlay y(t)</span>
                  </label>
                </div>

                {/* Time Shift */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#123A36]/80 font-medium">Time Shift (t₀):</span>
                    <span className="font-mono font-bold text-[#2A7B73]">{params.timeShift >= 0 ? '+' : ''}{params.timeShift.toFixed(2)} s</span>
                  </div>
                  <input
                    type="range"
                    min={-1.5}
                    max={1.5}
                    step={0.05}
                    value={params.timeShift}
                    onChange={(e) => setParams({ ...params, timeShift: Number(e.target.value) })}
                    className="w-full accent-[#2A7B73] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-[#123A36]/60 font-mono">
                    <span>-1.5s (Advance)</span>
                    <span>0s</span>
                    <span>+1.5s (Delay)</span>
                  </div>
                </div>

                {/* Time Scaling a */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#123A36]/80 font-medium">Time Scaling (a):</span>
                    <span className="font-mono font-bold text-[#2A7B73]">{params.timeScaling.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min={0.2}
                    max={3.0}
                    step={0.1}
                    value={params.timeScaling}
                    onChange={(e) => setParams({ ...params, timeScaling: Number(e.target.value) })}
                    className="w-full accent-[#2A7B73] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-[#123A36]/60 font-mono">
                    <span>0.2x (Expand)</span>
                    <span>1.0x</span>
                    <span>3.0x (Compress)</span>
                  </div>
                </div>

                {/* Amplitude Scale A */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#123A36]/80 font-medium">Amp Scaling (A):</span>
                    <span className="font-mono font-bold text-[#2A7B73]">{params.ampScale.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={2.5}
                    step={0.1}
                    value={params.ampScale}
                    onChange={(e) => setParams({ ...params, ampScale: Number(e.target.value) })}
                    className="w-full accent-[#2A7B73] cursor-pointer"
                  />
                </div>

                {/* Time Reversal toggle */}
                <div className="pt-2 border-t border-[#AAEED3]/40 flex items-center justify-between">
                  <span className="text-xs text-[#123A36] font-medium">Time Reversal x(-t):</span>
                  <button
                    type="button"
                    onClick={() => setParams({ ...params, isReversed: !params.isReversed })}
                    className={`px-3 py-1 text-xs font-mono font-semibold rounded-lg border transition cursor-pointer ${
                      params.isReversed
                        ? 'bg-[#2A7B73] text-white border-[#2A7B73]'
                        : 'bg-[#FAFCFB] text-[#123A36] border-[#AAEED3]'
                    }`}
                  >
                    {params.isReversed ? 'Active: x(-t)' : 'Normal: x(+t)'}
                  </button>
                </div>
              </div>
            )}

            {/* SECTION 3: Sampling & Time Domain */}
            {activeParamSection === 'sampling' && (
              <div className="space-y-3.5 animate-in fade-in duration-150">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[#123A36]/70 block mb-0.5">Start Time (s):</span>
                    <input
                      type="number"
                      step={0.1}
                      value={params.startTimeSeconds}
                      onChange={(e) => setParams({ ...params, startTimeSeconds: Number(e.target.value) })}
                      className="w-full bg-[#FAFCFB] border border-[#AAEED3] rounded-lg px-2 py-1 text-[#123A36] font-mono text-xs"
                    />
                  </div>
                  <div>
                    <span className="text-[#123A36]/70 block mb-0.5">End Time (s):</span>
                    <input
                      type="number"
                      step={0.1}
                      value={params.endTimeSeconds}
                      onChange={(e) => setParams({ ...params, endTimeSeconds: Number(e.target.value) })}
                      className="w-full bg-[#FAFCFB] border border-[#AAEED3] rounded-lg px-2 py-1 text-[#123A36] font-mono text-xs"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#123A36]/80 font-medium">Sampling Rate (Fs):</span>
                    <span className="font-mono font-bold text-[#2A7B73]">{params.samplingFrequencyHz} Hz</span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={2500}
                    step={20}
                    value={params.samplingFrequencyHz}
                    onChange={(e) => setParams({ ...params, samplingFrequencyHz: Number(e.target.value) })}
                    className="w-full accent-[#2A7B73] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-[#123A36]/65 font-mono mt-0.5">
                    <span>Δt = {(1000 / params.samplingFrequencyHz).toFixed(3)} ms</span>
                    <span>Nyquist Fn = {params.samplingFrequencyHz / 2} Hz</span>
                  </div>
                </div>

                {/* Visualization Mode */}
                <div className="pt-2 border-t border-[#AAEED3]/40">
                  <span className="text-[11px] text-[#123A36]/80 font-semibold block mb-1.5">
                    Visualization Mode:
                  </span>
                  <div className="grid grid-cols-3 gap-1.5 text-xs">
                    {(['both', 'curve', 'stems'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setViewMode(m)}
                        className={`py-1 rounded-lg border font-medium capitalize transition cursor-pointer ${
                          viewMode === m
                            ? 'bg-[#2A7B73] text-white border-[#2A7B73] shadow-2xs font-bold'
                            : 'bg-[#FAFCFB] text-[#123A36] border-[#AAEED3] hover:bg-[#AAEED3]/30'
                        }`}
                      >
                        {m === 'both' ? 'Both' : m === 'curve' ? 'Analog' : 'Samples'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: Live Mathematical Formula & Oscilloscope Graph (lg:col-span-8) */}
        <div className="lg:col-span-8 space-y-6">

          {/* Mathematical Equation Display Banner */}
          <div className="bg-white rounded-[14px] p-4 shadow-sm border border-[#AAEED3]/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#AAEED3]/30 border border-[#AAEED3] rounded-xl text-[#2A7B73]">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] uppercase font-mono tracking-wider text-[#123A36]/70 font-semibold">
                  Live Mathematical Formulation
                </div>
                <div className="font-mono text-[#2A7B73] font-bold text-sm tracking-wide">
                  {generatedSignal.metadata.formulaString}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-[#F3FAF7] text-[#123A36] border border-[#AAEED3] px-2.5 py-1 rounded-lg font-mono font-medium">
                {generatedSignal.metadata.category}
              </span>
            </div>
          </div>

          {/* Oscilloscope Graph Container */}
          <div className="bg-white rounded-[14px] p-5 shadow-sm border border-[#AAEED3]/50 flex flex-col transition-colors">
            <div className="flex flex-wrap items-center justify-between pb-3 mb-2 border-b border-[#AAEED3]/40 gap-2">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${isPlaying ? 'bg-emerald-500 animate-pulse' : 'bg-[#2A7B73]'}`} />
                <h3 className="text-sm sm:text-base font-bold text-[#123A36] font-heading">
                  Time-Domain Oscillogram x(t) & Transformed y(t)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setZoomLevel(1.0)}
                  className="px-2.5 py-1 text-xs font-semibold bg-[#F3FAF7] text-[#2A7B73] border border-[#AAEED3] rounded-lg hover:bg-[#AAEED3]/30 transition cursor-pointer"
                  title="Autoscale view"
                >
                  Autoscale
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.min(4.0, z * 1.25))}
                  className="p-1 text-xs bg-[#F3FAF7] text-[#2A7B73] border border-[#AAEED3] rounded-lg hover:bg-[#AAEED3]/30 transition cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(0.5, z / 1.25))}
                  className="p-1 text-xs bg-[#F3FAF7] text-[#2A7B73] border border-[#AAEED3] rounded-lg hover:bg-[#AAEED3]/30 transition cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* SVG Plot Canvas */}
            <div className="relative w-full bg-[#FAFCFB] rounded-xl p-2 border border-[#AAEED3]/60 shadow-2xs overflow-hidden">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full h-56 sm:h-64 overflow-visible"
                onMouseMove={(e) => {
                  if (isPlaying) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const relX = (e.clientX - rect.left - (padLeft / svgWidth) * rect.width) / ((plotW / svgWidth) * rect.width);
                  const clamped = Math.max(0, Math.min(1, relX));
                  const idx = Math.min(time.length - 1, Math.max(0, Math.round(clamped * (time.length - 1))));
                  setHoverIndex(idx);
                }}
                onMouseLeave={() => setHoverIndex(null)}
              >
                {/* Horizontal grid lines */}
                <line x1={padLeft} y1={padTop} x2={svgWidth - padRight} y2={padTop} stroke="#E2E8F0" strokeDasharray="3 3" />
                <line x1={padLeft} y1={padTop + plotH / 2} x2={svgWidth - padRight} y2={padTop + plotH / 2} stroke="#CBD5E1" strokeWidth="1.2" />
                <line x1={padLeft} y1={padTop + plotH} x2={svgWidth - padRight} y2={padTop + plotH} stroke="#E2E8F0" strokeDasharray="3 3" />

                {/* Vertical grid lines */}
                {[0.25, 0.5, 0.75].map((ratio) => (
                  <line
                    key={ratio}
                    x1={padLeft + ratio * plotW}
                    y1={padTop}
                    x2={padLeft + ratio * plotW}
                    y2={padTop + plotH}
                    stroke="#E2E8F0"
                    strokeDasharray="3 3"
                  />
                ))}

                {/* Zero Time Axis */}
                {tStart <= 0 && tEnd >= 0 && (
                  <line
                    x1={getX(0)}
                    y1={padTop}
                    x2={getX(0)}
                    y2={padTop + plotH}
                    stroke="#55A9A0"
                    strokeWidth="1.2"
                    strokeDasharray="2 2"
                  />
                )}

                {/* Faint reference paths during playback sweep */}
                {isPlaying && (
                  <>
                    {(viewMode === 'both' || viewMode === 'curve') && baseLinePoints && (
                      <polyline
                        fill="none"
                        stroke="#2A7B73"
                        strokeWidth="1.2"
                        strokeOpacity="0.22"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        points={baseLinePoints}
                      />
                    )}
                    {showTransformed && transLinePoints && (
                      <polyline
                        fill="none"
                        stroke="#D97706"
                        strokeWidth="1.2"
                        strokeOpacity="0.22"
                        strokeDasharray="4 2"
                        points={transLinePoints}
                      />
                    )}
                  </>
                )}

                {/* Transformed Signal Curve (Amber / Rose) */}
                {showTransformed && (isPlaying ? activeSweepTransPoints : transLinePoints) && (
                  <polyline
                    fill="none"
                    stroke="#D97706"
                    strokeWidth={isPlaying ? 2.2 : 1.8}
                    strokeDasharray={isPlaying ? undefined : '4 2'}
                    points={isPlaying ? activeSweepTransPoints : transLinePoints}
                  />
                )}

                {/* Ideal Continuous Curve x(t) (Deep Teal) */}
                {(viewMode === 'both' || viewMode === 'curve') && (isPlaying ? activeSweepBasePoints : baseLinePoints) && (
                  <polyline
                    fill="none"
                    stroke="#2A7B73"
                    strokeWidth={isPlaying ? 2.5 : 2.2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    points={isPlaying ? activeSweepBasePoints : baseLinePoints}
                  />
                )}

                {/* Discrete Sample Stems */}
                {(viewMode === 'both' || viewMode === 'stems') &&
                  stemIndices.map((i) => {
                    const t = time[i];
                    const val = amp[i];
                    const px = getX(t);
                    const pyZero = getY(0);
                    const pyVal = getY(val);
                    const isPassed = !isPlaying || i <= sweepIndex;
                    return (
                      <g key={i} opacity={isPassed ? 1 : 0.2}>
                        <line x1={px} y1={pyZero} x2={px} y2={pyVal} stroke="#55A9A0" strokeWidth="1" />
                        <circle cx={px} cy={pyVal} r={2.5} fill="#2A7B73" />
                      </g>
                    );
                  })}

                {/* Playback Sweep Moving Playhead Line & Markers */}
                {isPlaying && time.length > 0 && (
                  <g>
                    {/* Vertical Playhead Bar */}
                    <line
                      x1={getX(currentPlayT)}
                      y1={padTop}
                      x2={getX(currentPlayT)}
                      y2={padTop + plotH}
                      stroke="#2A7B73"
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                    />

                    {/* Active Point Marker on Base Signal */}
                    <circle
                      cx={getX(currentPlayT)}
                      cy={getY(currentPlayAmp)}
                      r={5}
                      fill="#FFF6B0"
                      stroke="#2A7B73"
                      strokeWidth="2"
                    />

                    {/* Active Point Marker on Transformed Signal */}
                    {showTransformed && (
                      <circle
                        cx={getX(currentPlayT)}
                        cy={getY(currentPlayTrans)}
                        r={4.5}
                        fill="#FED7AA"
                        stroke="#D97706"
                        strokeWidth="2"
                      />
                    )}
                  </g>
                )}

                {/* Hover cursor line and markers (when not playing) */}
                {!isPlaying && hoverIndex !== null && hoverIndex >= 0 && hoverIndex < time.length && (
                  <g>
                    <line
                      x1={getX(time[hoverIndex])}
                      y1={padTop}
                      x2={getX(time[hoverIndex])}
                      y2={padTop + plotH}
                      stroke="#123A36"
                      strokeWidth="1"
                      strokeDasharray="2 2"
                    />
                    <circle
                      cx={getX(time[hoverIndex])}
                      cy={getY(amp[hoverIndex])}
                      r={4.5}
                      fill="#2A7B73"
                      stroke="#FFFFFF"
                      strokeWidth="1.5"
                    />
                    {showTransformed && (
                      <circle
                        cx={getX(time[hoverIndex])}
                        cy={getY(trans[hoverIndex])}
                        r={4.5}
                        fill="#D97706"
                        stroke="#FFFFFF"
                        strokeWidth="1.5"
                      />
                    )}
                  </g>
                )}

                {/* Axes ticks & numerical labels */}
                {/* Y-Axis (Amplitude) */}
                <text x={padLeft - 8} y={padTop + 4} textAnchor="end" className="text-[10px] fill-[#123A36]/70 font-mono">
                  +{yLimit.toFixed(1)}V
                </text>
                <text x={padLeft - 8} y={padTop + plotH / 2 + 3} textAnchor="end" className="text-[10px] fill-[#123A36]/70 font-mono">
                  0V
                </text>
                <text x={padLeft - 8} y={padTop + plotH} textAnchor="end" className="text-[10px] fill-[#123A36]/70 font-mono">
                  -{yLimit.toFixed(1)}V
                </text>

                {/* X-Axis (Time) */}
                <text x={padLeft} y={padTop + plotH + 18} textAnchor="start" className="text-[10px] fill-[#123A36]/70 font-mono">
                  {tStart.toFixed(2)}s
                </text>
                <text x={padLeft + plotW / 2} y={padTop + plotH + 18} textAnchor="middle" className="text-[10px] fill-[#123A36]/70 font-mono">
                  {((tStart + tEnd) / 2).toFixed(2)}s
                </text>
                <text x={padLeft + plotW} y={padTop + plotH + 18} textAnchor="end" className="text-[10px] fill-[#123A36]/70 font-mono">
                  {tEnd.toFixed(2)}s
                </text>
              </svg>

              {/* Tooltip during manual hover inspection */}
              {!isPlaying && hoverIndex !== null && hoverIndex >= 0 && hoverIndex < time.length && (
                <div className="absolute top-3 right-4 bg-[#123A36] text-white px-3 py-1.5 rounded-lg text-xs font-mono shadow-md border border-[#2A7B73] pointer-events-none space-y-0.5">
                  <div className="text-[#AAEED3]">t = {time[hoverIndex].toFixed(4)} s</div>
                  <div>x(t) = <span className="font-bold text-white">{amp[hoverIndex].toFixed(4)} V</span></div>
                  {showTransformed && (
                    <div className="text-amber-300">y(t) = {trans[hoverIndex].toFixed(4)} V</div>
                  )}
                </div>
              )}

              {/* Live Playhead Readout during playback sweep */}
              {isPlaying && time.length > 0 && (
                <div className="absolute top-3 right-4 bg-[#123A36]/90 text-white px-3 py-1.5 rounded-lg text-xs font-mono shadow-md border border-[#2A7B73] pointer-events-none flex items-center gap-2">
                  <span className="text-[#AAEED3]">t = {currentPlayT.toFixed(3)}s</span>
                  <span>&bull;</span>
                  <span>x(t) = <strong className="text-white">{currentPlayAmp.toFixed(3)}V</strong></span>
                  {showTransformed && (
                    <>
                      <span>&bull;</span>
                      <span className="text-amber-300">y(t) = {currentPlayTrans.toFixed(3)}V</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Plot Legend & Axis Range */}
            <div className="flex flex-wrap items-center justify-between text-[11px] text-[#123A36]/70 font-mono mt-2.5">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-0.5 bg-[#2A7B73] inline-block" />
                  <span>Base Signal x(t)</span>
                </span>
                {showTransformed && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-0.5 bg-[#D97706] inline-block" />
                    <span>Transformed y(t) = A·x(a(t - t₀))</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span>t_min = {tStart.toFixed(2)}s</span>
                <span>|</span>
                <span>t_max = {tEnd.toFixed(2)}s</span>
                <span>|</span>
                <span>Peak ±{yLimit.toFixed(2)} V</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>

    {/* Page 2: Signal Combination & Operations */}
    <div
      id="topic-a-panel-combiner"
      role="tabpanel"
      aria-labelledby="topic-a-tab-combiner"
      aria-hidden={activePage !== 'combiner'}
      className={activePage === 'combiner' ? 'block animate-in fade-in duration-150' : 'hidden'}
    >
      <SignalCombinerSimulator isPageActive={activePage === 'combiner'} />
    </div>
  </div>
);
};
