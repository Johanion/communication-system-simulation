/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Compass, Info } from 'lucide-react';
import { EulerHelix3D } from './EulerHelix3D';

export const EulersIdentityModule: React.FC = () => {
  const [omega, setOmega] = useState<number>(1.0); // rad/sec
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [theta, setTheta] = useState<number>(0); // radians

  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const dt = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      if (isPlaying) {
        setTheta((prev) => (prev + omega * dt * 2) % (2 * Math.PI));
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, omega]);

  const radius = 100;
  const centerX = 160;
  const centerY = 160;

  const cosVal = Math.cos(theta);
  const sinVal = Math.sin(theta);

  const phasorX = centerX + cosVal * radius;
  const phasorY = centerY - sinVal * radius; // inverted y

  // Time wave traces (last 80 points)
  const historyLength = 120;
  const wavePointsCos: string[] = [];
  const wavePointsSin: string[] = [];

  for (let i = 0; i < historyLength; i++) {
    const tPast = theta - (i / historyLength) * 2 * Math.PI;
    const c = Math.cos(tPast);
    const s = Math.sin(tPast);

    // Cosine projection wave moving to the right
    const xCos = 320 + (i / historyLength) * 260;
    const yCos = centerY - c * radius;
    wavePointsCos.push(`${xCos.toFixed(1)},${yCos.toFixed(1)}`);

    // Sine projection wave
    const xSin = 320 + (i / historyLength) * 260;
    const ySin = centerY - s * radius;
    wavePointsSin.push(`${xSin.toFixed(1)},${ySin.toFixed(1)}`);
  }

  return (
    <div className="space-y-6">
      {/* Intro Card */}
      <div className="bg-white rounded-[14px] p-5 shadow-sm border border-[#AAEED3]/50">
        <div className="flex items-center gap-2 mb-1">
          <Compass className="w-5 h-5 text-[#2A7B73]" />
          <h2 className="text-xl font-bold text-[#123A36]">
            Topic B &bull; Euler's Identity & Rotating Phasors
          </h2>
        </div>
        <p className="text-sm text-[#123A36]/80 leading-relaxed">
          Euler’s formula states that{' '}
          <span className="font-mono font-bold text-[#2A7B73]">e^{`{jθ}`} = cos(θ) + j&middot;sin(θ)</span>.
          A rotating phasor on the complex plane projects a <strong className="text-[#55A9A0]">cosine wave</strong> onto the horizontal Real axis and a <strong className="text-[#2A7B73]">sine wave</strong> onto the vertical Imaginary axis simultaneously!
        </p>
      </div>

      {/* Interactive Phasor Canvas & Dual Wave Projection */}
      <div className="bg-white rounded-[14px] p-5 shadow-sm border border-[#AAEED3]/50">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="font-bold text-base text-[#123A36]">
            Rotating Complex Phasor & Orthogonal Projections
          </h3>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-[#F3FAF7] border border-[#AAEED3] text-[#123A36]">
              θ = {(theta * (180 / Math.PI)).toFixed(1)}° ({(theta / Math.PI).toFixed(2)}π rad)
            </span>
            <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-[#AAEED3]/40 border border-[#AAEED3] text-[#123A36] font-semibold">
              cos = {cosVal.toFixed(2)} &bull; sin = {sinVal.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="relative w-full aspect-[16/8] min-h-[320px]">
          <svg viewBox="0 0 620 320" className="w-full h-full select-none overflow-visible">
            {/* Left side: Complex Unit Circle */}
            <circle
              cx={centerX}
              cy={centerY}
              r={radius}
              fill="#FAFCFB"
              stroke="#AAEED3"
              strokeWidth="1.5"
            />

            {/* Axes */}
            <line x1={30} y1={centerY} x2={290} y2={centerY} stroke="#2A7B73" strokeWidth="1" strokeOpacity="0.5" />
            <line x1={centerX} y1={30} x2={centerX} y2={290} stroke="#2A7B73" strokeWidth="1" strokeOpacity="0.5" />
            <text x={280} y={centerY - 6} textAnchor="end" className="font-mono text-[10px] fill-[#2A7B73] font-semibold">
              +Real (cos)
            </text>
            <text x={centerX + 6} y={40} className="font-mono text-[10px] fill-[#2A7B73] font-semibold">
              +j Im (sin)
            </text>

            {/* Orthogonal projection lines */}
            {/* Horizontal projection to Real axis */}
            <line
              x1={phasorX}
              y1={phasorY}
              x2={phasorX}
              y2={centerY}
              stroke="var(--teal)"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
            {/* Vertical projection to Imaginary axis */}
            <line
              x1={phasorX}
              y1={phasorY}
              x2={centerX}
              y2={phasorY}
              stroke="var(--deep-teal)"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />

            {/* Phasor Vector Arrow */}
            <line
              x1={centerX}
              y1={centerY}
              x2={phasorX}
              y2={phasorY}
              stroke="var(--deep-teal)"
              strokeWidth="3"
              strokeLinecap="round"
            />

            {/* Tip marker (Pale Yellow + Deep Teal border) */}
            <circle
              cx={phasorX}
              cy={phasorY}
              r={6.5}
              fill="var(--pale-yellow)"
              stroke="var(--deep-teal)"
              strokeWidth="2.5"
            />

            {/* Divider line */}
            <line x1={310} y1={20} x2={310} y2={300} stroke="#AAEED3" strokeWidth="1" strokeDasharray="3 3" />

            {/* Right side: Time-Domain Waveforms */}
            <text x={330} y={35} className="font-semibold text-xs fill-[#123A36]">
              Time Projections Over Time (t)
            </text>

            {/* Zero line on right */}
            <line x1={320} y1={centerY} x2={590} y2={centerY} stroke="#AAEED3" strokeWidth="1" />

            {/* Projection indicator ray from phasor to waveform */}
            <line
              x1={phasorX}
              y1={phasorY}
              x2={320}
              y2={phasorY}
              stroke="var(--deep-teal)"
              strokeWidth="1.5"
              strokeDasharray="2 2"
              strokeOpacity="0.8"
            />

            {/* Cosine Wave (Teal: #55A9A0) */}
            {wavePointsCos.length > 0 && (
              <path
                d={`M ${wavePointsCos.join(' L ')}`}
                fill="none"
                stroke="var(--teal)"
                strokeWidth="2"
                strokeOpacity="0.8"
              />
            )}

            {/* Sine Wave (Deep Teal: #2A7B73) */}
            {wavePointsSin.length > 0 && (
              <path
                d={`M ${wavePointsSin.join(' L ')}`}
                fill="none"
                stroke="var(--deep-teal)"
                strokeWidth="2.5"
              />
            )}

            {/* Active tip on waveform */}
            <circle
              cx={320}
              cy={centerY - sinVal * radius}
              r={5}
              fill="var(--pale-yellow)"
              stroke="var(--deep-teal)"
              strokeWidth="2"
            />
          </svg>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-between text-xs mt-3 pt-3 border-t border-[#AAEED3]/30">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-1 rounded" style={{ backgroundColor: 'var(--teal)' }} />
              <span>Real part: cos(θ) (Teal)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-1 rounded" style={{ backgroundColor: 'var(--deep-teal)' }} />
              <span>Imaginary part: sin(θ) (Deep Teal)</span>
            </div>
          </div>
          <span className="font-mono text-[#2A7B73]">
            Radius r = 1.0 &bull; Magnitude |e^{`{jθ}`}| &equiv; 1
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-[14px] p-5 shadow-sm border border-[#AAEED3]/50 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => setIsPlaying(!isPlaying)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white transition-all shadow-sm"
          style={{ backgroundColor: isPlaying ? 'var(--deep-teal)' : 'var(--teal)' }}
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
          {isPlaying ? 'Pause Rotation' : 'Start Rotation'}
        </button>

        <button
          type="button"
          onClick={() => {
            setTheta(0);
            setIsPlaying(false);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-[#123A36] bg-[#F3FAF7] hover:bg-[#AAEED3]/40 border border-[#AAEED3]"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset (θ = 0)
        </button>

        {/* Angular Speed Slider */}
        <div className="flex-1 min-w-[220px] flex items-center gap-3">
          <label htmlFor="omega-slider" className="text-xs font-semibold text-[#123A36] whitespace-nowrap">
            Angular Frequency (ω):
          </label>
          <input
            id="omega-slider"
            type="range"
            min="0.1"
            max="4.0"
            step="0.1"
            value={omega}
            onChange={(e) => setOmega(parseFloat(e.target.value))}
            className="flex-1 accent-[#55A9A0] cursor-pointer"
          />
          <span className="font-mono font-bold text-xs text-[#2A7B73] min-w-[50px] text-right">
            {omega.toFixed(1)} rad/s
          </span>
        </div>

        {/* Manual Angle Scrub Slider */}
        <div className="flex-1 min-w-[220px] flex items-center gap-3">
          <label htmlFor="theta-slider" className="text-xs font-semibold text-[#123A36] whitespace-nowrap">
            Angle (θ):
          </label>
          <input
            id="theta-slider"
            type="range"
            min="0"
            max={(2 * Math.PI).toString()}
            step="0.05"
            value={theta}
            onChange={(e) => {
              setTheta(parseFloat(e.target.value));
              setIsPlaying(false);
            }}
            className="flex-1 accent-[#55A9A0] cursor-pointer"
          />
          <span className="font-mono font-bold text-xs text-[#2A7B73] min-w-[50px] text-right">
            {(theta * (180 / Math.PI)).toFixed(0)}°
          </span>
        </div>
      </div>

      {/* 3D Complex Exponential Helix */}
      <EulerHelix3D theta={theta} omega={omega} isPlaying={isPlaying} />
    </div>
  );
};
