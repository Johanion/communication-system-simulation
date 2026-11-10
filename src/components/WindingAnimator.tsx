/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { computeWindingPhasor, WindingState } from '../math/fourier';
import { Play, Pause, RotateCcw, FastForward, Info, Target, Sparkles } from 'lucide-react';

interface WindingAnimatorProps {
  signal: number[];
  sampleRate: number;
  detectedPeaks: number[];
}

export const WindingAnimator: React.FC<WindingAnimatorProps> = ({
  signal,
  sampleRate,
  detectedPeaks,
}) => {
  const nyquist = sampleRate / 2;
  const [windingFreq, setWindingFreq] = useState<number>(5.0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [sweepSpeed, setSweepSpeed] = useState<number>(0.5); // Hz per second
  const [maxSampleIndex, setMaxSampleIndex] = useState<number>(signal.length);
  const [showTrail, setShowTrail] = useState<boolean>(true);

  // Compute winding state for current frequency
  const fullWindingState = computeWindingPhasor(signal, windingFreq, sampleRate);

  // Filter points according to sample progress stepper
  const visiblePoints = fullWindingState.points.slice(0, maxSampleIndex);

  // Recompute visible center of mass if stepping through samples
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < visiblePoints.length; i++) {
    sumX += visiblePoints[i].x;
    sumY += visiblePoints[i].y;
  }
  const count = visiblePoints.length || 1;
  const currentComX = sumX / count;
  const currentComY = sumY / count;
  const currentComMag = Math.sqrt(currentComX * currentComX + currentComY * currentComY);

  // Pre-calculate full spectrum curve for the right-hand panel
  const spectrumPoints = useMemo<{ f: number; mag: number }[]>(() => {
    const steps = 120;
    const pts: { f: number; mag: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const f = (i / steps) * nyquist;
      const state = computeWindingPhasor(signal, f, sampleRate);
      pts.push({ f, mag: state.centerOfMass.magnitude });
    }
    return pts;
  }, [signal, sampleRate, nyquist]);

  // Animation frame loop for sweeping frequency
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const dt = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      if (isPlaying) {
        setWindingFreq((prev) => {
          let next = prev + sweepSpeed * dt * 4;
          if (next > nyquist) {
            next = 0;
          }
          return +next.toFixed(2);
        });
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, sweepSpeed, nyquist]);

  // Keep maxSampleIndex in bounds when signal length changes
  useEffect(() => {
    setMaxSampleIndex(signal.length);
  }, [signal.length]);

  // Dimensions for Complex Plane SVG
  const planeSize = 360;
  const planeCenter = planeSize / 2;
  // Dynamic scale so signal fits comfortably
  const maxSignalAmp = Math.max(...signal.map(Math.abs), 1);
  const planeScale = (planeSize * 0.42) / (maxSignalAmp * 1.25);

  const toSvgX = (x: number) => planeCenter + x * planeScale;
  const toSvgY = (y: number) => planeCenter - y * planeScale; // Invert SVG y

  // Generate SVG path for the winding line
  const windingPath = visiblePoints.reduce((acc, pt, idx) => {
    const sx = toSvgX(pt.x).toFixed(1);
    const sy = toSvgY(pt.y).toFixed(1);
    return idx === 0 ? `M ${sx},${sy}` : `${acc} L ${sx},${sy}`;
  }, '');

  // Dimensions for spectrum tracker plot
  const specW = 440;
  const specH = 260;
  const specPadL = 50;
  const specPadR = 20;
  const specPadT = 20;
  const specPadB = 35;
  const specPlotW = specW - specPadL - specPadR;
  const specPlotH = specH - specPadT - specPadB;

  const maxSpecMag = Math.max(...spectrumPoints.map((p) => p.mag), 0.5) * 1.15;
  const getSpecX = (f: number) => specPadL + (f / (nyquist || 1)) * specPlotW;
  const getSpecY = (mag: number) => specPadT + specPlotH - (mag / (maxSpecMag || 1)) * specPlotH;

  const specPath = spectrumPoints.reduce((acc, pt, idx) => {
    const sx = getSpecX(pt.f).toFixed(1);
    const sy = getSpecY(pt.mag).toFixed(1);
    return idx === 0 ? `M ${sx},${sy}` : `${acc} L ${sx},${sy}`;
  }, '');

  return (
    <div className="space-y-6">
      {/* Intro Banner Card */}
      <div className="bg-white rounded-[14px] p-5 shadow-sm border border-[#AAEED3]/50">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-[#2A7B73]" />
              <h2 className="text-xl font-bold text-[#123A36]">
                The Winding Machine: How the Transform Actually Works
              </h2>
            </div>
            <p className="text-sm text-[#123A36]/80 leading-relaxed">
              Wrap the time signal <span className="font-mono text-[#55A9A0] font-semibold">x(t)</span>{' '}
              around the complex circle at test frequency{' '}
              <span className="font-mono text-[#2A7B73] font-semibold">f_wind</span> via{' '}
              <span className="font-mono font-medium">z(t) = x(t) &middot; e^{`{-j 2π f t}`}</span>.
              The <strong className="text-[#123A36]">Center of Mass</strong> is the exact Fourier Transform coefficient! When the winding frequency matches a frequency in your signal, all the points gather on one side, pulling the center of mass away from the origin.
            </p>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex flex-col gap-1 bg-[#F3FAF7] px-4 py-3 rounded-xl border border-[#AAEED3]">
            <span className="text-xs font-semibold text-[#2A7B73]">Current Test Frequency</span>
            <span className="font-mono text-2xl font-bold text-[#123A36]">{windingFreq.toFixed(2)} Hz</span>
            <span className="text-xs text-[#123A36]/70">
              Center of Mass Mag: <strong className="font-mono text-[#2A7B73]">{currentComMag.toFixed(3)}</strong>
            </span>
          </div>
        </div>

        {/* Snap to Peak shortcuts */}
        {detectedPeaks.length > 0 && (
          <div className="mt-4 pt-3 border-t border-[#AAEED3]/40 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[#123A36] flex items-center gap-1">
              <Target className="w-3.5 h-3.5 text-[#2A7B73]" /> Snap to Resonance:
            </span>
            {detectedPeaks.map((peak) => (
              <button
                key={`snap-${peak}`}
                type="button"
                onClick={() => {
                  setWindingFreq(peak);
                  setIsPlaying(false);
                }}
                className="px-2.5 py-1 text-xs font-mono font-semibold rounded-lg border transition-all duration-200"
                style={{
                  backgroundColor: Math.abs(windingFreq - peak) < 0.2 ? 'var(--pale-yellow)' : 'white',
                  borderColor: 'var(--deep-teal)',
                  color: 'var(--text-dark-teal)',
                }}
              >
                {peak.toFixed(1)} Hz {Math.abs(windingFreq - peak) < 0.2 ? '(Resonant)' : ''}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Dual Interactive Canvas View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Complex Plane Winding View */}
        <div className="bg-white rounded-[14px] p-5 shadow-sm border border-[#AAEED3]/50 flex flex-col items-center">
          <div className="w-full flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--teal)' }} />
              <h3 className="font-bold text-base text-[#123A36]">Complex Winding Plane</h3>
            </div>
            <span className="text-xs font-mono text-[#2A7B73] bg-[#AAEED3]/30 px-2 py-0.5 rounded border border-[#AAEED3]">
              Re &bull; Im Coordinates
            </span>
          </div>

          <div className="relative w-full max-w-[360px] aspect-square my-2">
            <svg
              viewBox={`0 0 ${planeSize} ${planeSize}`}
              className="w-full h-full select-none overflow-visible"
              role="img"
              aria-label="Phasor winding trajectory in the complex plane"
            >
              {/* Complex plane background */}
              <circle
                cx={planeCenter}
                cy={planeCenter}
                r={planeSize * 0.45}
                fill="#FAFCFB"
                stroke="#AAEED3"
                strokeWidth="1"
                strokeDasharray="4 4"
                strokeOpacity="0.8"
              />

              {/* Concentric reference rings */}
              {[0.25, 0.5, 0.75, 1.0].map((ring) => (
                <circle
                  key={`ring-${ring}`}
                  cx={planeCenter}
                  cy={planeCenter}
                  r={(planeSize * 0.42 * ring * maxSignalAmp) / (maxSignalAmp * 1.25)}
                  fill="none"
                  stroke="#AAEED3"
                  strokeWidth="0.8"
                  strokeDasharray="2 2"
                  strokeOpacity="0.5"
                />
              ))}

              {/* Real Axis (Horizontal) */}
              <line
                x1={15}
                y1={planeCenter}
                x2={planeSize - 15}
                y2={planeCenter}
                stroke="#2A7B73"
                strokeWidth="1.2"
                strokeOpacity="0.6"
              />
              <text
                x={planeSize - 12}
                y={planeCenter - 6}
                textAnchor="end"
                className="font-mono text-[10px] fill-[#2A7B73] font-semibold"
              >
                +Real
              </text>

              {/* Imaginary Axis (Vertical) */}
              <line
                x1={planeCenter}
                y1={15}
                x2={planeCenter}
                y2={planeSize - 15}
                stroke="#2A7B73"
                strokeWidth="1.2"
                strokeOpacity="0.6"
              />
              <text
                x={planeCenter + 6}
                y={24}
                className="font-mono text-[10px] fill-[#2A7B73] font-semibold"
              >
                +j Im
              </text>

              {/* The Winding Curve (Teal: #55A9A0) */}
              {showTrail && windingPath && (
                <path
                  d={windingPath}
                  fill="none"
                  stroke="var(--teal)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeOpacity="0.85"
                />
              )}

              {/* Plotted sample points */}
              {visiblePoints.map((pt, i) => {
                const isLast = i === visiblePoints.length - 1;
                return (
                  <circle
                    key={`wpt-${i}`}
                    cx={toSvgX(pt.x)}
                    cy={toSvgY(pt.y)}
                    r={isLast ? 4 : 2}
                    fill={isLast ? 'var(--pale-yellow)' : 'var(--teal)'}
                    stroke="var(--deep-teal)"
                    strokeWidth={isLast ? 2 : 0.6}
                  />
                );
              })}

              {/* Center of Mass Vector Line from Origin */}
              <line
                x1={planeCenter}
                y1={planeCenter}
                x2={toSvgX(currentComX)}
                y2={toSvgY(currentComY)}
                stroke="var(--deep-teal)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* Center of Mass Marker (Pale Yellow with Deep Teal border) */}
              <circle
                cx={toSvgX(currentComX)}
                cy={toSvgY(currentComY)}
                r={7}
                fill="var(--pale-yellow)"
                stroke="var(--deep-teal)"
                strokeWidth="2.5"
                className="animate-pulse"
              />

              {/* Center of Mass label text */}
              <g
                transform={`translate(${toSvgX(currentComX) + 10}, ${toSvgY(currentComY) - 10})`}
              >
                <rect
                  width="110"
                  height="28"
                  rx="4"
                  fill="white"
                  stroke="var(--deep-teal)"
                  strokeWidth="1.2"
                  className="shadow-sm"
                />
                <text
                  x="55"
                  y="12"
                  textAnchor="middle"
                  className="font-mono text-[9px] fill-[#2A7B73] font-bold"
                >
                  Center of Mass
                </text>
                <text
                  x="55"
                  y="22"
                  textAnchor="middle"
                  className="font-mono text-[9px] fill-[#123A36]"
                >
                  |X| = {currentComMag.toFixed(3)}
                </text>
              </g>
            </svg>
          </div>

          {/* Readout stats */}
          <div className="w-full grid grid-cols-2 gap-2 mt-2 text-xs">
            <div className="bg-[#F3FAF7] p-2 rounded-lg border border-[#AAEED3]/50 text-center">
              <span className="text-[#2A7B73] block text-[11px]">Center of Mass (X, Y)</span>
              <span className="font-mono font-bold text-[#123A36]">
                ({currentComX.toFixed(2)}, {currentComY.toFixed(2)})
              </span>
            </div>
            <div className="bg-[#F3FAF7] p-2 rounded-lg border border-[#AAEED3]/50 text-center">
              <span className="text-[#2A7B73] block text-[11px]">Fourier Mag at {windingFreq.toFixed(1)}Hz</span>
              <span className="font-mono font-bold text-[#123A36]">
                {(currentComMag * 2).toFixed(2)} normalized
              </span>
            </div>
          </div>
        </div>

        {/* Right: Real-time Spectrum Trace */}
        <div className="bg-white rounded-[14px] p-5 shadow-sm border border-[#AAEED3]/50 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--deep-teal)' }} />
                <h3 className="font-bold text-base text-[#123A36]">
                  Center of Mass Distance vs Winding Frequency
                </h3>
              </div>
              <span className="text-xs font-mono text-[#2A7B73] bg-[#AAEED3]/30 px-2 py-0.5 rounded border border-[#AAEED3]">
                Sweeping 0 &rarr; {nyquist} Hz
              </span>
            </div>
            <p className="text-xs text-[#123A36]/70 mb-3">
              Notice how the center-of-mass distance matches the peaks of the Fourier Transform exactly!
            </p>
          </div>

          <div className="relative w-full aspect-[4/2.5]">
            <svg
              viewBox={`0 0 ${specW} ${specH}`}
              className="w-full h-full select-none overflow-visible"
              role="img"
              aria-label="Spectrum magnitude trace"
            >
              {/* Background */}
              <rect
                x={specPadL}
                y={specPadT}
                width={specPlotW}
                height={specPlotH}
                fill="#FAFCFB"
                rx={6}
                stroke="#AAEED3"
                strokeWidth="1"
              />

              {/* Gridlines */}
              {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                const f = pct * nyquist;
                const xPos = getSpecX(f);
                return (
                  <g key={`sf-${pct}`}>
                    <line
                      x1={xPos}
                      y1={specPadT}
                      x2={xPos}
                      y2={specPadT + specPlotH}
                      stroke="#AAEED3"
                      strokeWidth="1"
                      strokeDasharray="2 2"
                    />
                    <text
                      x={xPos}
                      y={specPadT + specPlotH + 15}
                      textAnchor="middle"
                      className="font-mono text-[9px] fill-[#2A7B73]"
                    >
                      {f.toFixed(0)}Hz
                    </text>
                  </g>
                );
              })}

              {/* Y Gridlines */}
              {[0, 0.5, 1].map((pct) => {
                const val = pct * maxSpecMag;
                const yPos = getSpecY(val);
                return (
                  <g key={`sm-${pct}`}>
                    <line
                      x1={specPadL}
                      y1={yPos}
                      x2={specPadL + specPlotW}
                      y2={yPos}
                      stroke="#AAEED3"
                      strokeWidth="1"
                      strokeDasharray="2 2"
                    />
                    <text
                      x={specPadL - 6}
                      y={yPos + 3}
                      textAnchor="end"
                      className="font-mono text-[9px] fill-[#2A7B73]"
                    >
                      {val.toFixed(1)}
                    </text>
                  </g>
                );
              })}

              {/* Spectrum Envelope Curve (Deep Teal: #2A7B73) */}
              {specPath && (
                <path
                  d={specPath}
                  fill="none"
                  stroke="var(--deep-teal)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              )}

              {/* Vertical line indicator at current winding frequency */}
              <line
                x1={getSpecX(windingFreq)}
                y1={specPadT}
                x2={getSpecX(windingFreq)}
                y2={specPadT + specPlotH}
                stroke="var(--deep-teal)"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />

              {/* Active current point on spectrum (Pale yellow fill + Deep teal border) */}
              <circle
                cx={getSpecX(windingFreq)}
                cy={getSpecY(currentComMag)}
                r={6}
                fill="var(--pale-yellow)"
                stroke="var(--deep-teal)"
                strokeWidth="2"
              />
            </svg>
          </div>

          {/* Explanation Callout */}
          <div className="mt-3 bg-[#AAEED3]/25 p-3 rounded-xl border border-[#AAEED3] text-xs text-[#123A36] flex items-start gap-2">
            <Info className="w-4 h-4 text-[#2A7B73] shrink-0 mt-0.5" />
            <span>
              <strong>Intuition check:</strong> When{' '}
              <span className="font-mono font-semibold text-[#2A7B73]">f_wind</span> does not match any component, the points wrap in a balanced symmetric polygon around the origin, so their center is 0. Only at resonance does the center pull away!
            </span>
          </div>
        </div>
      </div>

      {/* Animation Controls Bar */}
      <div className="bg-white rounded-[14px] p-5 shadow-sm border border-[#AAEED3]/50 space-y-4">
        {/* Top row: Play/Pause, Frequency Slider */}
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white transition-all duration-250 shadow-sm"
            style={{
              backgroundColor: isPlaying ? 'var(--deep-teal)' : 'var(--teal)',
            }}
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4" /> Pause Sweep
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" /> Play Frequency Sweep
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setWindingFreq(0);
              setIsPlaying(false);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-[#123A36] bg-[#F3FAF7] hover:bg-[#AAEED3]/40 border border-[#AAEED3] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset (0 Hz)
          </button>

          {/* Frequency Scrub Slider */}
          <div className="flex-1 min-w-[240px] flex items-center gap-3">
            <label htmlFor="winding-freq-slider" className="text-xs font-semibold text-[#123A36] whitespace-nowrap">
              Winding Frequency:
            </label>
            <input
              id="winding-freq-slider"
              type="range"
              min="0"
              max={nyquist}
              step="0.05"
              value={windingFreq}
              onChange={(e) => {
                setWindingFreq(parseFloat(e.target.value));
                setIsPlaying(false);
              }}
              className="flex-1 accent-[#55A9A0] cursor-pointer"
            />
            <span className="font-mono font-bold text-sm text-[#2A7B73] min-w-[60px] text-right">
              {windingFreq.toFixed(2)} Hz
            </span>
          </div>
        </div>

        {/* Second row: Speed & Sample progression slider */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-[#AAEED3]/30">
          {/* Sweep Speed control */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-[#123A36]">Sweep Speed:</span>
            {( [0.25, 0.5, 1.0, 2.0] as number[]).map((spd) => (
              <button
                key={`spd-${spd}`}
                type="button"
                onClick={() => setSweepSpeed(spd)}
                className={`px-2.5 py-1 text-xs font-mono rounded-lg border transition-colors ${
                  sweepSpeed === spd
                    ? 'bg-[#2A7B73] text-white border-[#2A7B73]'
                    : 'bg-[#F3FAF7] text-[#123A36] border-[#AAEED3] hover:bg-[#AAEED3]/40'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          {/* Sample-by-sample stepper slider */}
          <div className="flex items-center gap-3">
            <label htmlFor="sample-stepper-slider" className="text-xs font-medium text-[#123A36] whitespace-nowrap">
              Sample Progress:
            </label>
            <input
              id="sample-stepper-slider"
              type="range"
              min="1"
              max={signal.length}
              value={maxSampleIndex}
              onChange={(e) => setMaxSampleIndex(parseInt(e.target.value, 10))}
              className="flex-1 accent-[#55A9A0] cursor-pointer"
            />
            <span className="font-mono text-xs text-[#2A7B73] whitespace-nowrap">
              {maxSampleIndex} / {signal.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
