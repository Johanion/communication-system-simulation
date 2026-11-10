/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Focus Projection Overlay for Topic E (Convolution).
 * Lifts out and projects live signal shapes at 1.4x scale over a dimmed, blurred backdrop.
 * Supports cursor drag for time-shift and amplitude gain scaling with ghost comparison.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, RotateCcw } from 'lucide-react';
import {
  SignalDefinition,
  ConvolutionGridResult,
  evalContinuousSignal,
} from '../../math/convolution';

export interface ConvolutionFocusProjectionProps {
  focusedPlot: 1 | 2 | 3;
  onClose: () => void;
  domain: 'CT' | 'DT';
  flipTarget: 'h' | 'x';
  sigX: SignalDefinition;
  sigH: SignalDefinition;
  shiftT: number;
  shiftN: number;
  currentOutputValue: number;
  ctGrid: ConvolutionGridResult | null;
  dtGrid: any;
  currentDtStep: any;
  originRect: DOMRect | null;
}

const COLOR_X = '#2563EB'; // Blue
const COLOR_H = '#EA580C'; // Orange
const COLOR_OVERLAP = '#9333EA'; // Purple
const COLOR_OVERLAP_FILL = 'rgba(147, 51, 234, 0.45)';
const COLOR_OVERLAP_FILL_LIGHT = 'rgba(147, 51, 234, 0.28)';

export const ConvolutionFocusProjection: React.FC<ConvolutionFocusProjectionProps> = ({
  focusedPlot,
  onClose,
  domain,
  flipTarget,
  sigX,
  sigH,
  shiftT,
  shiftN,
  currentOutputValue,
  ctGrid,
  dtGrid,
  currentDtStep,
  originRect,
}) => {
  // Non-destructive preview transform state
  const [previewShift, setPreviewShift] = useState<number>(0);
  const [previewGain, setPreviewGain] = useState<number>(1.0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [showHint, setShowHint] = useState<boolean>(true);
  const [isEntering, setIsEntering] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const closeGraceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const dragStartRef = useRef<{ clientX: number; clientY: number; startShift: number; startGain: number } | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const initialPinchDistRef = useRef<number | null>(null);
  const initialPinchGainRef = useRef<number>(1.0);

  // Check prefers-reduced-motion
  const prefersReducedMotion = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  // Trigger scale entrance
  useEffect(() => {
    setIsEntering(true);
    const hintTimer = setTimeout(() => setShowHint(false), 4500);
    return () => clearTimeout(hintTimer);
  }, []);

  // Compute 1.4x target dimensions and clamped center
  const targetW = Math.min(window.innerWidth - 32, Math.max(360, (originRect?.width || 600) * 1.4));
  const scaleRatio = targetW / (originRect?.width || 600);
  const targetH = Math.min(window.innerHeight - 90, Math.max(220, (originRect?.height || 200) * scaleRatio));

  const origCenterX = originRect ? originRect.left + originRect.width / 2 : window.innerWidth / 2;
  const origCenterY = originRect ? originRect.top + originRect.height / 2 : window.innerHeight / 2;

  const halfW = targetW / 2;
  const halfH = targetH / 2;
  const clampedCenterX = Math.max(16 + halfW, Math.min(window.innerWidth - 16 - halfW, origCenterX));
  const clampedCenterY = Math.max(45 + halfH, Math.min(window.innerHeight - 45 - halfH, origCenterY));

  const targetLeft = clampedCenterX - halfW;
  const targetTop = clampedCenterY - halfH;

  // Reset transform helper
  const handleReset = useCallback(() => {
    setPreviewShift(0);
    setPreviewGain(1.0);
  }, []);

  // Grace delay on pointer leave
  const handlePointerEnterContainer = () => {
    if (closeGraceTimerRef.current) {
      clearTimeout(closeGraceTimerRef.current);
      closeGraceTimerRef.current = null;
    }
  };

  const handlePointerLeaveContainer = () => {
    if (isDraggingRef.current) return;
    if (closeGraceTimerRef.current) clearTimeout(closeGraceTimerRef.current);
    closeGraceTimerRef.current = setTimeout(() => {
      if (!isDraggingRef.current) {
        onClose();
      }
    }, 250);
  };

  // Keyboard navigation & Esc inside overlay
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleReset();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setPreviewShift((prev) => {
          if (domain === 'CT') return Math.max(-6, Math.min(6, prev - 0.2));
          return Math.max(-10, Math.min(10, prev - 1));
        });
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setPreviewShift((prev) => {
          if (domain === 'CT') return Math.max(-6, Math.min(6, prev + 0.2));
          return Math.max(-10, Math.min(10, prev + 1));
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setPreviewGain((prev) => {
          const next = Math.min(4.0, prev + 0.1);
          return Math.abs(next - 1.0) <= 0.03 ? 1.0 : next;
        });
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setPreviewGain((prev) => {
          const next = Math.max(0.1, prev - 0.1);
          return Math.abs(next - 1.0) <= 0.03 ? 1.0 : next;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [domain, onClose, handleReset]);

  // Pointer drag gestures
  const handlePointerDown = (e: React.PointerEvent) => {
    // Only primary mouse button or touch
    if (e.button !== 0) return;
    isDraggingRef.current = true;
    setIsDragging(true);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startShift: previewShift,
      startGain: previewGain,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || !dragStartRef.current) return;

    const dx = e.clientX - dragStartRef.current.clientX;
    const dy = e.clientY - dragStartRef.current.clientY;

    const lockHorizontal = e.shiftKey; // Shift held = lock horizontal only
    const lockVertical = e.altKey; // Alt held = lock vertical only

    // Horizontal shift
    if (!lockVertical) {
      if (domain === 'CT') {
        const timeSpan = 12; // [-6, 6]
        const dShift = (dx / (targetW - 80)) * timeSpan;
        const rawShift = dragStartRef.current.startShift + dShift;
        setPreviewShift(Math.max(-6, Math.min(6, Math.round(rawShift * 100) / 100)));
      } else {
        const sampleSpan = 20; // [-10, 10]
        const dSamples = Math.round((dx / (targetW - 80)) * sampleSpan);
        const rawShift = dragStartRef.current.startShift + dSamples;
        setPreviewShift(Math.max(-10, Math.min(10, Math.round(rawShift))));
      }
    }

    // Vertical amplitude gain
    if (!lockHorizontal) {
      const dGain = -(dy / 90);
      let nextGain = Math.max(0.1, Math.min(4.0, dragStartRef.current.startGain + dGain));
      if (Math.abs(nextGain - 1.0) <= 0.03) nextGain = 1.0;
      setPreviewGain(Math.round(nextGain * 100) / 100);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false;
    setIsDragging(false);
    dragStartRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
  };

  // Mouse wheel scaling
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    setPreviewGain((prev) => {
      let next = Math.max(0.1, Math.min(4.0, prev * zoomFactor));
      if (Math.abs(next - 1.0) <= 0.03) next = 1.0;
      return Math.round(next * 100) / 100;
    });
  };

  // Touch pinch for mobile / tablets
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialPinchDistRef.current = dist;
      initialPinchGainRef.current = previewGain;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistRef.current) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / initialPinchDistRef.current;
      let nextGain = Math.max(0.1, Math.min(4.0, initialPinchGainRef.current * ratio));
      if (Math.abs(nextGain - 1.0) <= 0.03) nextGain = 1.0;
      setPreviewGain(Math.round(nextGain * 100) / 100);
    }
  };

  const handleTouchEnd = () => {
    initialPinchDistRef.current = null;
  };

  // Canvas drawing loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = targetW;
      const h = targetH;

      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }

      ctx.resetTransform();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      const padX = 42;
      const padY = 32;
      const plotW = w - padX * 2;
      const plotH = h - padY * 2;

      // Dark theme detection
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
        document.documentElement.classList.contains('dark');

      // Shared axes & zero line mapping
      const tMin = -6;
      const tMax = 6;
      const tSpan = tMax - tMin;

      const maxY = Math.max(1.8, (ctGrid?.peakValue || 1.0) * 1.15, sigX.amplitude * 1.2, sigH.amplitude * 1.2);
      const minY = -0.4;
      const ySpan = maxY - minY;

      const toScreenX = (tau: number, shift = 0) => padX + (((tau + shift) - tMin) / tSpan) * plotW;
      const zeroY = padY + plotH - ((0 - minY) / ySpan) * plotH;
      const toScreenY = (val: number, gain = 1.0) => zeroY - (((val - 0) / ySpan) * plotH) * gain;

      // 1. Draw Zero Axis Lines & Ticks (Faint, clean, minimal)
      ctx.save();
      ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.32)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(padX - 8, zeroY);
      ctx.lineTo(w - padX + 8, zeroY);
      ctx.stroke();

      // Zero vertical line (tau = 0 or t = 0)
      const zeroX = toScreenX(0, 0);
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(zeroX, padY - 6);
      ctx.lineTo(zeroX, h - padY + 6);
      ctx.stroke();
      ctx.setLineDash([]);

      // Time axis ticks
      ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.55)' : 'rgba(255, 255, 255, 0.7)';
      ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
      ctx.textAlign = 'center';

      if (domain === 'CT') {
        [-6, -4, -2, 0, 2, 4, 6].forEach((tau) => {
          const sx = toScreenX(tau, 0);
          ctx.beginPath();
          ctx.moveTo(sx, zeroY - 3);
          ctx.lineTo(sx, zeroY + 3);
          ctx.stroke();
          ctx.fillText(`${tau}`, sx, h - 14);
        });
      } else {
        [-10, -5, 0, 5, 10].forEach((k) => {
          const sx = padX + ((k - (-10)) / 20) * plotW;
          ctx.beginPath();
          ctx.moveTo(sx, zeroY - 3);
          ctx.lineTo(sx, zeroY + 3);
          ctx.stroke();
          ctx.fillText(`k=${k}`, sx, h - 14);
        });
      }
      ctx.restore();

      // Helper to evaluate continuous values at tau
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
        return { vX, vH, prod };
      };

      const numSamples = 300;
      const dTau = tSpan / (numSamples - 1);

      // Function to render Plot shapes at given (shift, gain, isGhost)
      const renderShapes = (sShift: number, sGain: number, isGhost: boolean) => {
        ctx.save();
        if (isGhost) {
          ctx.globalAlpha = 0.28;
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 2.0;
        } else {
          ctx.globalAlpha = 1.0;
          ctx.setLineDash([]);
          ctx.lineWidth = 3.2;
          ctx.shadowBlur = 8;
        }

        // ================= PLOT 1: Flip & Shift =================
        if (focusedPlot === 1) {
          if (domain === 'CT') {
            const statColor = flipTarget === 'h' ? COLOR_X : COLOR_H;
            const flipColor = flipTarget === 'h' ? COLOR_H : COLOR_X;

            // 1. Shaded Overlap Fill
            ctx.beginPath();
            let firstPt = true;
            for (let i = 0; i < numSamples; i++) {
              const tau = tMin + i * dTau;
              const { prod } = evalAtTau(tau);
              const sx = toScreenX(tau, sShift);
              const sy = toScreenY(Math.max(0, prod), sGain);
              if (firstPt) {
                ctx.moveTo(sx, zeroY);
                firstPt = false;
              }
              ctx.lineTo(sx, sy);
            }
            ctx.lineTo(toScreenX(tMax, sShift), zeroY);
            ctx.closePath();
            ctx.fillStyle = isGhost ? 'rgba(147, 51, 234, 0.12)' : COLOR_OVERLAP_FILL;
            ctx.fill();

            // 2. Stationary Signal Curve
            ctx.beginPath();
            ctx.strokeStyle = statColor;
            ctx.shadowColor = statColor;
            for (let i = 0; i < numSamples; i++) {
              const tau = tMin + i * dTau;
              const { vX, vH } = evalAtTau(tau);
              const val = flipTarget === 'h' ? vX : vH;
              const sx = toScreenX(tau, sShift);
              const sy = toScreenY(val, sGain);
              if (i === 0) ctx.moveTo(sx, sy);
              else ctx.lineTo(sx, sy);
            }
            ctx.stroke();

            // 3. Flipped & Shifted Signal Curve
            ctx.beginPath();
            ctx.strokeStyle = flipColor;
            ctx.shadowColor = flipColor;
            for (let i = 0; i < numSamples; i++) {
              const tau = tMin + i * dTau;
              const { vX, vH } = evalAtTau(tau);
              const val = flipTarget === 'h' ? vH : vX;
              const sx = toScreenX(tau, sShift);
              const sy = toScreenY(val, sGain);
              if (i === 0) ctx.moveTo(sx, sy);
              else ctx.lineTo(sx, sy);
            }
            ctx.stroke();

            // 4. Moving shift position marker line
            const markerX = toScreenX(shiftT, sShift);
            ctx.beginPath();
            ctx.strokeStyle = flipColor;
            ctx.lineWidth = 1.8;
            ctx.setLineDash([3, 3]);
            ctx.moveTo(markerX, padY - 4);
            ctx.lineTo(markerX, h - padY + 4);
            ctx.stroke();

            ctx.fillStyle = flipColor;
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`t=${shiftT.toFixed(1)}`, markerX, padY - 8);
          } else if (currentDtStep) {
            // Discrete Time Stems
            const statColor = flipTarget === 'h' ? COLOR_X : COLOR_H;
            const flipColor = flipTarget === 'h' ? COLOR_H : COLOR_X;
            const maxVal = Math.max(1, sigX.amplitude, sigH.amplitude);

            currentDtStep.kIndices.forEach((k: number, idx: number) => {
              const xK = currentDtStep.xSamples[idx];
              const hShift = currentDtStep.hFlippedSamples[idx];
              const isOverlap = Math.abs(xK) > 1e-4 && Math.abs(hShift) > 1e-4;

              const baseX = padX + ((k - (-10)) / 20) * plotW;
              const sx = baseX + (sShift / 20) * plotW;

              // Overlap highlight box
              if (isOverlap) {
                ctx.fillStyle = isGhost ? 'rgba(147, 51, 234, 0.12)' : 'rgba(147, 51, 234, 0.35)';
                ctx.fillRect(sx - 10, padY, 20, plotH);
              }

              // Flipped stem (Orange/Blue)
              if (Math.abs(hShift) > 1e-4) {
                const stemH = ((Math.abs(hShift) / maxVal) * (plotH * 0.45)) * sGain;
                ctx.fillStyle = flipColor;
                ctx.shadowColor = flipColor;
                ctx.fillRect(sx + 2, zeroY - stemH, 6, stemH);
              }

              // Stationary stem (Blue/Orange)
              if (Math.abs(xK) > 1e-4) {
                const stemH = ((Math.abs(xK) / maxVal) * (plotH * 0.45)) * sGain;
                ctx.fillStyle = statColor;
                ctx.shadowColor = statColor;
                ctx.fillRect(sx - 8, zeroY - stemH, 6, stemH);
              }
            });
          }
        }

        // ================= PLOT 2: Overlap Product & Area =================
        if (focusedPlot === 2) {
          if (domain === 'CT') {
            // Overlap Product Area Fill
            ctx.beginPath();
            let firstPt = true;
            for (let i = 0; i < numSamples; i++) {
              const tau = tMin + i * dTau;
              const { prod } = evalAtTau(tau);
              const sx = toScreenX(tau, sShift);
              const sy = toScreenY(prod, sGain);
              if (firstPt) {
                ctx.moveTo(sx, zeroY);
                firstPt = false;
              }
              ctx.lineTo(sx, sy);
            }
            ctx.lineTo(toScreenX(tMax, sShift), zeroY);
            ctx.closePath();
            ctx.fillStyle = isGhost ? 'rgba(147, 51, 234, 0.15)' : COLOR_OVERLAP_FILL;
            ctx.fill();

            // Product Outline Curve
            ctx.beginPath();
            ctx.strokeStyle = COLOR_OVERLAP;
            ctx.shadowColor = '#C084FC';
            for (let i = 0; i < numSamples; i++) {
              const tau = tMin + i * dTau;
              const { prod } = evalAtTau(tau);
              const sx = toScreenX(tau, sShift);
              const sy = toScreenY(prod, sGain);
              if (i === 0) ctx.moveTo(sx, sy);
              else ctx.lineTo(sx, sy);
            }
            ctx.stroke();
          } else if (currentDtStep) {
            // Discrete Product Stems
            const maxVal = Math.max(1, dtGrid?.peakValue || 1);
            currentDtStep.kIndices.forEach((k: number, idx: number) => {
              const prod = currentDtStep.productStems[idx];
              if (Math.abs(prod) > 1e-4) {
                const baseX = padX + ((k - (-10)) / 20) * plotW;
                const sx = baseX + (sShift / 20) * plotW;
                const stemH = ((Math.abs(prod) / maxVal) * (plotH * 0.55)) * sGain;

                ctx.fillStyle = COLOR_OVERLAP;
                ctx.shadowColor = '#C084FC';
                ctx.fillRect(sx - 4, zeroY - stemH, 8, stemH);

                if (!isGhost) {
                  ctx.fillStyle = '#E9D5FF';
                  ctx.font = 'bold 9px monospace';
                  ctx.textAlign = 'center';
                  ctx.fillText(prod.toFixed(2), sx, zeroY - stemH - 4);
                }
              }
            });
          }
        }

        // ================= PLOT 3: Total Convolution Output =================
        if (focusedPlot === 3) {
          if (domain === 'CT' && ctGrid) {
            // Future Curve Track (Translucent dashed)
            ctx.beginPath();
            ctx.strokeStyle = '#55A9A0';
            ctx.shadowColor = 'transparent';
            ctx.setLineDash([4, 4]);
            ctx.lineWidth = 2.0;
            for (let i = 0; i < ctGrid.tValues.length; i++) {
              const t = ctGrid.tValues[i];
              const y = ctGrid.yValues[i];
              const sx = toScreenX(t, sShift);
              const sy = toScreenY(y, sGain);
              if (i === 0) ctx.moveTo(sx, sy);
              else ctx.lineTo(sx, sy);
            }
            ctx.stroke();

            // Past Shaded Area up to shiftT
            ctx.beginPath();
            let hasPast = false;
            for (let i = 0; i < ctGrid.tValues.length; i++) {
              const t = ctGrid.tValues[i];
              if (t > shiftT) break;
              const y = ctGrid.yValues[i];
              const sx = toScreenX(t, sShift);
              const sy = toScreenY(y, sGain);
              if (!hasPast) {
                ctx.moveTo(sx, zeroY);
                hasPast = true;
              }
              ctx.lineTo(sx, sy);
            }
            if (hasPast) {
              const markerX = toScreenX(shiftT, sShift);
              ctx.lineTo(markerX, zeroY);
              ctx.closePath();
              ctx.fillStyle = isGhost ? 'rgba(85, 169, 160, 0.12)' : 'rgba(85, 169, 160, 0.28)';
              ctx.fill();
            }

            // Past Output Solid Path
            ctx.beginPath();
            ctx.strokeStyle = '#2A7B73';
            ctx.shadowColor = '#5EEAD4';
            ctx.setLineDash([]);
            ctx.lineWidth = 3.6;
            let startedPast = false;
            for (let i = 0; i < ctGrid.tValues.length; i++) {
              const t = ctGrid.tValues[i];
              if (t > shiftT) break;
              const y = ctGrid.yValues[i];
              const sx = toScreenX(t, sShift);
              const sy = toScreenY(y, sGain);
              if (!startedPast) {
                ctx.moveTo(sx, sy);
                startedPast = true;
              } else {
                ctx.lineTo(sx, sy);
              }
            }
            ctx.stroke();

            // Current Beacon Circle Marker
            if (!isGhost) {
              const curX = toScreenX(shiftT, sShift);
              const curY = toScreenY(currentOutputValue, sGain);
              ctx.beginPath();
              ctx.arc(curX, curY, 6.5, 0, 2 * Math.PI);
              ctx.fillStyle = '#FFF6B0';
              ctx.shadowColor = '#FFF6B0';
              ctx.shadowBlur = 10;
              ctx.fill();
              ctx.strokeStyle = '#2A7B73';
              ctx.lineWidth = 2.5;
              ctx.stroke();
            }
          } else if (dtGrid) {
            // Discrete Output Stems
            const maxVal = Math.max(1, dtGrid.peakValue);
            dtGrid.nValues.forEach((n: number, idx: number) => {
              const val = dtGrid.yValues[idx];
              const isCurrent = n === shiftN;
              const isPast = n <= shiftN;

              const baseX = padX + ((n - (-10)) / 20) * plotW;
              const sx = baseX + (sShift / 20) * plotW;
              const stemH = ((Math.abs(val) / maxVal) * (plotH * 0.6)) * sGain;

              ctx.fillStyle = isCurrent ? '#FFF6B0' : isPast ? '#2A7B73' : 'rgba(170, 238, 211, 0.4)';
              ctx.shadowColor = isCurrent ? '#FFF6B0' : '#2A7B73';
              ctx.fillRect(sx - 4, zeroY - stemH, 8, stemH);

              if (isCurrent && !isGhost) {
                ctx.strokeStyle = '#2A7B73';
                ctx.lineWidth = 2;
                ctx.strokeRect(sx - 4, zeroY - stemH, 8, stemH);
              }
            });
          }
        }

        ctx.restore();
      };

      // If user modified shift or gain, draw faint dashed ghost of original shape
      const isModified = previewShift !== 0 || previewGain !== 1.0;
      if (isModified) {
        renderShapes(0, 1.0, true);
      }

      // Draw primary projected shapes (live in sync with simulation)
      renderShapes(previewShift, previewGain, false);

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [
    focusedPlot,
    targetW,
    targetH,
    previewShift,
    previewGain,
    domain,
    flipTarget,
    sigX,
    sigH,
    shiftT,
    shiftN,
    currentOutputValue,
    ctGrid,
    dtGrid,
    currentDtStep,
  ]);

  // Labels for the small floating color key
  const colorKeyInfo = (() => {
    if (focusedPlot === 1) {
      const statLabel = flipTarget === 'h' ? (domain === 'CT' ? 'x(τ)' : 'x[k]') : (domain === 'CT' ? 'h(τ)' : 'h[k]');
      const flipLabel = flipTarget === 'h'
        ? (domain === 'CT' ? `h(${shiftT.toFixed(2)} - τ)` : `h[${shiftN} - k]`)
        : (domain === 'CT' ? `x(${shiftT.toFixed(2)} - τ)` : `x[${shiftN} - k]`);
      return [
        { label: `${statLabel} (Stationary)`, color: flipTarget === 'h' ? COLOR_X : COLOR_H },
        { label: `${flipLabel} (Flipped & Sliding)`, color: flipTarget === 'h' ? COLOR_H : COLOR_X },
        { label: 'Overlap Area', color: COLOR_OVERLAP },
      ];
    }
    if (focusedPlot === 2) {
      return [
        {
          label: domain === 'CT' ? 'Integrand f(τ) = x(τ)·h(t−τ)' : 'Product Terms x[k]·h[n−k]',
          color: COLOR_OVERLAP,
        },
        {
          label: domain === 'CT' ? `∫ Overlap = ${currentOutputValue.toFixed(3)}` : `∑ Overlap = ${currentOutputValue.toFixed(3)}`,
          color: '#C084FC',
        },
      ];
    }
    return [
      {
        label: domain === 'CT' ? 'Output y(t) = (x * h)(t)' : 'Output y[n] = (x * h)[n]',
        color: '#2A7B73',
      },
      {
        label: domain === 'CT' ? `Current: y(${shiftT.toFixed(2)}) = ${currentOutputValue.toFixed(3)}` : `Current: y[${shiftN}] = ${currentOutputValue.toFixed(3)}`,
        color: '#FFF6B0',
      },
    ];
  })();

  const plotTitle = focusedPlot === 1
    ? 'Focused view: Flip & Shift (Dummy Variable Domain: τ / k)'
    : focusedPlot === 2
    ? 'Focused view: Overlap Product & Area Accumulation'
    : 'Focused view: Total Convolution Output Response';

  const isModified = previewShift !== 0 || previewGain !== 1.0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={plotTitle}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#071D1A]/55 backdrop-blur-[3.5px] transition-opacity duration-200"
      onClick={(e) => {
        // Tap on dimmed backdrop closes projection
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Projected Box Container */}
      <div
        ref={containerRef}
        tabIndex={-1}
        onPointerEnter={handlePointerEnterContainer}
        onPointerLeave={handlePointerLeaveContainer}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleReset}
        style={{
          position: 'fixed',
          left: `${targetLeft}px`,
          top: `${targetTop}px`,
          width: `${targetW}px`,
          height: `${targetH}px`,
          transformOrigin: `${origCenterX - targetLeft}px ${origCenterY - targetTop}px`,
        }}
        className={`select-none rounded-2xl p-2 flex flex-col justify-between transition-all duration-200 ease-out ${
          isEntering && !prefersReducedMotion ? 'scale-100 opacity-100' : prefersReducedMotion ? 'opacity-100' : 'scale-90 opacity-0'
        } ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      >
        {/* Top Control Header: Floating Color Key, Live Shift/Gain Readout Pill, and Close Button */}
        <div className="flex items-center justify-between gap-2 px-2 pt-1 pointer-events-auto">
          {/* Floating Color Key */}
          <div className="flex flex-wrap items-center gap-2 bg-[#0E2824]/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-[#2A7B73]/60 shadow-lg text-[10.5px] font-mono text-white/90">
            {colorKeyInfo.map((k, i) => (
              <span key={i} className="flex items-center gap-1.5 font-semibold">
                <span className="w-2 h-2 rounded-full inline-block shadow-sm" style={{ backgroundColor: k.color }} />
                <span>{k.label}</span>
              </span>
            ))}
          </div>

          {/* Center Monospace Readout Pill */}
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 bg-[#0E2824]/90 backdrop-blur-md px-3 py-1 rounded-lg border border-[#55A9A0]/70 shadow-lg text-xs font-mono text-[#AAEED3]"
          >
            <span className="font-bold">
              Shift: {previewShift >= 0 ? '+' : ''}
              {domain === 'CT' ? `${previewShift.toFixed(2)} s` : `${Math.round(previewShift)} samples`}
            </span>
            <span className="text-white/40">•</span>
            <span className="font-bold">
              Gain: ×{previewGain.toFixed(2)}
            </span>

            {/* Small Reset Button */}
            {isModified && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleReset();
                }}
                className="ml-1 px-1.5 py-0.5 rounded bg-[#2A7B73] hover:bg-[#55A9A0] text-white text-[10px] font-bold flex items-center gap-1 transition cursor-pointer shadow-xs"
                title="Reset shift and gain to 1.0 (or press R / double-click)"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Close (X) Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="w-7 h-7 rounded-full bg-[#0E2824]/80 hover:bg-[#123A36] text-white flex items-center justify-center transition border border-[#2A7B73]/60 shadow-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#AAEED3]"
            aria-label="Close focus projection (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* High-DPI Overlay Canvas */}
        <div className="relative flex-1 w-full h-full my-1">
          <canvas
            ref={canvasRef}
            className="w-full h-full block"
            aria-hidden="true"
          />
        </div>

        {/* Bottom Hint Text (Fades out after 4s) */}
        <div
          className={`text-center text-[11px] font-mono text-white/70 tracking-wide transition-opacity duration-500 pb-0.5 select-none ${
            showHint ? 'opacity-100' : 'opacity-0'
          }`}
        >
          Drag to shift • Scroll or drag up/down to scale • Esc to close
        </div>
      </div>
    </div>
  );
};
