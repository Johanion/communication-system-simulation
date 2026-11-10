/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ToastMessage } from '../types';
import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const isSuccess = t.type === 'success' || !t.type;
        const isWarning = t.type === 'warning';

        return (
          <div
            key={t.id}
            className="pointer-events-auto bg-white rounded-xl shadow-lg border p-3.5 flex items-start justify-between gap-3 animate-in slide-in-from-bottom-2 duration-200"
            style={{
              borderColor: isWarning ? '#FBBF24' : 'var(--deep-teal)',
            }}
          >
            <div className="flex items-start gap-2.5">
              {isWarning ? (
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              ) : isSuccess ? (
                <CheckCircle2 className="w-4 h-4 text-[#2A7B73] shrink-0 mt-0.5" />
              ) : (
                <Info className="w-4 h-4 text-[#55A9A0] shrink-0 mt-0.5" />
              )}
              <div>
                <h4 className="text-xs font-bold text-[#123A36]">{t.title}</h4>
                {t.description && (
                  <p className="text-[11px] text-[#123A36]/80 mt-0.5 leading-normal">
                    {t.description}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
