/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { TransformResult, MagnitudeScale } from '../types';
import {
  Activity,
  Compass,
  Download,
  AlertTriangle,
  CheckCircle2,
  Check,
  ShieldCheck,
} from 'lucide-react';

interface FrequencyDomainPlotProps {
  transform: TransformResult;
  sampleRate: number;
  scale: MagnitudeScale;
  onChangeScale: (scale: MagnitudeScale) => void;
  showPhase: boolean;
  onTogglePhase: () => void;
  algorithm: string;
  configuredHighestFreq?: number;
  timeEnergy?: number;
}

export const FrequencyDomainPlot: React.FC<FrequencyDomainPlotProps> = ({
  transform,
  sampleRate,
  scale,
  onChangeScale,
  showPhase,
  onTogglePhase,
  algorithm,
  configuredHighestFreq = 0,
  timeEnergy,
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const N = transform.n;
  const halfN = Math.floor(N / 2);
  const nyquistFreq = sampleRate / 2;

  const displayFrequencies = transform.frequencies.slice(0, halfN + 1);
  const rawMags = transform.magnitude.slice(0, halfN + 1);
  const normMags = transform.normalizedMagnitude.slice(0, halfN + 1);
  const phases = transform.phase.slice(0, halfN + 1);

  // Parseval's energy match
  const freqEnergy = transform.magnitude.reduce((sum, m) => sum + m * m, 0) / N;
  const energyMatchPercent =
    timeEnergy && timeEnergy > 0 ? (freqEnergy / timeEnergy) * 100 : 100;

  // Aliasing condition
  const isAliased = configuredHighestFreq > nyquistFreq;

  // Scale handling
  let values: number[] = [];
  let yUnit = '';
  let yMax = 1;

  if (scale === 'linear') {
    values = rawMags;
    yUnit = '|X[k]|';
    yMax = Math.max(...rawMags, 1);
  } else if (scale === 'normalized') {
    values = normMags;
    yUnit = 'Amp';
    yMax = Math.max(...normMags, 1);
  } else {
    // Decibels (dB)
    const maxPeak = Math.max(...rawMags, 1e-6);
    values = rawMags.map((m) => {
      const db = 20 * Math.log10(Math.max(m, 1e-4) / maxPeak);
      return Math.max(db, -60);
    });
    yUnit = 'dB';
    yMax = 0;
  }

  // Peak detection (local maxima)
  const peakIndices: number[] = [];
  const maxVal = Math.max(...normMags, 0.05);
  const peakThreshold = maxVal * 0.15;

  for (let i = 0; i <= halfN; i++) {
    const prev = i > 0 ? normMags[i - 1] : 0;
    const curr = normMags[i];
    const next = i < halfN ? normMags[i + 1] : 0;
    if (curr > peakThreshold && curr >= prev && curr >= next) {
      peakIndices.push(i);
    }
  }

  // Dimensions
  const width = 800;
  const height = 300;
  const padLeft = 60;
  const padRight = 30;
  const padTop = 30;
  const padBottom = 45;

  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const getX = (freq: number) => {
    return padLeft + (freq / nyquistFreq) * plotW;
  };

  const getY = (val: number) => {
    if (scale === 'db') {
      const norm = (val - -60) / 60;
      return padTop + plotH - norm * plotH;
    }
    const safeMax = yMax > 0 ? yMax * 1.15 : 1;
    return padTop + plotH - (val / safeMax) * plotH;
  };

  const getPhaseY = (rad: number) => {
    const norm = (rad + Math.PI) / (2 * Math.PI);
    return padTop + plotH - norm * plotH;
  };

  // Export frequency spectrum CSV
  const handleExportCSV = () => {
    let csv =
      'Bin_k,Frequency_Hz,Magnitude_|X[k]|,Normalized_Amplitude,Phase_Radians,Phase_Degrees,Real_Re,Imag_Im\n';
    for (let k = 0; k <= halfN; k++) {
      const f = transform.frequencies[k];
      const mag = transform.magnitude[k];
      const norm = transform.normalizedMagnitude[k];
      const pRad = transform.phase[k];
      const pDeg = (pRad * 180) / Math.PI;
      const re = transform.real[k];
      const im = transform.imag[k];
      csv += `${k},${f.toFixed(3)},${mag.toFixed(5)},${norm.toFixed(5)},${pRad.toFixed(5)},${pDeg.toFixed(2)},${re.toFixed(5)},${im.toFixed(5)}\n`;
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `fourier_spectrum_bins_${halfN + 1}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportNotice('Exported frequency spectrum CSV');
    setTimeout(() => setExportNotice(null), 3000);
  };

  return (
    <div className="bg-white rounded-[14px] p-5 shadow-sm border border-[#AAEED3]/50 flex flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-3.5 h-3.5 rounded-full"
            style={{ backgroundColor: 'var(--deep-teal)' }}
            title="Frequency domain representation"
          />
          <h2 className="text-base sm:text-lg font-bold text-[#123A36] tracking-tight">
            Frequency Spectrum <span className="font-mono text-sm font-normal text-[#2A7B73]">|X[k]| &bull; ∠X[k]</span>
          </h2>
          <span className="text-xs px-2 py-0.5 rounded font-mono font-medium bg-[#AAEED3]/30 text-[#123A36] border border-[#AAEED3]">
            DC to Nyquist ({nyquistFreq} Hz)
          </span>
        </div>

        {/* Toolbar: Scale, Phase toggle, Export CSV */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Magnitude scale selector */}
          <div className="flex items-center gap-1 bg-[#F3FAF7] p-1 rounded-lg border border-[#AAEED3]/60 text-xs">
            {(['linear', 'normalized', 'db'] as MagnitudeScale[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onChangeScale(s)}
                className={`px-2.5 py-1 rounded capitalize font-medium transition-colors cursor-pointer ${
                  scale === s
                    ? 'bg-[#2A7B73] text-white shadow-xs'
                    : 'text-[#123A36] hover:bg-[#AAEED3]/40'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Phase spectrum toggle */}
          <button
            type="button"
            onClick={onTogglePhase}
            className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
              showPhase
                ? 'bg-[#2A7B73] text-white border-[#2A7B73]'
                : 'bg-white text-[#123A36] border-[#AAEED3] hover:bg-[#AAEED3]/30'
            }`}
            title="Toggle phase spectrum overlay"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Phase</span>
          </button>

          {/* Export CSV */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#F3FAF7] text-[#2A7B73] border border-[#AAEED3] hover:bg-[#AAEED3]/40 transition-colors cursor-pointer shadow-2xs"
            title="Download Fourier frequency bins as CSV"
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

      {/* Aliasing Alert Box */}
      {isAliased && (
        <div className="mb-3 p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong>Aliasing Active:</strong> Constituent frequency ({configuredHighestFreq.toFixed(1)} Hz) exceeds the Nyquist limit ({nyquistFreq} Hz). Notice how the spectrum peak appears folded back to |{Math.abs(configuredHighestFreq - sampleRate).toFixed(1)}| Hz!
          </div>
        </div>
      )}

      {/* SVG Spectrum Chart */}
      <div className="relative w-full aspect-[21/9] min-h-[220px] bg-[#FAFCFB] rounded-xl border border-[#AAEED3] p-2 select-none overflow-hidden">
        <svg
          className="w-full h-full overflow-visible"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
        >
          {/* Y-axis grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
            const val = scale === 'db' ? -60 + frac * 60 : frac * yMax;
            const y = getY(val);
            return (
              <g key={`ygrid-spec-${frac}`}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#AAEED3"
                  strokeWidth="0.75"
                  strokeDasharray="3 3"
                  strokeOpacity="0.6"
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
                  {scale === 'db' ? `${val.toFixed(0)}dB` : val.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* X-axis frequency grid */}
          {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
            const f = frac * nyquistFreq;
            const x = getX(f);
            const isNyquist = frac === 1;

            return (
              <g key={`xgrid-spec-${frac}`}>
                <line
                  x1={x}
                  y1={padTop}
                  x2={x}
                  y2={height - padBottom}
                  stroke={isNyquist ? '#2A7B73' : '#AAEED3'}
                  strokeWidth={isNyquist ? 1.5 : 0.75}
                  strokeDasharray={isNyquist ? undefined : '3 3'}
                  strokeOpacity={isNyquist ? 0.8 : 0.6}
                />
                <text
                  x={x}
                  y={height - padBottom + 18}
                  fill="#123A36"
                  fontSize="10"
                  fontFamily="monospace"
                  textAnchor="middle"
                  opacity="0.8"
                  fontWeight={isNyquist ? 'bold' : 'normal'}
                >
                  {f.toFixed(0)} Hz
                </text>
              </g>
            );
          })}

          {/* Visual Nyquist Line Marker */}
          <line
            x1={getX(nyquistFreq)}
            y1={padTop}
            x2={getX(nyquistFreq)}
            y2={height - padBottom}
            stroke="#2A7B73"
            strokeWidth="2"
            strokeDasharray="4 2"
          />
          <text
            x={getX(nyquistFreq) - 5}
            y={padTop + 14}
            fill="#2A7B73"
            fontSize="10"
            fontFamily="monospace"
            fontWeight="bold"
            textAnchor="end"
          >
            Nyquist Limit (f_s / 2 = {nyquistFreq} Hz)
          </text>

          {/* Phase Spectrum Line (if enabled) */}
          {showPhase && (
            <polyline
              fill="none"
              stroke="#55A9A0"
              strokeWidth="1.5"
              strokeDasharray="3 3"
              opacity="0.65"
              points={displayFrequencies
                .map((f, i) => `${getX(f).toFixed(1)},${getPhaseY(phases[i]).toFixed(1)}`)
                .join(' ')}
            />
          )}

          {/* Frequency Bins / Stems */}
          {displayFrequencies.map((f, i) => {
            const val = values[i];
            const cx = getX(f);
            const cy = getY(val);
            const base = getY(scale === 'db' ? -60 : 0);
            const isHovered = hoverIndex === i;
            const isPeak = peakIndices.includes(i);

            return (
              <g
                key={`bin-${i}`}
                className="cursor-pointer"
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
              >
                {/* Vertical stem bar */}
                <line
                  x1={cx}
                  y1={base}
                  x2={cx}
                  y2={cy}
                  stroke={isPeak ? '#2A7B73' : '#55A9A0'}
                  strokeWidth={isPeak ? 2.5 : 1.5}
                />
                {/* Bin head dot */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isPeak ? 4.5 : isHovered ? 4 : 2}
                  fill={isPeak ? 'var(--pale-yellow)' : 'var(--deep-teal)'}
                  stroke="#123A36"
                  strokeWidth={isPeak ? 1.5 : 0.5}
                />
              </g>
            );
          })}

          {/* Peak Frequency Badges / Labels */}
          {peakIndices.map((pIdx) => {
            const f = displayFrequencies[pIdx];
            const mag = normMags[pIdx];
            const cx = getX(f);
            const cy = getY(values[pIdx]);

            return (
              <g key={`peak-lbl-${pIdx}`}>
                <rect
                  x={cx - 32}
                  y={cy - 24}
                  width="64"
                  height="16"
                  rx="4"
                  fill="#123A36"
                  opacity="0.9"
                />
                <text
                  x={cx}
                  y={cy - 12}
                  fill="#FFF6B0"
                  fontSize="9"
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {f.toFixed(1)} Hz
                </text>
              </g>
            );
          })}

          {/* Axis Title */}
          <text
            x={width / 2}
            y={height - 8}
            fill="#123A36"
            fontSize="11"
            fontFamily="sans-serif"
            textAnchor="middle"
            fontWeight="bold"
          >
            Frequency (Hz &bull; Bin resolution Δf = {(sampleRate / N).toFixed(2)} Hz)
          </text>
        </svg>

        {/* Hover Inspector Tooltip */}
        {hoverIndex !== null && hoverIndex <= halfN && (
          <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-xs p-2.5 rounded-lg border border-[#AAEED3] shadow-md font-mono text-xs pointer-events-none z-10 space-y-0.5">
            <div className="text-[10px] text-[#2A7B73] font-bold">Bin #{hoverIndex}</div>
            <div>Freq: <strong>{displayFrequencies[hoverIndex].toFixed(2)} Hz</strong></div>
            <div>Norm Amp: <strong className="text-[#2A7B73]">{normMags[hoverIndex].toFixed(4)}</strong></div>
            <div>Phase: <span className="text-[#123A36]">{((phases[hoverIndex] * 180) / Math.PI).toFixed(1)}°</span></div>
          </div>
        )}
      </div>

      {/* Parseval's Theorem Verification & Metrics Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs mt-3 pt-2 border-t border-[#AAEED3]/30">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#F3FAF7] border border-[#AAEED3] font-mono text-[11px]">
            <ShieldCheck className="w-4 h-4 text-[#2A7B73]" />
            <span className="text-[#123A36]">Parseval Integrity:</span>
            <strong className="text-[#2A7B73]">{energyMatchPercent.toFixed(2)}% Match</strong>
          </div>
          <span className="text-[#123A36]/70 text-[11px] hidden sm:inline">
            ∑ |x[n]|² = 1/N ∑ |X[k]|²
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono text-[#2A7B73]">
          <span>Detected Peaks: <strong>{peakIndices.length}</strong></span>
          <span>&bull;</span>
          <span>Algorithm: <strong className="uppercase">{algorithm}</strong></span>
        </div>
      </div>
    </div>
  );
};
