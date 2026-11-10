/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * DSP Workbench - Topic A: Signal Combination & Operations Simulator
 * Interactive multi-signal synthesizer, chaining operations (Add, Subtract, Multiply,
 * Divide, Max, Min, Average), post-processing, and synchronized multi-plot inspection.
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Play,
  Pause,
  RotateCcw,
  ChevronDown,
  Check,
  Sparkles,
  Sliders,
  Layers,
  Activity,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import {
  SignalType,
  SignalGeneratorParams,
  DEFAULT_SIGNAL_PARAMS,
  SignalGenerator,
} from '../../math/signalGenerator';

// Five categorized waveform groups matching Topic A
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
      { value: 'sinusoidal', label: 'Sinusoidal [A·sin(2πft + φ)]' },
      { value: 'cosine', label: 'Cosine [A·cos(2πft + φ)]' },
      { value: 'square', label: 'Square Wave (Duty Cycle)' },
      { value: 'triangular', label: 'Triangular Wave' },
      { value: 'sawtooth', label: 'Sawtooth Wave' },
    ],
  },
  {
    category: 'Singularity and Step',
    options: [
      { value: 'unit_step', label: 'Unit Step [A·u(t - t₀)]' },
      { value: 'impulse', label: 'Unit Impulse Approximation' },
      { value: 'ramp', label: 'Ramp Signal [A·(t - t₀)u(t - t₀)]' },
    ],
  },
  {
    category: 'Pulses and Sinc',
    options: [
      { value: 'rectangular_pulse', label: 'Rectangular Pulse' },
      { value: 'sinc', label: 'Sinc Signal [Normalized]' },
    ],
  },
  {
    category: 'Exponential and Sweeps',
    options: [
      { value: 'exponential', label: 'Exponential Growth / Decay' },
    ],
  },
  {
    category: 'Multitone',
    options: [
      { value: 'dc', label: 'DC Signal [A + C]' },
    ],
  },
];

export type OperatorType = 'add' | 'subtract' | 'multiply' | 'divide' | 'max' | 'min' | 'average';
export type ResultOpType = 'none' | 'negate' | 'abs' | 'square' | 'sqrt_abs' | 'normalize' | 'rectify';

export interface SignalSlotConfig {
  id: string;
  label: string;
  color: string;
  visible: boolean;
  gain: number;
  params: SignalGeneratorParams;
}

const SLOT_COLORS = [
  '#0891B2', // Cyan / Teal (x1)
  '#EA580C', // Orange (x2)
  '#2563EB', // Royal Blue (x3)
  '#9333EA', // Purple (x4)
];

const OPERATOR_OPTIONS: { id: OperatorType; label: string; symbol: string }[] = [
  { id: 'add', label: 'Add (+)', symbol: '+' },
  { id: 'subtract', label: 'Subtract (−)', symbol: '−' },
  { id: 'multiply', label: 'Multiply (×)', symbol: '×' },
  { id: 'divide', label: 'Divide (÷)', symbol: '÷' },
  { id: 'max', label: 'Maximum', symbol: 'max' },
  { id: 'min', label: 'Minimum', symbol: 'min' },
  { id: 'average', label: 'Average', symbol: 'avg' },
];

const RESULT_OP_OPTIONS: { id: ResultOpType; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'negate', label: 'Negate (−y)' },
  { id: 'abs', label: 'Absolute value |y|' },
  { id: 'square', label: 'Square y²' },
  { id: 'sqrt_abs', label: 'Square root of |y|' },
  { id: 'normalize', label: 'Normalize to ±1' },
  { id: 'rectify', label: 'Rectify (half-wave)' },
];

interface SignalCombinerSimulatorProps {
  isPageActive?: boolean;
}

export const SignalCombinerSimulator: React.FC<SignalCombinerSimulatorProps> = ({ isPageActive = true }) => {
  // Collapsed state for each slot: all collapsed by default ({})
  const [expandedSlotIds, setExpandedSlotIds] = useState<Record<string, boolean>>({});

  // Signal Slots state (starts with 2 slots)
  const [slots, setSlots] = useState<SignalSlotConfig[]>([
    {
      id: 'slot_1',
      label: 'x₁(t)',
      color: SLOT_COLORS[0],
      visible: true,
      gain: 1.0,
      params: {
        ...DEFAULT_SIGNAL_PARAMS,
        signalType: 'sinusoidal',
        amplitude: 1.0,
        frequencyHz: 5.0,
        phaseDegrees: 0,
        dcOffset: 0,
      },
    },
    {
      id: 'slot_2',
      label: 'x₂(t)',
      color: SLOT_COLORS[1],
      visible: true,
      gain: 1.0,
      params: {
        ...DEFAULT_SIGNAL_PARAMS,
        signalType: 'sinusoidal',
        amplitude: 1.0,
        frequencyHz: 6.0,
        phaseDegrees: 0,
        dcOffset: 0,
      },
    },
  ]);

  // Operators between consecutive slots: operators[0] between 1 & 2, operators[1] between 2 & 3, etc.
  const [operators, setOperators] = useState<OperatorType[]>(['add', 'add', 'add']);

  // Result post-processing options
  const [resultOp, setResultOp] = useState<ResultOpType>('none');
  const [resultGain, setResultGain] = useState<number>(1.0);
  const [resultDcOffset, setResultDcOffset] = useState<number>(0.0);
  const [showInputsInResult, setShowInputsInResult] = useState<boolean>(false);

  // Shared simulation time settings
  const [timeWindowSec, setTimeWindowSec] = useState<number>(1.0); // 0.1, 0.5, 1.0, 2.0
  const [sampleCount, setSampleCount] = useState<number>(1000); // 500, 1000, 2000

  // Playback animation sweep state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0); // 0.5, 1.0, 2.0
  const [playProgress, setPlayProgress] = useState<number>(0);

  // Synchronized hover time inspection across both plots
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Active open dropdown tracker & auto-placement
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [menuPlacement, setMenuPlacement] = useState<'down' | 'up'>('down');

  // Close open dropdowns on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.combiner-dropdown-container')) {
        setActiveMenuId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveMenuId(null);
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

  const toggleDropdown = (id: string, btnEl: HTMLElement | null, menuHeight = 240) => {
    if (activeMenuId === id) {
      setActiveMenuId(null);
      return;
    }
    if (btnEl) {
      const rect = btnEl.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
        setMenuPlacement('up');
      } else {
        setMenuPlacement('down');
      }
    }
    setActiveMenuId(id);
  };

  // Toggle slot expansion
  const toggleSlotExpanded = (slotId: string) => {
    setExpandedSlotIds((prev) => ({
      ...prev,
      [slotId]: !prev[slotId],
    }));
  };

  // Add / Remove Signal Slots
  const handleAddSlot = () => {
    if (slots.length >= 4) return;
    const newIdx = slots.length;
    const newSlotId = `slot_${Date.now()}`;
    const newSlot: SignalSlotConfig = {
      id: newSlotId,
      label: `x${newIdx + 1}(t)`,
      color: SLOT_COLORS[newIdx],
      visible: true,
      gain: 1.0,
      params: {
        ...DEFAULT_SIGNAL_PARAMS,
        signalType: 'sinusoidal',
        amplitude: 0.8,
        frequencyHz: 8.0 + newIdx * 2,
        phaseDegrees: 0,
        dcOffset: 0,
      },
    };
    // New slot starts collapsed by default
    setExpandedSlotIds((prev) => ({ ...prev, [newSlotId]: false }));
    setSlots([...slots, newSlot]);
  };

  const handleRemoveSlot = (indexToRemove: number) => {
    if (slots.length <= 2) return;
    const updated = slots.filter((_, idx) => idx !== indexToRemove).map((slot, idx) => ({
      ...slot,
      label: `x${idx + 1}(t)`,
      color: SLOT_COLORS[idx],
    }));
    setSlots(updated);
  };

  // Update Slot parameters
  const updateSlot = (index: number, partial: Partial<SignalSlotConfig>) => {
    setSlots((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...partial };
      return copy;
    });
  };

  const updateSlotParams = (index: number, partial: Partial<SignalGeneratorParams>) => {
    setSlots((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        params: { ...copy[index].params, ...partial },
      };
      return copy;
    });
  };

  // Operator update
  const updateOperator = (index: number, op: OperatorType) => {
    setOperators((prev) => {
      const copy = [...prev];
      copy[index] = op;
      return copy;
    });
    setActiveMenuId(null);
  };

  // Preset Examples
  const loadExample = (exampleId: string) => {
    setActiveMenuId(null);
    setIsPlaying(false);
    switch (exampleId) {
      case 'beat_frequencies':
        setSlots([
          {
            id: 'slot_1',
            label: 'x₁(t)',
            color: SLOT_COLORS[0],
            visible: true,
            gain: 1.0,
            params: {
              ...DEFAULT_SIGNAL_PARAMS,
              signalType: 'sinusoidal',
              amplitude: 1.0,
              frequencyHz: 10.0,
              phaseDegrees: 0,
              dcOffset: 0,
            },
          },
          {
            id: 'slot_2',
            label: 'x₂(t)',
            color: SLOT_COLORS[1],
            visible: true,
            gain: 1.0,
            params: {
              ...DEFAULT_SIGNAL_PARAMS,
              signalType: 'sinusoidal',
              amplitude: 1.0,
              frequencyHz: 12.0,
              phaseDegrees: 0,
              dcOffset: 0,
            },
          },
        ]);
        setOperators(['add', 'add', 'add']);
        setResultOp('none');
        setResultGain(1.0);
        setResultDcOffset(0.0);
        setTimeWindowSec(1.0);
        break;

      case 'amplitude_modulation':
        setSlots([
          {
            id: 'slot_1',
            label: 'x₁(t)',
            color: SLOT_COLORS[0],
            visible: true,
            gain: 1.0,
            params: {
              ...DEFAULT_SIGNAL_PARAMS,
              signalType: 'sinusoidal',
              amplitude: 1.0,
              frequencyHz: 25.0,
              phaseDegrees: 0,
              dcOffset: 0,
            },
          },
          {
            id: 'slot_2',
            label: 'x₂(t)',
            color: SLOT_COLORS[1],
            visible: true,
            gain: 1.0,
            params: {
              ...DEFAULT_SIGNAL_PARAMS,
              signalType: 'cosine',
              amplitude: 0.6,
              frequencyHz: 3.0,
              phaseDegrees: 0,
              dcOffset: 1.0,
            },
          },
        ]);
        setOperators(['multiply', 'add', 'add']);
        setResultOp('none');
        setResultGain(1.0);
        setResultDcOffset(0.0);
        setTimeWindowSec(1.0);
        break;

      case 'delayed_subtraction':
        setSlots([
          {
            id: 'slot_1',
            label: 'x₁(t)',
            color: SLOT_COLORS[0],
            visible: true,
            gain: 1.0,
            params: {
              ...DEFAULT_SIGNAL_PARAMS,
              signalType: 'sinusoidal',
              amplitude: 1.2,
              frequencyHz: 5.0,
              phaseDegrees: 0,
              dcOffset: 0,
            },
          },
          {
            id: 'slot_2',
            label: 'x₂(t)',
            color: SLOT_COLORS[1],
            visible: true,
            gain: 1.0,
            params: {
              ...DEFAULT_SIGNAL_PARAMS,
              signalType: 'sinusoidal',
              amplitude: 1.2,
              frequencyHz: 5.0,
              phaseDegrees: 60,
              dcOffset: 0,
            },
          },
        ]);
        setOperators(['subtract', 'add', 'add']);
        setResultOp('none');
        setResultGain(1.0);
        setResultDcOffset(0.0);
        setTimeWindowSec(1.0);
        break;

      case 'gated_sine':
        setSlots([
          {
            id: 'slot_1',
            label: 'x₁(t)',
            color: SLOT_COLORS[0],
            visible: true,
            gain: 1.0,
            params: {
              ...DEFAULT_SIGNAL_PARAMS,
              signalType: 'sinusoidal',
              amplitude: 1.2,
              frequencyHz: 12.0,
              phaseDegrees: 0,
              dcOffset: 0,
            },
          },
          {
            id: 'slot_2',
            label: 'x₂(t)',
            color: SLOT_COLORS[1],
            visible: true,
            gain: 1.0,
            params: {
              ...DEFAULT_SIGNAL_PARAMS,
              signalType: 'square',
              amplitude: 1.0,
              frequencyHz: 2.0,
              phaseDegrees: 0,
              dcOffset: 0,
              dutyCyclePercent: 50,
            },
          },
        ]);
        setOperators(['multiply', 'add', 'add']);
        setResultOp('rectify');
        setResultGain(1.0);
        setResultDcOffset(0.0);
        setTimeWindowSec(1.0);
        break;

      case 'harmonics_sum':
        setSlots([
          {
            id: 'slot_1',
            label: 'x₁(t)',
            color: SLOT_COLORS[0],
            visible: true,
            gain: 1.0,
            params: {
              ...DEFAULT_SIGNAL_PARAMS,
              signalType: 'sinusoidal',
              amplitude: 1.0,
              frequencyHz: 3.0,
              phaseDegrees: 0,
              dcOffset: 0,
            },
          },
          {
            id: 'slot_2',
            label: 'x₂(t)',
            color: SLOT_COLORS[1],
            visible: true,
            gain: 0.33,
            params: {
              ...DEFAULT_SIGNAL_PARAMS,
              signalType: 'sinusoidal',
              amplitude: 1.0,
              frequencyHz: 9.0,
              phaseDegrees: 0,
              dcOffset: 0,
            },
          },
          {
            id: 'slot_3',
            label: 'x₃(t)',
            color: SLOT_COLORS[2],
            visible: true,
            gain: 0.2,
            params: {
              ...DEFAULT_SIGNAL_PARAMS,
              signalType: 'sinusoidal',
              amplitude: 1.0,
              frequencyHz: 15.0,
              phaseDegrees: 0,
              dcOffset: 0,
            },
          },
        ]);
        setOperators(['add', 'add', 'add']);
        setResultOp('none');
        setResultGain(1.0);
        setResultDcOffset(0.0);
        setTimeWindowSec(1.0);
        break;

      default:
        break;
    }
  };

  // Reset Simulator
  const handleReset = () => {
    setSlots([
      {
        id: 'slot_1',
        label: 'x₁(t)',
        color: SLOT_COLORS[0],
        visible: true,
        gain: 1.0,
        params: {
          ...DEFAULT_SIGNAL_PARAMS,
          signalType: 'sinusoidal',
          amplitude: 1.0,
          frequencyHz: 5.0,
          phaseDegrees: 0,
          dcOffset: 0,
        },
      },
      {
        id: 'slot_2',
        label: 'x₂(t)',
        color: SLOT_COLORS[1],
        visible: true,
        gain: 1.0,
        params: {
          ...DEFAULT_SIGNAL_PARAMS,
          signalType: 'sinusoidal',
          amplitude: 1.0,
          frequencyHz: 6.0,
          phaseDegrees: 0,
          dcOffset: 0,
        },
      },
    ]);
    setExpandedSlotIds({});
    setOperators(['add', 'add', 'add']);
    setResultOp('none');
    setResultGain(1.0);
    setResultDcOffset(0.0);
    setTimeWindowSec(1.0);
    setIsPlaying(false);
    setPlayProgress(0);
    setActiveMenuId(null);
  };

  // Pause animation when page is inactive
  useEffect(() => {
    if (!isPageActive && isPlaying) {
      setIsPlaying(false);
    }
  }, [isPageActive, isPlaying]);

  // Playback Animation Loop
  useEffect(() => {
    if (!isPlaying) return;

    // Respect reduced-motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) {
      setIsPlaying(false);
      return;
    }

    let animId: number;
    let lastTime = performance.now();
    const baseDuration = 3.0; // 3 seconds per cycle at 1x

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

  // Numerical Evaluation of Slots & Combined Result
  const computedData = useMemo(() => {
    const timePoints: number[] = [];
    const N = sampleCount;
    const dt = timeWindowSec / (N - 1);

    for (let i = 0; i < N; i++) {
      timePoints.push(i * dt);
    }

    // Evaluate each slot's waveform array
    const slotArrays: number[][] = slots.map((slot) => {
      const p = {
        ...slot.params,
        samplingFrequencyHz: Math.round(N / timeWindowSec),
      };
      return timePoints.map((t) => slot.gain * SignalGenerator.evaluateAt(t, p));
    });

    let divisionGuardTriggered = false;
    const guardedRegions: boolean[] = new Array(N).fill(false);

    // Combine left-to-right
    let combinedValues: number[] = [...slotArrays[0]];

    for (let s = 1; s < slots.length; s++) {
      const nextArr = slotArrays[s];
      const op = operators[s - 1] || 'add';

      combinedValues = combinedValues.map((currVal, i) => {
        const nextVal = nextArr[i];
        switch (op) {
          case 'add':
            return currVal + nextVal;
          case 'subtract':
            return currVal - nextVal;
          case 'multiply':
            return currVal * nextVal;
          case 'divide': {
            if (Math.abs(nextVal) < 1e-4) {
              divisionGuardTriggered = true;
              guardedRegions[i] = true;
              const safeD = nextVal >= 0 ? 1e-4 : -1e-4;
              return currVal / safeD;
            }
            return currVal / nextVal;
          }
          case 'max':
            return Math.max(currVal, nextVal);
          case 'min':
            return Math.min(currVal, nextVal);
          case 'average':
            return (currVal + nextVal) / 2;
          default:
            return currVal + nextVal;
        }
      });
    }

    // Apply Result Operation
    let postProcessed = combinedValues.map((val) => {
      switch (resultOp) {
        case 'none':
          return val;
        case 'negate':
          return -val;
        case 'abs':
          return Math.abs(val);
        case 'square':
          return val * val;
        case 'sqrt_abs':
          return Math.sqrt(Math.abs(val));
        case 'rectify':
          return Math.max(0, val);
        case 'normalize':
          return val;
        default:
          return val;
      }
    });

    if (resultOp === 'normalize') {
      const maxAbs = Math.max(1e-6, Math.max(...postProcessed.map(Math.abs)));
      postProcessed = postProcessed.map((v) => v / maxAbs);
    }

    // Apply Result Gain & DC Offset
    const finalResult = postProcessed.map((v) => resultGain * v + resultDcOffset);

    // Compute Result Statistics
    let sum = 0;
    let sumSq = 0;
    let maxVal = -Infinity;
    let minVal = Infinity;

    for (let i = 0; i < N; i++) {
      const v = finalResult[i];
      sum += v;
      sumSq += v * v;
      if (v > maxVal) maxVal = v;
      if (v < minVal) minVal = v;
    }

    const meanVal = sum / N;
    const rmsVal = Math.sqrt(sumSq / N);
    const peakVal = Math.max(Math.abs(maxVal), Math.abs(minVal));

    return {
      timePoints,
      slotArrays,
      finalResult,
      divisionGuardTriggered,
      guardedRegions,
      stats: {
        peak: peakVal,
        min: minVal,
        max: maxVal,
        mean: meanVal,
        rms: rmsVal,
      },
    };
  }, [slots, operators, resultOp, resultGain, resultDcOffset, timeWindowSec, sampleCount]);

  // Formatted Live Mathematical Expression
  const liveFormulaString = useMemo(() => {
    let expr = `x₁(t)`;
    for (let i = 1; i < slots.length; i++) {
      const opObj = OPERATOR_OPTIONS.find((o) => o.id === operators[i - 1]);
      const sym = opObj ? opObj.symbol : '+';
      if (opObj?.id === 'max' || opObj?.id === 'min' || opObj?.id === 'average') {
        expr = `${sym}(${expr}, x${i + 1}(t))`;
      } else {
        expr = `(${expr} ${sym} x${i + 1}(t))`;
      }
    }

    // Wrap with result operation
    switch (resultOp) {
      case 'negate':
        expr = `−(${expr})`;
        break;
      case 'abs':
        expr = `|${expr}|`;
        break;
      case 'square':
        expr = `(${expr})²`;
        break;
      case 'sqrt_abs':
        expr = `√|${expr}|`;
        break;
      case 'normalize':
        expr = `norm(${expr})`;
        break;
      case 'rectify':
        expr = `rect(${expr})`;
        break;
      default:
        break;
    }

    if (resultGain !== 1.0) {
      expr = `${resultGain}·${expr}`;
    }
    if (resultDcOffset !== 0.0) {
      expr = `${expr} ${resultDcOffset >= 0 ? '+' : '−'} ${Math.abs(resultDcOffset)}`;
    }

    return `y(t) = ${expr}`;
  }, [slots.length, operators, resultOp, resultGain, resultDcOffset]);

  // SVG Chart Layout Specifications
  const svgWidth = 800;
  const svgHeight = 240;
  const padLeft = 55;
  const padRight = 25;
  const padTop = 24;
  const padBottom = 34;
  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;

  const { timePoints, slotArrays, finalResult, divisionGuardTriggered, stats } = computedData;
  const tEnd = timeWindowSec;

  // Auto-scale Y for Input Plot
  const inputYLimit = useMemo(() => {
    let maxAbs = 0.5;
    slots.forEach((slot, idx) => {
      if (slot.visible) {
        const arr = slotArrays[idx];
        if (arr) {
          for (let i = 0; i < arr.length; i++) {
            const a = Math.abs(arr[i]);
            if (a > maxAbs) maxAbs = a;
          }
        }
      }
    });
    return Math.max(0.5, +(maxAbs * 1.25).toFixed(2));
  }, [slots, slotArrays]);

  // Auto-scale Y for Result Plot
  const resultYLimit = useMemo(() => {
    const maxAbs = Math.max(0.5, stats.peak);
    return Math.max(0.5, +(maxAbs * 1.25).toFixed(2));
  }, [stats.peak]);

  const getX = (t: number) => {
    return padLeft + (t / tEnd) * plotW;
  };

  const getYInput = (val: number) => {
    return padTop + plotH / 2 - (val / inputYLimit) * (plotH / 2);
  };

  const getYResult = (val: number) => {
    return padTop + plotH / 2 - (val / resultYLimit) * (plotH / 2);
  };

  // Sweep Index for Progressively Drawn Curves
  const sweepIndex = useMemo(() => {
    if (!isPlaying || timePoints.length === 0) return timePoints.length - 1;
    return Math.max(1, Math.min(timePoints.length - 1, Math.round(playProgress * (timePoints.length - 1))));
  }, [isPlaying, playProgress, timePoints.length]);

  const activeInspectionIndex = isPlaying ? sweepIndex : hoverIndex;

  return (
    <div className="space-y-5">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#2A7B73] text-white flex items-center justify-center font-bold text-sm shadow-xs">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-[#123A36] font-heading tracking-tight">
              Signal Combination & Operations
            </h2>
            <p className="text-xs text-[#123A36]/75">
              Combine up to 4 signals and see the result in synchronized dual plots.
            </p>
          </div>
        </div>

        {/* Live Mathematical Formula Pill */}
        <div className="self-start sm:self-auto bg-[#F3FAF7] border border-[#AAEED3] px-3 py-1.5 rounded-xl font-mono text-xs font-bold text-[#2A7B73] shadow-2xs">
          {liveFormulaString}
          <span className="block text-[10px] text-[#123A36]/60 font-sans font-normal mt-0.5">
            Evaluated left to right
          </span>
        </div>
      </div>

      {/* Shared Global Simulation Controls Bar */}
      <div className="bg-white rounded-[14px] p-3.5 shadow-sm border border-[#AAEED3]/50 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left: Time Window & Samples */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Time Window Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#123A36]/80">Window:</span>
            <div className="relative combiner-dropdown-container">
              <button
                type="button"
                onClick={(e) => toggleDropdown('shared_window_menu', e.currentTarget, 150)}
                className="px-2.5 py-1 rounded-lg bg-[#FAFCFB] border border-[#AAEED3] text-xs font-mono font-bold text-[#123A36] hover:bg-[#AAEED3]/20 flex items-center gap-1 shadow-2xs cursor-pointer focus-visible:ring-2 focus-visible:ring-[#2A7B73] focus:outline-none"
              >
                <span>{timeWindowSec}s</span>
                <ChevronDown className="w-3 h-3 text-[#2A7B73]" />
              </button>
              {activeMenuId === 'shared_window_menu' && (
                <div
                  className={`absolute left-0 ${
                    menuPlacement === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                  } w-24 bg-white rounded-xl shadow-xl border border-[#AAEED3] py-1 z-50`}
                >
                  {[0.1, 0.5, 1.0, 2.0].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => {
                        setTimeWindowSec(sec);
                        setActiveMenuId(null);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs font-mono flex items-center justify-between cursor-pointer ${
                        timeWindowSec === sec ? 'bg-[#AAEED3]/30 text-[#2A7B73] font-bold' : 'text-[#123A36] hover:bg-[#AAEED3]/15'
                      }`}
                    >
                      <span>{sec}s</span>
                      {timeWindowSec === sec && <Check className="w-3 h-3 text-[#2A7B73]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sample Count Selector */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#123A36]/80">Resolution:</span>
            <div className="relative combiner-dropdown-container">
              <button
                type="button"
                onClick={(e) => toggleDropdown('shared_samples_menu', e.currentTarget, 150)}
                className="px-2.5 py-1 rounded-lg bg-[#FAFCFB] border border-[#AAEED3] text-xs font-mono font-bold text-[#123A36] hover:bg-[#AAEED3]/20 flex items-center gap-1 shadow-2xs cursor-pointer focus-visible:ring-2 focus-visible:ring-[#2A7B73] focus:outline-none"
              >
                <span>{sampleCount} pts</span>
                <ChevronDown className="w-3 h-3 text-[#2A7B73]" />
              </button>
              {activeMenuId === 'shared_samples_menu' && (
                <div
                  className={`absolute left-0 ${
                    menuPlacement === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                  } w-28 bg-white rounded-xl shadow-xl border border-[#AAEED3] py-1 z-50`}
                >
                  {[500, 1000, 2000].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => {
                        setSampleCount(count);
                        setActiveMenuId(null);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs font-mono flex items-center justify-between cursor-pointer ${
                        sampleCount === count ? 'bg-[#AAEED3]/30 text-[#2A7B73] font-bold' : 'text-[#123A36] hover:bg-[#AAEED3]/15'
                      }`}
                    >
                      <span>{count} pts</span>
                      {sampleCount === count && <Check className="w-3 h-3 text-[#2A7B73]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Examples Preset Custom Dropdown */}
          <div className="relative combiner-dropdown-container">
            <button
              type="button"
              onClick={(e) => toggleDropdown('examples_menu', e.currentTarget, 220)}
              className="px-3 py-1.5 rounded-xl bg-[#F3FAF7] border border-[#AAEED3] text-xs font-semibold text-[#123A36] hover:bg-[#AAEED3]/30 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer focus-visible:ring-2 focus-visible:ring-[#2A7B73] focus:outline-none"
              aria-haspopup="menu"
              aria-expanded={activeMenuId === 'examples_menu'}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#55A9A0]" />
              <span>Examples</span>
              <ChevronDown className={`w-3.5 h-3.5 text-[#2A7B73] transition-transform ${activeMenuId === 'examples_menu' ? 'rotate-180' : ''}`} />
            </button>

            {activeMenuId === 'examples_menu' && (
              <div
                className={`absolute left-0 ${
                  menuPlacement === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                } w-64 bg-white rounded-xl shadow-xl border border-[#AAEED3] py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100`}
                role="menu"
              >
                {[
                  { id: 'beat_frequencies', label: 'Beat frequencies (two close sines, add)' },
                  { id: 'amplitude_modulation', label: 'Amplitude modulation (sine × sine)' },
                  { id: 'delayed_subtraction', label: 'Signal minus delayed copy (subtract)' },
                  { id: 'gated_sine', label: 'Gated sine (sine × square)' },
                  { id: 'harmonics_sum', label: 'Sum of 3 harmonics (add)' },
                ].map((ex) => (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => loadExample(ex.id)}
                    className="w-full text-left px-3.5 py-2 text-xs text-[#123A36] hover:bg-[#AAEED3]/20 transition-colors cursor-pointer"
                    role="menuitem"
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center / Right: Sweep Playback & Reset */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Play/Pause Button */}
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs text-white transition-all shadow-xs cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2A7B73]"
            style={{ backgroundColor: isPlaying ? 'var(--deep-teal)' : 'var(--teal)' }}
            title={isPlaying ? 'Pause synchronized sweep' : 'Start synchronized simulation sweep'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>{isPlaying ? 'Pause' : 'Play Sweep'}</span>
          </button>

          {/* Reset Sweep to Start */}
          <button
            type="button"
            onClick={() => setPlayProgress(0)}
            className="p-1.5 rounded-lg bg-[#F3FAF7] border border-[#AAEED3] text-[#2A7B73] hover:bg-[#AAEED3]/30 transition cursor-pointer"
            title="Reset sweep playhead to start"
            aria-label="Reset sweep playhead to start"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Speed Selector (0.5x, 1x, 2x) */}
          <div className="flex items-center rounded-lg bg-[#F3FAF7] border border-[#AAEED3] p-0.5 text-xs">
            {[0.5, 1.0, 2.0].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setPlaybackSpeed(s)}
                className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-semibold transition-all cursor-pointer ${
                  playbackSpeed === s
                    ? 'bg-[#2A7B73] text-white shadow-2xs'
                    : 'text-[#123A36]/80 hover:text-[#123A36]'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Reset Simulator to Defaults */}
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-[#123A36]/80 bg-white hover:bg-[#F3FAF7] border border-[#AAEED3]/70 hover:text-[#123A36] transition cursor-pointer"
            title="Reset combiner to default state"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#2A7B73]" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Row 1: Signal Slots (30%) & Overlaid Input Plot (70%) */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">
        {/* LEFT: Signal Slots (Controls) Card (30% Width on Desktop) */}
        <div className="w-full lg:w-[32%] xl:w-[30%] lg:shrink-0 bg-white rounded-[14px] p-4 sm:p-5 shadow-sm border border-[#AAEED3]/50 relative z-20 space-y-4">
            <div className="flex items-center justify-between border-b border-[#AAEED3]/40 pb-2.5">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#2A7B73]" />
                <h3 className="font-heading font-bold text-sm sm:text-base text-[#123A36]">
                  Signal Slots
                </h3>
              </div>
              <span className="text-[11px] font-mono text-[#2A7B73] bg-[#AAEED3]/30 px-2 py-0.5 rounded font-bold">
                {slots.length} / 4
              </span>
            </div>

            {/* Vertically Stacked Collapsible Rows with Slim Operator Connectors */}
            <div className="space-y-2.5">
              {slots.map((slot, idx) => {
                const isExpanded = !!expandedSlotIds[slot.id];
                const sigType = slot.params.signalType;
                const isPeriodic = ['sinusoidal', 'cosine', 'square', 'triangular', 'sawtooth'].includes(sigType);

                return (
                  <React.Fragment key={slot.id}>
                    <div
                      className="bg-[#FAFCFB] rounded-xl border border-[#AAEED3]/70 shadow-2xs overflow-visible transition-colors"
                    >
                      {/* Collapsed Row Header: Name and rotating chevron only */}
                      <button
                        type="button"
                        onClick={() => toggleSlotExpanded(slot.id)}
                        aria-expanded={isExpanded}
                        aria-controls={`slot-controls-${slot.id}`}
                        className="w-full p-3 flex items-center justify-between text-left hover:bg-[#AAEED3]/20 transition-all rounded-xl cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2A7B73]"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs"
                            style={{ backgroundColor: slot.color }}
                          />
                          <span className="font-mono font-bold text-xs text-[#123A36] truncate">
                            {slot.label}
                          </span>
                          {!isExpanded && (
                            <span className="text-[10px] text-[#123A36]/60 truncate font-mono">
                              ({sigType})
                            </span>
                          )}
                        </div>

                        <ChevronDown
                          className={`w-4 h-4 text-[#2A7B73] shrink-0 transition-transform duration-200 ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      {/* Expanded Controls: Full parameters directly underneath */}
                      {isExpanded && (
                        <div
                          id={`slot-controls-${slot.id}`}
                          className="px-3 pb-3.5 pt-1 space-y-3 border-t border-[#AAEED3]/40 animate-in fade-in duration-150"
                        >
                          {/* Slot Actions Bar: Gain, Visibility, Remove */}
                          <div className="flex items-center justify-between gap-2 pt-1">
                            <div className="flex items-center gap-1.5 text-xs font-mono">
                              <span className="text-[#123A36]/80 font-medium">Gain:</span>
                              <input
                                type="number"
                                step={0.1}
                                value={slot.gain}
                                onChange={(e) => updateSlot(idx, { gain: Number(e.target.value) || 0 })}
                                className="w-14 bg-white border border-[#AAEED3] rounded px-1.5 py-0.5 text-right font-mono text-xs text-[#123A36]"
                                title="Amplitude weight / multiplier"
                              />
                            </div>

                            <div className="flex items-center gap-1.5">
                              {/* Visibility Eye Toggle */}
                              <button
                                type="button"
                                onClick={() => updateSlot(idx, { visible: !slot.visible })}
                                className={`p-1.5 rounded-lg border transition cursor-pointer ${
                                  slot.visible
                                    ? 'bg-[#AAEED3]/40 border-[#AAEED3] text-[#2A7B73]'
                                    : 'bg-white border-gray-300 text-gray-400'
                                }`}
                                title={slot.visible ? 'Hide from input plot' : 'Show in input plot'}
                                aria-label={`Toggle visibility for ${slot.label}`}
                              >
                                {slot.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                              </button>

                              {/* Remove button (if > 2 slots) */}
                              {slots.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSlot(idx)}
                                  className="p-1.5 rounded-lg border border-rose-200 text-rose-500 hover:bg-rose-50 transition cursor-pointer"
                                  title="Remove this signal slot"
                                  aria-label={`Remove signal ${slot.label}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Waveform Custom Dropdown */}
                          <div className="relative combiner-dropdown-container">
                            <span className="text-[10px] text-[#123A36]/70 uppercase tracking-wider font-semibold block mb-1">
                              Waveform Type
                            </span>
                            <button
                              type="button"
                              onClick={(e) => toggleDropdown(`slot_wf_${idx}`, e.currentTarget, 260)}
                              className="w-full bg-white border border-[#AAEED3] rounded-lg px-2.5 py-1.5 text-xs text-[#123A36] font-bold hover:bg-[#AAEED3]/20 flex items-center justify-between shadow-2xs cursor-pointer focus-visible:ring-2 focus-visible:ring-[#2A7B73] focus:outline-none"
                            >
                              <span className="truncate pr-1">
                                {WAVEFORM_CATEGORIES.flatMap((c) => c.options).find((o) => o.value === sigType)?.label || sigType}
                              </span>
                              <ChevronDown className="w-3.5 h-3.5 text-[#2A7B73] shrink-0" />
                            </button>

                            {activeMenuId === `slot_wf_${idx}` && (
                              <div
                                className={`absolute left-0 right-0 ${
                                  menuPlacement === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                                } bg-white rounded-xl shadow-xl border border-[#AAEED3] py-1.5 z-50 max-h-60 overflow-y-auto`}
                              >
                                {WAVEFORM_CATEGORIES.map((cat, catIdx) => (
                                  <div key={cat.category}>
                                    <div className={`text-[10px] uppercase tracking-wider font-bold text-[#2A7B73] px-3 pt-1.5 pb-0.5 ${catIdx > 0 ? 'border-t border-[#AAEED3]/30 mt-1' : ''}`}>
                                      {cat.category}
                                    </div>
                                    {cat.options.map((opt) => (
                                      <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => {
                                          updateSlotParams(idx, { signalType: opt.value });
                                          setActiveMenuId(null);
                                        }}
                                        className={`w-full text-left px-3 py-1.5 text-[11.5px] flex items-center justify-between cursor-pointer ${
                                          sigType === opt.value
                                            ? 'bg-[#AAEED3]/30 text-[#2A7B73] font-bold'
                                            : 'text-[#123A36] hover:bg-[#AAEED3]/15'
                                        }`}
                                      >
                                        <span className="truncate pr-2">{opt.label}</span>
                                        {sigType === opt.value && <Check className="w-3 h-3 text-[#2A7B73]" />}
                                      </button>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Single-Column Compact Parameters for Narrow 30% Width */}
                          <div className="space-y-2.5 text-xs pt-1">
                            {/* Amplitude */}
                            <div>
                              <div className="flex justify-between mb-0.5">
                                <span className="text-[#123A36]/80 font-medium">Amplitude (A):</span>
                                <span className="font-mono font-bold text-[#2A7B73]">{slot.params.amplitude.toFixed(1)}V</span>
                              </div>
                              <input
                                type="range"
                                min={0.1}
                                max={5.0}
                                step={0.1}
                                value={slot.params.amplitude}
                                onChange={(e) => updateSlotParams(idx, { amplitude: Number(e.target.value) })}
                                className="w-full accent-[#2A7B73] cursor-pointer"
                              />
                            </div>

                            {/* Frequency (for Periodic, Sinc) */}
                            {['sinusoidal', 'cosine', 'square', 'triangular', 'sawtooth', 'sinc'].includes(sigType) && (
                              <div>
                                <div className="flex justify-between mb-0.5">
                                  <span className="text-[#123A36]/80 font-medium">Frequency (f):</span>
                                  <span className="font-mono font-bold text-[#2A7B73]">{slot.params.frequencyHz.toFixed(1)}Hz</span>
                                </div>
                                <input
                                  type="range"
                                  min={0.5}
                                  max={40.0}
                                  step={0.5}
                                  value={slot.params.frequencyHz}
                                  onChange={(e) => updateSlotParams(idx, { frequencyHz: Number(e.target.value) })}
                                  className="w-full accent-[#2A7B73] cursor-pointer"
                                />
                              </div>
                            )}

                            {/* Phase (Periodic) */}
                            {isPeriodic && (
                              <div>
                                <div className="flex justify-between mb-0.5">
                                  <span className="text-[#123A36]/80 font-medium">Phase (φ):</span>
                                  <span className="font-mono font-bold text-[#2A7B73]">{slot.params.phaseDegrees}°</span>
                                </div>
                                <input
                                  type="range"
                                  min={-180}
                                  max={180}
                                  step={15}
                                  value={slot.params.phaseDegrees}
                                  onChange={(e) => updateSlotParams(idx, { phaseDegrees: Number(e.target.value) })}
                                  className="w-full accent-[#2A7B73] cursor-pointer"
                                />
                              </div>
                            )}

                            {/* Time shift t0 (for Singularity, Pulses, Exp) */}
                            {['unit_step', 'impulse', 'ramp', 'rectangular_pulse'].includes(sigType) && (
                              <div>
                                <div className="flex justify-between mb-0.5">
                                  <span className="text-[#123A36]/80 font-medium">Shift (t₀):</span>
                                  <span className="font-mono font-bold text-[#2A7B73]">{slot.params.t0.toFixed(2)}s</span>
                                </div>
                                <input
                                  type="range"
                                  min={0.0}
                                  max={1.0}
                                  step={0.05}
                                  value={slot.params.t0}
                                  onChange={(e) => updateSlotParams(idx, { t0: Number(e.target.value) })}
                                  className="w-full accent-[#2A7B73] cursor-pointer"
                                />
                              </div>
                            )}

                            {/* Pulse Width (Rectangular pulse) */}
                            {sigType === 'rectangular_pulse' && (
                              <div>
                                <div className="flex justify-between mb-0.5">
                                  <span className="text-[#123A36]/80 font-medium">Width (τ):</span>
                                  <span className="font-mono font-bold text-[#2A7B73]">{slot.params.pulseWidthSeconds.toFixed(2)}s</span>
                                </div>
                                <input
                                  type="range"
                                  min={0.05}
                                  max={0.8}
                                  step={0.05}
                                  value={slot.params.pulseWidthSeconds}
                                  onChange={(e) => updateSlotParams(idx, { pulseWidthSeconds: Number(e.target.value) })}
                                  className="w-full accent-[#2A7B73] cursor-pointer"
                                />
                              </div>
                            )}

                            {/* Exponential Rate Alpha */}
                            {sigType === 'exponential' && (
                              <div>
                                <div className="flex justify-between mb-0.5">
                                  <span className="text-[#123A36]/80 font-medium">Rate (α):</span>
                                  <span className="font-mono font-bold text-[#2A7B73]">{slot.params.alpha.toFixed(1)}</span>
                                </div>
                                <input
                                  type="range"
                                  min={0.5}
                                  max={8.0}
                                  step={0.5}
                                  value={slot.params.alpha}
                                  onChange={(e) => updateSlotParams(idx, { alpha: Number(e.target.value) })}
                                  className="w-full accent-[#2A7B73] cursor-pointer"
                                />
                              </div>
                            )}

                            {/* DC Offset */}
                            <div>
                              <div className="flex justify-between mb-0.5">
                                <span className="text-[#123A36]/80 font-medium">DC Offset:</span>
                                <span className="font-mono font-bold text-[#2A7B73]">{slot.params.dcOffset.toFixed(1)}V</span>
                              </div>
                              <input
                                type="range"
                                min={-3.0}
                                max={3.0}
                                step={0.2}
                                value={slot.params.dcOffset}
                                onChange={(e) => updateSlotParams(idx, { dcOffset: Number(e.target.value) })}
                                className="w-full accent-[#2A7B73] cursor-pointer"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Slim Operator Connector Row between consecutive signals */}
                    {idx < slots.length - 1 && (
                      <div className="flex items-center justify-center my-1 relative z-30">
                        <div className="relative combiner-dropdown-container">
                          <button
                            type="button"
                            onClick={(e) => toggleDropdown(`op_chain_${idx}`, e.currentTarget, 220)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F3FAF7] border border-[#2A7B73]/40 text-xs font-bold text-[#2A7B73] hover:bg-[#AAEED3]/30 shadow-2xs transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2A7B73]"
                            title={`Operation between ${slot.label} and ${slots[idx + 1].label}`}
                            aria-label={`Operation between ${slot.label} and ${slots[idx + 1].label}`}
                            aria-haspopup="listbox"
                            aria-expanded={activeMenuId === `op_chain_${idx}`}
                          >
                            <span>{OPERATOR_OPTIONS.find((o) => o.id === (operators[idx] || 'add'))?.label || 'Add (+)'}</span>
                            <ChevronDown className={`w-3 h-3 text-[#2A7B73] transition-transform ${activeMenuId === `op_chain_${idx}` ? 'rotate-180' : ''}`} />
                          </button>

                          {activeMenuId === `op_chain_${idx}` && (
                            <div
                              className={`absolute left-1/2 -translate-x-1/2 ${
                                menuPlacement === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                              } w-44 bg-white rounded-xl shadow-xl border border-[#AAEED3] py-1 z-50 animate-in fade-in zoom-in-95 duration-100`}
                              role="listbox"
                            >
                              {OPERATOR_OPTIONS.map((op) => {
                                const isSelected = (operators[idx] || 'add') === op.id;
                                return (
                                  <button
                                    key={op.id}
                                    type="button"
                                    onClick={() => {
                                      updateOperator(idx, op.id);
                                      setActiveMenuId(null);
                                    }}
                                    className={`w-full text-left px-3.5 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                                      isSelected ? 'bg-[#AAEED3]/30 text-[#2A7B73] font-bold' : 'text-[#123A36] hover:bg-[#AAEED3]/15'
                                    }`}
                                    role="option"
                                    aria-selected={isSelected}
                                  >
                                    <span>{op.label}</span>
                                    {isSelected && <Check className="w-3.5 h-3.5 text-[#2A7B73]" />}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Add Signal Button below the list */}
            <div className="pt-2 border-t border-[#AAEED3]/40">
              <button
                type="button"
                onClick={handleAddSlot}
                disabled={slots.length >= 4}
                className={`w-full py-2 px-3 rounded-xl font-semibold text-xs border transition-all flex items-center justify-center gap-1.5 shadow-2xs ${
                  slots.length >= 4
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                    : 'bg-[#F3FAF7] hover:bg-[#AAEED3]/40 text-[#2A7B73] border-[#AAEED3] cursor-pointer'
                }`}
                title="Add another signal slot (max 4)"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add signal</span>
                <span className="ml-1 text-[11px] font-mono px-1.5 py-0.2 rounded bg-white border border-[#AAEED3]/80">
                  {slots.length} / 4
                </span>
              </button>
            </div>

            {/* Live Expression Block */}
            <div className="pt-2 border-t border-[#AAEED3]/40 space-y-2">
              <div className="bg-[#F3FAF7] border border-[#AAEED3] p-2.5 rounded-xl shadow-2xs">
                <div className="font-mono text-xs font-bold text-[#2A7B73] break-words overflow-x-auto whitespace-normal">
                  {liveFormulaString}
                </div>
                <span className="block text-[10px] text-[#123A36]/65 font-sans font-normal mt-1">
                  Evaluated left to right
                </span>
              </div>

              {/* Division Safety Note (shown only when division is limited) */}
              {divisionGuardTriggered && (
                <div className="p-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-800 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Division by near-zero was limited (|divisor| &lt; 10⁻⁴) to prevent mathematical divergence.</span>
                </div>
              )}
            </div>

            {/* Thin Divider */}
            <div className="border-t border-[#AAEED3]/40 my-3" />

            {/* Result Post-Processing Section */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-[#123A36] uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-[#2A7B73]" /> Result
              </span>

              {/* Result Operation Dropdown */}
              <div>
                <label className="text-[11px] text-[#123A36]/80 font-medium block mb-1">
                  Result Operation:
                </label>
                <div className="relative combiner-dropdown-container">
                  <button
                    type="button"
                    onClick={(e) => toggleDropdown('controls_result_op', e.currentTarget, 220)}
                    className="w-full px-3 py-1.5 rounded-xl bg-[#FAFCFB] border border-[#AAEED3] font-bold text-xs text-[#123A36] hover:bg-[#AAEED3]/20 flex items-center justify-between shadow-2xs cursor-pointer focus-visible:ring-2 focus-visible:ring-[#2A7B73] focus:outline-none"
                    aria-haspopup="listbox"
                    aria-expanded={activeMenuId === 'controls_result_op'}
                  >
                    <span className="truncate pr-1">
                      {RESULT_OP_OPTIONS.find((r) => r.id === resultOp)?.label || 'None'}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-[#2A7B73] shrink-0 transition-transform ${activeMenuId === 'controls_result_op' ? 'rotate-180' : ''}`} />
                  </button>

                  {activeMenuId === 'controls_result_op' && (
                    <div
                      className={`absolute left-0 right-0 ${
                        menuPlacement === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                      } bg-white rounded-xl shadow-xl border border-[#AAEED3] py-1 z-50`}
                      role="listbox"
                    >
                      {RESULT_OP_OPTIONS.map((opt) => {
                        const isSelected = resultOp === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setResultOp(opt.id);
                              setActiveMenuId(null);
                            }}
                            className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                              isSelected ? 'bg-[#AAEED3]/30 text-[#2A7B73] font-bold' : 'text-[#123A36] hover:bg-[#AAEED3]/15'
                            }`}
                            role="option"
                            aria-selected={isSelected}
                          >
                            <span>{opt.label}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-[#2A7B73]" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Result Gain and Result Offset side by side */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[11px] text-[#123A36]/80 font-medium block mb-1">
                    Result Gain:
                  </label>
                  <input
                    type="number"
                    step={0.1}
                    value={resultGain}
                    onChange={(e) => setResultGain(Number(e.target.value) || 1)}
                    className="w-full bg-[#FAFCFB] border border-[#AAEED3] rounded-lg px-2.5 py-1 font-mono text-xs text-[#123A36] focus-visible:ring-2 focus-visible:ring-[#2A7B73] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-[#123A36]/80 font-medium block mb-1">
                    Result Offset:
                  </label>
                  <input
                    type="number"
                    step={0.1}
                    value={resultDcOffset}
                    onChange={(e) => setResultDcOffset(Number(e.target.value) || 0)}
                    className="w-full bg-[#FAFCFB] border border-[#AAEED3] rounded-lg px-2.5 py-1 font-mono text-xs text-[#123A36] focus-visible:ring-2 focus-visible:ring-[#2A7B73] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Input Signals Plot Card (70% Width on Desktop, Sticky Top) */}
          <div className="w-full lg:flex-1 min-w-0 lg:sticky lg:top-4 bg-white rounded-[14px] p-4 sm:p-5 shadow-sm border border-[#AAEED3]/50 transition-colors space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#AAEED3]/40">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0891B2]" />
                <h3 className="font-heading font-bold text-sm sm:text-base text-[#123A36]">
                  Input Signals Overlaid x_i(t)
                </h3>
              </div>

              {/* Interactive Legend with Visibility Swatches */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {slots.map((slot, idx) => (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => updateSlot(idx, { visible: !slot.visible })}
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border font-mono transition cursor-pointer ${
                      slot.visible
                        ? 'bg-[#F3FAF7] border-[#AAEED3] text-[#123A36]'
                        : 'bg-gray-50 border-gray-200 text-gray-400 opacity-60 line-through'
                    }`}
                    title={`Click to ${slot.visible ? 'hide' : 'show'} ${slot.label}`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: slot.color }} />
                    <span>{slot.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* SVG Plot Canvas */}
            <div className="relative w-full bg-[#FAFCFB] rounded-xl p-2 border border-[#AAEED3]/60 shadow-2xs overflow-hidden">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full h-56 sm:h-64 overflow-visible cursor-crosshair"
                onMouseMove={(e) => {
                  if (isPlaying) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const relX = (e.clientX - rect.left - (padLeft / svgWidth) * rect.width) / ((plotW / svgWidth) * rect.width);
                  const clamped = Math.max(0, Math.min(1, relX));
                  const idx = Math.min(timePoints.length - 1, Math.max(0, Math.round(clamped * (timePoints.length - 1))));
                  setHoverIndex(idx);
                }}
                onMouseLeave={() => setHoverIndex(null)}
              >
                {/* Grid Lines */}
                <line x1={padLeft} y1={padTop} x2={svgWidth - padRight} y2={padTop} stroke="#E2E8F0" strokeDasharray="3 3" />
                <line x1={padLeft} y1={padTop + plotH / 2} x2={svgWidth - padRight} y2={padTop + plotH / 2} stroke="#CBD5E1" strokeWidth="1.2" />
                <line x1={padLeft} y1={padTop + plotH} x2={svgWidth - padRight} y2={padTop + plotH} stroke="#E2E8F0" strokeDasharray="3 3" />

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

                {/* Zero line */}
                <line
                  x1={padLeft}
                  y1={getYInput(0)}
                  x2={svgWidth - padRight}
                  y2={getYInput(0)}
                  stroke="#55A9A0"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />

                {/* Render Input Curves */}
                {slots.map((slot, sIdx) => {
                  if (!slot.visible) return null;
                  const arr = slotArrays[sIdx];
                  if (!arr || arr.length === 0) return null;

                  const fullPoints = timePoints.map((t, i) => `${getX(t).toFixed(1)},${getYInput(arr[i]).toFixed(1)}`).join(' ');
                  const activePoints = isPlaying
                    ? timePoints.slice(0, sweepIndex + 1).map((t, i) => `${getX(t).toFixed(1)},${getYInput(arr[i]).toFixed(1)}`).join(' ')
                    : fullPoints;

                  return (
                    <g key={slot.id}>
                      {isPlaying && (
                        <polyline
                          fill="none"
                          stroke={slot.color}
                          strokeWidth="1.2"
                          strokeOpacity="0.25"
                          points={fullPoints}
                        />
                      )}
                      <polyline
                        fill="none"
                        stroke={slot.color}
                        strokeWidth={isPlaying ? 2.2 : 2.0}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={activePoints}
                      />
                      {activeInspectionIndex !== null && activeInspectionIndex < arr.length && (
                        <circle
                          cx={getX(timePoints[activeInspectionIndex])}
                          cy={getYInput(arr[activeInspectionIndex])}
                          r={4}
                          fill={slot.color}
                          stroke="#FFFFFF"
                          strokeWidth="1.5"
                        />
                      )}
                    </g>
                  );
                })}

                {/* Synchronized Inspection Cursor Line */}
                {activeInspectionIndex !== null && activeInspectionIndex < timePoints.length && (
                  <line
                    x1={getX(timePoints[activeInspectionIndex])}
                    y1={padTop}
                    x2={getX(timePoints[activeInspectionIndex])}
                    y2={padTop + plotH}
                    stroke="#123A36"
                    strokeWidth="1.2"
                    strokeDasharray="3 3"
                  />
                )}

                {/* Y Axis Labels */}
                <text x={padLeft - 8} y={padTop + 4} textAnchor="end" className="text-[10px] fill-[#123A36]/70 font-mono">
                  +{inputYLimit.toFixed(1)}V
                </text>
                <text x={padLeft - 8} y={getYInput(0) + 3} textAnchor="end" className="text-[10px] fill-[#123A36]/70 font-mono">
                  0V
                </text>
                <text x={padLeft - 8} y={padTop + plotH} textAnchor="end" className="text-[10px] fill-[#123A36]/70 font-mono">
                  -{inputYLimit.toFixed(1)}V
                </text>

                {/* X Axis Labels */}
                <text x={padLeft} y={padTop + plotH + 16} textAnchor="start" className="text-[10px] fill-[#123A36]/70 font-mono">
                  0.00s
                </text>
                <text x={padLeft + plotW / 2} y={padTop + plotH + 16} textAnchor="middle" className="text-[10px] fill-[#123A36]/70 font-mono">
                  {(tEnd / 2).toFixed(2)}s
                </text>
                <text x={padLeft + plotW} y={padTop + plotH + 16} textAnchor="end" className="text-[10px] fill-[#123A36]/70 font-mono">
                  {tEnd.toFixed(2)}s
                </text>
              </svg>

              {/* Synchronized Hover / Sweep Tooltip */}
              {activeInspectionIndex !== null && activeInspectionIndex < timePoints.length && (
                <div className="absolute top-2.5 right-3 bg-[#123A36]/95 text-white px-3 py-1.5 rounded-lg text-xs font-mono shadow-md border border-[#2A7B73] pointer-events-none flex flex-wrap items-center gap-2">
                  <span className="text-[#AAEED3]">t = {timePoints[activeInspectionIndex].toFixed(3)}s</span>
                  {slots.map((s, idx) => (
                    s.visible && slotArrays[idx] && (
                      <span key={s.id} style={{ color: s.color }} className="font-semibold">
                        {s.label} = {slotArrays[idx][activeInspectionIndex].toFixed(2)}V
                      </span>
                    )
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      {/* Result Simulation Card */}
          <div className="bg-white rounded-[14px] p-5 shadow-sm border border-[#AAEED3]/50 transition-colors space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#AAEED3]/40">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#123A36]" />
                <h3 className="font-heading font-bold text-sm sm:text-base text-[#123A36]">
                  Combined Result y(t)
                </h3>
                <span className="font-mono text-xs text-[#2A7B73] font-bold hidden sm:inline">
                  {liveFormulaString}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Show inputs in result toggle */}
                <label className="flex items-center gap-1.5 text-xs text-[#123A36] font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showInputsInResult}
                    onChange={(e) => setShowInputsInResult(e.target.checked)}
                    className="accent-[#2A7B73]"
                  />
                  <span>Show inputs</span>
                </label>

                {/* Quick Result Statistics Pills */}
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                  <span className="px-2 py-0.5 rounded-md bg-[#F3FAF7] border border-[#AAEED3] text-[#123A36]">
                    Peak: <strong>{stats.peak.toFixed(2)}V</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-[#F3FAF7] border border-[#AAEED3] text-[#123A36]">
                    Min: <strong>{stats.min.toFixed(2)}V</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-[#F3FAF7] border border-[#AAEED3] text-[#123A36]">
                    Mean: <strong>{stats.mean.toFixed(2)}V</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-[#AAEED3]/40 border border-[#AAEED3] text-[#2A7B73] font-bold">
                    RMS: <strong>{stats.rms.toFixed(2)}V</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* SVG Result Plot Canvas */}
            <div className="relative w-full bg-[#FAFCFB] rounded-xl p-2 border border-[#AAEED3]/60 shadow-2xs overflow-hidden">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full h-56 sm:h-64 overflow-visible cursor-crosshair"
                onMouseMove={(e) => {
                  if (isPlaying) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const relX = (e.clientX - rect.left - (padLeft / svgWidth) * rect.width) / ((plotW / svgWidth) * rect.width);
                  const clamped = Math.max(0, Math.min(1, relX));
                  const idx = Math.min(timePoints.length - 1, Math.max(0, Math.round(clamped * (timePoints.length - 1))));
                  setHoverIndex(idx);
                }}
                onMouseLeave={() => setHoverIndex(null)}
              >
                {/* Grid lines aligned vertically with input plot */}
                <line x1={padLeft} y1={padTop} x2={svgWidth - padRight} y2={padTop} stroke="#E2E8F0" strokeDasharray="3 3" />
                <line x1={padLeft} y1={padTop + plotH / 2} x2={svgWidth - padRight} y2={padTop + plotH / 2} stroke="#CBD5E1" strokeWidth="1.2" />
                <line x1={padLeft} y1={padTop + plotH} x2={svgWidth - padRight} y2={padTop + plotH} stroke="#E2E8F0" strokeDasharray="3 3" />

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

                {/* Zero line */}
                <line
                  x1={padLeft}
                  y1={getYResult(0)}
                  x2={svgWidth - padRight}
                  y2={getYResult(0)}
                  stroke="#55A9A0"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />

                {/* Optional background input signals (faintly rendered if toggled on) */}
                {showInputsInResult &&
                  slots.map((slot, sIdx) => {
                    const arr = slotArrays[sIdx];
                    if (!arr || arr.length === 0) return null;
                    const points = timePoints.map((t, i) => `${getX(t).toFixed(1)},${getYResult(arr[i]).toFixed(1)}`).join(' ');
                    return (
                      <polyline
                        key={`bg_slot_${slot.id}`}
                        fill="none"
                        stroke={slot.color}
                        strokeWidth="1"
                        strokeOpacity="0.25"
                        strokeDasharray="3 2"
                        points={points}
                      />
                    );
                  })}

                {/* Result Curve y(t) */}
                {finalResult.length > 0 && (() => {
                  const fullPoints = timePoints.map((t, i) => `${getX(t).toFixed(1)},${getYResult(finalResult[i]).toFixed(1)}`).join(' ');
                  const activePoints = isPlaying
                    ? timePoints.slice(0, sweepIndex + 1).map((t, i) => `${getX(t).toFixed(1)},${getYResult(finalResult[i]).toFixed(1)}`).join(' ')
                    : fullPoints;

                  return (
                    <g>
                      {isPlaying && (
                        <polyline
                          fill="none"
                          stroke="#2A7B73"
                          strokeWidth="1.4"
                          strokeOpacity="0.2"
                          points={fullPoints}
                        />
                      )}
                      <polyline
                        fill="none"
                        stroke="#123A36"
                        strokeWidth={isPlaying ? 2.6 : 2.4}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={activePoints}
                      />
                      {activeInspectionIndex !== null && activeInspectionIndex < finalResult.length && (
                        <circle
                          cx={getX(timePoints[activeInspectionIndex])}
                          cy={getYResult(finalResult[activeInspectionIndex])}
                          r={5}
                          fill="#FFF6B0"
                          stroke="#123A36"
                          strokeWidth="2"
                        />
                      )}
                    </g>
                  );
                })()}

                {/* Synchronized Inspection Cursor Line */}
                {activeInspectionIndex !== null && activeInspectionIndex < timePoints.length && (
                  <line
                    x1={getX(timePoints[activeInspectionIndex])}
                    y1={padTop}
                    x2={getX(timePoints[activeInspectionIndex])}
                    y2={padTop + plotH}
                    stroke="#123A36"
                    strokeWidth="1.2"
                    strokeDasharray="3 3"
                  />
                )}

                {/* Y Axis Labels */}
                <text x={padLeft - 8} y={padTop + 4} textAnchor="end" className="text-[10px] fill-[#123A36]/70 font-mono">
                  +{resultYLimit.toFixed(1)}V
                </text>
                <text x={padLeft - 8} y={getYResult(0) + 3} textAnchor="end" className="text-[10px] fill-[#123A36]/70 font-mono">
                  0V
                </text>
                <text x={padLeft - 8} y={padTop + plotH} textAnchor="end" className="text-[10px] fill-[#123A36]/70 font-mono">
                  -{resultYLimit.toFixed(1)}V
                </text>

                {/* X Axis Labels */}
                <text x={padLeft} y={padTop + plotH + 16} textAnchor="start" className="text-[10px] fill-[#123A36]/70 font-mono">
                  0.00s
                </text>
                <text x={padLeft + plotW / 2} y={padTop + plotH + 16} textAnchor="middle" className="text-[10px] fill-[#123A36]/70 font-mono">
                  {(tEnd / 2).toFixed(2)}s
                </text>
                <text x={padLeft + plotW} y={padTop + plotH + 16} textAnchor="end" className="text-[10px] fill-[#123A36]/70 font-mono">
                  {tEnd.toFixed(2)}s
                </text>
              </svg>

              {/* Synchronized Hover / Sweep Tooltip */}
              {activeInspectionIndex !== null && activeInspectionIndex < timePoints.length && (
                <div className="absolute top-2.5 right-3 bg-[#123A36]/95 text-white px-3 py-1.5 rounded-lg text-xs font-mono shadow-md border border-[#2A7B73] pointer-events-none flex items-center gap-2">
                  <span className="text-[#AAEED3]">t = {timePoints[activeInspectionIndex].toFixed(3)}s</span>
                  <span>&bull;</span>
                  <span>y(t) = <strong className="text-amber-300 font-bold">{finalResult[activeInspectionIndex].toFixed(3)}V</strong></span>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    };
