/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  DistributionType,
  DistributionParams,
  DEFAULT_PARAMS,
  DISTRIBUTIONS_META,
  generateSamples,
  generateSingleSample,
  isDiscreteDistribution,
  getTheoreticalStats,
  calculateSampleStats,
  computeDiscretePMF,
  computeContinuousPDF,
} from '../../math/distributions';
import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  TrendingUp,
  Table,
  BarChart2,
  Activity,
  Sliders,
  Download,
  Copy,
  ChevronDown,
  Layers,
  Upload,
  FileText,
  CheckCircle,
  HelpCircle,
  Radio,
  Zap,
  Info,
} from 'lucide-react';

export const RandomVariablesModule: React.FC = () => {
  // Step 1: Signal Source mode ('generate' = random stochastic models, 'custom' = user entered / CSV)
  const [sourceMode, setSourceMode] = useState<'generate' | 'custom'>('generate');

  // Step 2: Variable Domain ('continuous' = PDF/smooth CDF, 'discrete' = PMF/staircase CDF)
  const [domainMode, setDomainMode] = useState<'continuous' | 'discrete'>('continuous');

  // Distribution selection & parameters
  const [distType, setDistType] = useState<DistributionType>('gaussian');
  const [params, setParams] = useState<DistributionParams>(DEFAULT_PARAMS);
  const [sampleCount, setSampleCount] = useState<number>(250);

  // Custom data input state
  const [customText, setCustomText] = useState<string>('');
  const [customError, setCustomError] = useState<string | null>(null);

  // Dropdown state for distribution selector around signal plot
  const [isDistDropdownOpen, setIsDistDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Active samples state
  const [samples, setSamples] = useState<number[]>(() =>
    generateSamples('gaussian', DEFAULT_PARAMS, 250)
  );

  // Live animation / streaming state
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [streamSpeed, setStreamSpeed] = useState<number>(30); // samples per second
  const [isGeneratingAnim, setIsGeneratingAnim] = useState<boolean>(false);
  const [isSweepingN, setIsSweepingN] = useState<boolean>(false);

  // Active view tab in lower workspace
  const [activeTableTab, setActiveTableTab] = useState<'distribution' | 'samples' | 'guide'>('distribution');
  const [sampleTablePage, setSampleTablePage] = useState<number>(1);
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);

  // Interactive inspection hover for plots
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [cdfHoverX, setCdfHoverX] = useState<number | null>(null);

  // Streaming & sweep interval refs
  const streamTimerRef = useRef<number | null>(null);
  const sweepTimerRef = useRef<number | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDistDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Check if currently discrete
  const isDiscrete = useMemo(() => {
    if (sourceMode === 'custom') {
      return domainMode === 'discrete';
    }
    return isDiscreteDistribution(distType, params);
  }, [sourceMode, domainMode, distType, params]);

  // Synchronize distribution when switching domainMode
  const handleDomainChange = (newDomain: 'continuous' | 'discrete') => {
    setDomainMode(newDomain);
    setIsStreaming(false);

    if (newDomain === 'continuous') {
      // If currently on a discrete model, switch to Gaussian (AWGN)
      if (['bernoulli', 'binomial', 'poisson', 'geometric'].includes(distType)) {
        setDistType('gaussian');
        setSamples(generateSamples('gaussian', params, sampleCount));
      }
    } else {
      // If currently on a continuous model, switch to Bernoulli (Bit error)
      if (['gaussian', 'rayleigh', 'exponential'].includes(distType) || (distType === 'uniform' && !params.uniformIsDiscrete)) {
        setDistType('bernoulli');
        setSamples(generateSamples('bernoulli', params, sampleCount));
      }
    }
    setSampleTablePage(1);
  };

  // Theoretical stats
  const theoreticalStats = useMemo(
    () => getTheoreticalStats(distType, params),
    [distType, params]
  );

  // Empirical stats
  const sampleStats = useMemo(
    () => calculateSampleStats(samples),
    [samples]
  );

  // Discrete PMF entries
  const discreteEntries = useMemo(() => {
    if (!isDiscrete) return [];
    return computeDiscretePMF(samples, distType, params);
  }, [samples, isDiscrete, distType, params]);

  // Continuous PDF entries
  const continuousData = useMemo(() => {
    if (isDiscrete) {
      return { bins: [], rangeMin: 0, rangeMax: 1, binWidth: 1, maxDensity: 1 };
    }
    return computeContinuousPDF(samples, distType, params, 32);
  }, [samples, isDiscrete, distType, params]);

  // Handler to vary sample size smoothly (Law of Large Numbers)
  const handleSampleCountChange = useCallback((newCount: number) => {
    const clamped = Math.max(10, Math.min(5000, Math.round(newCount)));
    setSampleCount(clamped);
    if (sourceMode === 'generate') {
      setSamples((prev) => {
        if (clamped > prev.length) {
          const additional = generateSamples(distType, params, clamped - prev.length);
          return [...prev, ...additional];
        } else if (clamped < prev.length) {
          return prev.slice(0, clamped);
        }
        return prev;
      });
    }
    setSampleTablePage(1);
  }, [distType, params, sourceMode]);

  // Automated Sample Size Sweep (LLN Demonstration: ramp N from 25 to 3000)
  const handleToggleSweepN = useCallback(() => {
    if (isSweepingN) {
      if (sweepTimerRef.current) clearInterval(sweepTimerRef.current);
      setIsSweepingN(false);
      return;
    }

    setIsStreaming(false);
    setIsSweepingN(true);
    let currentN = 25;
    handleSampleCountChange(currentN);

    sweepTimerRef.current = window.setInterval(() => {
      currentN = Math.round(currentN * 1.35);
      if (currentN >= 3000) {
        currentN = 3000;
        handleSampleCountChange(currentN);
        if (sweepTimerRef.current) clearInterval(sweepTimerRef.current);
        setIsSweepingN(false);
      } else {
        handleSampleCountChange(currentN);
      }
    }, 450);
  }, [isSweepingN, handleSampleCountChange]);

  // Handler to generate fresh batch of samples
  const handleGenerateSignal = useCallback(() => {
    setIsGeneratingAnim(true);
    const newSamples = generateSamples(distType, params, sampleCount);
    setSamples(newSamples);
    setSampleTablePage(1);

    setTimeout(() => {
      setIsGeneratingAnim(false);
    }, 300);
  }, [distType, params, sampleCount]);

  // Update a single parameter helper
  const updateParam = <K extends keyof DistributionParams>(
    key: K,
    val: DistributionParams[K]
  ) => {
    const nextParams = { ...params, [key]: val };
    setParams(nextParams);
    if (sourceMode === 'generate') {
      setSamples(generateSamples(distType, nextParams, sampleCount));
    }
  };

  // Re-generate samples on distribution change
  const handleDistChange = (newType: DistributionType) => {
    setDistType(newType);
    setIsDistDropdownOpen(false);
    setSamples(generateSamples(newType, params, sampleCount));
    setSampleTablePage(1);
    setHoverIndex(null);
  };

  // Live streaming ticker
  useEffect(() => {
    if (!isStreaming) {
      if (streamTimerRef.current) clearInterval(streamTimerRef.current);
      return;
    }

    const intervalMs = Math.max(16, Math.floor(1000 / streamSpeed));
    streamTimerRef.current = window.setInterval(() => {
      const newSample = generateSingleSample(distType, params);
      setSamples((prev) => {
        const currentLength = sampleCount;
        const base = prev.length >= currentLength ? prev.slice(prev.length - currentLength + 1) : prev;
        return [...base, newSample];
      });
    }, intervalMs);

    return () => {
      if (streamTimerRef.current) clearInterval(streamTimerRef.current);
    };
  }, [isStreaming, streamSpeed, distType, params, sampleCount]);

  // Cleanup sweep timer on unmount
  useEffect(() => {
    return () => {
      if (sweepTimerRef.current) clearInterval(sweepTimerRef.current);
    };
  }, []);

  // Single step sample injection
  const handleStepOnce = () => {
    const newSample = generateSingleSample(distType, params);
    setSamples((prev) => [...prev.slice(1), newSample]);
  };

  // Reset to default sample batch
  const handleReset = () => {
    setIsStreaming(false);
    if (sweepTimerRef.current) clearInterval(sweepTimerRef.current);
    setIsSweepingN(false);
    setParams(DEFAULT_PARAMS);
    setSamples(generateSamples(distType, DEFAULT_PARAMS, sampleCount));
    setSampleTablePage(1);
  };

  // Custom data parsing helper
  const handleParseCustomData = (rawText: string) => {
    setCustomText(rawText);
    try {
      const tokens = rawText
        .replace(/[,;\t\r\n]+/g, ' ')
        .trim()
        .split(' ')
        .filter((t) => t.length > 0);

      if (tokens.length === 0) {
        setCustomError('Please enter at least one numeric sample');
        return;
      }

      const parsed = tokens.map((t) => {
        const val = Number(t);
        if (isNaN(val)) throw new Error(`Invalid number token: "${t}"`);
        return val;
      });

      if (parsed.length < 5) {
        setCustomError('Please provide at least 5 numeric samples for meaningful statistics');
        return;
      }

      setCustomError(null);
      setSamples(parsed);
      setSampleCount(parsed.length);
      setSampleTablePage(1);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setCustomError(err.message);
      } else {
        setCustomError('Failed to parse numeric data');
      }
    }
  };

  // Preset loader for custom laboratory data
  const loadCustomPreset = (presetName: string) => {
    let data: number[] = [];
    if (presetName === 'awgn') {
      // Oscilloscope ADC Noise
      data = Array.from({ length: 200 }, () => (Math.random() - 0.5) * 1.8 + (Math.random() - 0.5) * 1.8);
      setDomainMode('continuous');
    } else if (presetName === '4pam') {
      // 4-PAM symbols: -3, -1, 1, 3
      const symbols = [-3, -1, 1, 3];
      data = Array.from({ length: 240 }, () => symbols[Math.floor(Math.random() * 4)]);
      setDomainMode('discrete');
    } else if (presetName === 'rayleigh') {
      // Multipath envelope
      data = Array.from({ length: 220 }, () => {
        const x = (Math.random() - 0.5) * 2;
        const y = (Math.random() - 0.5) * 2;
        return Math.sqrt(x * x + y * y);
      });
      setDomainMode('continuous');
    } else if (presetName === 'poisson') {
      // Packet arrival counts
      data = Array.from({ length: 250 }, () => {
        let k = 0, p = 1, L = Math.exp(-3.2);
        do { k++; p *= Math.random(); } while (p > L);
        return k - 1;
      });
      setDomainMode('discrete');
    }
    const text = data.map((v) => (Number.isInteger(v) ? v.toString() : v.toFixed(3))).join(', ');
    setCustomText(text);
    setSamples(data);
    setSampleCount(data.length);
    setCustomError(null);
  };

  // File upload reader
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        handleParseCustomData(content);
      }
    };
    reader.readAsText(file);
  };

  // CSV export helper
  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    if (activeTableTab === 'distribution') {
      if (isDiscrete) {
        csvContent += 'Outcome_k,Count,Empirical_PMF,Theoretical_PMF,Abs_Delta,Empirical_CDF,Theoretical_CDF\n';
        discreteEntries.forEach((row) => {
          csvContent += `${row.k},${row.count},${row.empiricalProb.toFixed(5)},${row.theoreticalProb.toFixed(5)},${row.deltaProb.toFixed(5)},${row.empiricalCDF.toFixed(5)},${row.theoreticalCDF.toFixed(5)}\n`;
        });
      } else {
        csvContent += 'Bin_Index,Range_Start,Range_End,Midpoint,Count,Empirical_Density,Theoretical_Density,Empirical_CDF,Theoretical_CDF\n';
        continuousData.bins.forEach((b) => {
          csvContent += `${b.binIndex},${b.xStart.toFixed(4)},${b.xEnd.toFixed(4)},${b.xMid.toFixed(4)},${b.count},${b.empiricalDensity.toFixed(4)},${b.theoreticalDensity.toFixed(4)},${b.empiricalCDF.toFixed(4)},${b.theoreticalCDF.toFixed(4)}\n`;
        });
      }
    } else {
      csvContent += 'Sample_Index,Signal_Xn,Deviation_from_Mean,Squared_Deviation\n';
      samples.forEach((val, i) => {
        const dev = val - sampleStats.mean;
        csvContent += `${i},${val.toFixed(5)},${dev.toFixed(5)},${(dev * dev).toFixed(5)}\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `random_signal_${distType}_data.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setCopiedNotification('CSV file downloaded');
    setTimeout(() => setCopiedNotification(null), 3000);
  };

  // Copy values to clipboard
  const handleCopyTable = () => {
    let text = '';
    if (activeTableTab === 'distribution') {
      if (isDiscrete) {
        text = 'k\tCount\tEmp PMF\tTheo PMF\tEmp CDF\tTheo CDF\n';
        discreteEntries.forEach((row) => {
          text += `${row.k}\t${row.count}\t${row.empiricalProb.toFixed(4)}\t${row.theoreticalProb.toFixed(4)}\t${row.empiricalCDF.toFixed(4)}\t${row.theoreticalCDF.toFixed(4)}\n`;
        });
      } else {
        text = 'Interval\tMid\tCount\tEmp Density\tTheo Density\tEmp CDF\n';
        continuousData.bins.forEach((b) => {
          text += `[${b.xStart.toFixed(2)}, ${b.xEnd.toFixed(2)})\t${b.xMid.toFixed(2)}\t${b.count}\t${b.empiricalDensity.toFixed(3)}\t${b.theoreticalDensity.toFixed(3)}\t${b.empiricalCDF.toFixed(3)}\n`;
        });
      }
    } else {
      text = 'n\tX[n]\t(X[n] - μ)\n';
      samples.slice(0, 100).forEach((val, i) => {
        text += `${i}\t${val.toFixed(4)}\t${(val - sampleStats.mean).toFixed(4)}\n`;
      });
    }

    navigator.clipboard.writeText(text);
    setCopiedNotification('Table copied to clipboard');
    setTimeout(() => setCopiedNotification(null), 3000);
  };

  // Meta for active distribution
  const meta = DISTRIBUTIONS_META[distType] || DISTRIBUTIONS_META.gaussian;

  // Filtered lists of distributions based on domainMode
  const availableDistributions = useMemo(() => {
    if (domainMode === 'continuous') {
      return (['gaussian', 'uniform', 'rayleigh', 'exponential'] as DistributionType[]).map(
        (id) => DISTRIBUTIONS_META[id]
      );
    } else {
      return (['bernoulli', 'binomial', 'poisson', 'geometric'] as DistributionType[]).map(
        (id) => DISTRIBUTIONS_META[id]
      );
    }
  }, [domainMode]);

  // Discrepancy percentages
  const meanDelta = Math.abs(sampleStats.mean - theoreticalStats.mean);
  const varDelta = Math.abs(sampleStats.variance - theoreticalStats.variance);

  return (
    <div className="space-y-5">
      {/* =========================================================================
          TOP COMMAND DECK: NEAT & MODERN TWO-STEP CONFIGURATION
          Step 1: Signal Source (Generate vs Enter My Own)
          Step 2: Variable Domain (Continuous vs Discrete)
          ========================================================================= */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-[#AAEED3]/60 transition-all">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Header & Course Subtitle */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-7 h-7 rounded-lg bg-[#2A7B73] text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                F
              </span>
              <h2 className="text-lg font-bold text-[#123A36]">
                Probability Functions of Random Signals
              </h2>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-[#F3FAF7] text-[#2A7B73] border-[#AAEED3]">
                ECE Comms Lab
              </span>
            </div>
            <p className="text-xs text-[#123A36]/75 max-w-2xl leading-relaxed">
              Explore how continuous channel noise (AWGN, fading) and discrete digital symbols (bits, frames)
              converge to their theoretical density (PDF) and mass (PMF) through the Law of Large Numbers.
            </p>
          </div>

          {/* Interactive Stepped Control Deck */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Step 1: Signal Source Selector */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold tracking-wider uppercase text-[#2A7B73] flex items-center gap-1">
                <span className="w-3.5 h-3.5 rounded-full bg-[#AAEED3] text-[#123A36] text-[9px] flex items-center justify-center font-black">1</span>
                Signal Source
              </span>
              <div className="inline-flex p-1 bg-[#F3FAF7] rounded-xl border border-[#AAEED3]/80 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setSourceMode('generate')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    sourceMode === 'generate'
                      ? 'bg-[#2A7B73] text-white shadow-xs'
                      : 'text-[#123A36] hover:bg-white/80'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Generate Random Signal</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSourceMode('custom')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    sourceMode === 'custom'
                      ? 'bg-[#2A7B73] text-white shadow-xs'
                      : 'text-[#123A36] hover:bg-white/80'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Enter My Own</span>
                </button>
              </div>
            </div>

            {/* Step 2: Variable Domain Selector (Discrete vs Continuous) */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold tracking-wider uppercase text-[#2A7B73] flex items-center gap-1">
                <span className="w-3.5 h-3.5 rounded-full bg-[#AAEED3] text-[#123A36] text-[9px] flex items-center justify-center font-black">2</span>
                Variable Domain
              </span>
              <div className="inline-flex p-1 bg-[#F3FAF7] rounded-xl border border-[#AAEED3]/80 shadow-2xs">
                <button
                  type="button"
                  onClick={() => handleDomainChange('continuous')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    domainMode === 'continuous'
                      ? 'bg-[#2A7B73] text-white shadow-xs'
                      : 'text-[#123A36] hover:bg-white/80'
                  }`}
                  title="Analog channel voltages, thermal AWGN, continuous PDF & smooth CDF"
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Continuous</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDomainChange('discrete')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    domainMode === 'discrete'
                      ? 'bg-[#2A7B73] text-white shadow-xs'
                      : 'text-[#123A36] hover:bg-white/80'
                  }`}
                  title="Digital bit decisions, error counts, discrete PMF & staircase CDF"
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  <span>Discrete</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Custom Data Input Deck (Shown only when Step 1 is "Enter My Own") */}
        {sourceMode === 'custom' && (
          <div className="mt-4 pt-4 border-t border-[#AAEED3]/50 bg-[#FAFCFB] -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 p-4 sm:p-5 rounded-b-2xl animate-in fade-in duration-200">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#2A7B73]" />
                <h4 className="text-xs font-bold text-[#123A36] uppercase tracking-wider">
                  Custom Process Data Entry (Lab Samples / CSV Paste)
                </h4>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-[#123A36]/70 text-[11px]">Lab Presets:</span>
                <button
                  type="button"
                  onClick={() => loadCustomPreset('awgn')}
                  className="px-2 py-0.5 rounded bg-white border border-[#AAEED3] text-[#2A7B73] text-[11px] font-medium hover:bg-[#F3FAF7]"
                >
                  AWGN Noise
                </button>
                <button
                  type="button"
                  onClick={() => loadCustomPreset('4pam')}
                  className="px-2 py-0.5 rounded bg-white border border-[#AAEED3] text-[#2A7B73] text-[11px] font-medium hover:bg-[#F3FAF7]"
                >
                  4-PAM Symbols
                </button>
                <button
                  type="button"
                  onClick={() => loadCustomPreset('rayleigh')}
                  className="px-2 py-0.5 rounded bg-white border border-[#AAEED3] text-[#2A7B73] text-[11px] font-medium hover:bg-[#F3FAF7]"
                >
                  Multipath Envelope
                </button>
                <button
                  type="button"
                  onClick={() => loadCustomPreset('poisson')}
                  className="px-2 py-0.5 rounded bg-white border border-[#AAEED3] text-[#2A7B73] text-[11px] font-medium hover:bg-[#F3FAF7]"
                >
                  Packet Arrivals
                </button>
              </div>
            </div>

            <textarea
              value={customText}
              onChange={(e) => handleParseCustomData(e.target.value)}
              placeholder="Paste numbers separated by commas, spaces, or newlines (e.g., 0.12, -0.45, 0.88, 1.25, -0.05, 0.63, -1.1)..."
              rows={3}
              className="w-full text-xs font-mono p-3 rounded-xl border border-[#AAEED3] bg-white text-[#123A36] focus:outline-none focus:ring-2 focus:ring-[#2A7B73] resize-y shadow-2xs"
            />

            <div className="flex flex-wrap items-center justify-between gap-3 mt-2 text-xs">
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-[#AAEED3] text-[#2A7B73] font-medium cursor-pointer hover:bg-[#F3FAF7]">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload .csv / .txt</span>
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                <span className="text-[11px] text-[#123A36]/60">
                  Parsed: <strong className="text-[#2A7B73] font-mono">{samples.length}</strong> valid samples
                </span>
              </div>

              {customError && (
                <span className="text-red-600 text-[11px] font-medium bg-red-50 px-2 py-0.5 rounded border border-red-200">
                  {customError}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          MAIN SIGNAL PLOT WITH PERIMETER CONTROLS:
          - Distribution Dropdown button right around the signal plot
          - Primary Generate Button
          - Step +1
          - Live Stream Button & Streaming Rate
          - Buffer badge & Reset
          ========================================================================= */}
      <div className="bg-white rounded-2xl p-5 shadow-xs border border-[#AAEED3]/60 space-y-4">
        {/* Signal Plot Header & Perimeter Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[#AAEED3]/40">
          {/* Left Side: Distribution Dropdown + Trace Title */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Real-Time Distribution Dropdown Button */}
            {sourceMode === 'generate' && (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsDistDropdownOpen((prev) => !prev)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#F3FAF7] border border-[#AAEED3] text-[#123A36] font-bold text-xs hover:border-[#2A7B73] hover:bg-white transition-all shadow-2xs cursor-pointer group"
                  aria-expanded={isDistDropdownOpen}
                  aria-label="Select distribution model"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2A7B73] group-hover:scale-110 transition-transform" />
                  <span className="text-[#123A36] font-semibold">{meta.name}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#AAEED3]/40 text-[#2A7B73] hidden sm:inline">
                    {meta.tag}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-[#2A7B73] transition-transform duration-200 ${
                      isDistDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Dropdown Menu Popover */}
                {isDistDropdownOpen && (
                  <div className="absolute left-0 top-full mt-1.5 w-72 sm:w-80 bg-white rounded-2xl shadow-xl border border-[#AAEED3] p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#2A7B73] flex items-center justify-between">
                      <span>{domainMode === 'continuous' ? 'Continuous Stochastic Models' : 'Discrete Stochastic Models'}</span>
                      <span className="font-mono text-[#123A36]/60">{availableDistributions.length} Models</span>
                    </div>

                    <div className="space-y-1">
                      {availableDistributions.map((d) => {
                        const isSelected = distType === d.id;
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => handleDistChange(d.id)}
                            className={`w-full text-left p-2.5 rounded-xl text-xs transition-all flex items-start justify-between cursor-pointer ${
                              isSelected
                                ? 'bg-[#2A7B73] text-white shadow-xs'
                                : 'hover:bg-[#F3FAF7] text-[#123A36]'
                            }`}
                          >
                            <div>
                              <div className="font-bold flex items-center gap-1.5">
                                <span>{d.name}</span>
                              </div>
                              <div className={`text-[10px] mt-0.5 line-clamp-1 ${isSelected ? 'text-white/80' : 'text-[#123A36]/65'}`}>
                                {d.commsRelevance}
                              </div>
                            </div>
                            <span
                              className={`text-[9px] font-mono font-medium px-1.5 py-0.5 rounded whitespace-nowrap ml-2 ${
                                isSelected ? 'bg-white/20 text-white' : 'bg-[#AAEED3]/30 text-[#2A7B73]'
                              }`}
                            >
                              {d.tag}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Title & Domain Badge */}
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#2A7B73]" />
              <span className="font-bold text-sm text-[#123A36]">Random Data Signal: X[n]</span>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-[#F3FAF7] text-[#2A7B73] border border-[#AAEED3]/60">
                N = {samples.length}
              </span>
            </div>
          </div>

          {/* Right Side: Primary Generate, Step +1, Live Stream Radar & Reset */}
          <div className="flex flex-wrap items-center gap-2">
            {/* PRIMARY GENERATE BUTTON */}
            {sourceMode === 'generate' && (
              <button
                type="button"
                onClick={handleGenerateSignal}
                disabled={isStreaming}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs text-white transition-all shadow-xs cursor-pointer ${
                  isGeneratingAnim
                    ? 'scale-95 bg-[#123A36]'
                    : isStreaming
                    ? 'bg-slate-300 cursor-not-allowed opacity-60'
                    : 'bg-[#2A7B73] hover:bg-[#123A36] hover:shadow-sm'
                }`}
                title="Generate fresh random stochastic sequence"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isGeneratingAnim ? 'animate-spin' : ''}`} />
                <span>Generate Signal</span>
              </button>
            )}

            {/* STEP +1 BUTTON */}
            {sourceMode === 'generate' && (
              <button
                type="button"
                onClick={handleStepOnce}
                disabled={isStreaming}
                title="Inject 1 single new random sample (observe LLN tick by tick)"
                className="px-2.5 py-2 rounded-xl border border-[#AAEED3] bg-white text-[#123A36] text-xs font-semibold hover:bg-[#F3FAF7] transition-colors cursor-pointer disabled:opacity-50"
              >
                +1 Step
              </button>
            )}

            {/* LIVE STREAM RADAR BUTTON */}
            {sourceMode === 'generate' && (
              <div className="flex items-center gap-1.5 bg-[#F3FAF7] p-1 rounded-xl border border-[#AAEED3]/60">
                <button
                  type="button"
                  onClick={() => setIsStreaming(!isStreaming)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isStreaming
                      ? 'bg-amber-600 text-white shadow-xs animate-pulse'
                      : 'bg-[#55A9A0] text-white hover:bg-[#2A7B73]'
                  }`}
                  title="Simulate continuous oscilloscope data acquisition"
                >
                  {isStreaming ? (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-current" />
                      <span>Streaming...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Live Stream</span>
                    </>
                  )}
                </button>

                {/* Stream Speed Selector */}
                <select
                  value={streamSpeed}
                  onChange={(e) => setStreamSpeed(parseInt(e.target.value, 10))}
                  aria-label="Stream speed rate in samples per second"
                  className="bg-white border border-[#AAEED3] rounded-md px-1.5 py-1 text-[11px] font-mono text-[#123A36] cursor-pointer focus:outline-none"
                >
                  <option value={10}>10/s</option>
                  <option value={30}>30/s</option>
                  <option value={60}>60/s</option>
                  <option value={100}>100/s</option>
                </select>
              </div>
            )}

            {/* RESET BUTTON */}
            <button
              type="button"
              onClick={handleReset}
              title="Reset parameters & sample pool"
              className="p-2 rounded-xl text-[#2A7B73] bg-white border border-[#AAEED3] hover:bg-[#AAEED3]/30 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Signal Canvas / SVG Visualization */}
        <div className="relative w-full aspect-[21/8] min-h-[220px] bg-[#FAFCFB] rounded-xl border border-[#AAEED3] p-3 overflow-hidden select-none">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 1000 300" preserveAspectRatio="none">
            <defs>
              <linearGradient id="rvCorridorGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#AAEED3" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#AAEED3" stopOpacity="0.1" />
              </linearGradient>
            </defs>

            {(() => {
              // Calculate Y boundaries
              const minVal = Math.min(sampleStats.min, theoreticalStats.mean - 2.5 * theoreticalStats.std);
              const maxVal = Math.max(sampleStats.max, theoreticalStats.mean + 2.5 * theoreticalStats.std);
              const yMargin = (maxVal - minVal) * 0.15 || 1.0;
              const yMin = minVal - yMargin;
              const yMax = maxVal + yMargin;
              const ySpan = yMax - yMin;

              const toSvgY = (v: number) => 300 - ((v - yMin) / ySpan) * 280 - 10;
              const toSvgX = (idx: number) => (idx / Math.max(1, samples.length - 1)) * 980 + 10;

              const zeroY = toSvgY(0);
              const meanY = toSvgY(sampleStats.mean);
              const topSigmaY = toSvgY(sampleStats.mean + sampleStats.std);
              const botSigmaY = toSvgY(sampleStats.mean - sampleStats.std);

              // Build line path
              const linePoints = samples.map((v, i) => `${toSvgX(i)},${toSvgY(v)}`).join(' ');

              return (
                <g>
                  {/* Grid Lines */}
                  <line x1="10" y1={zeroY} x2="990" y2={zeroY} stroke="#123A36" strokeOpacity="0.15" strokeWidth="1" />

                  {/* Standard deviation corridor (±1σ) */}
                  <rect
                    x="10"
                    y={Math.min(topSigmaY, botSigmaY)}
                    width="980"
                    height={Math.abs(botSigmaY - topSigmaY)}
                    fill="url(#rvCorridorGrad)"
                  />

                  {/* Sample Mean Line */}
                  <line
                    x1="10"
                    y1={meanY}
                    x2="990"
                    y2={meanY}
                    stroke="#2A7B73"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />

                  {/* Discrete Stems or Continuous Wave */}
                  {isDiscrete ? (
                    // Stem Plot for Discrete Variables
                    samples.map((v, i) => {
                      if (samples.length > 250 && i % Math.ceil(samples.length / 250) !== 0) return null;
                      const sx = toSvgX(i);
                      const sy = toSvgY(v);
                      return (
                        <g key={`stem-${i}`}>
                          <line
                            x1={sx}
                            y1={zeroY}
                            x2={sx}
                            y2={sy}
                            stroke="#55A9A0"
                            strokeWidth={samples.length > 500 ? '0.75' : samples.length > 100 ? '1' : '1.5'}
                            opacity={0.85}
                          />
                          {samples.length <= 250 && (
                            <circle
                              cx={sx}
                              cy={sy}
                              r={samples.length > 100 ? '2' : '3'}
                              fill="#2A7B73"
                              className="cursor-pointer hover:r-5 transition-all"
                              onMouseEnter={() => setHoverIndex(i)}
                              onMouseLeave={() => setHoverIndex(null)}
                            />
                          )}
                        </g>
                      );
                    })
                  ) : (
                    // Continuous Wave / Line Plot
                    <>
                      <polyline
                        fill="none"
                        stroke="#2A7B73"
                        strokeWidth="1.75"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        points={linePoints}
                      />
                      {samples.length <= 150 &&
                        samples.map((v, i) => {
                          const sx = toSvgX(i);
                          const sy = toSvgY(v);
                          return (
                            <circle
                              key={`pt-${i}`}
                              cx={sx}
                              cy={sy}
                              r={hoverIndex === i ? 5 : 2.5}
                              fill={hoverIndex === i ? '#FFF6B0' : '#2A7B73'}
                              stroke="#123A36"
                              strokeWidth={hoverIndex === i ? 1.5 : 0.5}
                              className="cursor-pointer transition-all"
                              onMouseEnter={() => setHoverIndex(i)}
                              onMouseLeave={() => setHoverIndex(null)}
                            />
                          );
                        })}
                    </>
                  )}

                  {/* Real-time streaming scanning needle when animating */}
                  {isStreaming && (
                    <line
                      x1="990"
                      y1="10"
                      x2="990"
                      y2="290"
                      stroke="#2A7B73"
                      strokeWidth="3"
                      strokeOpacity="0.8"
                    />
                  )}
                </g>
              );
            })()}
          </svg>

          {/* Hover Inspector Tooltip */}
          {hoverIndex !== null && hoverIndex < samples.length && (
            <div className="absolute top-3 right-4 bg-white/95 backdrop-blur-xs p-2.5 rounded-lg shadow-md border border-[#AAEED3] text-xs font-mono pointer-events-none z-20">
              <div className="text-[10px] text-[#2A7B73] font-semibold">Sample Inspector:</div>
              <div>Index n: <strong className="text-[#123A36]">{hoverIndex}</strong></div>
              <div>Value X[n]: <strong className="text-[#2A7B73]">{samples[hoverIndex].toFixed(4)}</strong></div>
              <div>Deviation (X[n] - μ): <span className="text-[#123A36]/75">{(samples[hoverIndex] - sampleStats.mean).toFixed(4)}</span></div>
            </div>
          )}
        </div>

        {/* Oscilloscope Sub-Bar */}
        <div className="flex flex-wrap items-center justify-between text-[11px] text-[#123A36]/70 px-1">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-[#2A7B73]" />
              <span>Trace Sequence</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 border-t border-dashed border-[#55A9A0]" />
              <span>Mean x̄ = {sampleStats.mean.toFixed(2)}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2 rounded-xs bg-[#AAEED3]/60" />
              <span>±1σ Band [{ (sampleStats.mean - sampleStats.std).toFixed(2) }, { (sampleStats.mean + sampleStats.std).toFixed(2) }]</span>
            </span>
          </div>
          <span className="font-mono text-[#2A7B73]">
            SE = σ/√N ≈ {(theoreticalStats.std / Math.sqrt(sampleCount)).toFixed(3)}
          </span>
        </div>

        {/* =========================================================================
            PARAMETER TUNING & SAMPLE SIZE SUITE:
            Directly at the bottom of the Signal Plot (as requested)
            ========================================================================= */}
        <div className="pt-4 border-t border-[#AAEED3]/50">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left: Dynamic Distribution Parameter Sliders */}
            <div className="lg:col-span-7 bg-[#FAFCFB] p-4 rounded-xl border border-[#AAEED3]/60 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#123A36] uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-[#2A7B73]" />
                  Tune Distribution Parameters
                </span>
                <span className="text-[11px] font-mono text-[#2A7B73]">
                  {meta.name}
                </span>
              </div>

              {/* Sliders tailored to the active distribution */}
              {distType === 'gaussian' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-[#123A36]">DC Mean (μ):</span>
                      <span className="font-mono font-bold text-[#2A7B73] tabular-nums">
                        {params.gaussianMean.toFixed(2)} V
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-5"
                      max="5"
                      step="0.25"
                      value={params.gaussianMean}
                      onChange={(e) => updateParam('gaussianMean', parseFloat(e.target.value))}
                      className="w-full accent-[#2A7B73] cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-[#123A36]/50">
                      <span>-5.0 V</span>
                      <span>0.0 V (Zero Mean)</span>
                      <span>+5.0 V</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-[#123A36]">Noise RMS (σ):</span>
                      <span className="font-mono font-bold text-[#2A7B73] tabular-nums">
                        {params.gaussianStd.toFixed(2)} V (σ²: {(params.gaussianStd ** 2).toFixed(2)})
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.2"
                      max="3.0"
                      step="0.1"
                      value={params.gaussianStd}
                      onChange={(e) => updateParam('gaussianStd', parseFloat(e.target.value))}
                      className="w-full accent-[#2A7B73] cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-[#123A36]/50">
                      <span>0.2 V (Low Noise)</span>
                      <span>1.0 V</span>
                      <span>3.0 V (Heavy AWGN)</span>
                    </div>
                  </div>
                </div>
              )}

              {distType === 'uniform' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-[#123A36]">Lower Bound (a):</span>
                        <span className="font-mono font-bold text-[#2A7B73] tabular-nums">
                          {params.uniformMin.toFixed(1)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="-10"
                        max={params.uniformMax - 1}
                        step="0.5"
                        value={params.uniformMin}
                        onChange={(e) => updateParam('uniformMin', parseFloat(e.target.value))}
                        className="w-full accent-[#2A7B73] cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-[#123A36]">Upper Bound (b):</span>
                        <span className="font-mono font-bold text-[#2A7B73] tabular-nums">
                          {params.uniformMax.toFixed(1)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={params.uniformMin + 1}
                        max="10"
                        step="0.5"
                        value={params.uniformMax}
                        onChange={(e) => updateParam('uniformMax', parseFloat(e.target.value))}
                        className="w-full accent-[#2A7B73] cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#AAEED3]/40 text-xs">
                    <span className="text-[#123A36]">Quantization Step Size Δ = (b - a):</span>
                    <span className="font-mono font-bold text-[#2A7B73]">
                      {(params.uniformMax - params.uniformMin).toFixed(2)} (σ² = Δ²/12 = {(((params.uniformMax - params.uniformMin) ** 2) / 12).toFixed(3)})
                    </span>
                  </div>
                </div>
              )}

              {distType === 'rayleigh' && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-[#123A36]">Fading Scale Parameter (σ):</span>
                    <span className="font-mono font-bold text-[#2A7B73] tabular-nums">
                      σ = {params.rayleighSigma.toFixed(2)} &bull; Mean = {(params.rayleighSigma * Math.sqrt(Math.PI / 2)).toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="3.0"
                    step="0.1"
                    value={params.rayleighSigma}
                    onChange={(e) => updateParam('rayleighSigma', parseFloat(e.target.value))}
                    className="w-full accent-[#2A7B73] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-[#123A36]/50">
                    <span>0.2 (Weak Multipath)</span>
                    <span>1.0 (Standard)</span>
                    <span>3.0 (Strong Fading)</span>
                  </div>
                </div>
              )}

              {distType === 'exponential' && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-[#123A36]">Arrival Rate Parameter (λ):</span>
                    <span className="font-mono font-bold text-[#2A7B73] tabular-nums">
                      λ = {params.exponentialLambda.toFixed(2)} &bull; Mean 1/λ = {(1 / params.exponentialLambda).toFixed(2)} s
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="4.0"
                    step="0.1"
                    value={params.exponentialLambda}
                    onChange={(e) => updateParam('exponentialLambda', parseFloat(e.target.value))}
                    className="w-full accent-[#2A7B73] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-[#123A36]/50">
                    <span>λ = 0.2 (Long intervals)</span>
                    <span>λ = 1.0</span>
                    <span>λ = 4.0 (Rapid arrivals)</span>
                  </div>
                </div>
              )}

              {distType === 'bernoulli' && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-[#123A36]">Bit Error Rate / Crossover (p = P(X=1)):</span>
                    <span className="font-mono font-bold text-[#2A7B73] tabular-nums">
                      p = {params.bernoulliP.toFixed(2)} &bull; (q = {(1 - params.bernoulliP).toFixed(2)})
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.01"
                    max="0.99"
                    step="0.01"
                    value={params.bernoulliP}
                    onChange={(e) => updateParam('bernoulliP', parseFloat(e.target.value))}
                    className="w-full accent-[#2A7B73] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-[#123A36]/50">
                    <span>0.01 (Low BER)</span>
                    <span>0.50 (Noisy BSC Channel)</span>
                    <span>0.99 (Inverting Channel)</span>
                  </div>
                </div>
              )}

              {distType === 'binomial' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-[#123A36]">Block Length (n bits):</span>
                      <span className="font-mono font-bold text-[#2A7B73] tabular-nums">
                        n = {params.binomialN}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="4"
                      max="32"
                      step="1"
                      value={params.binomialN}
                      onChange={(e) => updateParam('binomialN', parseInt(e.target.value, 10))}
                      className="w-full accent-[#2A7B73] cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-[#123A36]">Bit Error Prob (p):</span>
                      <span className="font-mono font-bold text-[#2A7B73] tabular-nums">
                        p = {params.binomialP.toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.05"
                      max="0.8"
                      step="0.05"
                      value={params.binomialP}
                      onChange={(e) => updateParam('binomialP', parseFloat(e.target.value))}
                      className="w-full accent-[#2A7B73] cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {distType === 'poisson' && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-[#123A36]">Mean Packet Rate (λ = Mean Arrivals):</span>
                    <span className="font-mono font-bold text-[#2A7B73] tabular-nums">
                      λ = {params.poissonLambda.toFixed(1)} packets
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="15.0"
                    step="0.5"
                    value={params.poissonLambda}
                    onChange={(e) => updateParam('poissonLambda', parseFloat(e.target.value))}
                    className="w-full accent-[#2A7B73] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-[#123A36]/50">
                    <span>λ = 0.5 (Light traffic)</span>
                    <span>λ = 5.0 (Moderate)</span>
                    <span>λ = 15.0 (Saturated buffer)</span>
                  </div>
                </div>
              )}

              {distType === 'geometric' && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-[#123A36]">ACK Success Probability (p):</span>
                    <span className="font-mono font-bold text-[#2A7B73] tabular-nums">
                      p = {params.geometricP.toFixed(2)} &bull; Mean Attempts 1/p = {(1 / params.geometricP).toFixed(1)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="0.95"
                    step="0.05"
                    value={params.geometricP}
                    onChange={(e) => updateParam('geometricP', parseFloat(e.target.value))}
                    className="w-full accent-[#2A7B73] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-[#123A36]/50">
                    <span>p = 0.05 (Heavy ARQ retries)</span>
                    <span>p = 0.50</span>
                    <span>p = 0.95 (Immediate ACK)</span>
                  </div>
                </div>
              )}

              {/* Sample Size (N) Slider & Steppers directly underneath tuning */}
              <div className="pt-3 border-t border-[#AAEED3]/40 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#123A36] flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#2A7B73]" />
                    Sample Size (N):
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSampleCountChange(Math.round(sampleCount / 2))}
                      disabled={sampleCount <= 15}
                      className="px-2 py-0.5 text-xs font-mono font-semibold bg-white border border-[#AAEED3] rounded text-[#123A36] hover:bg-[#F3FAF7] disabled:opacity-40"
                    >
                      ÷2
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSampleCountChange(Math.round(sampleCount * 2))}
                      disabled={sampleCount >= 4500}
                      className="px-2 py-0.5 text-xs font-mono font-semibold bg-white border border-[#AAEED3] rounded text-[#123A36] hover:bg-[#F3FAF7] disabled:opacity-40"
                    >
                      ×2
                    </button>
                    <button
                      type="button"
                      onClick={handleToggleSweepN}
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-lg transition-all ${
                        isSweepingN
                          ? 'bg-amber-600 text-white shadow-xs animate-pulse'
                          : 'bg-[#AAEED3]/50 border border-[#2A7B73] text-[#2A7B73] hover:bg-[#AAEED3]'
                      }`}
                      title="Watch distribution converge as sample size sweeps from 25 to 3000"
                    >
                      <span>{isSweepingN ? 'Sweeping N...' : 'Sweep N (LLN Demo)'}</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <input
                    type="range"
                    min="10"
                    max="5000"
                    step={sampleCount < 250 ? 5 : sampleCount < 1000 ? 25 : 50}
                    value={sampleCount}
                    onChange={(e) => handleSampleCountChange(parseInt(e.target.value, 10))}
                    className="w-full accent-[#2A7B73] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-[#123A36]/60 font-mono">
                    <span>10 (Sparse)</span>
                    <span>100</span>
                    <span>500</span>
                    <span>1,000</span>
                    <span>2,500</span>
                    <span>5,000</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Theoretical Formulation & Practical Communications Context */}
            <div className="lg:col-span-5 bg-[#FAFCFB] p-4 rounded-xl border border-[#AAEED3]/60 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Info className="w-3.5 h-3.5 text-[#2A7B73]" />
                  <span className="text-xs font-bold text-[#123A36] uppercase tracking-wider">
                    Theoretical Formulation
                  </span>
                </div>

                <div className="bg-white p-3 rounded-lg border border-[#AAEED3]/60 font-mono text-xs text-[#2A7B73] space-y-1.5 mb-3 shadow-2xs">
                  <div className="flex justify-between">
                    <span className="text-[#123A36]/70">Expectation E[X]:</span>
                    <strong className="text-[#123A36]">{meta.formula.mean}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#123A36]/70">Variance Var(X):</span>
                    <strong className="text-[#123A36]">{meta.formula.variance}</strong>
                  </div>
                  <div className="pt-1.5 border-t border-[#AAEED3]/40 text-[11px] text-[#123A36]/80 truncate">
                    {meta.formula.densityOrMass}
                  </div>
                </div>

                <div className="text-xs text-[#123A36]/80 leading-relaxed">
                  <div className="font-semibold text-[#2A7B73] mb-0.5">Physical Comms Insight:</div>
                  <p>{meta.commsRelevance}</p>
                </div>
              </div>

              {/* Quick convergence badge */}
              <div className="mt-3 pt-2 border-t border-[#AAEED3]/40 flex items-center justify-between text-[11px] text-[#123A36]/70 font-mono">
                <span>Theory μ: <strong>{theoreticalStats.mean.toFixed(2)}</strong></span>
                <span>Empirical x̄: <strong className="text-[#2A7B73]">{sampleStats.mean.toFixed(2)}</strong></span>
                <span>Δ: <strong>{meanDelta.toFixed(3)}</strong></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          STATISTICAL METRICS SUMMARY BAR
          ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {/* Sample Mean vs Theo Mean */}
        <div className="bg-white rounded-xl p-3 shadow-2xs border border-[#AAEED3]/60">
          <div className="text-[10px] font-bold text-[#2A7B73] uppercase tracking-wider mb-0.5">Sample Mean (x̄)</div>
          <div className="font-mono font-bold text-base text-[#123A36] tabular-nums">
            {sampleStats.mean.toFixed(3)}
          </div>
          <div className="text-[10px] text-[#123A36]/65 mt-0.5 font-mono">
            Theory μ = <span className="text-[#2A7B73] font-semibold">{theoreticalStats.mean.toFixed(3)}</span>
          </div>
        </div>

        {/* Sample Variance vs Theo Variance */}
        <div className="bg-white rounded-xl p-3 shadow-2xs border border-[#AAEED3]/60">
          <div className="text-[10px] font-bold text-[#2A7B73] uppercase tracking-wider mb-0.5">Sample Variance (s²)</div>
          <div className="font-mono font-bold text-base text-[#123A36] tabular-nums">
            {sampleStats.variance.toFixed(3)}
          </div>
          <div className="text-[10px] text-[#123A36]/65 mt-0.5 font-mono">
            Theory σ² = <span className="text-[#2A7B73] font-semibold">{theoreticalStats.variance.toFixed(3)}</span>
          </div>
        </div>

        {/* Standard Deviation */}
        <div className="bg-white rounded-xl p-3 shadow-2xs border border-[#AAEED3]/60">
          <div className="text-[10px] font-bold text-[#2A7B73] uppercase tracking-wider mb-0.5">Std Dev (s)</div>
          <div className="font-mono font-bold text-base text-[#123A36] tabular-nums">
            {sampleStats.std.toFixed(3)}
          </div>
          <div className="text-[10px] text-[#123A36]/65 mt-0.5 font-mono">
            Theory σ = <span className="text-[#2A7B73] font-semibold">{theoreticalStats.std.toFixed(3)}</span>
          </div>
        </div>

        {/* Mean Discrepancy Error */}
        <div className="bg-white rounded-xl p-3 shadow-2xs border border-[#AAEED3]/60">
          <div className="text-[10px] font-bold text-[#2A7B73] uppercase tracking-wider mb-0.5">Mean Error |x̄ - μ|</div>
          <div className="font-mono font-bold text-base text-[#2A7B73] tabular-nums">
            {meanDelta.toFixed(4)}
          </div>
          <div className="text-[10px] text-[#123A36]/65 mt-0.5 font-mono">
            Var Error: {varDelta.toFixed(4)}
          </div>
        </div>

        {/* Median */}
        <div className="bg-white rounded-xl p-3 shadow-2xs border border-[#AAEED3]/60">
          <div className="text-[10px] font-bold text-[#2A7B73] uppercase tracking-wider mb-0.5">Sample Median</div>
          <div className="font-mono font-bold text-base text-[#123A36] tabular-nums">
            {sampleStats.median.toFixed(3)}
          </div>
          <div className="text-[10px] text-[#123A36]/65 mt-0.5 font-mono">
            50th Percentile
          </div>
        </div>

        {/* Extrema Range */}
        <div className="bg-white rounded-xl p-3 shadow-2xs border border-[#AAEED3]/60">
          <div className="text-[10px] font-bold text-[#2A7B73] uppercase tracking-wider mb-0.5">Sample Range</div>
          <div className="font-mono font-bold text-base text-[#123A36] tabular-nums truncate">
            [{sampleStats.min.toFixed(2)}, {sampleStats.max.toFixed(2)}]
          </div>
          <div className="text-[10px] text-[#123A36]/65 mt-0.5 font-mono">
            Span = {(sampleStats.max - sampleStats.min).toFixed(2)}
          </div>
        </div>
      </div>

      {/* =========================================================================
          DUAL SYNCHRONIZED PROBABILITY PLOTS:
          Panel A: PMF (Discrete) or PDF (Continuous)
          Panel B: CDF (Step-wise staircase vs Smooth continuous)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* PANEL A: PMF / PDF */}
        <div className="bg-white rounded-2xl p-5 shadow-xs border border-[#AAEED3]/60 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-[#2A7B73]" />
                <h3 className="font-bold text-sm text-[#123A36]">
                  {isDiscrete ? 'Probability Mass Function: P(X = k)' : 'Probability Density Function: f(x)'}
                </h3>
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#AAEED3]/30 text-[#2A7B73]">
                {isDiscrete ? 'Discrete PMF' : 'Continuous PDF'}
              </span>
            </div>
            <p className="text-xs text-[#123A36]/70 mb-3">
              {isDiscrete
                ? 'Empirical relative frequencies (bars) vs exact theoretical probabilities P(X=k) (dots).'
                : 'Empirical binned histogram density vs continuous analytical density curve f(x).'}
            </p>
          </div>

          {/* Plot Stage */}
          <div className="relative w-full aspect-[16/10] bg-[#FAFCFB] rounded-xl border border-[#AAEED3] p-4 flex items-end justify-between overflow-hidden">
            {isDiscrete ? (
              /* DISCRETE PMF PLOT */
              (() => {
                const maxProb = Math.max(
                  ...discreteEntries.map((e) => Math.max(e.empiricalProb, e.theoreticalProb)),
                  0.15
                );
                return (
                  <div className="w-full h-full flex items-end justify-around gap-1 pt-6 pb-4">
                    {discreteEntries.map((entry) => {
                      const empHeight = (entry.empiricalProb / maxProb) * 90;
                      const theoHeight = (entry.theoreticalProb / maxProb) * 90;

                      return (
                        <div
                          key={`pmf-${entry.k}`}
                          className="flex-1 max-w-[48px] flex flex-col items-center justify-end h-full relative group cursor-pointer"
                        >
                          {/* Theoretical Reference Dot */}
                          <div
                            className="absolute w-3 h-3 rounded-full border-2 border-[#123A36] z-10 -ml-1.5 transition-all group-hover:scale-125"
                            style={{
                              bottom: `${Math.min(96, theoHeight)}%`,
                              left: '50%',
                              backgroundColor: 'var(--pale-yellow)',
                            }}
                            title={`Theory P(X=${entry.k}) = ${entry.theoreticalProb.toFixed(4)}`}
                          />

                          {/* Empirical PMF Bar */}
                          <div
                            className="w-full rounded-t transition-all duration-200 group-hover:brightness-110"
                            style={{
                              height: `${Math.min(96, Math.max(2, empHeight))}%`,
                              backgroundColor: 'var(--deep-teal)',
                            }}
                          />

                          {/* Discrete X label */}
                          <span className="text-[10px] font-mono font-bold text-[#123A36] mt-1.5">
                            k={entry.k}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            ) : (
              /* CONTINUOUS PDF PLOT */
              (() => {
                const { bins, maxDensity } = continuousData;
                return (
                  <div className="w-full h-full relative flex items-end">
                    <div className="w-full h-full flex items-end justify-between gap-0.5 pb-4">
                      {bins.map((bin) => {
                        const hPct = (bin.empiricalDensity / maxDensity) * 88;
                        const theoPct = (bin.theoreticalDensity / maxDensity) * 88;

                        return (
                          <div
                            key={`bin-${bin.binIndex}`}
                            className="flex-1 flex flex-col items-center justify-end h-full relative group cursor-pointer"
                          >
                            {/* Theoretical Point */}
                            <div
                              className="absolute w-1.5 h-1.5 rounded-full border border-[#2A7B73] z-10"
                              style={{
                                bottom: `${Math.min(95, theoPct)}%`,
                                backgroundColor: 'var(--pale-yellow)',
                              }}
                              title={`Theory PDF: ${bin.theoreticalDensity.toFixed(4)}`}
                            />

                            {/* Bar */}
                            <div
                              className="w-full rounded-t transition-all duration-150"
                              style={{
                                height: `${Math.min(95, Math.max(1, hPct))}%`,
                                backgroundColor: 'var(--deep-teal)',
                                opacity: 0.85,
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()
            )}
          </div>

          {/* Plot Legend & Scale */}
          <div className="flex flex-wrap items-center justify-between text-xs mt-3 pt-2 border-t border-[#AAEED3]/30">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-2.5 rounded" style={{ backgroundColor: 'var(--deep-teal)' }} />
                <span className="text-xs">Empirical {isDiscrete ? 'PMF' : 'Histogram PDF'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full border border-[#123A36]" style={{ backgroundColor: 'var(--pale-yellow)' }} />
                <span className="text-xs font-semibold text-[#123A36]">Theoretical Model</span>
              </div>
            </div>

            <span className="font-mono text-xs text-[#2A7B73]">
              {isDiscrete ? `∑ P(k) = 1.000` : `Range [${continuousData.rangeMin.toFixed(1)}, ${continuousData.rangeMax.toFixed(1)}]`}
            </span>
          </div>
        </div>

        {/* PANEL B: CUMULATIVE DISTRIBUTION FUNCTION (CDF) */}
        <div className="bg-white rounded-2xl p-5 shadow-xs border border-[#AAEED3]/60 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#2A7B73]" />
                <h3 className="font-bold text-sm text-[#123A36]">
                  Cumulative Distribution Function: F(x) = P(X ≤ x)
                </h3>
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#AAEED3]/30 text-[#2A7B73]">
                {isDiscrete ? 'Staircase CDF' : 'Smooth Ogive CDF'}
              </span>
            </div>
            <p className="text-xs text-[#123A36]/70 mb-3">
              {isDiscrete
                ? 'Right-continuous step staircase jumping by P(X=k) at discrete integer points.'
                : 'Accumulated probability converging monotonically from F(-∞)=0 to F(+∞)=1.'}
            </p>
          </div>

          {/* CDF Canvas / SVG Plot */}
          <div className="relative w-full aspect-[16/10] bg-[#FAFCFB] rounded-xl border border-[#AAEED3] p-4 flex items-end justify-between overflow-hidden">
            <svg
              className="w-full h-full overflow-visible"
              viewBox="0 0 600 300"
              preserveAspectRatio="none"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                setCdfHoverX(frac);
              }}
              onMouseLeave={() => setCdfHoverX(null)}
            >
              {/* CDF 0.0, 0.5, 1.0 Horizontal Grid Lines */}
              <line x1="10" y1="20" x2="590" y2="20" stroke="#123A36" strokeOpacity="0.1" strokeDasharray="3 3" />
              <text x="15" y="16" fill="#2A7B73" fontSize="10" fontFamily="monospace">F(x) = 1.0</text>
              <line x1="10" y1="150" x2="590" y2="150" stroke="#123A36" strokeOpacity="0.1" strokeDasharray="3 3" />
              <text x="15" y="146" fill="#2A7B73" fontSize="10" fontFamily="monospace">F(x) = 0.5</text>
              <line x1="10" y1="280" x2="590" y2="280" stroke="#123A36" strokeOpacity="0.2" />
              <text x="15" y="276" fill="#2A7B73" fontSize="10" fontFamily="monospace">F(x) = 0.0</text>

              {isDiscrete ? (
                // Step Function for Discrete CDF
                (() => {
                  const n = discreteEntries.length;
                  if (n === 0) return null;
                  const stepWidth = 560 / Math.max(1, n);

                  return (
                    <g>
                      {discreteEntries.map((e, idx) => {
                        const xStart = 20 + idx * stepWidth;
                        const xEnd = xStart + stepWidth;
                        const yEmp = 280 - e.empiricalCDF * 260;
                        const yTheo = 280 - e.theoreticalCDF * 260;

                        return (
                          <g key={`step-${e.k}`}>
                            {/* Theoretical Step Line */}
                            <line
                              x1={xStart}
                              y1={yTheo}
                              x2={xEnd}
                              y2={yTheo}
                              stroke="#2A7B73"
                              strokeWidth="2"
                              strokeDasharray="4 2"
                            />

                            {/* Empirical Step Line */}
                            <line
                              x1={xStart}
                              y1={yEmp}
                              x2={xEnd}
                              y2={yEmp}
                              stroke="#123A36"
                              strokeWidth="2.5"
                            />
                            {/* Vertical drop connection */}
                            {idx > 0 && (
                              <line
                                x1={xStart}
                                y1={280 - discreteEntries[idx - 1].empiricalCDF * 260}
                                x2={xStart}
                                y2={yEmp}
                                stroke="#123A36"
                                strokeWidth="1"
                                strokeDasharray="2 2"
                              />
                            )}

                            {/* Solid closed dot at left jump */}
                            <circle cx={xStart} cy={yEmp} r="3.5" fill="#2A7B73" />
                            <text
                              x={xStart + stepWidth / 2}
                              y="295"
                              fill="#123A36"
                              fontSize="9"
                              textAnchor="middle"
                              fontFamily="monospace"
                            >
                              k={e.k}
                            </text>
                          </g>
                        );
                      })}
                    </g>
                  );
                })()
              ) : (
                // Continuous Smooth CDF Curve
                (() => {
                  const { bins } = continuousData;
                  if (bins.length === 0) return null;

                  const empPoints = bins
                    .map((b, i) => {
                      const sx = 20 + (i / (bins.length - 1)) * 560;
                      const sy = 280 - Math.min(1, b.empiricalCDF) * 260;
                      return `${sx},${sy}`;
                    })
                    .join(' ');

                  const theoPoints = bins
                    .map((b, i) => {
                      const sx = 20 + (i / (bins.length - 1)) * 560;
                      const sy = 280 - Math.min(1, b.theoreticalCDF) * 260;
                      return `${sx},${sy}`;
                    })
                    .join(' ');

                  return (
                    <g>
                      {/* Theoretical CDF Curve */}
                      <polyline
                        fill="none"
                        stroke="#55A9A0"
                        strokeWidth="2.5"
                        strokeDasharray="4 3"
                        points={theoPoints}
                      />

                      {/* Empirical CDF Curve */}
                      <polyline
                        fill="none"
                        stroke="#2A7B73"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        points={empPoints}
                      />
                    </g>
                  );
                })()
              )}

              {/* Cursor Inspector */}
              {cdfHoverX !== null && (
                <line
                  x1={20 + cdfHoverX * 560}
                  y1="20"
                  x2={20 + cdfHoverX * 560}
                  y2="280"
                  stroke="#2A7B73"
                  strokeWidth="1.5"
                  strokeDasharray="2 2"
                />
              )}
            </svg>
          </div>

          {/* CDF Legend */}
          <div className="flex flex-wrap items-center justify-between text-xs mt-3 pt-2 border-t border-[#AAEED3]/30">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-1 bg-[#2A7B73]" />
                <span className="text-xs">Empirical CDF F_N(x)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-1 border-t-2 border-dashed border-[#55A9A0]" />
                <span className="text-xs font-semibold text-[#123A36]">Theoretical CDF F(x)</span>
              </div>
            </div>

            <span className="font-mono text-xs text-[#2A7B73]">
              0.0 ≤ F(x) ≤ 1.0
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          DATA TABLES & WORKSPACE TABS (Distribution Table / Raw Samples / Comms Guide)
          ========================================================================= */}
      <div className="bg-white rounded-2xl p-5 shadow-xs border border-[#AAEED3]/60">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Table className="w-4 h-4 text-[#2A7B73]" />
            <h3 className="font-bold text-sm text-[#123A36]">Data Tables & Signal Inspector</h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View Switcher */}
            <div className="flex items-center bg-[#F3FAF7] p-1 rounded-xl border border-[#AAEED3]">
              <button
                type="button"
                onClick={() => setActiveTableTab('distribution')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  activeTableTab === 'distribution'
                    ? 'bg-[#2A7B73] text-white shadow-xs'
                    : 'text-[#123A36] hover:bg-white/80'
                }`}
              >
                {isDiscrete ? 'PMF / CDF Table' : 'Binned PDF Table'}
              </button>
              <button
                type="button"
                onClick={() => setActiveTableTab('samples')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  activeTableTab === 'samples'
                    ? 'bg-[#2A7B73] text-white shadow-xs'
                    : 'text-[#123A36] hover:bg-white/80'
                }`}
              >
                Raw Samples X[n]
              </button>
              <button
                type="button"
                onClick={() => setActiveTableTab('guide')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  activeTableTab === 'guide'
                    ? 'bg-[#2A7B73] text-white shadow-xs'
                    : 'text-[#123A36] hover:bg-white/80'
                }`}
              >
                Comms Guide
              </button>
            </div>

            {/* Export and Copy Buttons */}
            {activeTableTab !== 'guide' && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-white border border-[#AAEED3] text-[#2A7B73] text-xs font-semibold hover:bg-[#F3FAF7] cursor-pointer"
                  title="Export active table as CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Export CSV</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyTable}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-white border border-[#AAEED3] text-[#2A7B73] text-xs font-semibold hover:bg-[#F3FAF7] cursor-pointer"
                  title="Copy table to clipboard"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Copy</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Copy Notification Toast */}
        {copiedNotification && (
          <div className="mb-3 px-3 py-1.5 rounded-lg bg-[#AAEED3]/40 border border-[#2A7B73] text-xs text-[#123A36] font-medium flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-[#2A7B73]" />
            <span>{copiedNotification}</span>
          </div>
        )}

        {/* TAB 1: DISTRIBUTION TABLE */}
        {activeTableTab === 'distribution' && (
          <div className="overflow-x-auto">
            {isDiscrete ? (
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-[#F3FAF7] border-b border-[#AAEED3]/80 text-[#2A7B73] font-bold">
                    <th className="py-2.5 px-3">Outcome (k)</th>
                    <th className="py-2.5 px-3">Count (N_k)</th>
                    <th className="py-2.5 px-3">Empirical PMF P_N(k)</th>
                    <th className="py-2.5 px-3">Theoretical PMF P(k)</th>
                    <th className="py-2.5 px-3">Absolute Error |Δ|</th>
                    <th className="py-2.5 px-3">Empirical CDF F_N(k)</th>
                    <th className="py-2.5 px-3">Theoretical CDF F(k)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#AAEED3]/30 font-mono">
                  {discreteEntries.map((row) => (
                    <tr key={`tbl-${row.k}`} className="hover:bg-[#F3FAF7]/60">
                      <td className="py-2 px-3 font-bold text-[#123A36]">k = {row.k}</td>
                      <td className="py-2 px-3">{row.count}</td>
                      <td className="py-2 px-3 font-semibold text-[#2A7B73]">
                        {row.empiricalProb.toFixed(4)}
                      </td>
                      <td className="py-2 px-3 text-[#123A36]/80">
                        {row.theoreticalProb.toFixed(4)}
                      </td>
                      <td className="py-2 px-3 text-amber-700">
                        {row.deltaProb.toFixed(4)}
                      </td>
                      <td className="py-2 px-3 font-semibold text-[#2A7B73]">
                        {row.empiricalCDF.toFixed(4)}
                      </td>
                      <td className="py-2 px-3 text-[#123A36]/80">
                        {row.theoreticalCDF.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-[#F3FAF7] border-b border-[#AAEED3]/80 text-[#2A7B73] font-bold">
                    <th className="py-2.5 px-3">Bin #</th>
                    <th className="py-2.5 px-3">Interval [x_start, x_end)</th>
                    <th className="py-2.5 px-3">Midpoint (x)</th>
                    <th className="py-2.5 px-3">Count</th>
                    <th className="py-2.5 px-3">Empirical Density</th>
                    <th className="py-2.5 px-3">Theoretical PDF f(x)</th>
                    <th className="py-2.5 px-3">Empirical CDF F_N(x)</th>
                    <th className="py-2.5 px-3">Theoretical CDF F(x)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#AAEED3]/30 font-mono">
                  {continuousData.bins.map((bin) => (
                    <tr key={`bin-tbl-${bin.binIndex}`} className="hover:bg-[#F3FAF7]/60">
                      <td className="py-2 px-3 text-[#123A36]/70">#{bin.binIndex}</td>
                      <td className="py-2 px-3 text-[#123A36]">
                        [{bin.xStart.toFixed(2)}, {bin.xEnd.toFixed(2)})
                      </td>
                      <td className="py-2 px-3 font-bold text-[#123A36]">{bin.xMid.toFixed(2)}</td>
                      <td className="py-2 px-3">{bin.count}</td>
                      <td className="py-2 px-3 font-semibold text-[#2A7B73]">
                        {bin.empiricalDensity.toFixed(4)}
                      </td>
                      <td className="py-2 px-3 text-[#123A36]/80">
                        {bin.theoreticalDensity.toFixed(4)}
                      </td>
                      <td className="py-2 px-3 font-semibold text-[#2A7B73]">
                        {bin.empiricalCDF.toFixed(4)}
                      </td>
                      <td className="py-2 px-3 text-[#123A36]/80">
                        {bin.theoreticalCDF.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 2: RAW SAMPLES LIST */}
        {activeTableTab === 'samples' && (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse font-mono">
                <thead>
                  <tr className="bg-[#F3FAF7] border-b border-[#AAEED3]/80 text-[#2A7B73] font-bold">
                    <th className="py-2.5 px-3">Index (n)</th>
                    <th className="py-2.5 px-3">Sample Value X[n]</th>
                    <th className="py-2.5 px-3">Deviation (X[n] - x̄)</th>
                    <th className="py-2.5 px-3">Squared Error (X[n] - x̄)²</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#AAEED3]/30">
                  {samples
                    .slice((sampleTablePage - 1) * 20, sampleTablePage * 20)
                    .map((val, idx) => {
                      const actualIdx = (sampleTablePage - 1) * 20 + idx;
                      const dev = val - sampleStats.mean;
                      return (
                        <tr key={`sample-row-${actualIdx}`} className="hover:bg-[#F3FAF7]/60">
                          <td className="py-2 px-3 text-[#123A36]/60">n = {actualIdx}</td>
                          <td className="py-2 px-3 font-bold text-[#123A36]">
                            {val.toFixed(5)}
                          </td>
                          <td className="py-2 px-3 text-[#2A7B73]">
                            {dev >= 0 ? `+${dev.toFixed(5)}` : dev.toFixed(5)}
                          </td>
                          <td className="py-2 px-3 text-[#123A36]/80">
                            {(dev * dev).toFixed(5)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between pt-2 border-t border-[#AAEED3]/40 text-xs">
              <span className="text-[#123A36]/70">
                Showing samples {(sampleTablePage - 1) * 20 + 1} to{' '}
                {Math.min(samples.length, sampleTablePage * 20)} of {samples.length}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSampleTablePage((p) => Math.max(1, p - 1))}
                  disabled={sampleTablePage === 1}
                  className="px-2.5 py-1 rounded bg-[#F3FAF7] border border-[#AAEED3] text-[#123A36] disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="font-mono px-2 text-[#2A7B73]">
                  Page {sampleTablePage} / {Math.ceil(samples.length / 20)}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setSampleTablePage((p) =>
                      Math.min(Math.ceil(samples.length / 20), p + 1)
                    )
                  }
                  disabled={sampleTablePage >= Math.ceil(samples.length / 20)}
                  className="px-2.5 py-1 rounded bg-[#F3FAF7] border border-[#AAEED3] text-[#123A36] disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: COMMUNICATIONS ENGINEERING GUIDE */}
        {activeTableTab === 'guide' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[#123A36]/85">
            <div className="p-4 rounded-xl bg-[#F3FAF7] border border-[#AAEED3]/60 space-y-2">
              <h4 className="font-bold text-[#2A7B73] flex items-center gap-1.5 text-sm">
                <Activity className="w-4 h-4" />
                Continuous Random Signals in Comms
              </h4>
              <p>
                In communication systems, analog channel impairments are modeled via continuous random variables:
              </p>
              <ul className="list-disc pl-4 space-y-1">
                <li>
                  <strong>AWGN (Thermal Noise):</strong> Produced by thermal agitation of electrons (Johnson-Nyquist noise). Governed by the Central Limit Theorem.
                </li>
                <li>
                  <strong>Uniform Distribution:</strong> Models ADC round-off quantization error &Delta;/2, having variance &sigma;&sup2; = &Delta;&sup2; / 12.
                </li>
                <li>
                  <strong>Rayleigh Fading:</strong> Models the envelope R = &radic;(X&sup2; + Y&sup2;) of multipath wireless channels without Line-Of-Sight (NLOS).
                </li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-[#F3FAF7] border border-[#AAEED3]/60 space-y-2">
              <h4 className="font-bold text-[#2A7B73] flex items-center gap-1.5 text-sm">
                <BarChart2 className="w-4 h-4" />
                Discrete Random Signals &amp; Error Bounds
              </h4>
              <p>
                Digital transmission operates over discrete alphabets and packet transmission frames:
              </p>
              <ul className="list-disc pl-4 space-y-1">
                <li>
                  <strong>Bernoulli Trial:</strong> Single bit detection decision in a Binary Symmetric Channel (BSC) with bit error probability p.
                </li>
                <li>
                  <strong>Binomial Distribution:</strong> Number of bit errors across an n-bit block code. Determines Hamming code error-correcting capability.
                </li>
                <li>
                  <strong>Poisson Distribution:</strong> Arrival of discrete packet bursts at a network buffer interface.
                </li>
                <li>
                  <strong>Geometric Distribution:</strong> Number of retransmissions until an ACK is received in ARQ protocol design.
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
