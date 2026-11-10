/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Fourier Series Simulator - Topic C
 * Functional reference: Interactive Fourier Series Simulator
 * 
 * Layout:
 * 1. Merged unified top header card:
 *    - Left: 'C' badge, title 'Fourier Series', 'Interactive Topic' tag,
 *      subtitle 'Analytical Coefficients & Rotating Phasors', single combined description,
 *      and Power Captured & Gibbs Overshoot badges in one row below.
 *    - Right: 'Group 3 - Project' pill top right, with Export CSV and Reset buttons cleanly right-aligned below.
 *      (Redundant top Pause Animation button removed as simulation Play button controls identical state).
 * 2. Full-width simulation row:
 *    - 'Epicycle Phasor Chain & Waveform Synthesis' simulation card fills the entire width.
 *    - Header row has: Title & icon on left, and toolbar controls directly before Controls dropdown on right:
 *      Waveform drop-down, Sweep N (Gibbs Demo), Play, Reset Time, then Controls dropdown.
 *    - Controls dropdown opens panel directly above plot ('Harmonics, Speed & Amplitude').
 * 3. Merged View card directly below simulator:
 *    - Header with dynamic title and 'View' custom dropdown (Display Options, Live Series Formula, Live Metrics & Benchmarks).
 *    - Default on load is 'Display Options'.
 * 4. Remaining components in their current relative order and unchanged:
 *    - Harmonic Frequency Spectrum Bar Graph
 *    - Residual Error Plot
 *    - Collapsible Harmonic Coefficients Table
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  Play,
  Pause,
  RotateCcw,
  Sliders,
  BarChart2,
  Table as TableIcon,
  Download,
  Info,
  TrendingUp,
  ChevronDown,
  Check,
  Plus,
  Minus,
  Zap,
  Activity,
  Layers,
  X,
  Eye,
} from 'lucide-react';
import {
  PeriodicWaveformType,
  FOURIER_SERIES_MODELS,
  reconstructFourierSignal,
  calculateEpicycleChain,
  getLiveAnalyticalFormula,
} from '../../math/fourierSeries';

// Categorized Waveform options with descriptions
interface WaveformOption {
  value: PeriodicWaveformType;
  label: string;
  badge: string;
  description: string;
}

interface WaveformGroup {
  category: string;
  options: WaveformOption[];
}

const WAVEFORM_GROUPS: WaveformGroup[] = [
  {
    category: 'Standard Periodic',
    options: [
      {
        value: 'square',
        label: 'Square Wave',
        badge: 'Odd 1/n',
        description: 'Odd harmonics decaying as 1/n with ~17.9% Gibbs overshoot',
      },
      {
        value: 'sawtooth',
        label: 'Sawtooth Wave',
        badge: 'All 1/n',
        description: 'All integer harmonics with alternating signs',
      },
      {
        value: 'triangle',
        label: 'Symmetric Triangle Wave',
        badge: 'Odd 1/n²',
        description: 'Continuous with rapid 1/n² quadratic harmonic decay',
      },
      {
        value: 'pulse',
        label: 'Pulse Train (Duty Cycle)',
        badge: 'Sinc Envelope',
        description: 'Tunable pulse width with sinc-modulated Fourier spectrum',
      },
    ],
  },
  {
    category: 'Rectified Sine',
    options: [
      {
        value: 'full_wave_rect',
        label: 'Full-Wave Rectified Sine',
        badge: 'DC + Even 2ω₀',
        description: '|sin(t)| absolute value, doubled fundamental, even harmonics',
      },
      {
        value: 'half_wave_rect',
        label: 'Half-Wave Rectified Sine',
        badge: 'DC + ω₀ + Even',
        description: 'max(0, sin(t)), fundamental plus even cosine harmonics',
      },
    ],
  },
];

const PRESET_N_VALUES = [1, 3, 5, 11, 25, 64];

type MergedViewSection = 'display_options' | 'formula' | 'metrics' | 'spectrum' | 'table';

const VIEW_OPTIONS: { id: MergedViewSection; label: string; icon: typeof Sliders }[] = [
  { id: 'display_options', label: 'Display Options', icon: Eye },
  { id: 'formula', label: 'Live Series Formula', icon: Info },
  { id: 'metrics', label: 'Live Metrics & Benchmarks', icon: TrendingUp },
  { id: 'spectrum', label: 'Harmonic Frequency Spectrum', icon: BarChart2 },
  { id: 'table', label: 'Harmonic Coefficients Table', icon: TableIcon },
];

export const FourierSeriesModule: React.FC = () => {
  // 1. Simulation & Synthesis Parameters
  const [waveType, setWaveType] = useState<PeriodicWaveformType>('square');
  const [harmonicsCount, setHarmonicsCount] = useState<number>(7); // N: 1 to 64
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1.0); // 0 to 3x
  const [amplitude, setAmplitude] = useState<number>(1.0); // 0.2 to 3.0 V
  const [dutyCycle, setDutyCycle] = useState<number>(0.5); // 0.05 to 0.95
  const [f0] = useState<number>(1.0); // Fixed fundamental freq 1.0 Hz for clear timing

  // 2. Playback State (single authoritative animation state)
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [time, setTime] = useState<number>(0.0);
  const [isSweepingN, setIsSweepingN] = useState<boolean>(false);

  // 3. Display Options (All toggles ON by default per specification)
  const [showEpicycles, setShowEpicycles] = useState<boolean>(true);
  const [showTheoreticalWave, setShowTheoreticalWave] = useState<boolean>(true);
  const [showPhasorVectors, setShowPhasorVectors] = useState<boolean>(true);
  const [showConnectorBeam, setShowConnectorBeam] = useState<boolean>(true);
  const [showIndividualHarmonics, setShowIndividualHarmonics] = useState<boolean>(false);
  const [showResidualErrorPlot, setShowResidualErrorPlot] = useState<boolean>(true);

  // 4. Interactive States (Dropdowns, Hovers, Controls Panel, Merged View Dropdown, Collapsible Table)
  const [isWaveDropdownOpen, setIsWaveDropdownOpen] = useState<boolean>(false);
  const [isControlsDropdownOpen, setIsControlsDropdownOpen] = useState<boolean>(false);
  const [activeControlPanel, setActiveControlPanel] = useState<'harmonics' | 'speed' | 'amplitude' | null>(null);
  const [activeViewSection, setActiveViewSection] = useState<MergedViewSection>('display_options');
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState<boolean>(false);
  const [focusedViewIndex, setFocusedViewIndex] = useState<number>(-1);
  const [isTableExpanded, setIsTableExpanded] = useState<boolean>(false);
  const [hoveredHarmonicIndex, setHoveredHarmonicIndex] = useState<number | null>(null);
  const [waveformHoverTime, setWaveformHoverTime] = useState<number | null>(null);
  const [canvasWidth, setCanvasWidth] = useState<number>(800);

  // Refs for Canvas, Dropdowns, and Animation
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const waveDropdownRef = useRef<HTMLDivElement | null>(null);
  const controlsDropdownRef = useRef<HTMLDivElement | null>(null);
  const viewDropdownRef = useRef<HTMLDivElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const sweepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Close dropdowns on outside click or Escape key
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (waveDropdownRef.current && !waveDropdownRef.current.contains(e.target as Node)) {
        setIsWaveDropdownOpen(false);
      }
      if (controlsDropdownRef.current && !controlsDropdownRef.current.contains(e.target as Node)) {
        setIsControlsDropdownOpen(false);
      }
      if (viewDropdownRef.current && !viewDropdownRef.current.contains(e.target as Node)) {
        setIsViewDropdownOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isControlsDropdownOpen) {
          setIsControlsDropdownOpen(false);
        } else if (activeControlPanel !== null) {
          setActiveControlPanel(null);
        }
        if (isWaveDropdownOpen) {
          setIsWaveDropdownOpen(false);
        }
        if (isViewDropdownOpen) {
          setIsViewDropdownOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isControlsDropdownOpen, activeControlPanel, isWaveDropdownOpen, isViewDropdownOpen]);

  // Track canvas width on resize so it redraws to fill the new full width
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setCanvasWidth(entry.contentRect.width);
        }
      }
    });

    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  // Check reduced motion setting
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (mediaQuery.matches) {
        setIsPlaying(false);
      }
    }
  }, []);

  // Current Model & Reconstruction
  const currentModel = useMemo(() => FOURIER_SERIES_MODELS[waveType], [waveType]);

  const reconstruction = useMemo(() => {
    return reconstructFourierSignal(
      waveType,
      harmonicsCount,
      400, // high sampling resolution for silky continuous waveforms
      2, // 2 periods displayed
      f0,
      dutyCycle,
      amplitude,
      0.0 // timeOffset handled dynamically in real-time loop
    );
  }, [waveType, harmonicsCount, f0, dutyCycle, amplitude]);

  // Dynamic formula strings
  const liveFormula = useMemo(() => {
    return getLiveAnalyticalFormula(waveType, harmonicsCount, amplitude, f0, dutyCycle);
  }, [waveType, harmonicsCount, amplitude, f0, dutyCycle]);

  // Active harmonics with non-negligible magnitude
  const activeHarmonics = useMemo(() => {
    return reconstruction.harmonics.filter((h) => h.cn > 1e-5);
  }, [reconstruction.harmonics]);

  // Normalized RMS error
  const normalizedRmse = useMemo(() => {
    return amplitude > 0 ? reconstruction.rmse / amplitude : 0;
  }, [reconstruction.rmse, amplitude]);

  // Animation loop for time progression
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    lastTimeRef.current = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;

      if (speedMultiplier > 0) {
        setTime((prev) => {
          // Wrap time over 2 periods smoothly (2 / f0)
          const period = 2 / f0;
          return (prev + dt * speedMultiplier * 0.45) % period;
        });
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, speedMultiplier, f0]);

  // Sweep N (Gibbs demo) handler
  const handleStartSweepN = useCallback(() => {
    if (isSweepingN) {
      // Cancel sweep if already active
      if (sweepTimerRef.current) clearInterval(sweepTimerRef.current);
      setIsSweepingN(false);
      return;
    }

    setIsSweepingN(true);
    setHarmonicsCount(1);
    setIsPlaying(true);

    let curN = 1;
    if (sweepTimerRef.current) clearInterval(sweepTimerRef.current);

    sweepTimerRef.current = setInterval(() => {
      curN += 1;
      if (curN > 64) {
        if (sweepTimerRef.current) clearInterval(sweepTimerRef.current);
        setIsSweepingN(false);
      } else {
        setHarmonicsCount(curN);
      }
    }, 110);
  }, [isSweepingN]);

  // Clean up sweep timer on unmount
  useEffect(() => {
    return () => {
      if (sweepTimerRef.current) clearInterval(sweepTimerRef.current);
    };
  }, []);

  // Reset time to zero
  const handleResetTime = () => {
    setTime(0);
  };

  // Reset all parameters to initial defaults
  const handleResetAll = () => {
    if (sweepTimerRef.current) clearInterval(sweepTimerRef.current);
    setIsSweepingN(false);
    setWaveType('square');
    setHarmonicsCount(7);
    setSpeedMultiplier(1.0);
    setAmplitude(1.0);
    setDutyCycle(0.5);
    setTime(0);
    setIsPlaying(true);
    setActiveControlPanel(null);
  };

  // Stepper handlers
  const handleIncrementN = () => {
    setHarmonicsCount((prev) => Math.min(64, prev + 1));
  };

  const handleDecrementN = () => {
    setHarmonicsCount((prev) => Math.max(1, prev - 1));
  };

  // Export CSV
  const handleExportCSV = () => {
    const timeArr = reconstruction.timeArray;
    const orig = reconstruction.originalSignal;
    const synth = reconstruction.reconstructedSignal;
    const err = reconstruction.errorSignal;

    let csv = 'time_seconds,ideal_signal,synthesized_signal,error\n';
    for (let i = 0; i < timeArr.length; i++) {
      csv += `${timeArr[i].toFixed(6)},${orig[i].toFixed(6)},${synth[i].toFixed(6)},${err[i].toFixed(6)}\n`;
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fourier_series_${waveType}_N${harmonicsCount}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Canvas Drawing for Epicycles, Trace Connector Beam, and Waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Detect device pixel ratio for razor-sharp rendering on Retina screens
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.resetTransform();
    ctx.scale(dpr, dpr);

    // Check dark theme
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    // Background color
    ctx.fillStyle = isDark ? '#0E1F1D' : '#FAFCFB';
    ctx.fillRect(0, 0, width, height);

    // Section sizing: Epicycles on left (~28-32%), Waveform fills the remaining full width
    const minEpiW = Math.min(320, Math.max(220, Math.floor(width * 0.28)));
    const epiWidth = showEpicycles || showPhasorVectors ? minEpiW : 60;
    const waveStart = epiWidth + 12;
    const waveWidth = Math.max(100, width - waveStart - 16);

    // Center coordinates for epicycles
    const epiCenterX = epiWidth / 2;
    const epiCenterY = height / 2;

    // Amplitude scale (preserves exact circular geometry: scaleX === scaleY)
    const yLimit = Math.max(1.35 * amplitude, 1.25);
    const scaleY = (height / 2 - 24) / yLimit;

    // 1. Divider between Epicycle Area and Waveform Area
    ctx.strokeStyle = isDark ? 'rgba(88, 194, 179, 0.25)' : 'rgba(170, 238, 211, 0.8)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(epiWidth, 10);
    ctx.lineTo(epiWidth, height - 10);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. Epicycle Area Axes & Crosshairs
    ctx.strokeStyle = isDark ? 'rgba(88, 194, 179, 0.15)' : 'rgba(203, 213, 225, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(15, epiCenterY);
    ctx.lineTo(epiWidth - 15, epiCenterY);
    ctx.moveTo(epiCenterX, 15);
    ctx.lineTo(epiCenterX, height - 15);
    ctx.stroke();

    // 3. Waveform Area Grid Lines & Zero Line
    ctx.strokeStyle = isDark ? 'rgba(88, 194, 179, 0.15)' : '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);

    // +A and -A grid lines
    const yPosPlusA = epiCenterY - amplitude * scaleY;
    const yPosMinusA = epiCenterY + amplitude * scaleY;

    ctx.beginPath();
    ctx.moveTo(waveStart, yPosPlusA);
    ctx.lineTo(waveStart + waveWidth, yPosPlusA);
    ctx.moveTo(waveStart, yPosMinusA);
    ctx.lineTo(waveStart + waveWidth, yPosMinusA);
    ctx.stroke();

    // Period divider lines (T0 and 2T0)
    const xPeriod1 = waveStart + waveWidth / 2;
    const xPeriod2 = waveStart + waveWidth;

    ctx.beginPath();
    ctx.moveTo(xPeriod1, 15);
    ctx.lineTo(xPeriod1, height - 15);
    ctx.stroke();
    ctx.setLineDash([]);

    // Zero Line
    ctx.strokeStyle = isDark ? 'rgba(88, 194, 179, 0.4)' : '#CBD5E1';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(waveStart, epiCenterY);
    ctx.lineTo(waveStart + waveWidth, epiCenterY);
    ctx.stroke();

    // Grid labels
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = isDark ? '#89C7BC' : '#94A3B8';
    ctx.textAlign = 'right';
    ctx.fillText(`+${amplitude.toFixed(1)}V`, waveStart - 4, yPosPlusA + 3);
    ctx.fillText(`-${amplitude.toFixed(1)}V`, waveStart - 4, yPosMinusA + 3);
    ctx.fillText('0V', waveStart - 4, epiCenterY + 3);

    ctx.textAlign = 'center';
    ctx.fillText('t=0', waveStart + 10, height - 6);
    ctx.fillText('T₀', xPeriod1, height - 6);
    ctx.fillText('2T₀', xPeriod2 - 12, height - 6);

    // 4. Calculate rotating epicycle chain at current time
    const epicycleData = calculateEpicycleChain(
      reconstruction.harmonics,
      reconstruction.a0,
      time,
      f0,
      epiCenterX,
      epiCenterY,
      scaleY
    );

    const { nodes, finalTipX, finalTipY } = epicycleData;

    // 5. Draw Epicycles (Circles & Vectors)
    if (showEpicycles || showPhasorVectors) {
      nodes.forEach((node) => {
        const isHovered = hoveredHarmonicIndex === node.n;

        // Circle outline
        if (showEpicycles) {
          ctx.beginPath();
          ctx.arc(node.centerX, node.centerY, node.radius, 0, 2 * Math.PI);
          if (isHovered) {
            ctx.strokeStyle = isDark ? '#FBBF24' : '#D97706';
            ctx.lineWidth = 2.4;
            ctx.stroke();
          } else {
            ctx.strokeStyle = isDark ? 'rgba(167, 139, 250, 0.45)' : 'rgba(124, 58, 237, 0.3)';
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }
        }

        // Phasor Vector (Line from center to tip)
        if (showPhasorVectors) {
          ctx.beginPath();
          ctx.moveTo(node.centerX, node.centerY);
          ctx.lineTo(node.tipX, node.tipY);
          ctx.strokeStyle = isHovered
            ? (isDark ? '#FBBF24' : '#D97706')
            : (isDark ? '#A78BFA' : '#7C3AED');
          ctx.lineWidth = isHovered ? 2.5 : 1.5;
          ctx.stroke();

          // Center joint dot
          ctx.beginPath();
          ctx.arc(node.centerX, node.centerY, 1.8, 0, 2 * Math.PI);
          ctx.fillStyle = isDark ? '#A78BFA' : '#7C3AED';
          ctx.fill();
        }
      });

      // Highlighted tip marker
      ctx.beginPath();
      ctx.arc(finalTipX, finalTipY, 4, 0, 2 * Math.PI);
      ctx.fillStyle = isDark ? '#38BDF8' : '#0284C7';
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // 6. Draw Waveform Plot Curves
    const totalSamples = reconstruction.reconstructedSignal.length;
    const getWaveX = (idx: number) => waveStart + (idx / (totalSamples - 1)) * waveWidth;
    const getWaveY = (val: number) => epiCenterY - val * scaleY;

    // Optional: Draw individual harmonics faintly behind sum (first 8)
    if (showIndividualHarmonics) {
      const first8 = activeHarmonics.slice(0, 8);
      first8.forEach((h) => {
        ctx.beginPath();
        ctx.strokeStyle = isDark ? 'rgba(167, 139, 250, 0.22)' : 'rgba(124, 58, 237, 0.22)';
        ctx.lineWidth = 1.2;

        for (let i = 0; i < totalSamples; i++) {
          const tSample = (i / (totalSamples - 1)) * (2 / f0);
          const angle = 2 * Math.PI * h.n * f0 * tSample;
          const val = h.an * Math.cos(angle) + h.bn * Math.sin(angle);
          const px = getWaveX(i);
          const py = getWaveY(val);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      });
    }

    // Theoretical Ideal Target Wave (High Contrast Amber / Gold #D97706)
    if (showTheoreticalWave) {
      ctx.beginPath();
      ctx.strokeStyle = isDark ? '#FBBF24' : '#D97706';
      ctx.lineWidth = 2.0;

      for (let i = 0; i < totalSamples; i++) {
        const val = reconstruction.originalSignal[i];
        const px = getWaveX(i);
        const py = getWaveY(val);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Synthesized Fourier Sum (Vibrant Teal / Sky Blue #0284C7 / #0D9488)
    ctx.beginPath();
    ctx.strokeStyle = isDark ? '#38BDF8' : '#0284C7';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 0; i < totalSamples; i++) {
      const val = reconstruction.reconstructedSignal[i];
      const px = getWaveX(i);
      const py = getWaveY(val);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // 7. Time Playhead Cursor & Connector Beam
    const timeInTwoPeriods = (time % (2 / f0) + 2 / f0) % (2 / f0);
    const cursorFraction = timeInTwoPeriods / (2 / f0);
    const playheadX = waveStart + cursorFraction * waveWidth;

    // Trace Connector Beam (Emerald / Mint #10B981)
    if (showConnectorBeam) {
      ctx.beginPath();
      ctx.strokeStyle = isDark ? '#34D399' : '#10B981';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 3]);
      ctx.moveTo(finalTipX, finalTipY);
      ctx.lineTo(playheadX, finalTipY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Glowing contact dot on synthesized wave
      ctx.beginPath();
      ctx.arc(playheadX, finalTipY, 4.5, 0, 2 * Math.PI);
      ctx.fillStyle = isDark ? '#34D399' : '#10B981';
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Vertical Playhead Line
    ctx.beginPath();
    ctx.strokeStyle = isDark ? 'rgba(56, 189, 248, 0.55)' : 'rgba(2, 132, 199, 0.45)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([2, 2]);
    ctx.moveTo(playheadX, 15);
    ctx.lineTo(playheadX, height - 15);
    ctx.stroke();
    ctx.setLineDash([]);

    // 8. Interactive Hover Indicator
    if (waveformHoverTime !== null) {
      const hoverFraction = Math.max(0, Math.min(1, waveformHoverTime / (2 / f0)));
      const hoverX = waveStart + hoverFraction * waveWidth;
      const hoverIdx = Math.min(totalSamples - 1, Math.max(0, Math.round(hoverFraction * (totalSamples - 1))));
      const synthVal = reconstruction.reconstructedSignal[hoverIdx];
      const idealVal = reconstruction.originalSignal[hoverIdx];

      ctx.beginPath();
      ctx.strokeStyle = isDark ? '#E5F6F1' : '#123A36';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.moveTo(hoverX, 15);
      ctx.lineTo(hoverX, height - 15);
      ctx.stroke();
      ctx.setLineDash([]);

      // Dot on synth
      ctx.beginPath();
      ctx.arc(hoverX, getWaveY(synthVal), 4, 0, 2 * Math.PI);
      ctx.fillStyle = isDark ? '#38BDF8' : '#0284C7';
      ctx.fill();

      // Dot on ideal
      ctx.beginPath();
      ctx.arc(hoverX, getWaveY(idealVal), 4, 0, 2 * Math.PI);
      ctx.fillStyle = isDark ? '#FBBF24' : '#D97706';
      ctx.fill();
    }
  }, [
    waveType,
    harmonicsCount,
    amplitude,
    f0,
    time,
    showEpicycles,
    showTheoreticalWave,
    showPhasorVectors,
    showConnectorBeam,
    showIndividualHarmonics,
    reconstruction,
    activeHarmonics,
    hoveredHarmonicIndex,
    waveformHoverTime,
    canvasWidth,
  ]);

  // Handle canvas mouse move for cursor readout
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const width = rect.width;
    const minEpiW = Math.min(320, Math.max(220, Math.floor(width * 0.28)));
    const epiWidth = showEpicycles || showPhasorVectors ? minEpiW : 60;
    const waveStart = epiWidth + 12;
    const waveWidth = Math.max(100, width - waveStart - 16);

    if (mouseX >= waveStart && mouseX <= waveStart + waveWidth) {
      const fraction = (mouseX - waveStart) / waveWidth;
      const t = fraction * (2 / f0);
      setWaveformHoverTime(t);
    } else {
      setWaveformHoverTime(null);
    }
  };

  const handleCanvasMouseLeave = () => {
    setWaveformHoverTime(null);
  };

  // Hovered inspection values
  const hoverReadout = useMemo(() => {
    if (waveformHoverTime === null) return null;
    const totalSamples = reconstruction.reconstructedSignal.length;
    const fraction = Math.max(0, Math.min(1, waveformHoverTime / (2 / f0)));
    const idx = Math.min(totalSamples - 1, Math.max(0, Math.round(fraction * (totalSamples - 1))));
    return {
      t: waveformHoverTime,
      synth: reconstruction.reconstructedSignal[idx],
      ideal: reconstruction.originalSignal[idx],
      err: reconstruction.errorSignal[idx],
    };
  }, [waveformHoverTime, reconstruction, f0]);

  // Selected waveform option helper
  const selectedOption = useMemo(() => {
    for (const group of WAVEFORM_GROUPS) {
      const match = group.options.find((opt) => opt.value === waveType);
      if (match) return match;
    }
    return WAVEFORM_GROUPS[0].options[0];
  }, [waveType]);

  // Selected view option helper
  const selectedViewOption = useMemo(() => {
    return VIEW_OPTIONS.find((opt) => opt.id === activeViewSection) || VIEW_OPTIONS[0];
  }, [activeViewSection]);

  const handleSelectViewSection = (id: MergedViewSection) => {
    setActiveViewSection(id);
    if (id === 'table') {
      setIsTableExpanded(true);
    }
    setIsViewDropdownOpen(false);
  };

  const handleToggleViewDropdown = () => {
    setIsViewDropdownOpen((prev) => {
      const next = !prev;
      if (next) {
        const idx = VIEW_OPTIONS.findIndex((o) => o.id === activeViewSection);
        setFocusedViewIndex(idx >= 0 ? idx : 0);
      }
      return next;
    });
  };

  const handleViewDropdownKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!isViewDropdownOpen) {
        setIsViewDropdownOpen(true);
        const idx = VIEW_OPTIONS.findIndex((o) => o.id === activeViewSection);
        setFocusedViewIndex(idx >= 0 ? idx : 0);
      }
    } else if (e.key === 'Escape') {
      if (isViewDropdownOpen) {
        e.preventDefault();
        setIsViewDropdownOpen(false);
      }
    }
  };

  const handleViewListboxKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedViewIndex((prev) => (prev + 1) % VIEW_OPTIONS.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedViewIndex((prev) => (prev - 1 + VIEW_OPTIONS.length) % VIEW_OPTIONS.length);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setFocusedViewIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setFocusedViewIndex(VIEW_OPTIONS.length - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (focusedViewIndex >= 0 && focusedViewIndex < VIEW_OPTIONS.length) {
        handleSelectViewSection(VIEW_OPTIONS[focusedViewIndex].id);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsViewDropdownOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* =========================================================================
          ITEM 1 & 2: SINGLE MERGED TOP HEADER CARD
          - Single card with shared border, radius, shadow, and padding.
          - Left: 'C' badge, 'Fourier Series' title with 'Interactive Topic' tag,
            one-line subtitle 'Analytical Coefficients & Rotating Phasors',
            combined description, and Power Captured & Gibbs Overshoot badges below.
          - Right: 'Group 3 - Project' pill top right, with Export CSV and Reset buttons
            cleanly right-aligned below.
          - The duplicate Pause Animation button was removed as the simulation Play
            button controls the exact same animation state.
          ========================================================================= */}
      <div className="bg-white rounded-[14px] p-4 sm:p-5 shadow-sm border border-[#AAEED3]/50 flex flex-col md:flex-row md:items-start justify-between gap-4">
        {/* Left Section */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-[#2A7B73] text-white flex items-center justify-center font-mono font-bold text-base shadow-xs shrink-0">
            C
          </span>
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-heading font-bold text-lg sm:text-xl text-[#123A36]">
                Fourier Series
              </h1>
              <span className="text-xs font-mono px-2 py-0.5 rounded font-semibold bg-[#AAEED3]/30 text-[#2A7B73] border border-[#AAEED3]">
                Interactive Topic
              </span>
            </div>

            <div className="text-xs font-semibold text-[#2A7B73]">
              Analytical Coefficients &amp; Rotating Phasors
            </div>

            <p className="text-xs text-[#123A36]/75 max-w-3xl leading-relaxed">
              Synthesize periodic waveforms from orthogonal trigonometric harmonics with Gibbs phenomenon analysis, observe epicycle phasor chains rotating in real time, and compare reconstructed signals side by side with theoretical targets.
            </p>

            {/* Badges in one row under description */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-[#FFF6B0] text-[#123A36] border border-[#AAEED3]/60">
                Power Captured: {reconstruction.powerAccumulatedPercent.toFixed(1)}%
              </span>
              {waveType === 'square' && (
                <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-300">
                  Gibbs Overshoot: {reconstruction.gibbsOvershootPercent}%
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Section: Group 3 - Project pill & Action buttons (Export CSV & Reset) */}
        <div className="flex flex-col items-start md:items-end justify-between gap-3 shrink-0 self-stretch md:self-auto">
          <span className="text-xs font-mono px-3 py-1 rounded-full font-semibold bg-[#AAEED3]/30 text-[#2A7B73] border border-[#AAEED3]">
            Group 3 - Project
          </span>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-xl bg-[#F3FAF7] text-[#2A7B73] border border-[#AAEED3] hover:bg-[#AAEED3]/40 transition cursor-pointer shadow-2xs focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2A7B73]"
              title="Download reconstructed waveform and error data as CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={handleResetAll}
              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-xl bg-white text-[#123A36]/70 border border-[#AAEED3]/60 hover:text-[#123A36] hover:bg-[#F3FAF7] transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2A7B73]"
              title="Reset simulation parameters to default"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          ITEM 1: FULL-WIDTH SIMULATION ROW WITH TOOLBAR CONTROLS IN HEADER
          - Full width directly under merged header card
          - Header row: Title on left, and on right:
            [Waveform drop-down] [Sweep N (Gibbs Demo)] [Play] [Reset Time] [Controls]
          - Wraps onto a second line right-aligned if width is narrow
          - High-contrast legend row
          - Optional control panel ('Harmonics, Speed & Amplitude') shown above plot
          - Epicycle & Waveform plot canvas with responsive auto-resizing
          - Footer status readouts
          ========================================================================= */}
      <div className="bg-white rounded-[14px] p-5 shadow-sm border border-[#AAEED3]/50 space-y-4">
        
        {/* Header Row: Title & Integrated Toolbar + Controls Dropdown */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#AAEED3]/40 pb-3">
          {/* Title on Left */}
          <div className="flex items-center gap-2 shrink-0">
            <Activity className="w-4 h-4 text-[#2A7B73]" />
            <h3 className="font-heading font-bold text-sm sm:text-base text-[#123A36]">
              Epicycle Phasor Chain &amp; Waveform Synthesis
            </h3>
          </div>

          {/* Right Toolbar Controls (Order: Waveform drop-down, Sweep N, Play, Reset Time, Controls) */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            
            {/* 1. Waveform Custom Dropdown */}
            <div className="relative" ref={waveDropdownRef}>
              <button
                type="button"
                onClick={() => setIsWaveDropdownOpen(!isWaveDropdownOpen)}
                aria-haspopup="listbox"
                aria-expanded={isWaveDropdownOpen}
                className="px-3 py-1.5 rounded-xl bg-[#F3FAF7] border border-[#AAEED3] text-xs font-bold text-[#123A36] hover:bg-[#AAEED3]/30 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2A7B73]"
                title="Select periodic waveform archetype"
              >
                <span className="text-[#2A7B73] font-mono text-[10px] uppercase font-bold bg-[#AAEED3]/40 px-1.5 py-0.5 rounded">
                  Waveform
                </span>
                <span className="truncate max-w-[130px] sm:max-w-none">{selectedOption.label}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-[#2A7B73] transition-transform ${isWaveDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Waveform Dropdown Popover */}
              {isWaveDropdownOpen && (
                <div
                  className="absolute right-0 sm:left-0 sm:right-auto top-full mt-1.5 w-72 sm:w-80 bg-white rounded-xl shadow-xl border border-[#AAEED3] py-2 z-50 animate-in fade-in zoom-in-95 duration-100"
                  role="listbox"
                >
                  {WAVEFORM_GROUPS.map((group) => (
                    <div key={group.category} className="mb-2 last:mb-0">
                      <div className="px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#2A7B73]/80 bg-[#F3FAF7]">
                        {group.category}
                      </div>
                      {group.options.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setWaveType(opt.value);
                            setIsWaveDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                            waveType === opt.value
                              ? 'bg-[#AAEED3]/30 text-[#2A7B73] font-bold'
                              : 'text-[#123A36] hover:bg-[#AAEED3]/15'
                          }`}
                          role="option"
                          aria-selected={waveType === opt.value}
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span>{opt.label}</span>
                              <span className="text-[10px] font-mono text-[#2A7B73]/70">[{opt.badge}]</span>
                            </div>
                            <div className="text-[10px] text-[#123A36]/60 mt-0.5 line-clamp-1">
                              {opt.description}
                            </div>
                          </div>
                          {waveType === opt.value && <Check className="w-4 h-4 text-[#2A7B73] shrink-0" />}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Sweep N (Gibbs Demo) Button */}
            <button
              type="button"
              onClick={handleStartSweepN}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                isSweepingN
                  ? 'bg-amber-500 text-white border-amber-600 animate-pulse'
                  : 'bg-[#FFF6B0] text-[#123A36] border-[#AAEED3] hover:bg-[#FFF6B0]/80'
              }`}
              title="Automatically sweep N from 1 to 64 to observe Gibbs phenomenon convergence"
            >
              <Zap className="w-3.5 h-3.5 text-amber-700" />
              <span>{isSweepingN ? `Sweeping N (${harmonicsCount}/64)...` : 'Sweep N (Gibbs Demo)'}</span>
            </button>

            {/* 3. Play / Pause Button */}
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              aria-pressed={isPlaying}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                isPlaying
                  ? 'bg-[#2A7B73] text-white hover:bg-[#123A36]'
                  : 'bg-[#F3FAF7] text-[#2A7B73] border border-[#AAEED3] hover:bg-[#AAEED3]/40'
              }`}
              title={isPlaying ? 'Pause animation' : 'Play animation'}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlaying ? 'Pause' : 'Play'}</span>
            </button>

            {/* 4. Reset Time Button */}
            <button
              type="button"
              onClick={handleResetTime}
              className="px-2.5 py-1.5 rounded-xl bg-[#F3FAF7] text-[#123A36]/80 border border-[#AAEED3]/60 hover:text-[#123A36] hover:bg-[#AAEED3]/30 text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
              title="Reset time to t=0"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#2A7B73]" />
              <span>Reset Time</span>
            </button>

            {/* 5. Controls Custom Dropdown */}
            <div className="relative" ref={controlsDropdownRef}>
              <button
                type="button"
                onClick={() => setIsControlsDropdownOpen(!isControlsDropdownOpen)}
                aria-haspopup="listbox"
                aria-expanded={isControlsDropdownOpen}
                aria-controls="simulation-controls-menu"
                aria-label="Simulation Controls"
                className="px-3 py-1.5 rounded-xl bg-[#F3FAF7] border border-[#AAEED3] text-xs font-bold text-[#123A36] hover:bg-[#AAEED3]/30 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2A7B73]"
              >
                <Sliders className="w-3.5 h-3.5 text-[#2A7B73]" />
                <span>Controls</span>
                <ChevronDown className={`w-3.5 h-3.5 text-[#2A7B73] transition-transform ${isControlsDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Controls Floating Menu Panel */}
              {isControlsDropdownOpen && (
                <div
                  id="simulation-controls-menu"
                  className="absolute right-0 top-full mt-1.5 w-64 bg-white rounded-xl shadow-xl border border-[#AAEED3] py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
                  role="listbox"
                >
                  {/* Option 1: Number of Harmonics (N) */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveControlPanel('harmonics');
                      setIsControlsDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      activeControlPanel === 'harmonics'
                        ? 'bg-[#AAEED3]/30 text-[#2A7B73] font-bold'
                        : 'text-[#123A36] hover:bg-[#AAEED3]/15'
                    }`}
                    role="option"
                    aria-selected={activeControlPanel === 'harmonics'}
                  >
                    <div className="flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 text-[#2A7B73]" />
                      <div>
                        <div className="font-semibold">Number of Harmonics (N)</div>
                        <div className="text-[10px] text-[#123A36]/60">N = {harmonicsCount}</div>
                      </div>
                    </div>
                    {activeControlPanel === 'harmonics' && <Check className="w-4 h-4 text-[#2A7B73]" />}
                  </button>

                  {/* Option 2: Fundamental Speed (ω) */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveControlPanel('speed');
                      setIsControlsDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      activeControlPanel === 'speed'
                        ? 'bg-[#AAEED3]/30 text-[#2A7B73] font-bold'
                        : 'text-[#123A36] hover:bg-[#AAEED3]/15'
                    }`}
                    role="option"
                    aria-selected={activeControlPanel === 'speed'}
                  >
                    <div className="flex items-center gap-2">
                      <Activity className="w-3.5 h-3.5 text-[#2A7B73]" />
                      <div>
                        <div className="font-semibold">Fundamental Speed (ω)</div>
                        <div className="text-[10px] text-[#123A36]/60">{speedMultiplier.toFixed(1)}x speed</div>
                      </div>
                    </div>
                    {activeControlPanel === 'speed' && <Check className="w-4 h-4 text-[#2A7B73]" />}
                  </button>

                  {/* Option 3: Base Amplitude (A) */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveControlPanel('amplitude');
                      setIsControlsDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      activeControlPanel === 'amplitude'
                        ? 'bg-[#AAEED3]/30 text-[#2A7B73] font-bold'
                        : 'text-[#123A36] hover:bg-[#AAEED3]/15'
                    }`}
                    role="option"
                    aria-selected={activeControlPanel === 'amplitude'}
                  >
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-3.5 h-3.5 text-[#2A7B73]" />
                      <div>
                        <div className="font-semibold">Base Amplitude (A)</div>
                        <div className="text-[10px] text-[#123A36]/60">{amplitude.toFixed(2)} V</div>
                      </div>
                    </div>
                    {activeControlPanel === 'amplitude' && <Check className="w-4 h-4 text-[#2A7B73]" />}
                  </button>

                  {/* Divider */}
                  <div className="border-t border-[#AAEED3]/40 my-1" />

                  {/* Option 4: Hide controls */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveControlPanel(null);
                      setIsControlsDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      activeControlPanel === null
                        ? 'bg-[#AAEED3]/20 text-[#123A36] font-semibold'
                        : 'text-[#123A36]/80 hover:bg-[#AAEED3]/15'
                    }`}
                    role="option"
                    aria-selected={activeControlPanel === null}
                  >
                    <div className="flex items-center gap-2">
                      <X className="w-3.5 h-3.5 text-[#123A36]/60" />
                      <div>
                        <div>Hide controls</div>
                        <div className="text-[10px] text-[#123A36]/50">Close controls panel</div>
                      </div>
                    </div>
                    {activeControlPanel === null && <Check className="w-4 h-4 text-[#2A7B73]" />}
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* High-Contrast Legend Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#0284C7] inline-block shadow-2xs" />
              <span className="text-[#123A36] font-semibold">Synthesized Sum x_N(t)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#D97706] inline-block shadow-2xs" />
              <span className="text-[#123A36] font-semibold">Theoretical Ideal Wave</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#7C3AED] inline-block shadow-2xs" />
              <span className="text-[#123A36] font-semibold">Rotating Phasors</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-[#10B981] inline-block" />
              <span className="text-[#123A36] font-semibold">Connector Beam</span>
            </div>
          </div>

          <span className="text-[11px] text-[#123A36]/60 font-sans">
            Full-width synchronized view
          </span>
        </div>

        {/* Selected Control Panel (Shown directly above simulation plot when active) */}
        {activeControlPanel !== null && (
          <div
            id="simulation-control-panel"
            role="region"
            aria-label="Harmonics, Speed & Amplitude Control Panel"
            className="bg-[#FAFCFB] p-4 rounded-xl border border-[#AAEED3]/60 shadow-2xs space-y-3 transition-all duration-200"
          >
            <div className="flex items-center justify-between border-b border-[#AAEED3]/40 pb-2">
              <div className="flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5 text-[#2A7B73]" />
                <span className="text-xs font-bold text-[#123A36] uppercase tracking-wider">
                  Harmonics, Speed &amp; Amplitude
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveControlPanel(null)}
                className="w-6 h-6 rounded-lg text-[#123A36]/60 hover:text-[#123A36] hover:bg-[#AAEED3]/25 flex items-center justify-center transition cursor-pointer"
                aria-label="Close controls panel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Sub-panel 1: Number of Harmonics (N) */}
            {activeControlPanel === 'harmonics' && (
              <div className="space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-[#123A36] block">Number of Harmonics (N)</span>
                    <span className="text-[11px] text-[#123A36]/65">Harmonic limit range: 1 to 64</span>
                  </div>
                  <span className="text-base font-mono font-bold text-[#2A7B73] bg-white px-2.5 py-0.5 rounded-lg border border-[#AAEED3]">
                    N = {harmonicsCount}
                  </span>
                </div>

                {/* Slider with - / + Stepper buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDecrementN}
                    disabled={harmonicsCount <= 1}
                    className="w-7 h-7 rounded-lg bg-white border border-[#AAEED3] text-[#123A36] hover:bg-[#AAEED3]/30 disabled:opacity-40 flex items-center justify-center transition cursor-pointer shadow-2xs"
                    aria-label="Decrease harmonics"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>

                  <input
                    type="range"
                    min={1}
                    max={64}
                    step={1}
                    value={harmonicsCount}
                    onChange={(e) => setHarmonicsCount(Number(e.target.value))}
                    className="flex-1 accent-[#2A7B73] cursor-pointer"
                    aria-label="Harmonics count N"
                  />

                  <button
                    type="button"
                    onClick={handleIncrementN}
                    disabled={harmonicsCount >= 64}
                    className="w-7 h-7 rounded-lg bg-white border border-[#AAEED3] text-[#123A36] hover:bg-[#AAEED3]/30 disabled:opacity-40 flex items-center justify-center transition cursor-pointer shadow-2xs"
                    aria-label="Increase harmonics"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Number-only Presets Chip Row (1, 3, 5, 11, 25, 64) */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] font-mono text-[#123A36]/60">Presets:</span>
                  {PRESET_N_VALUES.map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setHarmonicsCount(val)}
                      className={`px-2.5 py-0.5 text-[11px] font-mono rounded-lg border transition cursor-pointer ${
                        harmonicsCount === val
                          ? 'bg-[#2A7B73] text-white border-[#2A7B73] font-bold shadow-2xs'
                          : 'bg-white text-[#123A36] border-[#AAEED3]/60 hover:bg-[#AAEED3]/25'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sub-panel 2: Fundamental Speed (ω) */}
            {activeControlPanel === 'speed' && (
              <div className="space-y-3 animate-in fade-in duration-150">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#123A36] font-bold">Fundamental Speed (ω):</span>
                  <span className="font-mono font-bold text-[#2A7B73] bg-white px-2 py-0.5 rounded border border-[#AAEED3]">
                    {speedMultiplier.toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min={0.0}
                  max={3.0}
                  step={0.1}
                  value={speedMultiplier}
                  onChange={(e) => setSpeedMultiplier(Number(e.target.value))}
                  className="w-full accent-[#2A7B73] cursor-pointer"
                  aria-label="Fundamental speed multiplier"
                />
                <div className="flex justify-between text-[10px] text-[#123A36]/60 font-mono">
                  <span>0x (Freeze)</span>
                  <span>1.0x (Standard)</span>
                  <span>3.0x (Fast)</span>
                </div>

                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[10px] font-mono text-[#123A36]/60">Quick Speeds:</span>
                  {[0.5, 1.0, 2.0].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSpeedMultiplier(s)}
                      className={`px-2.5 py-0.5 text-[11px] font-mono rounded-lg border transition cursor-pointer ${
                        speedMultiplier === s
                          ? 'bg-[#2A7B73] text-white border-[#2A7B73] font-bold shadow-2xs'
                          : 'bg-white text-[#123A36] border-[#AAEED3]/60 hover:bg-[#AAEED3]/25'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sub-panel 3: Base Amplitude (A) */}
            {activeControlPanel === 'amplitude' && (
              <div className="space-y-3 animate-in fade-in duration-150">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#123A36] font-bold">Base Amplitude (A):</span>
                  <span className="font-mono font-bold text-[#2A7B73] bg-white px-2 py-0.5 rounded border border-[#AAEED3]">
                    {amplitude.toFixed(2)} V
                  </span>
                </div>
                <input
                  type="range"
                  min={0.2}
                  max={3.0}
                  step={0.1}
                  value={amplitude}
                  onChange={(e) => setAmplitude(Number(e.target.value))}
                  className="w-full accent-[#2A7B73] cursor-pointer"
                  aria-label="Base amplitude in Volts"
                />

                {/* Duty Cycle (when Pulse wave selected) */}
                {waveType === 'pulse' && (
                  <div className="pt-2 border-t border-[#AAEED3]/40 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#123A36] font-bold">Duty Cycle (D):</span>
                      <span className="font-mono font-bold text-[#2A7B73]">{(dutyCycle * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0.05}
                      max={0.95}
                      step={0.01}
                      value={dutyCycle}
                      onChange={(e) => setDutyCycle(Number(e.target.value))}
                      className="w-full accent-[#2A7B73] cursor-pointer"
                      aria-label="Pulse duty cycle"
                    />
                    <div className="flex justify-between text-[10px] text-[#123A36]/60 font-mono">
                      <span>5% (Narrow)</span>
                      <span>50% (Symmetric)</span>
                      <span>95% (Wide)</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Epicycle & Waveform Canvas (Full Width) */}
        <div className="relative w-full rounded-xl overflow-hidden border border-[#AAEED3]/50 bg-white shadow-2xs">
          <canvas
            ref={canvasRef}
            onMouseMove={handleCanvasMouseMove}
            onMouseLeave={handleCanvasMouseLeave}
            className="w-full h-[320px] sm:h-[350px] block cursor-crosshair"
            aria-label="Epicycle phasor chain and Fourier synthesized waveform plot"
          />

          {/* Live Floating Inspector Tooltip on Cursor Hover */}
          {hoverReadout && (
            <div className="absolute top-2.5 right-2.5 bg-[#123A36]/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-xs font-mono shadow-lg border border-[#2A7B73] flex items-center gap-3 animate-in fade-in duration-100">
              <span>t = {hoverReadout.t.toFixed(3)}s</span>
              <span>|</span>
              <span className="text-[#38BDF8]">x_N(t) = {hoverReadout.synth.toFixed(3)}V</span>
              <span>|</span>
              <span className="text-amber-300">ideal = {hoverReadout.ideal.toFixed(3)}V</span>
              <span>|</span>
              <span className="text-rose-300">|e| = {Math.abs(hoverReadout.err).toFixed(3)}V</span>
            </div>
          )}
        </div>

        {/* Footer Status Readouts */}
        <div className="flex flex-wrap items-center justify-between text-[11px] text-[#123A36]/70 font-mono px-1">
          <span>
            Phase: <strong>{(time * f0).toFixed(2)} periods</strong> (t = {time.toFixed(3)} s)
          </span>
          <span className="text-[#2A7B73]">
            Hover waveform to inspect instantaneous amplitude and residual error
          </span>
        </div>
      </div>

      {/* =========================================================================
          ITEM 3: MERGED VIEW CARD (5 Sections: Display Options, Formula, Metrics, Spectrum, Table)
          - Single card directly below simulation row with shared border, radius, shadow, padding
          - Custom 'View' dropdown at top right with 5 options:
            1. Display Options (default on load)
            2. Live Series Formula
            3. Live Metrics & Benchmarks
            4. Harmonic Frequency Spectrum
            5. Harmonic Coefficients Table
          - Left title shows the name and icon of the active section
          - Full keyboard navigation and smooth transition
          ========================================================================= */}
      <div className="bg-white rounded-[14px] p-5 shadow-sm border border-[#AAEED3]/50 space-y-4">
        
        {/* Card Header: Dynamic Section Title on Left & 'View' Dropdown on Right */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#AAEED3]/40 pb-3">
          {/* Dynamic Title */}
          <div>
            {activeViewSection === 'display_options' && (
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#2A7B73]" />
                <h4 className="font-heading font-bold text-sm sm:text-base text-[#123A36]">
                  Display Options
                </h4>
              </div>
            )}
            {activeViewSection === 'formula' && (
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-[#2A7B73]" />
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-heading font-bold text-sm sm:text-base text-[#123A36]">
                    Live Series Formula
                  </h4>
                  <span className="text-[10px] font-mono text-[#2A7B73] bg-[#AAEED3]/30 px-2 py-0.5 rounded border border-[#AAEED3]">
                    N = {harmonicsCount}
                  </span>
                </div>
              </div>
            )}
            {activeViewSection === 'metrics' && (
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#2A7B73]" />
                <h4 className="font-heading font-bold text-sm sm:text-base text-[#123A36]">
                  Live Metrics &amp; Benchmarks
                </h4>
              </div>
            )}
            {activeViewSection === 'spectrum' && (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-[#2A7B73]" />
                  <h4 className="font-heading font-bold text-sm sm:text-base text-[#123A36]">
                    Harmonic Frequency Spectrum
                  </h4>
                </div>
                <span className="text-[11px] font-mono text-[#2A7B73] bg-[#AAEED3]/30 px-2 py-0.5 rounded border border-[#AAEED3]">
                  Hover bar to highlight corresponding epicycle
                </span>
              </div>
            )}
            {activeViewSection === 'table' && (
              <div className="flex items-center gap-2">
                <TableIcon className="w-4 h-4 text-[#2A7B73]" />
                <h4 className="font-heading font-bold text-sm sm:text-base text-[#123A36]">
                  Harmonic Coefficients Table
                </h4>
              </div>
            )}
          </div>

          {/* 'View' Custom Dropdown */}
          <div className="relative" ref={viewDropdownRef}>
            <button
              type="button"
              onClick={handleToggleViewDropdown}
              onKeyDown={handleViewDropdownKeyDown}
              aria-haspopup="listbox"
              aria-expanded={isViewDropdownOpen}
              aria-controls="merged-view-menu"
              aria-label="Select View Section"
              className="px-3.5 py-1.5 rounded-xl bg-[#F3FAF7] border border-[#AAEED3] text-xs font-bold text-[#123A36] hover:bg-[#AAEED3]/30 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2A7B73]"
            >
              <span className="text-[#2A7B73] font-semibold">View:</span>
              <span>{selectedViewOption.label}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-[#2A7B73] transition-transform ${isViewDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* View Dropdown Popover */}
            {isViewDropdownOpen && (
              <div
                id="merged-view-menu"
                className="absolute right-0 top-full mt-1.5 w-64 bg-white rounded-xl shadow-xl border border-[#AAEED3] py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
                role="listbox"
                aria-label="View sections"
                tabIndex={-1}
                onKeyDown={handleViewListboxKeyDown}
              >
                {VIEW_OPTIONS.map((opt, idx) => {
                  const IconComp = opt.icon;
                  const isSelected = activeViewSection === opt.id;
                  const isFocused = focusedViewIndex === idx;
                  return (
                    <button
                      key={opt.id}
                      id={`view-opt-${opt.id}`}
                      type="button"
                      onClick={() => handleSelectViewSection(opt.id)}
                      onMouseEnter={() => setFocusedViewIndex(idx)}
                      className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#AAEED3]/30 text-[#2A7B73] font-bold'
                          : isFocused
                          ? 'bg-[#AAEED3]/15 text-[#123A36]'
                          : 'text-[#123A36] hover:bg-[#AAEED3]/15'
                      }`}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <div className="flex items-center gap-2">
                        <IconComp className="w-3.5 h-3.5 text-[#2A7B73]" />
                        <span>{opt.label}</span>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-[#2A7B73]" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Card Content with Smooth 150ms Transition */}
        <div
          role="region"
          aria-label={selectedViewOption.label}
          className="transition-all duration-150 ease-in-out"
        >
          
          {/* Section 1: Display Options (Default) */}
          {activeViewSection === 'display_options' && (
            <div className="animate-in fade-in duration-150 space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
                {/* Epicycles */}
                <label className="flex items-center justify-between p-2.5 rounded-lg bg-[#FAFCFB] border border-[#AAEED3]/50 cursor-pointer hover:bg-[#F3FAF7]">
                  <span className="text-[#123A36] font-medium">Show Epicycles (Circles)</span>
                  <input
                    type="checkbox"
                    checked={showEpicycles}
                    onChange={(e) => setShowEpicycles(e.target.checked)}
                    className="accent-[#2A7B73] w-4 h-4 cursor-pointer"
                  />
                </label>

                {/* Theoretical Target Wave */}
                <label className="flex items-center justify-between p-2.5 rounded-lg bg-[#FAFCFB] border border-[#AAEED3]/50 cursor-pointer hover:bg-[#F3FAF7]">
                  <span className="text-[#123A36] font-medium">Show Target Ideal Wave</span>
                  <input
                    type="checkbox"
                    checked={showTheoreticalWave}
                    onChange={(e) => setShowTheoreticalWave(e.target.checked)}
                    className="accent-[#2A7B73] w-4 h-4 cursor-pointer"
                  />
                </label>

                {/* Rotating Phasor Vectors */}
                <label className="flex items-center justify-between p-2.5 rounded-lg bg-[#FAFCFB] border border-[#AAEED3]/50 cursor-pointer hover:bg-[#F3FAF7]">
                  <span className="text-[#123A36] font-medium">Show Rotating Phasor Vectors</span>
                  <input
                    type="checkbox"
                    checked={showPhasorVectors}
                    onChange={(e) => setShowPhasorVectors(e.target.checked)}
                    className="accent-[#2A7B73] w-4 h-4 cursor-pointer"
                  />
                </label>

                {/* Trace Connector Beam */}
                <label className="flex items-center justify-between p-2.5 rounded-lg bg-[#FAFCFB] border border-[#AAEED3]/50 cursor-pointer hover:bg-[#F3FAF7]">
                  <span className="text-[#123A36] font-medium">Trace Connector Beam</span>
                  <input
                    type="checkbox"
                    checked={showConnectorBeam}
                    onChange={(e) => setShowConnectorBeam(e.target.checked)}
                    className="accent-[#2A7B73] w-4 h-4 cursor-pointer"
                  />
                </label>

                {/* Individual Harmonics */}
                <label className="flex items-center justify-between p-2.5 rounded-lg bg-[#FAFCFB] border border-[#AAEED3]/50 cursor-pointer hover:bg-[#F3FAF7]">
                  <span className="text-[#123A36] font-medium">Individual Harmonics (First 8)</span>
                  <input
                    type="checkbox"
                    checked={showIndividualHarmonics}
                    onChange={(e) => setShowIndividualHarmonics(e.target.checked)}
                    className="accent-[#2A7B73] w-4 h-4 cursor-pointer"
                  />
                </label>

                {/* Residual Error Plot Toggle */}
                <label className="flex items-center justify-between p-2.5 rounded-lg bg-[#FAFCFB] border border-[#AAEED3]/50 cursor-pointer hover:bg-[#F3FAF7]">
                  <span className="text-[#123A36] font-medium">Show Residual Error Plot</span>
                  <input
                    type="checkbox"
                    checked={showResidualErrorPlot}
                    onChange={(e) => setShowResidualErrorPlot(e.target.checked)}
                    className="accent-[#2A7B73] w-4 h-4 cursor-pointer"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Section 2: Live Series Formula */}
          {activeViewSection === 'formula' && (
            <div className="animate-in fade-in duration-150 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-[#2A7B73] bg-[#F3FAF7] px-2.5 py-1 rounded-lg border border-[#AAEED3]">
                  {liveFormula.category}
                </span>
                <span className="text-[11px] font-mono text-[#123A36]/60">
                  Analytical formulation for current waveform
                </span>
              </div>
              <div className="font-mono text-xs sm:text-sm text-[#123A36] font-bold bg-[#F3FAF7] p-3.5 rounded-xl border border-[#AAEED3]/60 overflow-x-auto shadow-2xs">
                {liveFormula.shortSeries}
              </div>
              <div className="font-mono text-xs text-[#2A7B73] bg-[#FAFCFB] p-3 rounded-xl border border-[#AAEED3]/40 overflow-x-auto">
                {liveFormula.expandedSeries}
              </div>
            </div>
          )}

          {/* Section 3: Live Metrics & Benchmarks */}
          {activeViewSection === 'metrics' && (
            <div className="animate-in fade-in duration-150 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs font-mono">
                <div className="bg-[#FAFCFB] p-3 rounded-xl border border-[#AAEED3]/50">
                  <span className="text-[#123A36]/65 block text-[10px] font-sans font-semibold">Normalized RMS Error</span>
                  <span className="text-[#123A36] font-bold text-sm">{(normalizedRmse * 100).toFixed(2)}%</span>
                  <span className="text-[9.5px] text-[#123A36]/60 block font-mono">({reconstruction.rmse.toFixed(4)}V)</span>
                </div>

                <div className="bg-[#FAFCFB] p-3 rounded-xl border border-[#AAEED3]/50">
                  <span className="text-[#123A36]/65 block text-[10px] font-sans font-semibold">Gibbs Overshoot</span>
                  <span className="text-amber-700 font-bold text-sm">
                    {waveType === 'square' ? `${reconstruction.gibbsOvershootPercent}%` : '0.0%'}
                  </span>
                  <span className="text-[9.5px] text-[#123A36]/60 block font-sans">
                    {waveType === 'square' ? 'At discontinuities' : 'Continuous wave'}
                  </span>
                </div>

                <div className="bg-[#FAFCFB] p-3 rounded-xl border border-[#AAEED3]/50">
                  <span className="text-[#123A36]/65 block text-[10px] font-sans font-semibold">Harmonics Active</span>
                  <span className="text-[#2A7B73] font-bold text-sm">{harmonicsCount} (K={harmonicsCount})</span>
                  <span className="text-[9.5px] text-[#123A36]/60 block font-sans">{activeHarmonics.length} non-zero</span>
                </div>

                <div className="bg-[#FAFCFB] p-3 rounded-xl border border-[#AAEED3]/50">
                  <span className="text-[#123A36]/65 block text-[10px] font-sans font-semibold">Active Period (T₀)</span>
                  <span className="text-[#123A36] font-bold text-sm">{(1 / f0).toFixed(2)} s</span>
                  <span className="text-[9.5px] text-[#123A36]/60 block font-sans">f₀ = {f0.toFixed(1)} Hz</span>
                </div>

                <div className="bg-[#FAFCFB] p-3 rounded-xl border border-[#AAEED3]/50">
                  <span className="text-[#123A36]/65 block text-[10px] font-sans font-semibold">Power Captured</span>
                  <span className="text-[#2A7B73] font-bold text-sm">{reconstruction.powerAccumulatedPercent.toFixed(1)}%</span>
                  <span className="text-[9.5px] text-[#123A36]/60 block font-sans">Parseval sum</span>
                </div>

                <div className="bg-[#FAFCFB] p-3 rounded-xl border border-[#AAEED3]/50">
                  <span className="text-[#123A36]/65 block text-[10px] font-sans font-semibold">Peak Abs Error</span>
                  <span className="text-[#123A36] font-bold text-sm">{reconstruction.maxAbsoluteError.toFixed(4)} V</span>
                  <span className="text-[9.5px] text-[#123A36]/60 block font-sans">Max ripple</span>
                </div>
              </div>
            </div>
          )}

          {/* Section 4: Harmonic Frequency Spectrum */}
          {activeViewSection === 'spectrum' && (
            <div className="animate-in fade-in duration-150 space-y-3">
              {/* Spectrum Bars */}
              <div className="relative pt-2">
                <div className="h-32 flex items-end gap-1 px-2 border-b border-[#CBD5E1]">
                  {reconstruction.harmonics.map((h) => {
                    const maxMag = Math.max(1.0, reconstruction.harmonics[0]?.cn || 1.0);
                    const barHeightPct = Math.min(100, Math.max(2, (h.cn / maxMag) * 95));
                    const isHovered = hoveredHarmonicIndex === h.n;

                    // Thinning logic: for N <= 16 show every bar label; for 16 < N <= 32 show evens; for N > 32 show every 5th
                    const showLabel =
                      harmonicsCount <= 16
                        ? true
                        : harmonicsCount <= 32
                        ? h.n % 2 === 1 || h.n === harmonicsCount
                        : h.n === 1 || h.n % 5 === 0 || h.n === harmonicsCount;

                    return (
                      <div
                        key={h.n}
                        onMouseEnter={() => setHoveredHarmonicIndex(h.n)}
                        onMouseLeave={() => setHoveredHarmonicIndex(null)}
                        className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
                      >
                        {/* Hover Tooltip Card */}
                        {isHovered && (
                          <div className="absolute bottom-full mb-1 z-30 bg-[#123A36] text-white p-2 rounded-lg text-[10px] font-mono shadow-xl border border-[#2A7B73] whitespace-nowrap pointer-events-none">
                            <div className="font-bold text-[#AAEED3]">Harmonic n = {h.n} ({h.freq.toFixed(1)} Hz)</div>
                            <div>Magnitude |cₙ|: {h.cn.toFixed(4)} V</div>
                            <div>Cosine aₙ: {h.an.toFixed(4)}</div>
                            <div>Sine bₙ: {h.bn.toFixed(4)}</div>
                            <div>Phase θₙ: {(h.phaseRad * (180 / Math.PI)).toFixed(1)}°</div>
                            <div className="text-amber-300">Power: {h.powerPercent.toFixed(1)}%</div>
                          </div>
                        )}

                        {/* Bar element */}
                        <div
                          className={`w-full rounded-t transition-all duration-150 ${
                            isHovered
                              ? 'bg-amber-500 scale-x-110 shadow-sm'
                              : h.cn > 1e-4
                              ? 'bg-[#2A7B73] hover:bg-[#55A9A0]'
                              : 'bg-slate-200 dark:bg-slate-700'
                          }`}
                          style={{ height: `${barHeightPct}%` }}
                        />

                        {/* Thinned X-axis labels */}
                        <span
                          className={`text-[9px] font-mono mt-1 ${
                            isHovered ? 'font-bold text-amber-700' : 'text-[#123A36]/60'
                          }`}
                        >
                          {showLabel ? h.n : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between items-center text-[10px] text-[#123A36]/60 font-mono mt-2 px-2">
                  <span>Harmonic index n</span>
                  <span>Harmonics displayed: 1 to {harmonicsCount}</span>
                </div>
              </div>
            </div>
          )}

          {/* Section 5: Harmonic Coefficients Table */}
          {activeViewSection === 'table' && (
            <div className="animate-in fade-in duration-150 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#AAEED3]/30 pb-2">
                <p className="text-[11px] text-[#123A36]/60">
                  Exact analytical coefficient values calculated for N = {harmonicsCount} harmonics
                </p>

                <button
                  type="button"
                  onClick={() => setIsTableExpanded(!isTableExpanded)}
                  className="px-3 py-1.5 rounded-xl bg-[#F3FAF7] text-[#2A7B73] border border-[#AAEED3] hover:bg-[#AAEED3]/30 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  aria-expanded={isTableExpanded}
                >
                  <span>{isTableExpanded ? 'Hide Table' : 'Show Table'}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isTableExpanded ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* Collapsible Table Content */}
              {isTableExpanded && (
                <div className="space-y-3 animate-in fade-in duration-150">
                  <div className="overflow-x-auto max-h-64 custom-scrollbar rounded-lg border border-[#AAEED3]/50">
                    <table className="w-full text-left font-mono text-[11px] text-[#123A36] border-collapse bg-white">
                      <thead className="sticky top-0 bg-[#F3FAF7] text-[#123A36]/80 border-b border-[#AAEED3]/50 z-10">
                        <tr>
                          <th className="py-2 px-3">Harmonic n</th>
                          <th className="py-2 px-3">Freq [Hz]</th>
                          <th className="py-2 px-3">Cosine aₙ</th>
                          <th className="py-2 px-3">Sine bₙ</th>
                          <th className="py-2 px-3">Magnitude |cₙ|</th>
                          <th className="py-2 px-3">Phase θₙ [deg]</th>
                          <th className="py-2 px-3 text-right">Power %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reconstruction.a0 !== 0 && (
                          <tr className="border-b border-[#AAEED3]/30 bg-[#FFF6B0]/30 font-semibold">
                            <td className="py-1.5 px-3">n = 0 (DC)</td>
                            <td className="py-1.5 px-3">0.0</td>
                            <td className="py-1.5 px-3">{(reconstruction.a0 / 2).toFixed(4)}</td>
                            <td className="py-1.5 px-3">0.0000</td>
                            <td className="py-1.5 px-3">{(reconstruction.a0 / 2).toFixed(4)}</td>
                            <td className="py-1.5 px-3">0.0°</td>
                            <td className="py-1.5 px-3 text-right text-[#2A7B73]">DC Offset</td>
                          </tr>
                        )}
                        {reconstruction.harmonics.map((h) => (
                          <tr
                            key={h.n}
                            onMouseEnter={() => setHoveredHarmonicIndex(h.n)}
                            onMouseLeave={() => setHoveredHarmonicIndex(null)}
                            className={`border-b border-[#AAEED3]/30 transition-colors ${
                              hoveredHarmonicIndex === h.n
                                ? 'bg-amber-50 font-bold'
                                : 'hover:bg-[#F3FAF7]'
                            }`}
                          >
                            <td className="py-1.5 px-3 text-[#2A7B73] font-bold">n = {h.n}</td>
                            <td className="py-1.5 px-3">{h.freq.toFixed(1)}</td>
                            <td className="py-1.5 px-3">{h.an.toFixed(4)}</td>
                            <td className="py-1.5 px-3">{h.bn.toFixed(4)}</td>
                            <td className="py-1.5 px-3 font-bold text-[#123A36]">{h.cn.toFixed(4)}</td>
                            <td className="py-1.5 px-3 text-[#123A36]/70">
                              {(h.phaseRad * (180 / Math.PI)).toFixed(1)}°
                            </td>
                            <td className="py-1.5 px-3 text-right text-[#2A7B73] font-semibold">
                              {h.powerPercent.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between text-xs text-[#123A36]/70 font-mono px-1">
                    <span>Parseval Sum Power: {reconstruction.powerAccumulatedPercent.toFixed(1)}%</span>
                    <span>Total Harmonics Computed: {harmonicsCount}</span>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* =========================================================================
          REMAINING COMPONENTS: RESIDUAL ERROR PLOT
          Remaining components in their current relative order and unchanged.
          ========================================================================= */}
      {/* Residual Error Plot e(t) = ideal(t) - synth(t) (Toggleable) */}
      {showResidualErrorPlot && (
        <div className="bg-white rounded-[14px] p-5 shadow-sm border border-[#AAEED3]/50 space-y-2 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-[#AAEED3]/40 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#E11D48] inline-block" />
              <h4 className="font-heading font-bold text-sm text-[#123A36]">
                Residual Error Plot: e(t) = x(t) - x_N(t)
              </h4>
            </div>
            <span className="text-[11px] font-mono text-[#E11D48] font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
              Max Error: {reconstruction.maxAbsoluteError.toFixed(4)} V
            </span>
          </div>

          {/* Error SVG Curve */}
          <div className="relative w-full overflow-hidden bg-[#FAFCFB] rounded-lg border border-[#AAEED3]/40 p-1">
            <svg viewBox="0 0 600 100" className="w-full h-24 overflow-visible">
              {/* Zero center line */}
              <line x1="10" y1="50" x2="590" y2="50" stroke="#CBD5E1" strokeWidth="1" strokeDasharray="3 3" />

              {/* Period dividers */}
              <line x1="300" y1="5" x2="300" y2="95" stroke="#E2E8F0" strokeWidth="1" />

              {/* Error Path */}
              <path
                d={reconstruction.errorSignal
                  .map((err, i) => {
                    const px = 10 + (i / (reconstruction.errorSignal.length - 1)) * 580;
                    const errScale = Math.max(1.0, reconstruction.maxAbsoluteError * 1.25);
                    const py = 50 - (err / errScale) * 42;
                    return `${i === 0 ? 'M' : 'L'} ${px.toFixed(1)},${py.toFixed(1)}`;
                  })
                  .join(' ')}
                fill="none"
                stroke="#E11D48"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div className="flex justify-between items-center text-[10px] text-[#123A36]/60 font-mono px-1">
            <span>t = 0.0s</span>
            <span className="text-[#E11D48]">RMSE = {reconstruction.rmse.toFixed(4)} V</span>
            <span>t = 2T₀ ({(2 / f0).toFixed(2)}s)</span>
          </div>
        </div>
      )}

    </div>
  );
};
