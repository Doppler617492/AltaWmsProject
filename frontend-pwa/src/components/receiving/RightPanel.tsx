import React, { useState, useEffect } from 'react';
import type { RightPanelProps } from '../../types/receiving';

export default function RightPanel({
  item,
  isOpen,
  onClose,
  onSave,
  isLoading = false
}: RightPanelProps) {
  const [received, setReceived] = useState(0);
  const [note, setNote] = useState('');
  const [quickNote, setQuickNote] = useState('');

  useEffect(() => {
    if (item) {
      setReceived(item.received || 0);
      setNote(item.note || '');
    }
  }, [item]);

  const handleSave = () => {
    if (!item) return;
    
    onSave(item.id, received, note);
    
    // Simple celebration effect
    if (item.requested > 0 && received >= item.requested) {
      // You can add confetti here if you want to install canvas-confetti
      // 100% match achieved
    }
  };

  const handleMatchRequested = () => {
    if (item) {
      setReceived(item.requested);
    }
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'critical':
        setQuickNote('Označeno kao kritično');
        break;
      case 'note':
        if (quickNote.trim()) {
          setNote(prev => prev ? `${prev}\n${quickNote}` : quickNote);
          setQuickNote('');
        }
        break;
    }
  };

  const canClose = !isLoading;
  const isValid = item && item.requested > 0 && received >= 0 && received <= item.requested * 2;

  if (!isOpen || !item) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={canClose ? onClose : undefined}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
        style={{ display: isOpen ? 'block' : 'none' }}
      />

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 bottom-0 w-full max-w-md bg-[#171A1D] border-l border-[#22262B] shadow-2xl z-50 overflow-hidden flex flex-col transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="panel-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#22262B] bg-[#0F1113]">
          <div className="flex-1 min-w-0">
            <h2 id="panel-title" className="text-lg font-bold text-zinc-200 truncate">
              Uredi stavku
            </h2>
            <p className="text-sm text-zinc-400 truncate mt-0.5">
              {item.code} - {item.name}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={!canClose}
            className="ml-4 p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors focus:ring-2 focus:ring-[#4C9FFE] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Zatvori panel"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quantity input */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-3">
              Zaprimljena količina
            </label>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setReceived(Math.max(0, received - 1))}
                disabled={isLoading || received <= 0}
                className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:ring-2 focus:ring-[#4C9FFE] focus:outline-none"
                aria-label="Smanji količinu"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              
              <input
                type="number"
                value={received}
                onChange={(e) => setReceived(Math.max(0, Number(e.target.value)))}
                disabled={isLoading}
                min={0}
                className="flex-1 text-center text-3xl font-bold bg-zinc-900 border-2 border-zinc-800 rounded-xl px-4 py-3 text-emerald-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-colors disabled:opacity-50"
                aria-label="Zaprimljena količina"
              />
              
              <button
                onClick={() => setReceived(received + 1)}
                disabled={isLoading}
                className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:ring-2 focus:ring-[#4C9FFE] focus:outline-none"
                aria-label="Povećaj količinu"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-zinc-500">
                Traženo: <span className="font-semibold text-zinc-300">{item.requested}</span>
              </span>
              {received >= item.requested && (
                <span className="flex items-center gap-1 text-emerald-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Jednako traženom
                </span>
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-3">
              Brze akcije
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleMatchRequested}
                disabled={isLoading || received === item.requested}
                className="px-3 py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                Match Requested
              </button>
              
              <button
                onClick={() => handleQuickAction('critical')}
                disabled={isLoading}
                className="px-3 py-2 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-yellow-500 focus:outline-none flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Kritično
              </button>
            </div>
          </div>

          {/* Note */}
          <div>
            <label htmlFor="note" className="block text-sm font-medium text-zinc-300 mb-3">
              Napomena
            </label>
            <textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={isLoading}
              rows={4}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 placeholder-zinc-500 focus:border-zinc-700 focus:ring-2 focus:ring-[#4C9FFE] focus:outline-none transition-colors resize-none disabled:opacity-50"
              placeholder="Dodaj napomenu o prijemu..."
            />
          </div>

          {/* Quick note */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                value={quickNote}
                onChange={(e) => setQuickNote(e.target.value)}
                disabled={isLoading}
                placeholder="Brza napomena..."
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-zinc-700 focus:ring-2 focus:ring-[#4C9FFE] focus:outline-none transition-colors disabled:opacity-50"
              />
              <button
                onClick={() => handleQuickAction('note')}
                disabled={isLoading || !quickNote.trim()}
                className="px-3 py-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                Dodaj
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[#22262B] bg-[#0F1113] space-y-3">
          {!isValid && (
            <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <svg className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-sm text-yellow-400">
                Količina mora biti između 0 i {item.requested * 2}
              </span>
            </div>
          )}
          
          <button
            onClick={handleSave}
            disabled={isLoading || !isValid}
            className={`w-full rounded-full px-4 py-3 font-medium bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-black transition-all focus:ring-2 focus:ring-[#4C9FFE] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
              !isLoading && isValid ? 'hover:scale-[1.02] active:scale-[0.98]' : ''
            }`}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Čuvanje...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Sačuvaj
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}












