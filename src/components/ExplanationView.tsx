/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SignalConfig, ActiveTab } from '../types';
import {
  BookOpen,
  CheckCircle,
  HelpCircle,
  Layers,
  Cpu,
  ArrowRight,
  Lightbulb,
  Radio,
  Zap,
  Activity,
  AlertTriangle,
  Sparkles,
  Compass,
} from 'lucide-react';

interface ExplanationViewProps {
  onApplyExperiment: (
    name: string,
    updates: Partial<SignalConfig>,
    targetTab?: ActiveTab
  ) => void;
}

export const ExplanationView: React.FC<ExplanationViewProps> = ({
  onApplyExperiment,
}) => {
  const [selectedToken, setSelectedToken] = useState<string>('exp');
  const [quizAnswers, setQuizAnswers] = useState<{ [q: number]: number }>({});
  const [showResults, setShowResults] = useState<{ [q: number]: boolean }>({});

  const formulaTokens: { [key: string]: { label: string; title: string; desc: string } } = {
    Xk: {
      label: 'X[k]',
      title: 'Frequency Spectrum Bin k',
      desc: 'The complex number representation for frequency index k. Its magnitude |X[k]| is the amplitude of that frequency, and its angle is the phase offset.',
    },
    sum: {
      label: '∑ (n=0 to N-1)',
      title: 'Discrete Summation',
      desc: 'Sums all N time-domain samples together. In continuous time this is an integral from -∞ to +∞.',
    },
    xn: {
      label: 'x[n]',
      title: 'Time Domain Sample at index n',
      desc: 'The instantaneous amplitude of the input signal measured at discrete time t = n / f_s.',
    },
    exp: {
      label: 'e^{-j 2π k n / N}',
      title: 'Complex Exponent (Rotating Phasor)',
      desc: 'By Euler’s formula, e^{-jθ} = cos(θ) - j sin(θ). This wraps the signal around the complex unit circle at a rotational speed determined by frequency bin k.',
    },
  };

  const handleQuiz = (questionIndex: number, optionIndex: number) => {
    setQuizAnswers((prev) => ({ ...prev, [questionIndex]: optionIndex }));
    setShowResults((prev) => ({ ...prev, [questionIndex]: true }));
  };

  const quizzes = [
    {
      question: 'Why does the Center of Mass move away from zero when the winding frequency matches a constituent signal frequency?',
      options: [
        'Because noise is cancelled out automatically',
        'Because all signal peaks line up on the same side of the circle and reinforce each other',
        'Because the circle expands in diameter',
      ],
      correct: 1,
      explanation: 'At resonance, the negative exponential unwinds the rotation at the exact rate the signal oscillates, keeping peaks stationary on one side of the complex plane.',
    },
    {
      question: 'What is the algorithmic complexity improvement of Cooley-Tukey FFT over direct DFT?',
      options: [
        'From O(N²) to O(N log N)',
        'From O(N³) to O(N²)',
        'From O(2^N) to O(N)',
      ],
      correct: 0,
      explanation: 'For N=1024, FFT takes ~10,000 operations compared to 1,000,000 for direct DFT—over 100x faster!',
    },
    {
      question: 'What occurs when a signal frequency exceeds the Nyquist limit (f > fs / 2)?',
      options: [
        'The signal vanishes completely',
        'The signal gets amplified',
        'Aliasing occurs: the frequency reflects backward across the Nyquist threshold into a false lower frequency',
      ],
      correct: 2,
      explanation: 'Because there are fewer than 2 samples per oscillation cycle, the discrete points fit an identical slower sinusoid, producing an alias reflection at |f - fs|.',
    },
    {
      question: 'What is the physical meaning of Parseval’s Theorem?',
      options: [
        'Energy is strictly conserved between the time and frequency domains: ∑|x[n]|² = 1/N ∑|X[k]|²',
        'Frequency bins must always be integers',
        'The phase angle is always zero for real signals',
      ],
      correct: 0,
      explanation: 'Parseval’s theorem proves the Fourier Transform is a unitary transformation that preserves total Euclidean signal energy.',
    },
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white rounded-[14px] p-6 shadow-sm border border-[#AAEED3]/50">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="w-5 h-5 text-[#2A7B73]" />
          <h2 className="text-xl font-bold text-[#123A36]">
            Interactive Fourier Concepts & "What If?" Laboratory
          </h2>
        </div>
        <p className="text-sm text-[#123A36]/80 leading-relaxed">
          The Fourier Transform takes any composite signal and decomposes it into constituent pure harmonic sinusoids. Explore the 4 key theoretical pillars below, then launch the interactive <strong>"What If?"</strong> experiment cards to see real-time parameter changes in action!
        </p>
      </div>

      {/* SECTION 1: INTERACTIVE "WHAT IF?" EXPERIMENT CARDS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#2A7B73]" />
            <h3 className="font-bold text-base text-[#123A36]">
              Interactive "What If?" Action Cards
            </h3>
          </div>
          <span className="text-xs font-mono text-[#2A7B73]">
            Click any experiment to load parameters & navigate
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* What If 1: Aliasing */}
          <div className="p-4 rounded-xl bg-white border border-[#AAEED3]/70 shadow-2xs flex flex-col justify-between hover:border-[#55A9A0] transition-all">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <h4 className="font-bold text-sm text-[#123A36]">
                  What If: We Violate Nyquist?
                </h4>
              </div>
              <p className="text-xs text-[#123A36]/75 leading-relaxed mb-3">
                Sample a <strong>75 Hz</strong> tone at only <strong>fs = 100 Hz</strong> (Nyquist limit: 50 Hz). Watch the true 75 Hz tone fold across the 50 Hz barrier and alias down to 25 Hz!
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                onApplyExperiment(
                  'Induce Aliasing',
                  {
                    preset: 'aliasing-demo',
                    signalType: 'sine',
                    sampleRate: 100,
                    sampleCount: 256,
                    f1: 75,
                    a1: 1.2,
                    noiseLevel: 0,
                  },
                  'analyzer'
                )
              }
              className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-xs"
            >
              <span>Induce Aliasing</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* What If 2: Harmonic Superposition */}
          <div className="p-4 rounded-xl bg-white border border-[#AAEED3]/70 shadow-2xs flex flex-col justify-between hover:border-[#55A9A0] transition-all">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Layers className="w-4 h-4 text-[#2A7B73]" />
                <h4 className="font-bold text-sm text-[#123A36]">
                  What If: Superpose 3 Tones?
                </h4>
              </div>
              <p className="text-xs text-[#123A36]/75 leading-relaxed mb-3">
                Combine three simultaneous frequencies: <strong>15 Hz</strong> (bass), <strong>40 Hz</strong> (mid), and <strong>75 Hz</strong> (treble). See how the tangled time waveform cleanly separates into 3 sharp delta peaks!
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                onApplyExperiment(
                  'Superpose Harmonics',
                  {
                    preset: 'two-tones',
                    signalType: 'multi-tone',
                    sampleRate: 250,
                    sampleCount: 256,
                    f1: 15,
                    a1: 1.0,
                    noiseLevel: 0,
                    tones: [
                      { id: 't1', frequency: 15, amplitude: 1.0, phaseDeg: 0 },
                      { id: 't2', frequency: 40, amplitude: 0.7, phaseDeg: 45 },
                      { id: 't3', frequency: 75, amplitude: 0.45, phaseDeg: 90 },
                    ],
                  },
                  'analyzer'
                )
              }
              className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-[#2A7B73] hover:bg-[#123A36] text-white transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-xs"
            >
              <span>Superpose Harmonics</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* What If 3: White Noise Injection */}
          <div className="p-4 rounded-xl bg-white border border-[#AAEED3]/70 shadow-2xs flex flex-col justify-between hover:border-[#55A9A0] transition-all">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Activity className="w-4 h-4 text-[#55A9A0]" />
                <h4 className="font-bold text-sm text-[#123A36]">
                  What If: Buried in Noise?
                </h4>
              </div>
              <p className="text-xs text-[#123A36]/75 leading-relaxed mb-3">
                Inject heavy Gaussian white noise (<strong>σ = 0.65</strong>). The time trace looks completely chaotic, but the Fourier Transform concentrates signal energy into a clear 30 Hz spike!
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                onApplyExperiment(
                  'Inject Noise',
                  {
                    preset: 'noisy-signal',
                    signalType: 'sine',
                    sampleRate: 300,
                    sampleCount: 256,
                    f1: 30,
                    a1: 1.0,
                    noiseLevel: 0.65,
                  },
                  'analyzer'
                )
              }
              className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-[#2A7B73] hover:bg-[#123A36] text-white transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-xs"
            >
              <span>Inject Noise (σ = 0.65)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* What If 4: 3Blue1Brown Winding Resonance */}
          <div className="p-4 rounded-xl bg-white border border-[#AAEED3]/70 shadow-2xs flex flex-col justify-between hover:border-[#55A9A0] transition-all">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Compass className="w-4 h-4 text-[#2A7B73]" />
                <h4 className="font-bold text-sm text-[#123A36]">
                  What If: Test Winding Resonance?
                </h4>
              </div>
              <p className="text-xs text-[#123A36]/75 leading-relaxed mb-3">
                Load a <strong>20 Hz</strong> pure sine wave and launch the Geometric Winding Machine. Sweep winding frequency to 20 Hz to watch the center of mass pull dramatically away from the origin!
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                onApplyExperiment(
                  'Winding Machine at 20 Hz',
                  {
                    preset: 'pure-tone',
                    signalType: 'sine',
                    sampleRate: 200,
                    sampleCount: 128,
                    f1: 20,
                    a1: 1.2,
                    noiseLevel: 0,
                  },
                  'animator'
                )
              }
              className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-[#55A9A0] hover:bg-[#2A7B73] text-white transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-xs"
            >
              <span>Open Winding Machine</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* What If 5: Benchmark N = 1024 */}
          <div className="p-4 rounded-xl bg-white border border-[#AAEED3]/70 shadow-2xs flex flex-col justify-between hover:border-[#55A9A0] transition-all">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Cpu className="w-4 h-4 text-[#2A7B73]" />
                <h4 className="font-bold text-sm text-[#123A36]">
                  What If: Scale N to 1024?
                </h4>
              </div>
              <p className="text-xs text-[#123A36]/75 leading-relaxed mb-3">
                Jump from N=64 to <strong>N=1024</strong>. Direct DFT must evaluate 1,048,576 complex products, while Cooley-Tukey FFT finishes in just 10,240 operations—over <strong>100x speedup</strong>!
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                onApplyExperiment(
                  'Benchmark N=1024',
                  {
                    sampleCount: 1024,
                    sampleRate: 512,
                    algorithm: 'both',
                  },
                  'analyzer'
                )
              }
              className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-[#2A7B73] hover:bg-[#123A36] text-white transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-xs"
            >
              <span>Benchmark N = 1024</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* What If 6: Spectral Leakage vs Windowing */}
          <div className="p-4 rounded-xl bg-white border border-[#AAEED3]/70 shadow-2xs flex flex-col justify-between hover:border-[#55A9A0] transition-all">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Zap className="w-4 h-4 text-[#2A7B73]" />
                <h4 className="font-bold text-sm text-[#123A36]">
                  What If: Non-Integer Bins?
                </h4>
              </div>
              <p className="text-xs text-[#123A36]/75 leading-relaxed mb-3">
                Set a frequency of <strong>17.3 Hz</strong> which doesn't fit neatly into sampling bins. Observe the resulting spectral leakage skirts and switch to Hann window to suppress side lobes!
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                onApplyExperiment(
                  'Spectral Leakage',
                  {
                    f1: 17.3,
                    sampleRate: 200,
                    sampleCount: 128,
                    windowType: 'rectangular',
                  },
                  'analyzer'
                )
              }
              className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-[#2A7B73] hover:bg-[#123A36] text-white transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-xs"
            >
              <span>Test Spectral Leakage</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 2: 4 THEORETICAL PILLARS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Pillar 1: Time vs Frequency Duality */}
        <div className="bg-white rounded-[14px] p-5 shadow-sm border border-[#AAEED3]/50 flex flex-col justify-between">
          <div>
            <div className="w-8 h-8 rounded-lg bg-[#AAEED3]/40 border border-[#AAEED3] flex items-center justify-center mb-3">
              <span className="font-bold text-sm text-[#2A7B73]">1</span>
            </div>
            <h4 className="font-bold text-sm text-[#123A36] mb-1">
              Time Domain vs Frequency Domain Duality
            </h4>
            <p className="text-xs text-[#123A36]/80 leading-relaxed">
              In the <strong>Time Domain</strong>, a signal is an instantaneous amplitude value measured sequentially at times <span className="font-mono text-[#2A7B73]">t = n / f_s</span>. In the <strong>Frequency Domain</strong>, the same signal is viewed along an orthogonal axis as a superposition of constituent sinusoidal oscillations, each with a distinct magnitude <span className="font-mono text-[#2A7B73]">|X[k]|</span> and phase angle <span className="font-mono text-[#2A7B73]">∠X[k]</span>.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#AAEED3]/30 text-[11px] font-mono text-[#2A7B73]">
            Duality: Time Duration ↔ Frequency Bandwidth
          </div>
        </div>

        {/* Pillar 2: The Geometric Winding Machine */}
        <div className="bg-white rounded-[14px] p-5 shadow-sm border border-[#AAEED3]/50 flex flex-col justify-between">
          <div>
            <div className="w-8 h-8 rounded-lg bg-[#AAEED3]/40 border border-[#AAEED3] flex items-center justify-center mb-3">
              <span className="font-bold text-sm text-[#2A7B73]">2</span>
            </div>
            <h4 className="font-bold text-sm text-[#123A36] mb-1">
              The Geometric Winding Machine Intuition
            </h4>
            <p className="text-xs text-[#123A36]/80 leading-relaxed">
              Multiplying <span className="font-mono text-[#2A7B73]">x[n]</span> by <span className="font-mono text-[#2A7B73]">e^{`{-j 2π f_wind t}`}</span> winds the waveform in circular loops in the 2D complex plane. When <span className="font-mono text-[#2A7B73]">f_wind</span> matches a frequency present in the signal, the wave oscillations match the winding speed, keeping signal peaks all gathered on one side. The <strong>Center of Mass</strong> shifts outward, exactly giving the Fourier Transform magnitude and phase!
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#AAEED3]/30 text-[11px] font-mono text-[#2A7B73]">
            Resonance = Center of Mass Displaced from (0,0)
          </div>
        </div>

        {/* Pillar 3: Nyquist-Shannon Sampling Theorem & Aliasing */}
        <div className="bg-white rounded-[14px] p-5 shadow-sm border border-[#AAEED3]/50 flex flex-col justify-between">
          <div>
            <div className="w-8 h-8 rounded-lg bg-[#AAEED3]/40 border border-[#AAEED3] flex items-center justify-center mb-3">
              <span className="font-bold text-sm text-[#2A7B73]">3</span>
            </div>
            <h4 className="font-bold text-sm text-[#123A36] mb-1">
              Nyquist-Shannon Theorem & Aliasing
            </h4>
            <p className="text-xs text-[#123A36]/80 leading-relaxed">
              To reconstruct a signal unambiguously, the sampling rate must be at least twice the maximum frequency: <span className="font-mono text-[#2A7B73]">f_s &gt; 2 f_max</span>. The threshold <span className="font-mono text-[#2A7B73]">f_N = f_s / 2</span> is the <strong>Nyquist Limit</strong>. Any component above this frequency folds backward into the spectrum as a mirror reflection: <span className="font-mono text-[#2A7B73]">f_alias = |f - k·f_s|</span>.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#AAEED3]/30 text-[11px] font-mono text-[#2A7B73]">
            Nyquist Barrier: f_N = f_s / 2
          </div>
        </div>

        {/* Pillar 4: DFT vs FFT Algorithmic Complexity */}
        <div className="bg-white rounded-[14px] p-5 shadow-sm border border-[#AAEED3]/50 flex flex-col justify-between">
          <div>
            <div className="w-8 h-8 rounded-lg bg-[#AAEED3]/40 border border-[#AAEED3] flex items-center justify-center mb-3">
              <span className="font-bold text-sm text-[#2A7B73]">4</span>
            </div>
            <h4 className="font-bold text-sm text-[#123A36] mb-1">
              DFT vs. Cooley-Tukey FFT Algorithmic Complexity
            </h4>
            <p className="text-xs text-[#123A36]/80 leading-relaxed">
              Direct matrix DFT evaluates <span className="font-mono text-[#2A7B73]">N²</span> complex multiplications. The 1965 Cooley-Tukey FFT recursively decomposes the transform into even and odd indices via butterfly stages, reducing operations to <span className="font-mono text-[#2A7B73]">N log₂ N</span>. For N=1024, operations drop from 1,048,576 to 10,240—over a 100x acceleration!
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#AAEED3]/30 text-[11px] font-mono text-[#2A7B73]">
            Complexity: O(N²) → O(N log₂ N)
          </div>
        </div>
      </div>

      {/* SECTION 3: INTERACTIVE FORMULA EXPLORER */}
      <div className="bg-white rounded-[14px] p-6 shadow-sm border border-[#AAEED3]/50">
        <h3 className="font-bold text-base text-[#123A36] mb-2 flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#2A7B73]" />
          Interactive Discrete Fourier Transform (DFT) Formula
        </h3>
        <p className="text-xs text-[#123A36]/70 mb-4">
          Click any token of the formula below to inspect its mathematical role:
        </p>

        {/* Formula Bar */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 p-4 bg-[#F3FAF7] rounded-xl border border-[#AAEED3] font-mono text-base sm:text-lg mb-4">
          {Object.entries(formulaTokens).map(([key, item]) => {
            const isSelected = selectedToken === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedToken(key)}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#2A7B73] text-white shadow-xs scale-105'
                    : 'bg-white text-[#123A36] border border-[#AAEED3] hover:bg-[#AAEED3]/30'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Selected token explanation callout */}
        {selectedToken && (
          <div className="p-4 rounded-xl bg-[#FAFCFB] border border-[#2A7B73]/40 text-xs text-[#123A36]">
            <h4 className="font-bold text-sm text-[#2A7B73] mb-1">
              {formulaTokens[selectedToken].title}
            </h4>
            <p className="leading-relaxed">
              {formulaTokens[selectedToken].desc}
            </p>
          </div>
        )}
      </div>

      {/* SECTION 4: INTERACTIVE KNOWLEDGE CHECK */}
      <div className="bg-white rounded-[14px] p-6 shadow-sm border border-[#AAEED3]/50">
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle className="w-5 h-5 text-[#2A7B73]" />
          <h3 className="font-bold text-base text-[#123A36]">
            Interactive Knowledge Check Quiz
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quizzes.map((q, qIdx) => (
            <div
              key={`quiz-${qIdx}`}
              className="p-4 rounded-xl bg-[#F3FAF7] border border-[#AAEED3]/60 flex flex-col justify-between"
            >
              <div>
                <p className="text-xs font-bold text-[#123A36] mb-2.5">
                  {qIdx + 1}. {q.question}
                </p>

                <div className="space-y-1.5">
                  {q.options.map((opt, optIdx) => {
                    const isSelected = quizAnswers[qIdx] === optIdx;
                    const isSubmitted = showResults[qIdx];
                    const isCorrect = optIdx === q.correct;

                    let btnStyle =
                      'bg-white border-[#AAEED3] text-[#123A36] hover:bg-[#AAEED3]/30';
                    if (isSubmitted) {
                      if (isCorrect) {
                        btnStyle =
                          'bg-[#AAEED3] border-[#2A7B73] text-[#123A36] font-semibold';
                      } else if (isSelected) {
                        btnStyle = 'bg-rose-100 border-rose-400 text-rose-800';
                      }
                    }

                    return (
                      <button
                        key={`opt-${optIdx}`}
                        type="button"
                        onClick={() => handleQuiz(qIdx, optIdx)}
                        className={`w-full text-left p-2 rounded-lg border text-xs transition-colors flex items-center justify-between cursor-pointer ${btnStyle}`}
                      >
                        <span>{opt}</span>
                        {isSubmitted && isCorrect && (
                          <CheckCircle className="w-3.5 h-3.5 text-[#2A7B73] shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {showResults[qIdx] && (
                <div className="mt-3 p-2.5 rounded-lg bg-white border border-[#AAEED3] text-xs text-[#123A36] flex items-start gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-[#2A7B73] shrink-0 mt-0.5" />
                  <span>{q.explanation}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
