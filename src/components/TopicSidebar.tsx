/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Left-side Topic Navigation Sidebar & Mobile Drawer.
 * Replaces the top navigation dropdown with a persistent sidebar dashboard.
 */

import React from 'react';
import { TopicModuleId, TopicModuleMeta } from '../types';
import { Activity, X } from 'lucide-react';

interface TopicSidebarProps {
  currentModuleId: TopicModuleId;
  onSelectModule: (id: TopicModuleId) => void;
  modules: TopicModuleMeta[];
  mobileOpen: boolean;
  onCloseMobile: () => void;
  isCollapsed?: boolean;
}

export const TopicSidebar: React.FC<TopicSidebarProps> = ({
  currentModuleId,
  onSelectModule,
  modules,
  mobileOpen,
  onCloseMobile,
  isCollapsed = false,
}) => {
  const renderSidebarContent = (isMobile = false) => (
    <div className="flex flex-col h-full bg-white select-none">
      {/* 1. Brand Block at the top (Pinned) */}
      <div className="p-4 sm:p-5 border-b border-[#AAEED3]/50 flex items-center justify-between shrink-0 bg-white">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#2A7B73] flex items-center justify-center shadow-xs shrink-0">
            <Activity className="w-5 h-5 text-[#FFF6B0]" />
          </div>
          <div className="min-w-0">
            <h1 className="font-heading font-bold text-base leading-tight tracking-tight text-[#123A36] truncate">
              Group 3 - Project
            </h1>
            <p className="text-[11px] text-[#2A7B73] font-mono font-medium truncate mt-0.5">
              Signals &amp; Systems Interactive Lab
            </p>
          </div>
        </div>

        {/* Mobile close button */}
        {isMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="p-1.5 rounded-lg text-[#123A36]/70 hover:text-[#123A36] hover:bg-[#AAEED3]/20 transition-colors"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* 2. Section Label */}
      <div className="px-5 pt-4 pb-2 shrink-0">
        <span className="text-[10px] font-bold text-[#2A7B73] uppercase tracking-wider font-mono">
          Signals &amp; Systems Modules
        </span>
      </div>

      {/* 3. Topic List (Scrolls independently) */}
      <nav
        className="flex-1 overflow-y-auto px-3 pb-4 space-y-1.5 focus:outline-none"
        aria-label="Signals and systems topics"
      >
        {modules.map((m) => {
          const isSelected = m.id === currentModuleId;

          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                onSelectModule(m.id);
                if (isMobile) onCloseMobile();
              }}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs transition-all duration-150 flex items-start gap-3 relative cursor-pointer focus-visible:ring-2 focus-visible:ring-[#2A7B73] focus:outline-none focus-visible:ring-offset-1 ${
                isSelected
                  ? 'bg-[#AAEED3]/30 font-semibold before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1.5 before:bg-[#2A7B73] before:rounded-r'
                  : 'hover:bg-[#AAEED3]/20 text-[#123A36]/90'
              }`}
            >
              {/* Topic Letter Badge */}
              <span
                className={`w-6 h-6 rounded-md flex items-center justify-center font-mono font-bold text-[11px] shrink-0 mt-0.5 transition-colors ${
                  isSelected
                    ? 'bg-[#2A7B73] text-white shadow-xs'
                    : 'bg-[#F3FAF7] text-[#2A7B73] border border-[#AAEED3]'
                }`}
              >
                {m.code}
              </span>

              {/* Title & Subtitle */}
              <div className="flex-1 min-w-0">
                <div
                  className={`font-semibold text-xs sm:text-[13px] leading-snug ${
                    isSelected ? 'text-[#123A36]' : 'text-[#123A36]/95'
                  }`}
                >
                  {m.title}
                </div>
                <div className="text-[11px] text-[#123A36]/70 leading-normal line-clamp-2 mt-0.5 font-normal">
                  {m.subtitle}
                </div>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Bottom Subtle Status */}
      <div className="p-3 border-t border-[#AAEED3]/40 bg-[#FAFCFB] shrink-0 text-center">
        <span className="text-[10px] font-mono text-[#2A7B73]/80">
          7 Interactive Topics Ready
        </span>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Left Sidebar */}
      <aside
        onTransitionEnd={() => window.dispatchEvent(new Event('resize'))}
        className={`hidden lg:flex w-[285px] h-screen sticky top-0 flex-col border-r border-[#AAEED3]/60 shadow-xs z-30 shrink-0 transition-[margin] duration-250 ease-in-out ${
          isCollapsed ? '-ml-[286px] pointer-events-none' : 'ml-0'
        }`}
      >
        {renderSidebarContent(false)}
      </aside>

      {/* Mobile Off-canvas Drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          {/* Sliding drawer panel */}
          <div className="relative w-[285px] max-w-[85vw] h-full shadow-2xl z-50 flex flex-col animate-in slide-in-from-left duration-200">
            {renderSidebarContent(true)}
          </div>
        </div>
      )}
    </>
  );
};
