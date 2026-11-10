/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  ActiveTab,
  SignalConfig,
  SignalPreset,
  TopicModuleId,
  TopicModuleMeta,
  ToastMessage,
  TransformResult,
} from './types';
import {
  computeDFT,
  computeFFTRadix2,
  computeIDFT,
  generateSignal,
  benchmarkTransforms,
} from './math/fourier';

import { TopicSidebar } from './components/TopicSidebar';
import { SidebarControls } from './components/SidebarControls';
import { TimeDomainPlot } from './components/TimeDomainPlot';
import { FrequencyDomainPlot } from './components/FrequencyDomainPlot';
import { WindingAnimator } from './components/WindingAnimator';
import { ExplanationView } from './components/ExplanationView';
import { ToastContainer } from './components/ToastContainer';

// Additional modules from the Signals & Systems topics
import { EulersIdentityModule } from './components/modules/EulersIdentityModule';
import { FourierSeriesModule } from './components/modules/FourierSeriesModule';
import { ConvolutionModule } from './components/modules/ConvolutionModule';
import { SignalsOpsModule } from './components/modules/SignalsOpsModule';
import { RandomVariablesModule } from './components/modules/RandomVariablesModule';
import { RandomProcessesModule } from './components/modules/RandomProcessesModule';

import {
  Activity,
  PlayCircle,
  HelpCircle,
  ShieldCheck,
  Zap,
  Info,
  CheckCircle,
  Sparkles,
  Menu,
  Sun,
  Moon,
} from 'lucide-react';

const MODULES_LIST: TopicModuleMeta[] = [
  {
    id: 'signals_ops',
    code: 'A',
    title: 'Signals & Operations',
    subtitle: 'Synthesis, Shifts, Scaling & Interchange Bus',
    description: '12 canonical waveform generators, time transformations y(t) = A·x(a(t-t₀)), Nyquist aliasing checker, analytical statistics, and standard JSON/CSV interchange.',
  },
  {
    id: 'eulers_identity',
    code: 'B',
    title: "Euler's Identity",
    subtitle: 'Rotating Phasors & Dual Projections',
    description: 'Complex exponential e^(jθ) = cos(θ) + j sin(θ) with orthogonal sinusoidal projections.',
  },
  {
    id: 'fourier_series',
    code: 'C',
    title: 'Fourier Series',
    subtitle: 'Harmonic Synthesis & Gibbs Ringing',
    description: 'Periodic waveforms synthesized from discrete harmonic frequencies and Gibbs phenomenon analysis.',
  },
  {
    id: 'fourier_transform',
    code: 'D',
    title: 'Fourier Transform & FFT',
    subtitle: 'DFT, Magnitude, Phase, Winding & IDFT',
    description: 'Continuous spectrum decomposition, Cooley-Tukey FFT, phasor winding machine, and IDFT roundtrip.',
  },
  {
    id: 'convolution',
    code: 'E',
    title: 'Convolution',
    subtitle: '3 Synchronized Plots & Overlap Area',
    description: 'Interactive LTI convolution: flip, shift, product overlap area, and accumulated output response.',
  },
  {
    id: 'random_variables',
    code: 'F',
    title: 'Probability Functions of Random Signals',
    subtitle: 'Live Stochastic Signal, PMF, PDF, CDF & Tables',
    description: 'Generates random data signals with live animation, calculates discrete PMF, continuous PDF, right-continuous CDF, mean & variance convergence, and full data tables.',
  },
  {
    id: 'random_processes',
    code: 'G',
    title: 'Random Processes & PSD',
    subtitle: 'Autocorrelation, Lag Workout & Wiener–Khinchin PSD',
    description: 'Interactive stochastic signal generator, time-lagging comparative workout for R_xx(τ), raw periodogram, Welch ensemble averaging, and Wiener–Khinchin theorem verification.',
  },
];

const DEFAULT_CONFIG: SignalConfig = {
  preset: 'pure-tone',
  signalType: 'sine',
  sampleCount: 256,
  sampleRate: 200,
  f1: 20.0,
  a1: 1.0,
  phase1Deg: 0,
  f2: 40.0,
  a2: 0.7,
  f3: 60.0,
  a3: 0.4,
  tones: [
    { id: 't1', frequency: 15.0, amplitude: 1.0, phaseDeg: 0 },
    { id: 't2', frequency: 40.0, amplitude: 0.7, phaseDeg: 45 },
  ],
  noiseLevel: 0.0,
  windowType: 'rectangular',
  algorithm: 'both',
  scale: 'normalized',
  showPhase: false,
  showIDFT: false,
  pulseWidth: 0.2,
};

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('analyzer');
  const [currentModuleId, setCurrentModuleId] = useState<TopicModuleId>('random_variables');
  const [config, setConfig] = useState<SignalConfig>(DEFAULT_CONFIG);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isTopicSidebarCollapsed, setIsTopicSidebarCollapsed] = useState<boolean>(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Toggle theme between light (default) and dark mode
  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  // Sync data-theme attribute on root document element
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme]);

  // Toggle left topic sidebar on every screen size (desktop collapse or mobile drawer)
  const handleToggleSidebar = useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsMobileNavOpen((prev) => !prev);
    } else {
      setIsTopicSidebarCollapsed((prev) => !prev);
    }
  }, []);

  // Trigger resize event after transition completes so all plots and canvases adapt
  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 280);
    return () => clearTimeout(timer);
  }, [isTopicSidebarCollapsed]);

  // Add toast helper
  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Generate signal data
  const { rawSignal, windowedSignal, timeArray } = useMemo(() => {
    return generateSignal(config.signalType, {
      sampleCount: config.sampleCount,
      sampleRate: config.sampleRate,
      f1: config.f1,
      a1: config.a1,
      phase1Deg: config.phase1Deg,
      f2: config.f2,
      a2: config.a2,
      f3: config.f3,
      a3: config.a3,
      tones: config.tones,
      noiseLevel: config.noiseLevel,
      windowType: config.windowType,
      pulseWidth: config.pulseWidth,
    });
  }, [config]);

  // Compute Fourier Transform based on chosen algorithm
  const transformResult: TransformResult = useMemo(() => {
    if (config.algorithm === 'dft') {
      return computeDFT(windowedSignal, config.sampleRate);
    }
    // FFT or Both: radix-2 FFT
    return computeFFTRadix2(windowedSignal, undefined, config.sampleRate);
  }, [windowedSignal, config.sampleRate, config.algorithm]);

  // Live execution benchmark timings comparing DFT vs FFT in milliseconds
  const benchmark = useMemo(() => {
    return benchmarkTransforms(windowedSignal, config.sampleRate);
  }, [windowedSignal, config.sampleRate]);

  // Compute reconstructed IDFT signal if requested
  const reconstructedSignal: number[] = useMemo(() => {
    if (!config.showIDFT) return [];
    return computeIDFT(transformResult.real, transformResult.imag);
  }, [config.showIDFT, transformResult]);

  // Highest configured constituent frequency for aliasing checks
  const highestConfiguredFreq = useMemo(() => {
    if (config.signalType === 'multi-tone' && config.tones.length > 0) {
      return Math.max(...config.tones.map((t) => t.frequency));
    }
    return config.f1;
  }, [config.signalType, config.tones, config.f1]);

  // Detected peak frequencies
  const detectedPeaks = useMemo(() => {
    const halfN = Math.floor(transformResult.n / 2);
    const normMags = transformResult.normalizedMagnitude.slice(0, halfN + 1);
    const maxVal = Math.max(...normMags, 0.05);
    const threshold = maxVal * 0.15;
    const peaks: number[] = [];

    for (let i = 0; i <= halfN; i++) {
      const prev = i > 0 ? normMags[i - 1] : 0;
      const curr = normMags[i];
      const next = i < halfN ? normMags[i + 1] : 0;
      if (curr > threshold && curr >= prev && curr >= next) {
        peaks.push(transformResult.frequencies[i]);
      }
    }
    return peaks;
  }, [transformResult]);

  // Config handlers
  const handleUpdateConfig = (newConfig: Partial<SignalConfig>) => {
    setConfig((prev) => ({ ...prev, ...newConfig }));
  };

  const handleApplyPreset = (preset: SignalPreset) => {
    let updates: Partial<SignalConfig> = { preset };

    switch (preset) {
      case 'pure-tone':
      case 'sine':
        updates = {
          preset: 'pure-tone',
          signalType: 'sine',
          f1: 20.0,
          a1: 1.0,
          phase1Deg: 0,
          sampleRate: 200,
          sampleCount: 256,
          noiseLevel: 0,
        };
        break;
      case 'two-tones':
      case 'multi-tone':
        updates = {
          preset: 'two-tones',
          signalType: 'multi-tone',
          sampleRate: 200,
          sampleCount: 256,
          noiseLevel: 0,
          tones: [
            { id: 't1', frequency: 15.0, amplitude: 1.0, phaseDeg: 0 },
            { id: 't2', frequency: 40.0, amplitude: 0.7, phaseDeg: 45 },
          ],
        };
        break;
      case 'square-wave':
      case 'square':
        updates = {
          preset: 'square-wave',
          signalType: 'square',
          f1: 10.0,
          a1: 1.0,
          phase1Deg: 0,
          sampleRate: 200,
          sampleCount: 256,
          noiseLevel: 0,
        };
        break;
      case 'sawtooth-wave':
      case 'sawtooth':
        updates = {
          preset: 'sawtooth-wave',
          signalType: 'sawtooth',
          f1: 12.0,
          a1: 1.0,
          phase1Deg: 0,
          sampleRate: 200,
          sampleCount: 256,
          noiseLevel: 0,
        };
        break;
      case 'noisy-signal':
        updates = {
          preset: 'noisy-signal',
          signalType: 'sine',
          f1: 25.0,
          a1: 1.0,
          phase1Deg: 0,
          sampleRate: 250,
          sampleCount: 256,
          noiseLevel: 0.5,
        };
        break;
      case 'aliasing-demo':
        updates = {
          preset: 'aliasing-demo',
          signalType: 'sine',
          f1: 75.0,
          a1: 1.2,
          phase1Deg: 0,
          sampleRate: 100, // Nyquist is 50 Hz, 75 Hz aliases to 25 Hz!
          sampleCount: 256,
          noiseLevel: 0,
        };
        break;
      case 'pulse':
        updates = { preset, signalType: 'sine', f1: 2.0, a1: 1.5, pulseWidth: 0.25, noiseLevel: 0 };
        break;
      case 'damped':
        updates = { preset, signalType: 'sine', f1: 8.0, a1: 1.5, noiseLevel: 0 };
        break;
      case 'chirp':
        updates = { preset, signalType: 'sine', f1: 2.0, a1: 1.0, noiseLevel: 0 };
        break;
    }

    setConfig((prev) => ({ ...prev, ...updates }));
    addToast({
      title: `Loaded ${preset.replace('-', ' ').toUpperCase()} Preset`,
      description: 'Signal parameters and Fourier spectrum updated in real time.',
      type: 'info',
    });
  };

  const handleApplyExperiment = (
    name: string,
    updates: Partial<SignalConfig>,
    targetTab?: ActiveTab
  ) => {
    setConfig((prev) => ({ ...prev, ...updates }));
    if (targetTab) {
      setActiveTab(targetTab);
    }
    addToast({
      title: `Loaded Experiment: ${name}`,
      description: 'Parameters updated. Observe the changes in real time!',
      type: 'info',
    });
  };

  const handleResetDefaults = () => {
    setConfig(DEFAULT_CONFIG);
    addToast({
      title: 'Parameters Reset',
      description: 'Default sampling rates and frequencies restored.',
      type: 'info',
    });
  };

  const handleModuleSelect = (moduleId: string) => {
    setCurrentModuleId(moduleId as TopicModuleId);
    const mod = MODULES_LIST.find((m) => m.id === moduleId);
    if (mod) {
      addToast({
        title: `Switched to Topic ${mod.code}`,
        description: mod.title,
        type: 'info',
      });
    }
  };

  // Parseval's energy verification: ∑ |x[n]|² vs 1/N ∑ |X[k]|²
  const timeEnergy = useMemo(() => {
    return windowedSignal.reduce((sum, x) => sum + x * x, 0);
  }, [windowedSignal]);

  const freqEnergy = useMemo(() => {
    const N = transformResult.n;
    const sumMagSq = transformResult.magnitude.reduce((sum: number, m: number) => sum + m * m, 0);
    return sumMagSq / N;
  }, [transformResult]);

  const energyMatchRatio = timeEnergy > 0 ? (freqEnergy / timeEnergy) * 100 : 100;

  const currentModule = MODULES_LIST.find((m) => m.id === currentModuleId) || MODULES_LIST[3];

  return (
    <div className="min-h-screen flex bg-[#F3FAF7] text-[#123A36] overflow-x-hidden" data-theme={theme}>
      {/* Fixed Left Sidebar (Desktop) & Off-canvas Drawer (Mobile) */}
      <TopicSidebar
        currentModuleId={currentModuleId}
        onSelectModule={(id) => handleModuleSelect(id)}
        modules={MODULES_LIST}
        mobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
        isCollapsed={isTopicSidebarCollapsed}
      />

      {/* Main Content Column to the Right of the Sidebar */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Bar with Hamburger Menu Button (Every screen size, including desktop & fullscreen) */}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-[#AAEED3]/60 px-4 py-2.5 sm:px-6 flex items-center justify-between shadow-xs shrink-0">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleToggleSidebar}
              className="p-2 rounded-lg bg-[#F3FAF7] border border-[#AAEED3] text-[#123A36] hover:bg-[#AAEED3]/30 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#2A7B73] focus:outline-none"
              aria-label="Toggle sidebar"
              title="Toggle sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#2A7B73] flex items-center justify-center shadow-xs">
                <Activity className="w-4 h-4 text-[#FFF6B0]" />
              </div>
              <span className="font-heading font-bold text-sm text-[#123A36]">
                Group 3 - Project
              </span>
            </div>
          </div>
          <span className="text-xs font-mono font-bold bg-[#AAEED3]/40 text-[#2A7B73] border border-[#AAEED3] px-2.5 py-0.5 rounded-md">
            Topic {currentModule.code}
          </span>
        </header>

        {/* Main Container */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
          {/* Module Header Ribbon */}
          {currentModuleId !== 'convolution' && currentModuleId !== 'signals_ops' && currentModuleId !== 'fourier_series' && (
            <div className="bg-white rounded-[14px] p-4 sm:p-5 shadow-sm border border-[#AAEED3]/50 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-[#2A7B73] text-white flex items-center justify-center font-mono font-bold text-base shadow-xs">
                  {currentModule.code}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="font-heading font-bold text-lg sm:text-xl text-[#123A36]">
                      {currentModule.title}
                    </h1>
                    <span className="hidden sm:inline text-xs font-mono px-2 py-0.5 rounded font-semibold bg-[#AAEED3]/30 text-[#2A7B73] border border-[#AAEED3]">
                      Interactive Topic
                    </span>
                  </div>
                  <p className="text-xs text-[#123A36]/75 mt-0.5">
                    {currentModule.subtitle} &bull; {currentModule.description}
                  </p>
                </div>
              </div>

              {/* Right Top Topic/Project Badge */}
              <span className="text-xs font-mono px-3 py-1 rounded-full font-semibold bg-[#AAEED3]/30 text-[#2A7B73] border border-[#AAEED3]">
                Group 3 - Project
              </span>
            </div>
          )}

        {/* View Switcher based on Active Module & Tab */}
        {currentModuleId === 'fourier_transform' ? (
          <>
            {activeTab === 'analyzer' && (
              <div className="flex flex-col lg:flex-row items-start gap-6">
                {/* Left Collapsible Control Panel */}
                <SidebarControls
                  config={config}
                  onChangeConfig={handleUpdateConfig}
                  isCollapsed={isSidebarCollapsed}
                  onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                  onApplyPreset={handleApplyPreset}
                  onResetDefaults={handleResetDefaults}
                  benchmark={benchmark}
                />

                {/* Right Plots Area */}
                <div className="flex-1 w-full flex flex-col gap-6 min-w-0">
                  {/* Energy & Sampling Metrics Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white rounded-xl p-3 shadow-xs border border-[#AAEED3]/50">
                      <span className="text-[11px] font-medium text-[#2A7B73] block">
                        Parseval Energy Match
                      </span>
                      <span className="font-mono font-bold text-sm text-[#123A36]">
                        {energyMatchRatio.toFixed(2)}% Match
                      </span>
                    </div>

                    <div className="bg-white rounded-xl p-3 shadow-xs border border-[#AAEED3]/50">
                      <span className="text-[11px] font-medium text-[#2A7B73] block">
                        Nyquist Limit (f_s / 2)
                      </span>
                      <span className="font-mono font-bold text-sm text-[#123A36]">
                        {(config.sampleRate / 2).toFixed(1)} Hz
                      </span>
                    </div>

                    <div className="bg-white rounded-xl p-3 shadow-xs border border-[#AAEED3]/50">
                      <span className="text-[11px] font-medium text-[#2A7B73] block">
                        Bin Resolution &Delta;f
                      </span>
                      <span className="font-mono font-bold text-sm text-[#123A36]">
                        {(config.sampleRate / config.sampleCount).toFixed(2)} Hz
                      </span>
                    </div>

                    <div className="bg-white rounded-xl p-3 shadow-xs border border-[#AAEED3]/50">
                      <span className="text-[11px] font-medium text-[#2A7B73] block">
                        Active Transform
                      </span>
                      <span className="font-mono font-bold text-sm text-[#2A7B73] uppercase">
                        {config.algorithm}
                      </span>
                    </div>
                  </div>

                  {/* Time Domain Plot (Teal) */}
                  <TimeDomainPlot
                    timeArray={timeArray}
                    signal={windowedSignal}
                    reconstructedSignal={reconstructedSignal}
                    sampleRate={config.sampleRate}
                    sampleCount={config.sampleCount}
                    showIDFT={config.showIDFT}
                    onToggleIDFT={() =>
                      handleUpdateConfig({ showIDFT: !config.showIDFT })
                    }
                    windowType={config.windowType}
                  />

                  {/* Frequency Domain Plot (Deep Teal & Pale Yellow Highlights) */}
                  <FrequencyDomainPlot
                    transform={transformResult}
                    sampleRate={config.sampleRate}
                    scale={config.scale}
                    onChangeScale={(scale) => handleUpdateConfig({ scale })}
                    showPhase={config.showPhase}
                    onTogglePhase={() =>
                      handleUpdateConfig({ showPhase: !config.showPhase })
                    }
                    algorithm={config.algorithm}
                    configuredHighestFreq={highestConfiguredFreq}
                    timeEnergy={timeEnergy}
                  />
                </div>
              </div>
            )}

            {activeTab === 'animator' && (
              <WindingAnimator
                signal={windowedSignal}
                sampleRate={config.sampleRate}
                detectedPeaks={detectedPeaks}
              />
            )}

            {activeTab === 'explain' && (
              <ExplanationView onApplyExperiment={handleApplyExperiment} />
            )}
          </>
        ) : (
          /* Render Specialized Interactive Module when switched to any of the other 8 topics */
          <div>
            {currentModuleId === 'signals_ops' && <SignalsOpsModule />}
            {currentModuleId === 'eulers_identity' && <EulersIdentityModule />}
            {currentModuleId === 'fourier_series' && <FourierSeriesModule />}
            {currentModuleId === 'convolution' && <ConvolutionModule />}
            {currentModuleId === 'random_variables' && <RandomVariablesModule />}
            {currentModuleId === 'random_processes' && <RandomProcessesModule />}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto py-6 border-t border-[#AAEED3]/50 bg-white text-[#123A36]/80 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#123A36]">
              Group 3 - Project
            </span>
            <span>&bull;</span>
            <span>Signals &amp; Systems Interactive Lab</span>
          </div>

          <div className="flex items-center font-mono text-[11px] text-[#2A7B73]">
            <button
              type="button"
              onClick={handleToggleTheme}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#AAEED3] bg-[#F3FAF7] text-[#123A36] text-[11.5px] font-mono font-medium hover:bg-[#AAEED3]/30 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2A7B73] shadow-2xs"
              aria-label="Toggle light or dark theme"
              title="Toggle light or dark theme"
            >
              {theme === 'light' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-[#2A7B73]" />
                  <span>Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-[#58C2B3]" />
                  <span>Dark</span>
                </>
              )}
            </button>
          </div>
        </div>
      </footer>
      </div>

      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
