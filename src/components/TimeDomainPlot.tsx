/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Eye, Download, Info, Check, ZoomIn } from 'lucide-react';

interface TimeDomainPlotProps {
  timeArray: number[];
  signal: number[];
  reconstructedSignal?: number[];
  sampleRate: number;
  sampleCount: number;
  showIDFT: boolean;
  onToggleIDFT: () => void;
  windowType: string;
}

export const TimeDomainPlot: React.FC<TimeDomainPlotProps> = ({
  timeArray,
  signal,
  reconstructedSignal,
  sampleRate,
  sampleCount,
  showIDFT,
  onToggleIDFT,
  windowType,
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Determine Y bounds
  let minVal = 0;
  let maxVal = 0;
  for (let i = 0; i < signal.length; i++) {
    if (signal[i] < minVal) minVal = signal[i];
    if (signal[i] > maxVal) maxVal = signal[i];
  }
  const peakToPeak = Math.max(Math.abs(minVal), Math.abs(maxVal), 0.5);
  const yLimit = +(peakToPeak * 1.25).toFixed(2);

  // SVG dimensions
  const width = 800;
  const height = 300;
  const padLeft = 60;
  const padRight = 30;
  const padTop = 30;
  const padBottom = 45;

  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxT = (sampleCount - 1) / sampleRate;

  const getX = (t: number) => {
    return padLeft + (t / (maxT || 1)) * plotW;
  };

  const getY = (val: number) => {
    return padTop + plotH / 2 - (val / (yLimit || 1)) * (plotH / 2);
  };

  // Continuous line path
  const linePoints = signal.map((y, idx) => {
    const t = timeArray[idx] ?? idx / sampleRate;
    return `${getX(t).toFixed(1)},${getY(y).toFixed(1)}`;
  });
  const linePath = linePoints.length > 0 ? `M ${linePoints.join(' L ')}` : '';

  // Reconstructed IDFT path
  let reconPath = '';
  if (showIDFT && reconstructedSignal && reconstructedSignal.length === signal.length) {
    const reconPoints = reconstructedSignal.map((y, idx) => {
      const t = timeArray[idx] ?? idx / sampleRate;
      return `${getX(t).toFixed(1)},${getY(y).toFixed(1)}`;
    });
    reconPath = `M ${reconPoints.join(' L ')}`;
  }

  // Quick statistics
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < signal.length; i++) {
    sum += signal[i];
    sumSq += signal[i] * signal[i];
  }
  const dcOffset = +(sum / signal.length).toFixed(3);
  const rmsVal = +Math.sqrt(sumSq / signal.length).toFixed(3);
  const peakVal = +Math.max(...signal.map(Math.abs)).toFixed(3);

  // Export time-domain samples to CSV
  const handleExportCSV = () => {
    let csv = 'Sample_Index,Time_Seconds,Time_Milliseconds,Amplitude_x[n]';
    if (showIDFT && reconstructedSignal) {
      csv += ',Reconstructed_IDFT_x[n]\n';
    } else {
      csv += '\n';
    }

    for (let i = 0; i < signal.length; i++) {
      const tSec = timeArray[i] ?? i / sampleRate;
      const tMs = tSec * 1000;
      csv += `${i},${tSec.toFixed(6)},${tMs.toFixed(3)},${signal[i].toFixed(6)}`;
      if (showIDFT && reconstructedSignal) {
        csv += `,${reconstructedSignal[i].toFixed(6)}\n`;
      } else {
        csv += '\n';
      }
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `time_domain_samples_${sampleCount}_pts.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportNotice('Exported time-domain CSV');
    setTimeout(() => setExportNotice(null), 3000);
  };

  // Hover detection
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const normalizedX = (clientX - (padLeft / width) * rect.width) / ((plotW / width) * rect.width);
    const clampedRatio = Math.max(0, Math.min(1, normalizedX));
    const closestIdx = Math.round(clampedRatio * (sampleCount - 1));
    if (closestIdx >= 0 && closestIdx < sampleCount) {
      setHoverIndex(closestIdx);
    }
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  return (
    <div
      ref={containerRef}
      className="bg-white rounded-[14px] p-5 shadow-sm border border-[#AAEED3]/50 flex flex-col"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-3.5 h-3.5 rounded-full"
            style={{ backgroundColor: 'var(--teal)' }}
            title="Time domain representation"
          />
          <h2 className="text-base sm:text-lg font-bold text-[#123A36] tracking-tight">
            Time Domain Signal <span className="font-mono text-sm font-normal text-[#2A7B73]">x[n] &bull; x(t)</span>
          </h2>
          <span className="text-xs px-2 py-0.5 rounded font-mono font-medium bg-[#AAEED3]/30 text-[#123A36] border border-[#AAEED3]">
            {sampleCount} samples @ {sampleRate} Hz
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* IDFT Reconstruction Toggle */}
          <button
            type="button"
            onClick={onToggleIDFT}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
              showIDFT
                ? 'bg-[#2A7B73] text-white border-[#2A7B73]'
                : 'bg-white text-[#123A36] border-[#AAEED3] hover:bg-[#AAEED3]/30'
            }`}
            title="Overlay reconstructed signal from Inverse Discrete Fourier Transform (IDFT)"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>IDFT Roundtrip</span>
          </button>

          {/* Export CSV */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#F3FAF7] text-[#2A7B73] border border-[#AAEED3] hover:bg-[#AAEED3]/40 transition-colors cursor-pointer shadow-2xs"
            title="Download sampled waveform data as CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {exportNotice && (
        <div className="mb-2 p-2 bg-[#AAEED3]/30 border border-[#AAEED3] rounded-lg text-xs font-medium text-[#2A7B73] flex items-center gap-2">
          <Check className="w-4 h-4 text-[#2A7B73]" />
          <span>{exportNotice}</span>
        </div>
      )}

      {/* SVG Plot Canvas */}
      <div className="relative w-full aspect-[21/9] min-h-[220px] bg-[#FAFCFB] rounded-xl border border-[#AAEED3] p-2 select-none overflow-hidden">
        <svg
          className="w-full h-full overflow-visible"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Grid lines */}
          {[-1, -0.5, 0, 0.5, 1].map((frac) => {
            const y = getY(frac * yLimit);
            const isZero = frac === 0;
            return (
              <g key={`ygrid-${frac}`}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke={isZero ? '#123A36' : '#AAEED3'}
                  strokeWidth={isZero ? 1.25 : 0.75}
                  strokeDasharray={isZero ? undefined : '3 3'}
                  strokeOpacity={isZero ? 0.4 : 0.6}
                />
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  fill="#123A36"
                  fontSize="10"
                  fontFamily="monospace"
                  textAnchor="end"
                  opacity="0.8"
                >
                  {(frac * yLimit).toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Time axis ticks */}
          {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
            const t = frac * maxT;
            const x = getX(t);
            return (
              <g key={`xgrid-${frac}`}>
                <line
                  x1={x}
                  y1={padTop}
                  x2={x}
                  y2={height - padBottom}
                  stroke="#AAEED3"
                  strokeWidth="0.75"
                  strokeDasharray="3 3"
                  strokeOpacity="0.6"
                />
                <text
                  x={x}
                  y={height - padBottom + 18}
                  fill="#123A36"
                  fontSize="10"
                  fontFamily="monospace"
                  textAnchor="middle"
                  opacity="0.8"
                >
                  {(t * 1000).toFixed(0)}ms
                </text>
              </g>
            );
          })}

          {/* Reconstructed IDFT Path (Dashed Pale Yellow/Teal) */}
          {showIDFT && reconPath && (
            <path
              d={reconPath}
              fill="none"
              stroke="#2A7B73"
              strokeWidth="2.5"
              strokeDasharray="4 4"
              strokeOpacity="0.9"
            />
          )}

          {/* Continuous Reconstructed Waveform (Teal) */}
          <path
            d={linePath}
            fill="none"
            stroke="#55A9A0"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Discrete Sample Points x[n] (Stems + Dots) */}
          {signal.map((y, idx) => {
            if (sampleCount > 256 && idx % Math.ceil(sampleCount / 256) !== 0) return null;
            const t = timeArray[idx] ?? idx / sampleRate;
            const cx = getX(t);
            const cy = getY(y);
            const isHovered = hoverIndex === idx;

            return (
              <g key={`sample-${idx}`}>
                {/* Vertical stem from zero */}
                <line
                  x1={cx}
                  y1={getY(0)}
                  x2={cx}
                  y2={cy}
                  stroke="#55A9A0"
                  strokeWidth={sampleCount > 256 ? 0.8 : 1.2}
                  strokeOpacity="0.45"
                />
                {/* Sample marker point */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 5 : sampleCount > 256 ? 1.5 : 2.5}
                  fill={isHovered ? 'var(--pale-yellow)' : 'var(--deep-teal)'}
                  stroke="#123A36"
                  strokeWidth={isHovered ? 1.5 : 0.5}
                />
              </g>
            );
          })}

          {/* Active Hover Inspector Needle */}
          {hoverIndex !== null && hoverIndex < signal.length && (
            <g>
              <line
                x1={getX(timeArray[hoverIndex] ?? hoverIndex / sampleRate)}
                y1={padTop}
                x2={getX(timeArray[hoverIndex] ?? hoverIndex / sampleRate)}
                y2={height - padBottom}
                stroke="#2A7B73"
                strokeWidth="1.5"
                strokeDasharray="2 2"
              />
            </g>
          )}

          {/* Axis Labels */}
          <text
            x={width / 2}
            y={height - 8}
            fill="#123A36"
            fontSize="11"
            fontFamily="sans-serif"
            textAnchor="middle"
            fontWeight="bold"
          >
            Time (t in milliseconds &bull; total duration: {(maxT * 1000).toFixed(1)} ms)
          </text>
        </svg>

        {/* Floating Tooltip when hovering a sample point */}
        {hoverIndex !== null && hoverIndex < signal.length && (
          <div
            className="absolute top-3 right-3 bg-white/95 backdrop-blur-xs p-2.5 rounded-lg border border-[#AAEED3] shadow-md font-mono text-xs pointer-events-none z-10 space-y-0.5"
          >
            <div className="text-[10px] text-[#2A7B73] font-bold">Sample Point #{hoverIndex}</div>
            <div>Time t: <strong>{((timeArray[hoverIndex] ?? hoverIndex / sampleRate) * 1000).toFixed(2)} ms</strong></div>
            <div>Amplitude x[n]: <strong className="text-[#2A7B73]">{signal[hoverIndex].toFixed(4)}</strong></div>
            {showIDFT && reconstructedSignal && (
              <div>Recon x̂[n]: <strong className="text-[#123A36]">{reconstructedSignal[hoverIndex]?.toFixed(4)}</strong></div>
            )}
          </div>
        )}
      </div>

      {/* Footer Metrics Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-[#123A36] mt-3 pt-2 border-t border-[#AAEED3]/30">
        <div className="flex items-center gap-4">
          <span>Peak: <strong className="text-[#2A7B73]">{peakVal}</strong></span>
          <span>RMS: <strong className="text-[#2A7B73]">{rmsVal}</strong></span>
          <span>DC Offset: <strong className="text-[#2A7B73]">{dcOffset}</strong></span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-[#2A7B73]">
          <span>Sampling Interval Δt = {(1000 / sampleRate).toFixed(2)} ms</span>
        </div>
      </div>
    </div>
  );
};
