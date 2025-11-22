import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import ItemCard from '../components/receiving/ItemCard';
import RightPanel from '../components/receiving/RightPanel';
import type { Item, Shipment, FilterType, SortType } from '../types/receiving';
import { formatPercent } from '../utils/format';
import { useDebounce } from '../utils/useDebounce';
import PwaBackButton from '../../components/PwaBackButton';

// Mock data generator
function generateMockItems(count: number): Item[] {
  const items: Item[] = [];
  const names = [
    'KORPA NATURAL + CRNA 41-44 CY-03 VECA',
    'TIPKA ZA KOLO KUZURA (DŽEP)',
    'ZAKIVAČ VINKOVIČKI',
    'KORPA VAŽA 45L',
    'PIN RENDER STAR 75x150mm',
  ];
  
  for (let i = 0; i < count; i++) {
    const idx = i % names.length;
    const requested = Math.floor(Math.random() * 500) + 50;
    const received = i < 3 
      ? 0 
      : i < 10 
        ? Math.floor(requested * 0.3)
        : i < 20
          ? Math.floor(requested * 0.8)
          : requested;
    
    items.push({
      id: `item-${i}`,
      code: `0902${String(10 + idx).padStart(2, '0')}`,
      name: names[idx],
      requested,
      received,
      critical: i < 15 && received < requested * 0.3,
      variant: `Varijanta ${i + 1}`,
      lot: `LOT-${Date.now()}`,
      serials: ['SN001', 'SN002'],
      scanHistory: [
        {
          timestamp: new Date().toLocaleString('sr-Latn-RS'),
          user: 'Magacioner M1',
          note: 'Auto-scan'
        }
      ],
      note: i % 3 === 0 ? 'Napomena za ovu stavku' : undefined,
    });
  }
  
  return items;
}

const MOCK_SHIPMENT: Shipment = {
  id: '25-1900-000701',
  status: 'IN_PROGRESS',
  items: generateMockItems(35),
  progressPct: 65.5,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export default function ConfirmReceiptScreen() {
  const router = useRouter();
  
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 250);
  
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [sort, setSort] = useState<SortType>('UNPROCESSED');
  const [denseView, setDenseView] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [confirmingItem, setConfirmingItem] = useState<string | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  // Mock fetch
  useEffect(() => {
    const fetchShipment = async () => {
      setLoading(true);
      setError(null);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      try {
        setShipment(MOCK_SHIPMENT);
      } catch (err) {
        setError('Greška pri učitavanju prijema');
      } finally {
        setLoading(false);
      }
    };

    fetchShipment();
  }, []);

  // Filter and sort logic
  const filteredAndSortedItems = useMemo(() => {
    if (!shipment) return [];

    let items = [...shipment.items];

    // Search filter
    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
      items = items.filter(item =>
        item.code.toLowerCase().includes(query) ||
        item.name.toLowerCase().includes(query)
      );
    }

    // Filter by status
    if (filter !== 'ALL') {
      items = items.filter(item => {
        const received = item.received;
        const requested = item.requested;
        
        switch (filter) {
          case 'CRITICAL':
            return item.critical || (received < requested * 0.5 && received > 0);
          case 'SHORTAGE':
            return received < requested && received > 0;
          case 'EXCESS':
            return received > requested;
          case 'CONFIRMED':
            return received === requested && received > 0;
          default:
            return true;
        }
      });
    }

    // Sort
    items.sort((a, b) => {
      switch (sort) {
        case 'NAME_ASC':
          return a.name.localeCompare(b.name);
        case 'NAME_DESC':
          return b.name.localeCompare(a.name);
        case 'MOST_REQUESTED':
          return b.requested - a.requested;
        case 'UNPROCESSED':
          return a.received - b.received;
        default:
          return 0;
      }
    });

    return items;
  }, [shipment, debouncedSearch, filter, sort]);

  // Handle confirm
  const handleConfirm = useCallback(async (itemId: string) => {
    if (!shipment) return;
    
    setConfirmingItem(itemId);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 800));
    
    setShipment(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map(item =>
          item.id === itemId
            ? { ...item, received: item.requested }
            : item
        )
      };
    });
    
    setConfirmingItem(null);
  }, [shipment]);

  // Handle edit save
  const handleSave = useCallback(async (itemId: string, received: number, note?: string) => {
    if (!shipment) return;
    
    setConfirmingItem(itemId);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 800));
    
    setShipment(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map(item =>
          item.id === itemId
            ? { ...item, received, note: note || item.note }
            : item
        )
      };
    });
    
    setConfirmingItem(null);
    setEditingItem(null);
  }, [shipment]);

  // Calculate progress
  const progressPct = useMemo(() => {
    if (!shipment) return 0;
    const totalRequested = shipment.items.reduce((sum, item) => sum + item.requested, 0);
    const totalReceived = shipment.items.reduce((sum, item) => sum + item.received, 0);
    return totalRequested > 0 ? (totalReceived / totalRequested) * 100 : 0;
  }, [shipment]);

  // Status badge config
  const getStatusBadge = (status: string) => {
    const configs = {
      IN_PROGRESS: { icon: '⟳', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30', label: 'U TOKU' },
      COMPLETED: { icon: '✓', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', label: 'ZAVRŠENO' },
      ERROR: { icon: '!', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', label: 'GREŠKA' },
    };
    return configs[status as keyof typeof configs] || configs.IN_PROGRESS;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F1113] flex items-center justify-center">
        <div className="text-center">
          <svg className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-zinc-400">Učitavanje...</p>
        </div>
      </div>
    );
  }

  if (error || !shipment) {
    return (
      <div className="min-h-screen bg-[#0F1113] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#171A1D] border border-red-500/30 rounded-xl p-6 text-center">
          <svg className="w-12 h-12 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-xl font-bold text-zinc-200 mb-2">Greška</h2>
          <p className="text-zinc-400 mb-6">{error || 'Prijem nije pronađen'}</p>
          <button
            onClick={() => router.back()}
            className="rounded-full px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-medium transition-colors"
          >
            Nazad
          </button>
        </div>
      </div>
    );
  }

  const statusConfig = getStatusBadge(shipment.status);

  return (
    <div className="min-h-screen bg-[#0F1113] text-zinc-200">
      {/* Header - Sticky */}
      <div className="sticky top-0 z-30 bg-[#0F1113] border-b border-[#22262B]">
        <div className="px-4 py-4 md:px-6">
          <div className="mb-4">
            <PwaBackButton />
          </div>
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg hover:bg-zinc-800 transition-colors focus:ring-2 focus:ring-[#4C9FFE] focus:outline-none"
              aria-label="Nazad"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-zinc-200 truncate">
                {shipment.id}
              </h1>
            </div>
            
            <div className={`flex items-center gap-2 ${statusConfig.bg} ${statusConfig.border} border px-3 py-1.5 rounded-full text-sm font-medium`}>
              <span className={statusConfig.color}>{statusConfig.icon}</span>
              <span className={statusConfig.color}>{statusConfig.label}</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-2">
            <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-zinc-500">
                Napredak
              </span>
              <span className="text-xs font-semibold text-emerald-400">
                {formatPercent(progressPct, 1)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters - Sticky */}
      <div className="sticky top-[120px] z-20 bg-[#0F1113] border-b border-[#22262B] px-4 py-4 md:px-6">
        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pretraži po šifri ili nazivu..."
              className="w-full pl-10 pr-4 py-2.5 bg-[#171A1D] border border-[#22262B] rounded-xl text-zinc-200 placeholder-zinc-500 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-colors"
            />
          </div>

          {/* Filter & Sort controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              {(['ALL', 'CRITICAL', 'SHORTAGE', 'EXCESS', 'CONFIRMED'] as FilterType[]).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    filter === f
                      ? 'bg-emerald-500 text-black'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  } focus:ring-2 focus:ring-emerald-500 focus:outline-none`}
                >
                  {f === 'ALL' ? 'Sve' : 
                   f === 'CRITICAL' ? 'Kritično' :
                   f === 'SHORTAGE' ? 'Manjak' :
                   f === 'EXCESS' ? 'Višak' : 'Potvrđeno'}
                </button>
              ))}
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2 ml-auto">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortType)}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-colors"
              >
                <option value="UNPROCESSED">Neobrađeno</option>
                <option value="NAME_ASC">A–Z</option>
                <option value="NAME_DESC">Z–A</option>
                <option value="MOST_REQUESTED">Najtraženije</option>
              </select>

              {/* Dense toggle */}
              <button
                onClick={() => setDenseView(!denseView)}
                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                aria-label="Toggle compact view"
              >
                {denseView ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6 md:px-6 max-w-7xl mx-auto">
        {filteredAndSortedItems.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-16 h-16 text-zinc-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h2 className="text-xl font-bold text-zinc-300 mb-2">Nema stavki</h2>
            <p className="text-zinc-500 mb-6">
              {searchQuery ? 'Nema rezultata za pretragu' : 'Sve stavke su prikazane'}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="rounded-full px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-medium transition-colors"
              >
                Očisti pretragu
              </button>
            )}
          </div>
        ) : (
          <div className={`grid ${denseView ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'} gap-4`}>
            {filteredAndSortedItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onConfirm={handleConfirm}
                onEdit={setEditingItem}
                isExpanded={expandedItem === item.id}
                onToggleExpand={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                isLoading={confirmingItem === item.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Right Panel */}
      <RightPanel
        item={editingItem}
        isOpen={!!editingItem}
        onClose={() => setEditingItem(null)}
        onSave={handleSave}
        isLoading={!!confirmingItem}
      />
    </div>
  );
}






