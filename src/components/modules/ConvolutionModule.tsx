/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Interactive Signals & Systems Convolution Simulator (Topic E).
 * Supports Continuous-Time (CT) numerical integration & Discrete-Time (DT) exact stem summation,
 * 3 Synchronized animated plots, flip-target commutativity swapping, overlap product shading,
 * signal archetype generators, and mathematical property verification.
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  DomainMode,
  SignalArchetype,
  SignalDefinition,
  DEFAULT_X_SIGNAL,
  DEFAULT_H_SIGNAL,
  computeFullContinuousConvolution,
  computeDiscreteConvolution,
  evalContinuousSignal,
  evalDiscreteSignal,
  CONVOLUTION_PRESETS,
  ConvolutionPreset,
} from '../../math/convolution';
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  ArrowRightLeft,
  Sliders,
  Check,
  Copy,
  Sparkles,
  BookOpen,
  Compass,
  ChevronDown,
} from 'lucide-react';
import { ConvolutionFocusProjection } from './ConvolutionFocusProjection';

// Three distinct, accessible, high-contrast colors
const COLOR_X = '#2563EB'; // Vibrant Blue for Input signal x(τ)
const COLOR_H = '#EA580C'; // Vibrant Orange for Impulse response h(t - τ)
const COLOR_OVERLAP = '#9333EA'; // Vibrant Purple for Overlap / Product Area
const COLOR_OVERLAP_FILL = 'rgba(147, 51, 234, 0.35)';
const COLOR_OVERLAP_FILL_LIGHT = 'rgba(147, 51, 234, 0.22)';

const ARCHETYPE_OPTIONS: { id: SignalArchetype; label: string; desc: string }[] = [
  { id: 'rect', label: 'Rectangular Pulse rect(t)', desc: 'Unit amplitude pulse of width W' },
  { id: 'tri', label: 'Triangle tri(t)', desc: 'Triangular pulse with base 2W' },
  { id: 'step', label: 'Unit Step u(t)', desc: 'Heaviside step function' },
  { id: 'delta', label: 'Impulse δ(t)', desc: 'Dirac delta / Kronecker unit impulse' },
  { id: 'exp', label: 'Exponential Decay e^(-at)', desc: 'Causal single-pole impulse response' },
  { id: 'sin', label: 'Sinusoid Windowed', desc: 'Truncated sinusoidal burst' },
  { id: 'ramp', label: 'Ramp r(t)', desc: 'Linear rise up to saturation' },
  { id: 'sinc', label: 'Sinc pulse sinc(ft)', desc: 'Ideal bandlimited kernel sin(πft)/(πft)' },
  { id: 'gaussian', label: 'Gaussian Bell', desc: 'Smooth bell-curve filter envelope' },
  { id: 'custom', label: 'Custom Expression / Samples', desc: 'Custom formula or discrete values' },
];

export const ConvolutionModule: React.FC = () => {
  // Domain selection: Continuous (CT) or Discrete (DT)
  const [domain, setDomain] = useState<'CT' | 'DT'>('CT');
  // Flip target: commutativity demonstration (x * h = h * x)
  const [flipTarget, setFlipTarget] = useState<'h' | 'x'>('h');

  // Signal definitions
  const [sigX, setSigX] = useState<SignalDefinition>({ ...DEFAULT_X_SIGNAL });
  const [sigH, setSigH] = useState<SignalDefinition>({ ...DEFAULT_H_SIGNAL });

  // Current shift parameter
  // For CT: continuous time t in [-6, 6]
  const [shiftT, setShiftT] = useState<number>(0.0);
  // For DT: discrete index n in [-10, 10]
  const [shiftN, setShiftN] = useState<number>(0);

  // Animation state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0); // 0.5x, 1x, 2x
  const [isLooping, setIsLooping] = useState<boolean>(true);

  // Active tab in bottom deep-dive with hover reveal: 'properties' | 'math' | null
  const [activeDrawerTab, setActiveDrawerTab] = useState<'properties' | 'math' | null>(null);
  const drawerCloseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const drawerContainerRef = useRef<HTMLDivElement>(null);
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);

  // Selected preset ID
  const [activePresetId, setActivePresetId] = useState<string>('rect_rect_triangle');

  // Signal being configured in Row 1: 'x' | 'h'
  const [activeConfigSignal, setActiveConfigSignal] = useState<'x' | 'h'>('x');

  // Active open dropdown menu in top bar & placement direction
  const [openMenu, setOpenMenu] = useState<'mode' | 'operations' | 'presets' | null>(null);
  const [menuPlacement, setMenuPlacement] = useState<'down' | 'up'>('down');
  const menuBarRef = useRef<HTMLDivElement>(null);
  const modeBtnRef = useRef<HTMLButtonElement>(null);
  const opsBtnRef = useRef<HTMLButtonElement>(null);
  const presetsBtnRef = useRef<HTMLButtonElement>(null);

  // Signal Configurator dropdown state & refs
  const [isSignalMenuOpen, setIsSignalMenuOpen] = useState<boolean>(false);
  const [signalMenuPlacement, setSignalMenuPlacement] = useState<'down' | 'up'>('down');
  const [signalFocusedIndex, setSignalFocusedIndex] = useState<number>(0);
  const signalDropdownRef = useRef<HTMLDivElement>(null);
  const signalBtnRef = useRef<HTMLButtonElement>(null);

  const toggleSignalMenu = useCallback(() => {
    setIsSignalMenuOpen((prev) => {
      const next = !prev;
      if (next && signalBtnRef.current) {
        const rect = signalBtnRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        if (spaceBelow < 180 && spaceAbove > spaceBelow) {
          setSignalMenuPlacement('up');
        } else {
          setSignalMenuPlacement('down');
        }
        setSignalFocusedIndex(activeConfigSignal === 'x' ? 0 : 1);
      }
      return next;
    });
  }, [activeConfigSignal]);

  const signalOptions = useMemo(
    () => [
      {
        id: 'x' as const,
        title: domain === 'CT' ? 'Input signal x(t)' : 'Input signal x[n]',
        role: flipTarget === 'x' ? 'Flipped & sliding' : 'Stationary',
        color: COLOR_X,
      },
      {
        id: 'h' as const,
        title: domain === 'CT' ? 'Impulse response h(t)' : 'Impulse response h[n]',
        role: flipTarget === 'h' ? 'Flipped & sliding' : 'Stationary',
        color: COLOR_H,
      },
    ],
    [domain, flipTarget]
  );

  const handleSignalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isSignalMenuOpen) {
        toggleSignalMenu();
      } else {
        setSignalFocusedIndex((prev) => (prev + 1) % signalOptions.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isSignalMenuOpen) {
        toggleSignalMenu();
      } else {
        setSignalFocusedIndex((prev) => (prev - 1 + signalOptions.length) % signalOptions.length);
      }
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (isSignalMenuOpen) {
        setActiveConfigSignal(signalOptions[signalFocusedIndex].id);
        setIsSignalMenuOpen(false);
        signalBtnRef.current?.focus();
      } else {
        toggleSignalMenu();
      }
    } else if (e.key === 'Escape') {
      if (isSignalMenuOpen) {
        e.preventDefault();
        setIsSignalMenuOpen(false);
        signalBtnRef.current?.focus();
      }
    } else if (e.key === 'Tab') {
      if (isSignalMenuOpen) {
        setIsSignalMenuOpen(false);
      }
    }
  };

  // Toggle drop-down with automatic viewport space detection to open upward if near screen bottom
  const handleToggleMenu = (menu: 'mode' | 'operations' | 'presets', btn: HTMLButtonElement | null) => {
    if (openMenu === menu) {
      setOpenMenu(null);
    } else {
      if (btn) {
        const rect = btn.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        if (spaceBelow < 240 && spaceAbove > spaceBelow) {
          setMenuPlacement('up');
        } else {
          setMenuPlacement('down');
        }
      } else {
        setMenuPlacement('down');
      }
      setOpenMenu(menu);
    }
  };

  // Focus Projection Mode for Plots 1, 2, 3
  const [focusedPlot, setFocusedPlot] = useState<1 | 2 | 3 | null>(null);
  const [originRect, setOriginRect] = useState<DOMRect | null>(null);
  const plot1Ref = useRef<HTMLDivElement>(null);
  const plot2Ref = useRef<HTMLDivElement>(null);
  const plot3Ref = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSliderDraggingRef = useRef<boolean>(false);
  const lastFocusedTriggerRef = useRef<HTMLDivElement | null>(null);

  const openFocusProjection = useCallback((plotId: 1 | 2 | 3) => {
    const el = plotId === 1 ? plot1Ref.current : plotId === 2 ? plot2Ref.current : plot3Ref.current;
    if (el) {
      setOriginRect(el.getBoundingClientRect());
      lastFocusedTriggerRef.current = el;
    }
    setFocusedPlot(plotId);
    document.body.style.overflow = 'hidden';
  }, []);

  const closeFocusProjection = useCallback(() => {
    setFocusedPlot(null);
    document.body.style.overflow = '';
    lastFocusedTriggerRef.current?.focus();
  }, []);

  const handlePlotMouseEnter = useCallback((plotId: 1 | 2 | 3) => {
    if (isSliderDraggingRef.current || openMenu !== null || isSignalMenuOpen || activeDrawerTab !== null || focusedPlot !== null) {
      return;
    }
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      if (!isSliderDraggingRef.current && openMenu === null && !isSignalMenuOpen) {
        openFocusProjection(plotId);
      }
    }, 300);
  }, [openMenu, isSignalMenuOpen, activeDrawerTab, focusedPlot, openFocusProjection]);

  const handlePlotMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);

  const handlePlotKeyDown = useCallback((e: React.KeyboardEvent, plotId: 1 | 2 | 3) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openFocusProjection(plotId);
    }
  }, [openFocusProjection]);

  // Global listener to reset slider dragging flag and cleanup on unmount
  useEffect(() => {
    const handleGlobalPointerUp = () => {
      isSliderDraggingRef.current = false;
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      document.body.style.overflow = '';
    };
  }, []);

  // Close open dropdowns or floating drawers on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuBarRef.current && !menuBarRef.current.contains(target)) {
        setOpenMenu(null);
      }
      if (signalDropdownRef.current && !signalDropdownRef.current.contains(target)) {
        setIsSignalMenuOpen(false);
      }
      if (drawerContainerRef.current && !drawerContainerRef.current.contains(target)) {
        setActiveDrawerTab(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenu(null);
        setIsSignalMenuOpen(false);
        setActiveDrawerTab(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Compute CT convolution results
  const ctGrid = useMemo(() => {
    if (domain !== 'CT') return null;
    return computeFullContinuousConvolution(sigX, sigH, flipTarget, {
      min: -6.0,
      max: 6.0,
      dt: 0.04,
    });
  }, [domain, sigX, sigH, flipTarget]);

  // Compute DT convolution results
  const dtGrid = useMemo(() => {
    if (domain !== 'DT') return null;
    return computeDiscreteConvolution(sigX, sigH, flipTarget, {
      min: -10,
      max: 10,
    });
  }, [domain, sigX, sigH, flipTarget]);

  // Animation frame loop for both CT and DT
  useEffect(() => {
    if (!isPlaying) return;

    let animId: number;
    let lastStamp = performance.now();
    let dtAccumulator = 0;

    const frameStep = (now: number) => {
      const dtSec = Math.min(0.1, (now - lastStamp) / 1000);
      lastStamp = now;

      if (domain === 'CT') {
        const speedMultiplier = 1.8 * playbackSpeed;
        setShiftT((prev) => {
          let next = prev + dtSec * speedMultiplier;
          if (next > 6.0) {
            if (isLooping) next = -6.0;
            else {
              setIsPlaying(false);
              return 6.0;
            }
          }
          return Math.round(next * 100) / 100;
        });
      } else if (domain === 'DT') {
        const stepIntervalSec = 0.45 / playbackSpeed;
        dtAccumulator += dtSec;

        if (dtAccumulator >= stepIntervalSec) {
          dtAccumulator -= stepIntervalSec;
          setShiftN((prev) => {
            let next = prev + 1;
            if (next > 10) {
              if (isLooping) next = -10;
              else {
                setIsPlaying(false);
                return 10;
              }
            }
            return next;
          });
        }
      }

      animId = requestAnimationFrame(frameStep);
    };

    animId = requestAnimationFrame(frameStep);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, domain, playbackSpeed, isLooping]);

  // Load preset helper
  const handleLoadPreset = (preset: ConvolutionPreset) => {
    setActivePresetId(preset.id);
    setDomain(preset.domain);
    setSigX({ ...preset.x });
    setSigH({ ...preset.h });
    if (preset.domain === 'CT') {
      setShiftT(-3.5);
    } else {
      setShiftN(-5);
    }
    setIsPlaying(false);
  };

  // Swap signals X and H
  const handleSwapSignals = () => {
    const temp = { ...sigX };
    setSigX({ ...sigH });
    setSigH(temp);
  };

  // Copy values to clipboard
  const handleCopyResults = () => {
    let text = '';
    if (domain === 'CT' && ctGrid) {
      text = `Continuous Convolution Result\nShift t = ${shiftT.toFixed(2)}\n`;
      text += `t, x(t), h(t), y(t)\n`;
      for (let i = 0; i < ctGrid.tValues.length; i += 5) {
        text += `${ctGrid.tValues[i].toFixed(2)}, ${ctGrid.xValues[i].toFixed(3)}, ${ctGrid.hValues[i].toFixed(3)}, ${ctGrid.yValues[i].toFixed(3)}\n`;
      }
    } else if (dtGrid) {
      text = `Discrete Convolution Result\nShift n = ${shiftN}\n`;
      text += `n, x[n], h[n], y[n]\n`;
      for (let i = 0; i < dtGrid.nValues.length; i++) {
        text += `${dtGrid.nValues[i]}, ${dtGrid.xValues[i].toFixed(3)}, ${dtGrid.hValues[i].toFixed(3)}, ${dtGrid.yValues[i].toFixed(3)}\n`;
      }
    }
    navigator.clipboard.writeText(text);
    setCopiedNotification('Signal data copied to clipboard!');
    setTimeout(() => setCopiedNotification(null), 3000);
  };

  const activePresetName = useMemo(() => {
    const p = CONVOLUTION_PRESETS.find((item) => item.id === activePresetId && item.domain === domain);
    if (p) return p.name;
    const anyP = CONVOLUTION_PRESETS.find((item) => item.id === activePresetId);
    return anyP ? anyP.name : 'Rect * Rect = Triangle';
  }, [activePresetId, domain]);

  // Interpolated or evaluated current output value y(t) or y[n]
  const currentOutputValue = useMemo(() => {
    if (domain === 'CT') {
      if (!ctGrid) return 0;
      const idx = Math.min(
        ctGrid.tValues.length - 1,
        Math.max(0, Math.round((shiftT - ctGrid.startShift) / ctGrid.dt))
      );
      return ctGrid.yValues[idx] || 0;
    } else {
      if (!dtGrid) return 0;
      const step = dtGrid.stepDetails.get(shiftN);
      return step ? step.sum : 0;
    }
  }, [domain, ctGrid, dtGrid, shiftT, shiftN]);

  // Current overlap breakdown for DT
  const currentDtStep = useMemo(() => {
    if (domain !== 'DT' || !dtGrid) return null;
    return dtGrid.stepDetails.get(shiftN) || null;
  }, [domain, dtGrid, shiftN]);

  // Calculate coordinates and SVG paths for CT Plot 1, 2, 3 (scaled up by 5% to svgH: 185px / padY: 21px)
  const ctPlotData = useMemo(() => {
    if (domain !== 'CT' || !ctGrid) return null;

    const tauMin = -6;
    const tauMax = 6;
    const tauSpan = tauMax - tauMin;
    const svgW = 600;
    const svgH = 185;
    const padX = 36;
    const padY = 21;
    const plotW = svgW - padX * 2;
    const plotH = svgH - padY * 2;

    // Y scale: determine min and max across x, h, and product
    const maxY = Math.max(1.8, ctGrid.peakValue * 1.15, sigX.amplitude * 1.2, sigH.amplitude * 1.2);
    const minY = -0.4;
    const ySpan = maxY - minY;

    const toSvgX = (tau: number) => padX + ((tau - tauMin) / tauSpan) * plotW;
    const toSvgY = (val: number) => padY + plotH - ((val - minY) / ySpan) * plotH;
    const zeroY = toSvgY(0);

    // Helper to evaluate continuous values and overlap state at any tau
    const evalAtTau = (tau: number) => {
      let vX = 0;
      let vH = 0;
      if (flipTarget === 'h') {
        vX = evalContinuousSignal(sigX, tau);
        vH = evalContinuousSignal(sigH, shiftT - tau);
      } else {
        vH = evalContinuousSignal(sigH, tau);
        vX = evalContinuousSignal(sigX, shiftT - tau);
      }
      const prod = vX * vH;
      const inOverlap = Math.abs(vX) > 1e-4 && Math.abs(vH) > 1e-4 && Math.abs(prod) > 1e-4;
      return { vX, vH, prod, inOverlap };
    };

    // Refine boundary tau between t0 (no overlap) and t1 (in overlap) using binary bisection
    const refineBoundary = (t0: number, t1: number, maxIter = 8): number => {
      let a = t0;
      let b = t1;
      for (let iter = 0; iter < maxIter; iter++) {
        const mid = (a + b) / 2;
        const res = evalAtTau(mid);
        if (res.inOverlap) {
          b = mid;
        } else {
          a = mid;
        }
      }
      return (a + b) / 2;
    };

    // Sample dense tau points for Plot 1 and 2
    const numSamples = 400;
    const dTau = tauSpan / (numSamples - 1);

    const xPathPoints: [number, number][] = [];
    const hShiftedPathPoints: [number, number][] = [];
    const productPathPoints: [number, number][] = [];
    const sampleRecords: { tau: number; sx: number; prod: number; inOverlap: boolean }[] = [];

    let currentIntegralSum = 0;

    for (let i = 0; i < numSamples; i++) {
      const tau = tauMin + i * dTau;
      const sx = toSvgX(tau);
      const { vX, vH, prod, inOverlap } = evalAtTau(tau);

      currentIntegralSum += prod * dTau;

      xPathPoints.push([sx, toSvgY(vX)]);
      hShiftedPathPoints.push([sx, toSvgY(vH)]);
      productPathPoints.push([sx, toSvgY(prod)]);
      sampleRecords.push({ tau, sx, prod, inOverlap });
    }

    const makePath = (pts: [number, number][]) => {
      if (pts.length === 0) return '';
      return pts.reduce((acc, p, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${p[0].toFixed(1)},${p[1].toFixed(1)}`, '');
    };

    // Identify contiguous overlap segments where BOTH signals are non-zero
    const overlapSegments: { start: number; end: number }[] = [];
    let segStart = -1;

    for (let i = 0; i < numSamples; i++) {
      if (sampleRecords[i].inOverlap) {
        if (segStart === -1) segStart = i;
      } else {
        if (segStart !== -1) {
          overlapSegments.push({ start: segStart, end: i - 1 });
          segStart = -1;
        }
      }
    }
    if (segStart !== -1) {
      overlapSegments.push({ start: segStart, end: numSamples - 1 });
    }

    let overlapAreaPoly = '';
    for (const seg of overlapSegments) {
      let tauStart = sampleRecords[seg.start].tau;
      if (seg.start > 0) {
        tauStart = refineBoundary(sampleRecords[seg.start - 1].tau, sampleRecords[seg.start].tau);
      }
      const sxStart = toSvgX(tauStart);

      let tauEnd = sampleRecords[seg.end].tau;
      if (seg.end < numSamples - 1) {
        tauEnd = refineBoundary(sampleRecords[seg.end + 1].tau, sampleRecords[seg.end].tau);
      }
      const sxEnd = toSvgX(tauEnd);

      let d = `M ${sxStart.toFixed(1)},${zeroY.toFixed(1)}`;
      for (let k = seg.start; k <= seg.end; k++) {
        d += ` L ${sampleRecords[k].sx.toFixed(1)},${toSvgY(sampleRecords[k].prod).toFixed(1)}`;
      }
      d += ` L ${sxEnd.toFixed(1)},${zeroY.toFixed(1)} Z`;

      overlapAreaPoly += (overlapAreaPoly ? ' ' : '') + d;
    }

    // Output path for Plot 3
    const yOutPoints: [number, number][] = [];
    const yOutPastPoints: [number, number][] = [];

    const yMaxVal = Math.max(1.8, Math.abs(ctGrid.peakValue) * 1.25);
    const yMinVal = -0.3;
    const toYPlotY = (val: number) => padY + plotH - ((val - minY) / (yMaxVal - minY)) * plotH;
    const yZeroLine = toYPlotY(0);

    for (let i = 0; i < ctGrid.tValues.length; i++) {
      const t = ctGrid.tValues[i];
      const yVal = ctGrid.yValues[i];
      const sx = toSvgX(t);
      const sy = toYPlotY(yVal);
      yOutPoints.push([sx, sy]);
      if (t <= shiftT + 0.02) {
        yOutPastPoints.push([sx, sy]);
      }
    }

    const currentOutputCoord: [number, number] = [toSvgX(shiftT), toYPlotY(currentOutputValue)];

    return {
      svgW,
      svgH,
      zeroY,
      yZeroLine,
      toSvgX,
      toSvgY,
      toYPlotY,
      xPath: makePath(xPathPoints),
      hShiftedPath: makePath(hShiftedPathPoints),
      productPath: makePath(productPathPoints),
      productAreaPoly: overlapAreaPoly,
      yOutPath: makePath(yOutPoints),
      yOutPastPoly: makePath(yOutPastPoints) ? `${makePath(yOutPastPoints)} L ${yOutPastPoints[yOutPastPoints.length - 1][0].toFixed(1)},${yZeroLine.toFixed(1)} L ${yOutPastPoints[0][0].toFixed(1)},${yZeroLine.toFixed(1)} Z` : '',
      yOutPastPath: makePath(yOutPastPoints),
      currentOutputCoord,
      currentIntegralSum,
    };
  }, [domain, ctGrid, sigX, sigH, flipTarget, shiftT, currentOutputValue]);

  return (
    <div className="space-y-[17px]">
      {/* 1. Merged Header & Controls Card (Scaled up 5%, overflow-visible so dropdowns overlay cleanly) */}
      <div
        ref={menuBarRef}
        className="relative z-30 bg-white rounded-[17px] shadow-sm border border-[#AAEED3]/50 overflow-visible"
      >
        {/* Header row at top */}
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-[30px] h-[30px] rounded-lg bg-gradient-to-br from-[#2A7B73] to-[#123A36] text-white flex items-center justify-center font-bold text-[13px] shadow-xs shrink-0">
              E
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-[17px] font-extrabold text-[#123A36] tracking-tight">
                  Convolution
                </h2>
                <span className="text-[11.5px] font-semibold px-2.5 py-0.5 rounded-full bg-[#E1F3EC] text-[#2A7B73] border border-[#AAEED3]/60">
                  Interactive Topic
                </span>
              </div>
              <p className="text-[11.5px] text-[#123A36]/75 truncate hidden sm:block">
                3 Synchronized Plots &amp; Overlap Area • Interactive LTI convolution: flip, shift, product overlap area, and accumulated output response.
              </p>
            </div>
          </div>
          <span className="text-[11.5px] font-medium px-3 py-1 rounded-full bg-[#F3FAF7] text-[#123A36]/80 border border-[#AAEED3]/60 shadow-2xs shrink-0 whitespace-nowrap">
            Group 3 - Project
          </span>
        </div>

        {/* Divider 1 */}
        <div className="border-t border-[#AAEED3]/40" />

        {/* Top Drop-down Row: Mode, Operations, Presets */}
        <div className="px-4 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Drop-down: Mode Selector (CT | DT only) */}
              <div className="relative">
                <button
                  ref={modeBtnRef}
                  type="button"
                  onClick={() => handleToggleMenu('mode', modeBtnRef.current)}
                  className="px-3 py-1.5 rounded-lg bg-[#F3FAF7] border border-[#AAEED3] text-[11.5px] font-semibold text-[#123A36] hover:bg-[#AAEED3]/30 transition-all flex items-center gap-2 shadow-2xs focus-visible:ring-2 focus-visible:ring-[#2A7B73] focus:outline-none cursor-pointer"
                  aria-haspopup="listbox"
                  aria-expanded={openMenu === 'mode'}
                  title="Select Convolution Mode"
                >
                  <span className="text-[#2A7B73] font-bold">Mode:</span>
                  <span>{domain === 'CT' ? 'Continuous (CT)' : 'Discrete (DT)'}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-[#2A7B73] transition-transform ${openMenu === 'mode' ? 'rotate-180' : ''}`} />
                </button>
                {openMenu === 'mode' && (
                  <div
                    className={`absolute left-0 ${
                      menuPlacement === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                    } w-44 bg-white rounded-xl shadow-xl border border-[#AAEED3] py-1.5 z-50 max-h-[min(280px,65vh)] overflow-y-auto animate-in fade-in zoom-in-95 duration-100`}
                  >
                    {[
                      { id: 'CT', label: 'Continuous (CT)' },
                      { id: 'DT', label: 'Discrete (DT)' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setDomain(opt.id as 'CT' | 'DT');
                          setIsPlaying(false);
                          setOpenMenu(null);
                        }}
                        className={`w-full text-left px-3.5 py-2 text-[11.5px] flex items-center justify-between transition-colors cursor-pointer ${
                          domain === opt.id
                            ? 'bg-[#AAEED3]/30 text-[#2A7B73] font-bold'
                            : 'text-[#123A36] hover:bg-[#AAEED3]/15'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {domain === opt.id && <Check className="w-3.5 h-3.5 text-[#2A7B73]" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Drop-down: Operations (Flip Target & Signal Swap) */}
              <div className="relative">
                <button
                  ref={opsBtnRef}
                  type="button"
                  onClick={() => handleToggleMenu('operations', opsBtnRef.current)}
                  className="px-3 py-1.5 rounded-lg bg-[#F3FAF7] border border-[#AAEED3] text-[11.5px] font-semibold text-[#123A36] hover:bg-[#AAEED3]/30 transition-all flex items-center gap-2 shadow-2xs focus-visible:ring-2 focus-visible:ring-[#2A7B73] focus:outline-none cursor-pointer"
                  aria-haspopup="menu"
                  aria-expanded={openMenu === 'operations'}
                  title="Flip and Swap Operations"
                >
                  <span className="text-[#2A7B73] font-bold">Operation:</span>
                  <span>
                    {flipTarget === 'h'
                      ? domain === 'CT' ? 'Flip h(τ)' : 'Flip h[k]'
                      : domain === 'CT' ? 'Flip x(τ)' : 'Flip x[k]'}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-[#2A7B73] transition-transform ${openMenu === 'operations' ? 'rotate-180' : ''}`} />
                </button>
                {openMenu === 'operations' && (
                  <div
                    className={`absolute left-0 ${
                      menuPlacement === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                    } w-48 bg-white rounded-xl shadow-xl border border-[#AAEED3] py-1.5 z-50 max-h-[min(280px,65vh)] overflow-y-auto animate-in fade-in zoom-in-95 duration-100`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setFlipTarget('h');
                        setOpenMenu(null);
                      }}
                      className={`w-full text-left px-3.5 py-2 text-[11.5px] flex items-center justify-between transition-colors cursor-pointer ${
                        flipTarget === 'h'
                          ? 'bg-[#AAEED3]/30 text-[#2A7B73] font-bold'
                          : 'text-[#123A36] hover:bg-[#AAEED3]/15'
                      }`}
                    >
                      <span>{domain === 'CT' ? 'Flip h(τ)' : 'Flip h[k]'}</span>
                      {flipTarget === 'h' && <Check className="w-3.5 h-3.5 text-[#2A7B73]" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFlipTarget('x');
                        setOpenMenu(null);
                      }}
                      className={`w-full text-left px-3.5 py-2 text-[11.5px] flex items-center justify-between transition-colors cursor-pointer ${
                        flipTarget === 'x'
                          ? 'bg-[#AAEED3]/30 text-[#2A7B73] font-bold'
                          : 'text-[#123A36] hover:bg-[#AAEED3]/15'
                      }`}
                    >
                      <span>{domain === 'CT' ? 'Flip x(τ)' : 'Flip x[k]'}</span>
                      {flipTarget === 'x' && <Check className="w-3.5 h-3.5 text-[#2A7B73]" />}
                    </button>
                    <div className="my-1 border-t border-[#AAEED3]/50" />
                    <button
                      type="button"
                      onClick={() => {
                        handleSwapSignals();
                        setOpenMenu(null);
                      }}
                      className="w-full text-left px-3.5 py-2 text-[11.5px] flex items-center gap-2 text-[#123A36] hover:bg-[#AAEED3]/20 font-semibold transition-colors cursor-pointer"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 text-[#2A7B73]" />
                      <span>Swap x ↔ h</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Drop-down: Presets */}
              <div className="relative">
                <button
                  ref={presetsBtnRef}
                  type="button"
                  onClick={() => handleToggleMenu('presets', presetsBtnRef.current)}
                  className="px-3 py-1.5 rounded-lg bg-[#F3FAF7] border border-[#AAEED3] text-[11.5px] font-semibold text-[#123A36] hover:bg-[#AAEED3]/30 transition-all flex items-center gap-2 shadow-2xs focus-visible:ring-2 focus-visible:ring-[#2A7B73] focus:outline-none cursor-pointer max-w-[260px] sm:max-w-[320px]"
                  aria-haspopup="listbox"
                  aria-expanded={openMenu === 'presets'}
                  title="Select Preset"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#2A7B73] shrink-0" />
                  <span className="text-[#2A7B73] font-bold shrink-0">Presets:</span>
                  <span className="truncate">{activePresetName}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-[#2A7B73] shrink-0 transition-transform ${openMenu === 'presets' ? 'rotate-180' : ''}`} />
                </button>
                {openMenu === 'presets' && (
                  <div
                    className={`absolute left-0 ${
                      menuPlacement === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                    } w-64 sm:w-72 bg-white rounded-xl shadow-xl border border-[#AAEED3] py-1.5 z-50 max-h-[min(280px,65vh)] overflow-y-auto animate-in fade-in zoom-in-95 duration-100`}
                  >
                    {CONVOLUTION_PRESETS.map((p) => {
                      const isActive = activePresetId === p.id && domain === p.domain;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            handleLoadPreset(p);
                            setOpenMenu(null);
                          }}
                          className={`w-full text-left px-3.5 py-2 text-[11.5px] flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-[#AAEED3]/30 text-[#2A7B73] font-bold'
                              : 'text-[#123A36] hover:bg-[#AAEED3]/15'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="truncate font-semibold">{p.name}</div>
                            <div className="text-[9.5px] text-[#123A36]/60 uppercase font-mono">{p.domain}-Time</div>
                          </div>
                          {isActive && <Check className="w-3.5 h-3.5 text-[#2A7B73] shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-2 text-[11.5px] font-mono font-semibold text-[#2A7B73]">
              <span className="w-2 h-2 rounded-full bg-[#2A7B73]" />
              <span>LTI System Simulator</span>
            </div>
          </div>
        </div>

        {/* Divider 2 */}
        <div className="border-t border-[#AAEED3]/40" />

        {/* Playback Bar (Scaled up 5%) */}
        <div className="px-4 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
            {/* Playback Transport Buttons & Speeds */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (domain === 'CT') setShiftT(-6.0);
                  else setShiftN(-10);
                  setIsPlaying(false);
                }}
                className="p-1.5 rounded-md bg-[#F3FAF7] border border-[#AAEED3] hover:bg-[#AAEED3]/30 text-[#123A36] transition-all cursor-pointer"
                title="Jump to Start"
              >
                <SkipBack className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  if (domain === 'CT') setShiftT((prev) => Math.max(-6, Math.round((prev - 0.2) * 100) / 100));
                  else setShiftN((prev) => Math.max(-10, prev - 1));
                  setIsPlaying(false);
                }}
                className="px-2 py-1 rounded-md bg-[#F3FAF7] border border-[#AAEED3] hover:bg-[#AAEED3]/30 text-[#123A36] transition-all cursor-pointer font-mono font-bold text-[11.5px]"
                title="Step Backward"
              >
                ◀ -
              </button>

              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold text-[11.5px] text-white transition-all shadow-xs cursor-pointer"
                style={{ backgroundColor: isPlaying ? 'var(--deep-teal)' : 'var(--teal)' }}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>{isPlaying ? 'Pause Sweep' : 'Auto Play Sweep'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (domain === 'CT') setShiftT((prev) => Math.min(6, Math.round((prev + 0.2) * 100) / 100));
                  else setShiftN((prev) => Math.min(10, prev + 1));
                  setIsPlaying(false);
                }}
                className="px-2 py-1 rounded-md bg-[#F3FAF7] border border-[#AAEED3] hover:bg-[#AAEED3]/30 text-[#123A36] transition-all cursor-pointer font-mono font-bold text-[11.5px]"
                title="Step Forward"
              >
                + ▶
              </button>

              <button
                type="button"
                onClick={() => {
                  if (domain === 'CT') setShiftT(0);
                  else setShiftN(0);
                  setIsPlaying(false);
                }}
                className="p-1.5 rounded-md bg-[#F3FAF7] border border-[#AAEED3] hover:bg-[#AAEED3]/30 text-[#123A36] transition-all cursor-pointer"
                title="Center at Origin (t = 0 / n = 0)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              {/* Speed Selector */}
              <div className="flex items-center gap-0.5 ml-1 bg-[#F3FAF7] p-0.5 rounded-md border border-[#AAEED3]">
                {[0.5, 1.0, 2.0].map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => setPlaybackSpeed(spd)}
                    className={`px-2 py-0.5 text-[10.5px] font-mono font-semibold rounded transition-all cursor-pointer ${
                      playbackSpeed === spd
                        ? 'bg-[#2A7B73] text-white shadow-2xs'
                        : 'text-[#123A36]/75 hover:text-[#123A36]'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>

            {/* Center: Slider inline stretching to fill available width */}
            <div className="flex-1 min-w-[170px] flex items-center gap-2">
              <label htmlFor="shift-slider" className="text-[11.5px] font-bold text-[#123A36] whitespace-nowrap shrink-0">
                {domain === 'CT' ? 'Time Shift Parameter (t):' : 'Discrete Shift Index (n):'}
              </label>
              <input
                id="shift-slider"
                type="range"
                min={domain === 'CT' ? -6 : -10}
                max={domain === 'CT' ? 6 : 10}
                step={domain === 'CT' ? 0.05 : 1}
                value={domain === 'CT' ? shiftT : shiftN}
                onPointerDown={() => { isSliderDraggingRef.current = true; }}
                onPointerUp={() => { isSliderDraggingRef.current = false; }}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (domain === 'CT') setShiftT(val);
                  else setShiftN(Math.round(val));
                  setIsPlaying(false);
                }}
                className="flex-1 accent-[#55A9A0] cursor-pointer h-2 bg-[#E1F3EC] rounded-lg"
              />
              <span className="font-mono font-bold text-[11.5px] text-[#2A7B73] whitespace-nowrap bg-[#F3FAF7] px-2 py-0.5 rounded-md border border-[#AAEED3] shrink-0">
                {domain === 'CT' ? `t = ${shiftT.toFixed(2)}` : `n = ${shiftN}`}
              </span>
            </div>

            {/* Right: Active Output readout + Copy button */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="px-2.5 py-1 rounded-md bg-[#F3FAF7] border border-[#AAEED3] flex items-center gap-1.5 shadow-2xs text-[11.5px]">
                <span className="font-semibold text-[#123A36]">Active Output:</span>
                <span className="font-mono font-bold text-[11.5px] text-[#2A7B73]">
                  {domain === 'CT' ? `y(t = ${shiftT.toFixed(2)})` : `y[n = ${shiftN}]`} = {currentOutputValue.toFixed(3)}
                </span>
              </div>

              <button
                type="button"
                onClick={handleCopyResults}
                className="p-1.5 rounded-md bg-[#F3FAF7] border border-[#AAEED3] hover:bg-[#AAEED3]/30 text-[#123A36] transition-all relative cursor-pointer"
                title="Copy output data"
              >
                <Copy className="w-3.5 h-3.5 text-[#2A7B73]" />
                {copiedNotification && (
                  <span className="absolute -top-7 right-0 bg-[#123A36] text-white text-[10px] px-2 py-0.5 rounded shadow whitespace-nowrap z-20">
                    {copiedNotification}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Row 1: Signal Configurator (40%) + 1. Flip & Shift (60%) - Scaled up 5% */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-[17px] items-stretch">
        {/* Signal Configurator & Parameters (40% width -> 2 cols out of 5) */}
        <div className="lg:col-span-2 bg-white rounded-[17px] p-4 shadow-sm border border-[#AAEED3]/50 flex flex-col justify-between overflow-visible">
          <div>
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[#AAEED3]/30 gap-2">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#2A7B73]" />
                <h3 className="font-bold text-[13px] text-[#123A36]">
                  Signal Configurator
                </h3>
              </div>
              {/* Polished Signal Drop-down */}
              <div ref={signalDropdownRef} className="relative">
                <button
                  ref={signalBtnRef}
                  type="button"
                  onClick={toggleSignalMenu}
                  onKeyDown={handleSignalKeyDown}
                  aria-haspopup="listbox"
                  aria-expanded={isSignalMenuOpen}
                  aria-label="Choose signal to configure"
                  className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#F3FAF7] border border-[#AAEED3] text-[11.5px] font-semibold text-[#123A36] hover:bg-[#AAEED3]/30 transition-all flex items-center gap-2 shadow-2xs focus-visible:ring-2 focus-visible:ring-[#2A7B73] focus:outline-none cursor-pointer select-none"
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2 h-2 rounded-full shrink-0 shadow-2xs"
                      style={{ backgroundColor: activeConfigSignal === 'x' ? COLOR_X : COLOR_H }}
                    />
                    <span className="text-[#2A7B73] font-bold shrink-0">Signal:</span>
                    <span className="font-semibold text-[#123A36] truncate">
                      {activeConfigSignal === 'x'
                        ? domain === 'CT' ? 'Input x(t)' : 'Input x[n]'
                        : domain === 'CT' ? 'Impulse h(t)' : 'Impulse h[n]'}
                    </span>
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-[#2A7B73] shrink-0 transition-transform duration-150 ${
                      isSignalMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isSignalMenuOpen && (
                  <div
                    role="listbox"
                    aria-label="Choose signal to configure"
                    className={`absolute right-0 ${
                      signalMenuPlacement === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                    } w-60 sm:w-64 bg-white rounded-xl shadow-xl border border-[#AAEED3] p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 select-none`}
                  >
                    {signalOptions.map((opt, idx) => {
                      const isSelected = activeConfigSignal === opt.id;
                      const isFocused = signalFocusedIndex === idx;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            setActiveConfigSignal(opt.id);
                            setIsSignalMenuOpen(false);
                            signalBtnRef.current?.focus();
                          }}
                          onMouseEnter={() => setSignalFocusedIndex(idx)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-[11.5px] flex items-center justify-between gap-2.5 transition-colors cursor-pointer outline-none ${
                            isSelected
                              ? 'bg-[#AAEED3]/30 text-[#123A36] font-semibold'
                              : isFocused
                              ? 'bg-[#AAEED3]/15 text-[#123A36]'
                              : 'text-[#123A36] hover:bg-[#AAEED3]/15'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                              style={{ backgroundColor: opt.color }}
                            />
                            <div className="min-w-0">
                              <div className="font-semibold truncate">{opt.title}</div>
                              <div className="text-[10px] text-[#123A36]/60 truncate font-medium">
                                {opt.role}
                              </div>
                            </div>
                          </div>
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-[#2A7B73] shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {activeConfigSignal === 'x' ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between pb-1 text-[11.5px]">
                  <span className="font-bold text-[#123A36] flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" />
                    Input Signal x({domain === 'CT' ? 't' : 'n'})
                  </span>
                  <span className="text-[10.5px] font-mono text-[#2563EB] uppercase font-bold">
                    {sigX.type}
                  </span>
                </div>

                <div>
                  <label className="text-[11.5px] font-semibold text-[#123A36] block mb-1">
                    Waveform Archetype:
                  </label>
                  <select
                    value={sigX.type}
                    onChange={(e) => setSigX({ ...sigX, type: e.target.value as SignalArchetype })}
                    className="w-full text-[11.5px] font-medium p-2 rounded-md bg-white border border-[#AAEED3] text-[#123A36] focus:outline-none focus:ring-1 focus:ring-[#2563EB] cursor-pointer"
                  >
                    {ARCHETYPE_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex justify-between text-[11.5px] text-[#123A36] mb-1">
                    <span>Amplitude (A):</span>
                    <span className="font-mono font-bold text-[#2563EB]">{sigX.amplitude.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="3.0"
                    step="0.1"
                    value={sigX.amplitude}
                    onChange={(e) => setSigX({ ...sigX, amplitude: parseFloat(e.target.value) })}
                    className="w-full accent-[#2563EB] cursor-pointer h-2 bg-[#E1F3EC] rounded-lg"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11.5px] text-[#123A36] mb-1">
                    <span>Width / Duration (W):</span>
                    <span className="font-mono font-bold text-[#2563EB]">{sigX.width.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="5.0"
                    step="0.5"
                    value={sigX.width}
                    onChange={(e) => setSigX({ ...sigX, width: parseFloat(e.target.value) })}
                    className="w-full accent-[#2563EB] cursor-pointer h-2 bg-[#E1F3EC] rounded-lg"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11.5px] text-[#123A36] mb-1">
                    <span>Center Shift (t₀ / n₀):</span>
                    <span className="font-mono font-bold text-[#2563EB]">{sigX.shift.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="-4.0"
                    max="4.0"
                    step="0.5"
                    value={sigX.shift}
                    onChange={(e) => setSigX({ ...sigX, shift: parseFloat(e.target.value) })}
                    className="w-full accent-[#2563EB] cursor-pointer h-2 bg-[#E1F3EC] rounded-lg"
                  />
                </div>

                {sigX.type === 'exp' && (
                  <div>
                    <div className="flex justify-between text-[11.5px] text-[#123A36] mb-1">
                      <span>Decay Rate (α):</span>
                      <span className="font-mono font-bold text-[#2563EB]">{sigX.decay.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="0.2"
                      max="3.0"
                      step="0.1"
                      value={sigX.decay}
                      onChange={(e) => setSigX({ ...sigX, decay: parseFloat(e.target.value) })}
                      className="w-full accent-[#2563EB] cursor-pointer h-2 bg-[#E1F3EC] rounded-lg"
                    />
                  </div>
                )}

                {sigX.type === 'custom' && domain === 'CT' && (
                  <div>
                    <label className="text-[11.5px] font-semibold text-[#123A36] block mb-1">
                      Custom Expression (variable: t):
                    </label>
                    <input
                      type="text"
                      value={sigX.customExpr}
                      onChange={(e) => setSigX({ ...sigX, customExpr: e.target.value })}
                      className="w-full text-[11.5px] font-mono p-2 rounded-md bg-white border border-[#AAEED3] text-[#123A36]"
                      placeholder="e.g. exp(-t) * (t >= 0)"
                    />
                  </div>
                )}

                {sigX.type === 'custom' && domain === 'DT' && (
                  <div>
                    <label className="text-[11.5px] font-semibold text-[#123A36] block mb-1">
                      Custom Discrete Samples:
                    </label>
                    <input
                      type="text"
                      value={sigX.customSamples}
                      onChange={(e) => setSigX({ ...sigX, customSamples: e.target.value })}
                      className="w-full text-[11.5px] font-mono p-2 rounded-md bg-white border border-[#AAEED3] text-[#123A36]"
                      placeholder="1, 2, 3, 2, 1"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between pb-1 text-[11.5px]">
                  <span className="font-bold text-[#123A36] flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#EA580C]" />
                    Impulse Response h({domain === 'CT' ? 't' : 'n'})
                  </span>
                  <span className="text-[10.5px] font-mono text-[#EA580C] uppercase font-bold">
                    {sigH.type}
                  </span>
                </div>

                <div>
                  <label className="text-[11.5px] font-semibold text-[#123A36] block mb-1">
                    Waveform Archetype:
                  </label>
                  <select
                    value={sigH.type}
                    onChange={(e) => setSigH({ ...sigH, type: e.target.value as SignalArchetype })}
                    className="w-full text-[11.5px] font-medium p-2 rounded-md bg-white border border-[#AAEED3] text-[#123A36] focus:outline-none focus:ring-1 focus:ring-[#EA580C] cursor-pointer"
                  >
                    {ARCHETYPE_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex justify-between text-[11.5px] text-[#123A36] mb-1">
                    <span>Amplitude (A):</span>
                    <span className="font-mono font-bold text-[#EA580C]">{sigH.amplitude.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="3.0"
                    step="0.1"
                    value={sigH.amplitude}
                    onChange={(e) => setSigH({ ...sigH, amplitude: parseFloat(e.target.value) })}
                    className="w-full accent-[#EA580C] cursor-pointer h-2 bg-[#E1F3EC] rounded-lg"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11.5px] text-[#123A36] mb-1">
                    <span>Width / Duration (W):</span>
                    <span className="font-mono font-bold text-[#EA580C]">{sigH.width.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="5.0"
                    step="0.5"
                    value={sigH.width}
                    onChange={(e) => setSigH({ ...sigH, width: parseFloat(e.target.value) })}
                    className="w-full accent-[#EA580C] cursor-pointer h-2 bg-[#E1F3EC] rounded-lg"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11.5px] text-[#123A36] mb-1">
                    <span>Center Shift (t₀ / n₀):</span>
                    <span className="font-mono font-bold text-[#EA580C]">{sigH.shift.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="-4.0"
                    max="4.0"
                    step="0.5"
                    value={sigH.shift}
                    onChange={(e) => setSigH({ ...sigH, shift: parseFloat(e.target.value) })}
                    className="w-full accent-[#EA580C] cursor-pointer h-2 bg-[#E1F3EC] rounded-lg"
                  />
                </div>

                {sigH.type === 'exp' && (
                  <div>
                    <div className="flex justify-between text-[11.5px] text-[#123A36] mb-1">
                      <span>Decay Rate (α):</span>
                      <span className="font-mono font-bold text-[#EA580C]">{sigH.decay.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="0.2"
                      max="3.0"
                      step="0.1"
                      value={sigH.decay}
                      onChange={(e) => setSigH({ ...sigH, decay: parseFloat(e.target.value) })}
                      className="w-full accent-[#EA580C] cursor-pointer h-2 bg-[#E1F3EC] rounded-lg"
                    />
                  </div>
                )}

                {sigH.type === 'custom' && domain === 'CT' && (
                  <div>
                    <label className="text-[11.5px] font-semibold text-[#123A36] block mb-1">
                      Custom Expression (variable: t):
                    </label>
                    <input
                      type="text"
                      value={sigH.customExpr}
                      onChange={(e) => setSigH({ ...sigH, customExpr: e.target.value })}
                      className="w-full text-[11.5px] font-mono p-2 rounded-md bg-white border border-[#AAEED3] text-[#123A36]"
                      placeholder="e.g. rect(t / 2)"
                    />
                  </div>
                )}

                {sigH.type === 'custom' && domain === 'DT' && (
                  <div>
                    <label className="text-[11.5px] font-semibold text-[#123A36] block mb-1">
                      Custom Discrete Samples:
                    </label>
                    <input
                      type="text"
                      value={sigH.customSamples}
                      onChange={(e) => setSigH({ ...sigH, customSamples: e.target.value })}
                      className="w-full text-[11.5px] font-mono p-2 rounded-md bg-white border border-[#AAEED3] text-[#123A36]"
                      placeholder="1, 1, 1"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 1. Flip & Shift (60% width -> 3 cols out of 5) - Scaled up 5% */}
        <div className="lg:col-span-3 bg-white rounded-[17px] p-4 shadow-sm border border-[#AAEED3]/50 flex flex-col justify-between overflow-visible">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5 pb-2 border-b border-[#AAEED3]/30">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#2A7B73]" />
              <h3 className="font-bold text-[13px] text-[#123A36]">
                1. Flip &amp; Shift (Dummy Variable Domain: τ / k)
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11.5px] font-mono">
              <span
                className="flex items-center gap-1.5 font-semibold"
                style={{ color: flipTarget === 'h' ? COLOR_X : COLOR_H }}
              >
                <span
                  className="inline-block w-2.5 h-2.5 rounded-xs"
                  style={{ backgroundColor: flipTarget === 'h' ? COLOR_X : COLOR_H }}
                />
                {flipTarget === 'h' ? (domain === 'CT' ? 'x(τ)' : 'x[k]') : (domain === 'CT' ? 'h(τ)' : 'h[k]')} (Stationary)
              </span>
              <span
                className="flex items-center gap-1.5 font-semibold"
                style={{ color: flipTarget === 'h' ? COLOR_H : COLOR_X }}
              >
                <span
                  className="inline-block w-2.5 h-2.5 rounded-xs"
                  style={{ backgroundColor: flipTarget === 'h' ? COLOR_H : COLOR_X }}
                />
                {flipTarget === 'h'
                  ? (domain === 'CT' ? `h(${shiftT.toFixed(2)} - τ)` : `h[${shiftN} - k]`)
                  : (domain === 'CT' ? `x(${shiftT.toFixed(2)} - τ)` : `x[${shiftN} - k]`)} (Flipped & Sliding)
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-[#9333EA]">
                <span className="inline-block w-2.5 h-2.5 rounded-xs bg-[#9333EA] border border-[#7C3AED]" />
                {domain === 'CT' ? 'Overlap Area x(τ)·h(t−τ)' : 'Overlap Indices (k)'}
              </span>
            </div>
          </div>

          {/* Canvas for Plot 1 (Scaled up 5%: min-h-[185px] / h-[185px]) */}
          <div
            ref={plot1Ref}
            tabIndex={0}
            role="button"
            aria-label="Focus projection: 1. Flip & Shift (Dummy Variable Domain: τ / k)"
            onMouseEnter={() => handlePlotMouseEnter(1)}
            onMouseLeave={handlePlotMouseLeave}
            onKeyDown={(e) => handlePlotKeyDown(e, 1)}
            onClick={() => openFocusProjection(1)}
            className="relative w-full flex-1 min-h-[185px] h-[185px] sm:h-[200px] bg-[#FAFCFB] rounded-xl border border-[#AAEED3]/60 p-2 overflow-hidden flex items-center justify-center cursor-zoom-in focus-visible:ring-2 focus-visible:ring-[#2A7B73] focus:outline-none transition-shadow"
          >
            {domain === 'CT' && ctPlotData ? (
              <svg viewBox={`0 0 ${ctPlotData.svgW} ${ctPlotData.svgH}`} className="w-full h-full">
                {/* Horizontal Zero Axis */}
                <line
                  x1="30"
                  y1={ctPlotData.zeroY}
                  x2={ctPlotData.svgW - 30}
                  y2={ctPlotData.zeroY}
                  stroke="#123A36"
                  strokeWidth="1.5"
                  strokeOpacity="0.4"
                />
                {/* Vertical Zero Axis (tau = 0) */}
                <line
                  x1={ctPlotData.toSvgX(0)}
                  y1="10"
                  x2={ctPlotData.toSvgX(0)}
                  y2={ctPlotData.svgH - 18}
                  stroke="#123A36"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                  strokeOpacity="0.3"
                />

                {/* Shaded Overlap Area directly between/under curves in Tier 1 */}
                <path
                  d={ctPlotData.productAreaPoly}
                  fill={COLOR_OVERLAP_FILL_LIGHT}
                  stroke="none"
                />

                {/* Shift Position Marker Line */}
                <line
                  x1={ctPlotData.toSvgX(shiftT)}
                  y1="10"
                  x2={ctPlotData.toSvgX(shiftT)}
                  y2={ctPlotData.svgH - 18}
                  stroke={flipTarget === 'h' ? COLOR_H : COLOR_X}
                  strokeWidth="1.5"
                  strokeDasharray="2 3"
                />
                <text
                  x={ctPlotData.toSvgX(shiftT)}
                  y="12"
                  textAnchor="middle"
                  className="text-[9.5px] font-mono font-bold"
                  fill={flipTarget === 'h' ? COLOR_H : COLOR_X}
                >
                  t = {shiftT.toFixed(1)}
                </text>

                {/* Stationary curve */}
                <path
                  d={ctPlotData.xPath}
                  fill="none"
                  stroke={flipTarget === 'h' ? COLOR_X : COLOR_H}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                {/* Flipped and shifted curve */}
                <path
                  d={ctPlotData.hShiftedPath}
                  fill="none"
                  stroke={flipTarget === 'h' ? COLOR_H : COLOR_X}
                  strokeWidth="2.5"
                  strokeDasharray="6 3"
                  strokeLinecap="round"
                />

                {/* Axis Labels */}
                {[-6, -4, -2, 0, 2, 4, 6].map((tau) => (
                  <text
                    key={tau}
                    x={ctPlotData.toSvgX(tau)}
                    y={ctPlotData.svgH - 5}
                    textAnchor="middle"
                    className="text-[9.5px] font-mono fill-[#123A36]/60"
                  >
                    τ={tau}
                  </text>
                ))}
              </svg>
            ) : domain === 'DT' && dtGrid && currentDtStep ? (
              <div className="w-full h-full flex items-end justify-between px-3 pb-3 pt-5">
                {currentDtStep.kIndices.map((k, i) => {
                  const xK = currentDtStep.xSamples[i];
                  const hShifted = currentDtStep.hFlippedSamples[i];
                  const maxDisplayVal = Math.max(1, sigX.amplitude, sigH.amplitude);
                  const hHeightPx = Math.max(2, (Math.abs(hShifted) / maxDisplayVal) * 50);
                  const xHeightPx = Math.max(2, (Math.abs(xK) / maxDisplayVal) * 50);
                  const isOverlap = Math.abs(xK) > 1e-4 && Math.abs(hShifted) > 1e-4;

                  return (
                    <div key={k} className="flex flex-col items-center flex-1 relative group">
                      {isOverlap && (
                        <div
                          className="absolute inset-x-0 bottom-3.5 top-1 bg-[#9333EA]/15 rounded border border-[#9333EA]/35 -z-0 pointer-events-none"
                          title={`Overlap at k=${k}: x[${k}]·h[${shiftN}-${k}]`}
                        />
                      )}
                      {isOverlap && (
                        <span className="text-[7.5px] font-mono font-extrabold text-[#9333EA] absolute top-0.5 z-10 select-none">
                          overlap
                        </span>
                      )}

                      {Math.abs(hShifted) > 1e-4 && (
                        <div
                          className="w-2 rounded-t absolute transition-all"
                          style={{
                            height: `${hHeightPx}px`,
                            bottom: '15px',
                            left: 'calc(50% + 1px)',
                            backgroundColor: flipTarget === 'h' ? COLOR_H : COLOR_X,
                          }}
                        />
                      )}
                      {Math.abs(xK) > 1e-4 && (
                        <div
                          className="w-2 rounded-t absolute transition-all"
                          style={{
                            height: `${xHeightPx}px`,
                            bottom: '15px',
                            left: 'calc(50% - 3px)',
                            backgroundColor: flipTarget === 'h' ? COLOR_X : COLOR_H,
                          }}
                        />
                      )}
                      <div className="w-full border-b border-[#123A36]/30 mb-0.5" />
                      <span className={`text-[8.5px] font-mono ${isOverlap ? 'text-[#9333EA] font-bold' : 'text-[#123A36]/70'}`}>
                        k={k}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Row 2: Plot 2 (50%) + Plot 3 (50%) - Scaled up 5% */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[17px] items-stretch">
        {/* 2. Overlap Product & Area Accumulation (50%) - Scaled up 5% */}
        <div className="bg-white rounded-[17px] p-4 shadow-sm border border-[#AAEED3]/50 flex flex-col justify-between overflow-visible">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5 pb-2 border-b border-[#AAEED3]/30">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#9333EA] border border-[#7C3AED]" />
              <h3 className="font-bold text-[13px] text-[#123A36]">
                2. Overlap Product &amp; Area Accumulation
              </h3>
            </div>
            <div className="flex items-center gap-2 font-mono text-[11.5px]">
              <span className="text-[#123A36]/80 font-bold hidden sm:inline">
                {domain === 'CT'
                  ? 'Integrand: f(τ) = x(τ) · h(t - τ)'
                  : 'Term Products: x[k] · h[n - k]'}
              </span>
              <span className="px-2.5 py-1 rounded-md bg-[#F3E8FF] text-[#9333EA] font-bold border border-[#9333EA]/30">
                {domain === 'CT'
                  ? `∫ Overlap dτ = ${currentOutputValue.toFixed(3)}`
                  : `∑ Overlap = ${currentOutputValue.toFixed(3)}`}
              </span>
            </div>
          </div>

          {/* SVG Canvas for Tier 2 (Scaled up 5%: min-h-[168px] / h-[168px]) */}
          <div
            ref={plot2Ref}
            tabIndex={0}
            role="button"
            aria-label="Focus projection: 2. Overlap Product & Area Accumulation"
            onMouseEnter={() => handlePlotMouseEnter(2)}
            onMouseLeave={handlePlotMouseLeave}
            onKeyDown={(e) => handlePlotKeyDown(e, 2)}
            onClick={() => openFocusProjection(2)}
            className="relative w-full flex-1 min-h-[168px] h-[168px] sm:h-[184px] bg-[#FAFCFB] rounded-xl border border-[#AAEED3]/60 p-2 overflow-hidden flex items-center justify-center cursor-zoom-in focus-visible:ring-2 focus-visible:ring-[#2A7B73] focus:outline-none transition-shadow"
          >
            {domain === 'CT' && ctPlotData ? (
              <svg viewBox={`0 0 ${ctPlotData.svgW} ${ctPlotData.svgH}`} className="w-full h-full">
                {/* Horizontal Zero Axis */}
                <line
                  x1="30"
                  y1={ctPlotData.zeroY}
                  x2={ctPlotData.svgW - 30}
                  y2={ctPlotData.zeroY}
                  stroke="#123A36"
                  strokeWidth="1.5"
                  strokeOpacity="0.4"
                />

                {/* Shaded Overlap Area in dedicated Purple color */}
                <path
                  d={ctPlotData.productAreaPoly}
                  fill={COLOR_OVERLAP_FILL}
                  stroke="none"
                />

                {/* Product Outline Curve in dedicated Purple color */}
                <path
                  d={ctPlotData.productPath}
                  fill="none"
                  stroke={COLOR_OVERLAP}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

                {/* Axis Labels */}
                {[-6, -4, -2, 0, 2, 4, 6].map((tau) => (
                  <text
                    key={tau}
                    x={ctPlotData.toSvgX(tau)}
                    y={ctPlotData.svgH - 5}
                    textAnchor="middle"
                    className="text-[9.5px] font-mono fill-[#123A36]/60"
                  >
                    τ={tau}
                  </text>
                ))}
              </svg>
            ) : domain === 'DT' && dtGrid && currentDtStep ? (
              <div className="w-full h-full flex flex-col justify-between">
                <div className="flex-1 flex items-end justify-between px-3 pb-2 pt-4">
                  {currentDtStep.kIndices.map((k, i) => {
                    const prod = currentDtStep.productStems[i];
                    const isNonZero = Math.abs(prod) > 1e-4;
                    const maxDisplayVal = Math.max(1, dtGrid.peakValue);
                    const prodHeight = isNonZero ? Math.max(3, (Math.abs(prod) / maxDisplayVal) * 63) : 0;

                    return (
                      <div key={k} className="flex flex-col items-center flex-1 relative group">
                        {isNonZero ? (
                          <>
                            <span className="text-[8.5px] font-mono font-bold text-[#9333EA] mb-0.5">
                              {prod.toFixed(2)}
                            </span>
                            <div
                              className="w-2.5 rounded-t transition-all bg-[#9333EA] border border-[#7C3AED] shadow-2xs"
                              style={{ height: `${prodHeight}px` }}
                            />
                          </>
                        ) : (
                          <div className="w-2.5 h-0" />
                        )}
                        <div className="w-full border-b border-[#123A36]/30 mb-0.5" />
                        <span className={`text-[8.5px] font-mono ${isNonZero ? 'text-[#9333EA] font-bold' : 'text-[#123A36]/70'}`}>
                          k={k}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {/* Active Terms Breakdown Banner */}
                <div className="bg-[#F3FAF7] p-2 rounded-lg border border-[#AAEED3]/80 text-[11.5px] font-mono text-[#123A36] overflow-x-auto whitespace-nowrap">
                  <span className="font-bold text-[#2A7B73]">y[{shiftN}]</span> = <span className="text-[#9333EA] font-bold">{currentDtStep.termsText}</span> = <strong className="text-[#2A7B73]">{currentOutputValue.toFixed(3)}</strong>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* 3. Total Convolution Output Response: y(t) = (x * h)(t) (50%) - Scaled up 5% */}
        <div className="bg-white rounded-[17px] p-4 shadow-sm border border-[#AAEED3]/50 flex flex-col justify-between overflow-visible">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5 pb-2 border-b border-[#AAEED3]/30">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#2A7B73]" />
              <h3 className="font-bold text-[13px] text-[#123A36]">
                3. Total Output Response: y({domain === 'CT' ? 't' : 'n'})
              </h3>
            </div>
            <div className="flex items-center gap-3 text-[11.5px] font-mono">
              <span className="text-[#123A36]/70">
                Peak: <strong className="text-[#2A7B73]">{(domain === 'CT' ? ctGrid?.peakValue : dtGrid?.peakValue)?.toFixed(2)}</strong> at {domain === 'CT' ? `t = ${ctGrid?.peakShift.toFixed(2)}` : `n = ${dtGrid?.peakShift}`}
              </span>
              <span className="text-[#123A36]/70">
                Energy: <strong className="text-[#2A7B73]">{(domain === 'CT' ? ctGrid?.totalEnergy : dtGrid?.totalEnergy)?.toFixed(2)}</strong>
              </span>
            </div>
          </div>

          {/* SVG Canvas for Tier 3 (Scaled up 5%: min-h-[168px] / h-[168px]) */}
          <div
            ref={plot3Ref}
            tabIndex={0}
            role="button"
            aria-label="Focus projection: 3. Total Output Response: y(t) = (x * h)(t)"
            onMouseEnter={() => handlePlotMouseEnter(3)}
            onMouseLeave={handlePlotMouseLeave}
            onKeyDown={(e) => handlePlotKeyDown(e, 3)}
            onClick={() => openFocusProjection(3)}
            className="relative w-full flex-1 min-h-[168px] h-[168px] sm:h-[184px] bg-[#FAFCFB] rounded-xl border border-[#AAEED3]/60 p-2 overflow-hidden flex items-center justify-center cursor-zoom-in focus-visible:ring-2 focus-visible:ring-[#2A7B73] focus:outline-none transition-shadow"
          >
            {domain === 'CT' && ctPlotData ? (
              <svg viewBox={`0 0 ${ctPlotData.svgW} ${ctPlotData.svgH}`} className="w-full h-full">
                {/* Horizontal Zero Axis */}
                <line
                  x1="30"
                  y1={ctPlotData.yZeroLine}
                  x2={ctPlotData.svgW - 30}
                  y2={ctPlotData.yZeroLine}
                  stroke="#123A36"
                  strokeWidth="1.5"
                  strokeOpacity="0.4"
                />

                {/* Full Curve Translucent Future Track */}
                <path
                  d={ctPlotData.yOutPath}
                  fill="none"
                  stroke="#55A9A0"
                  strokeWidth="1.8"
                  strokeDasharray="4 4"
                  strokeOpacity="0.5"
                />

                {/* Shaded Output Area up to current t */}
                <path
                  d={ctPlotData.yOutPastPoly}
                  fill="rgba(85, 169, 160, 0.2)"
                  stroke="none"
                />

                {/* Past Output Path Drawn Solid */}
                <path
                  d={ctPlotData.yOutPastPath}
                  fill="none"
                  stroke="#2A7B73"
                  strokeWidth="3"
                  strokeLinecap="round"
                />

                {/* Current Value Marker Beacon */}
                <circle
                  cx={ctPlotData.currentOutputCoord[0]}
                  cy={ctPlotData.currentOutputCoord[1]}
                  r="5.5"
                  fill="#FFF6B0"
                  stroke="#2A7B73"
                  strokeWidth="2.5"
                />

                {/* Axis Labels */}
                {[-6, -4, -2, 0, 2, 4, 6].map((t) => (
                  <text
                    key={t}
                    x={ctPlotData.toSvgX(t)}
                    y={ctPlotData.svgH - 5}
                    textAnchor="middle"
                    className="text-[9.5px] font-mono fill-[#123A36]/60"
                  >
                    t={t}
                  </text>
                ))}
              </svg>
            ) : domain === 'DT' && dtGrid ? (
              <div className="w-full h-full flex items-end justify-between px-3 pb-3 pt-5">
                {dtGrid.nValues.map((n, idx) => {
                  const val = dtGrid.yValues[idx];
                  const isCurrent = n === shiftN;
                  const isPast = n <= shiftN;
                  const maxPeak = Math.max(1, dtGrid.peakValue);
                  const stemHeight = Math.max(2, (Math.abs(val) / maxPeak) * 67);

                  return (
                    <div key={n} className="flex flex-col items-center flex-1 relative group">
                      <span
                        className={`text-[8.5px] font-mono font-bold mb-0.5 ${
                          isCurrent ? 'text-[#2A7B73] scale-110' : 'text-[#123A36]/60'
                        }`}
                      >
                        {Math.abs(val) > 0.05 ? val.toFixed(1) : '0'}
                      </span>
                      <div
                        className={`w-2.5 rounded-t transition-all ${
                          isCurrent
                            ? 'bg-[#FFF6B0] border-2 border-[#2A7B73] shadow-md z-10'
                            : isPast
                            ? 'bg-[#2A7B73]'
                            : 'bg-[#AAEED3]/50 border border-dashed border-[#55A9A0]'
                        }`}
                        style={{ height: `${stemHeight}px` }}
                      />
                      <div className="w-full border-b border-[#123A36]/30 mb-0.5" />
                      <span
                        className={`text-[8.5px] font-mono ${
                          isCurrent ? 'text-[#2A7B73] font-bold' : 'text-[#123A36]/70'
                        }`}
                      >
                        n={n}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Item 2: Hover-Reveal for Mathematical Properties & Proofs and Analytical Integration Reference (Scaled up 5%) */}
      <div
        ref={drawerContainerRef}
        className="relative bg-white rounded-[17px] shadow-sm border border-[#AAEED3]/50 overflow-visible"
      >
        <div className="flex bg-[#FAFCFB] px-5 py-0.5 rounded-[17px] overflow-hidden">
          <button
            type="button"
            id="tab-btn-properties"
            aria-controls="panel-properties"
            aria-expanded={activeDrawerTab === 'properties'}
            onMouseEnter={() => {
              if (drawerCloseTimerRef.current) clearTimeout(drawerCloseTimerRef.current);
              setActiveDrawerTab('properties');
            }}
            onMouseLeave={() => {
              if (drawerCloseTimerRef.current) clearTimeout(drawerCloseTimerRef.current);
              drawerCloseTimerRef.current = setTimeout(() => setActiveDrawerTab(null), 150);
            }}
            onFocus={() => {
              if (drawerCloseTimerRef.current) clearTimeout(drawerCloseTimerRef.current);
              setActiveDrawerTab('properties');
            }}
            onClick={() => setActiveDrawerTab((prev) => (prev === 'properties' ? null : 'properties'))}
            className={`flex items-center gap-2.5 py-3.5 px-4.5 border-b-2 font-semibold text-[12.5px] transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2A7B73] ${
              activeDrawerTab === 'properties'
                ? 'border-[#2A7B73] text-[#2A7B73]'
                : 'border-transparent text-[#123A36]/70 hover:text-[#123A36]'
            }`}
          >
            <Compass className="w-4.5 h-4.5" />
            <span>Mathematical Properties &amp; Proofs</span>
          </button>

          <button
            type="button"
            id="tab-btn-math"
            aria-controls="panel-math"
            aria-expanded={activeDrawerTab === 'math'}
            onMouseEnter={() => {
              if (drawerCloseTimerRef.current) clearTimeout(drawerCloseTimerRef.current);
              setActiveDrawerTab('math');
            }}
            onMouseLeave={() => {
              if (drawerCloseTimerRef.current) clearTimeout(drawerCloseTimerRef.current);
              drawerCloseTimerRef.current = setTimeout(() => setActiveDrawerTab(null), 150);
            }}
            onFocus={() => {
              if (drawerCloseTimerRef.current) clearTimeout(drawerCloseTimerRef.current);
              setActiveDrawerTab('math');
            }}
            onClick={() => setActiveDrawerTab((prev) => (prev === 'math' ? null : 'math'))}
            className={`flex items-center gap-2.5 py-3.5 px-4.5 border-b-2 font-semibold text-[12.5px] transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2A7B73] ${
              activeDrawerTab === 'math'
                ? 'border-[#2A7B73] text-[#2A7B73]'
                : 'border-transparent text-[#123A36]/70 hover:text-[#123A36]'
            }`}
          >
            <BookOpen className="w-4.5 h-4.5" />
            <span>Analytical Integration Reference</span>
          </button>
        </div>

        {/* Floating Panel overlaying without moving page content */}
        {activeDrawerTab && (
          <div
            id={activeDrawerTab === 'properties' ? 'panel-properties' : 'panel-math'}
            role="region"
            aria-labelledby={activeDrawerTab === 'properties' ? 'tab-btn-properties' : 'tab-btn-math'}
            onMouseEnter={() => {
              if (drawerCloseTimerRef.current) clearTimeout(drawerCloseTimerRef.current);
            }}
            onMouseLeave={() => {
              if (drawerCloseTimerRef.current) clearTimeout(drawerCloseTimerRef.current);
              drawerCloseTimerRef.current = setTimeout(() => setActiveDrawerTab(null), 150);
            }}
            className="absolute top-full mt-2 left-0 right-0 z-40 bg-white rounded-[17px] shadow-xl border border-[#AAEED3] p-6.5 max-h-[75vh] overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150"
          >
            {activeDrawerTab === 'properties' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4.5 rounded-xl bg-[#FAFCFB] border border-[#AAEED3]/60">
                  <h4 className="font-bold text-[13px] text-[#123A36] mb-1">1. Commutativity</h4>
                  <p className="font-mono text-[13px] text-[#2A7B73] font-bold mb-2">x * h = h * x</p>
                  <p className="text-[11.5px] text-[#123A36]/75 leading-relaxed">
                    Flipping and sliding either signal produces the exact same output response. Try toggling Flip h vs Flip x above!
                  </p>
                </div>

                <div className="p-4.5 rounded-xl bg-[#FAFCFB] border border-[#AAEED3]/60">
                  <h4 className="font-bold text-[13px] text-[#123A36] mb-1">2. Associativity</h4>
                  <p className="font-mono text-[13px] text-[#2A7B73] font-bold mb-2">x * (h₁ * h₂) = (x * h₁) * h₂</p>
                  <p className="text-[11.5px] text-[#123A36]/75 leading-relaxed">
                    Cascaded LTI systems can be combined by convolving their individual impulse responses in any order.
                  </p>
                </div>

                <div className="p-4.5 rounded-xl bg-[#FAFCFB] border border-[#AAEED3]/60">
                  <h4 className="font-bold text-[13px] text-[#123A36] mb-1">3. Distributivity</h4>
                  <p className="font-mono text-[13px] text-[#2A7B73] font-bold mb-2">x * (h₁ + h₂) = x*h₁ + x*h₂</p>
                  <p className="text-[11.5px] text-[#123A36]/75 leading-relaxed">
                    Parallel LTI systems sum linearly, equivalent to convolving with the composite impulse response (h₁ + h₂).
                  </p>
                </div>

                <div className="p-4.5 rounded-xl bg-[#FAFCFB] border border-[#AAEED3]/60">
                  <h4 className="font-bold text-[13px] text-[#123A36] mb-1">4. Identity (Delta Kernel)</h4>
                  <p className="font-mono text-[13px] text-[#2A7B73] font-bold mb-2">x(t) * δ(t - t₀) = x(t - t₀)</p>
                  <p className="text-[11.5px] text-[#123A36]/75 leading-relaxed">
                    Convolving with a Dirac/Kronecker delta simply reproduces the original signal shifted to t₀ with zero distortion.
                  </p>
                </div>
              </div>
            )}

            {activeDrawerTab === 'math' && (
              <div className="space-y-4 text-[12.5px] leading-relaxed text-[#123A36]/80">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4.5 rounded-xl bg-[#FAFCFB] border border-[#AAEED3]/60 space-y-2.5">
                    <h4 className="font-bold text-[15px] text-[#123A36]">Continuous-Time Convolution Integral</h4>
                    <div className="p-3.5 bg-white rounded-lg border border-[#AAEED3] font-mono text-[#2A7B73] text-center font-bold text-[12.5px]">
                      y(t) = (x * h)(t) = ∫₋∞^∞ x(τ) · h(t - τ) dτ
                    </div>
                    <ul className="list-disc pl-5 space-y-1 text-[11.5px]">
                      <li><strong>Flip:</strong> Replace τ with -τ to invert impulse response horizontally.</li>
                      <li><strong>Shift:</strong> Translate by parameter t into h(t - τ).</li>
                      <li><strong>Multiply:</strong> Form point-by-point product x(τ) · h(t - τ).</li>
                      <li><strong>Integrate:</strong> Compute definite area under the product curve across all τ.</li>
                    </ul>
                  </div>

                  <div className="p-4.5 rounded-xl bg-[#FAFCFB] border border-[#AAEED3]/60 space-y-2.5">
                    <h4 className="font-bold text-[15px] text-[#123A36]">Discrete-Time Convolution Sum</h4>
                    <div className="p-3.5 bg-white rounded-lg border border-[#AAEED3] font-mono text-[#2A7B73] text-center font-bold text-[12.5px]">
                      y[n] = (x * h)[n] = ∑_{'{k=-∞}'}^∞ x[k] · h[n - k]
                    </div>
                    <ul className="list-disc pl-5 space-y-1 text-[11.5px]">
                      <li><strong>Support Length:</strong> Length(y) = Length(x) + Length(h) - 1.</li>
                      <li><strong>Polynomial Multiplication:</strong> Exactly matches algebraic polynomial coefficient multiplication.</li>
                      <li><strong>Moving Average:</strong> If h[n] = 1/M for 0 ≤ n &lt; M, convolution computes a sliding unweighted box filter.</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Focus Projection Overlay (Active when hovering or selecting a plot) */}
      {focusedPlot !== null && (
        <ConvolutionFocusProjection
          focusedPlot={focusedPlot}
          onClose={closeFocusProjection}
          domain={domain}
          flipTarget={flipTarget}
          sigX={sigX}
          sigH={sigH}
          shiftT={shiftT}
          shiftN={shiftN}
          currentOutputValue={currentOutputValue}
          ctGrid={ctGrid}
          dtGrid={dtGrid}
          currentDtStep={currentDtStep}
          originRect={originRect}
        />
      )}
    </div>
  );
};
