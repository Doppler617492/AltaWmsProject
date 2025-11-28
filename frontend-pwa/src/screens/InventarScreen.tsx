import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import PwaHeader from '../../components/PwaHeader';
import PwaBackButton from '../../components/PwaBackButton';

interface Store {
  id: number;
  name: string;
  code: string;
}

interface InventoryItem {
  sku: string;
  name: string;
  quantity: number;
  store_name: string;
}

interface ArticleInventory {
  sku: string;
  name: string;
  stores: Array<{
    store_name: string;
    quantity: number;
  }>;
  total_quantity: number;
}

interface SearchResult {
  ident: string;
  naziv: string;
  barcodes?: string[];
}

// Custom SVG Icons
const SearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/>
    <path d="m21 21-4.35-4.35"/>
  </svg>
);

const PackageIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M16.5 9.4L7.55 4.24C6.62 3.69 5.5 4.36 5.5 5.4v13.2c0 1.04 1.12 1.71 2.05 1.16l8.95-5.16c.93-.55.93-1.77 0-2.32z"/>
    <rect x="14" y="4" width="8" height="16" rx="2"/>
  </svg>
);

const InventoryIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
    <line x1="8" y1="21" x2="16" y2="21"/>
    <line x1="12" y1="17" x2="12" y2="21"/>
  </svg>
);

const LoadingIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
    <path d="M21 12a9 9 0 11-6.219-8.56"/>
  </svg>
);

const WarehouseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M2 20h20"/>
    <path d="M4 20V10l8-6 8 6v10"/>
    <path d="M9 20V14h6v6"/>
    <path d="M9 9h6"/>
  </svg>
);

export default function InventarScreen() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<ArticleInventory | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();
  
  const apiBase = typeof window !== 'undefined' ? `${window.location.origin}/api/fresh` : 'http://localhost:8000';

  // Load user and stores on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/');
      return;
    }
    
    // Decode user from token
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setUser({ 
        id: payload.sub, 
        username: payload.username, 
        name: payload.name || payload.username,
        role: payload.role 
      });
    } catch {
      localStorage.removeItem('token');
      router.push('/');
      return;
    }
    
    const loadStores = async () => {
      try {
        const response = await fetch(`${apiBase}/stock/stores`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const storeList = await response.json();
        setStores(Array.isArray(storeList) ? storeList : []);
      } catch (error) {
        console.error('Error loading stores:', error);
      }
    };
    loadStores();
  }, [router]);

  const searchArticles = async () => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setSelectedArticle(null);
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token') || '';
      const params = new URLSearchParams();
      params.set('limit', '50');
      params.set('search', searchTerm.trim());
      
      const response = await fetch(`${apiBase}/stock/pantheon/items?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = await response.json();
      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      
      setSearchResults(items);
      setSelectedArticle(null);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const loadInventoryForArticle = async (article: SearchResult) => {
    setLoadingInventory(true);
    setSelectedArticle(null);
    
    try {
      const token = localStorage.getItem('token') || '';
      
      // Search across all store inventories for this specific article
      const inventoryPromises = stores.map(async (store) => {
        try {
          const response = await fetch(`${apiBase}/stock/by-store/${store.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await response.json();
          const matchingItem = (data?.items || []).find((item: any) => 
            item.sku === article.ident
          );
          return {
            store_name: store.name,
            quantity: matchingItem?.quantity || 0
          };
        } catch {
          return {
            store_name: store.name,
            quantity: 0
          };
        }
      });

      const storeInventories = await Promise.all(inventoryPromises);
      const totalQuantity = storeInventories.reduce((sum, store) => sum + store.quantity, 0);
      
      setSelectedArticle({
        sku: article.ident,
        name: article.naziv,
        stores: storeInventories.sort((a, b) => b.quantity - a.quantity),
        total_quantity: totalQuantity
      });
    } catch (error) {
      console.error('Inventory load error:', error);
    } finally {
      setLoadingInventory(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    searchArticles();
  };

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm.trim().length >= 2) {
        searchArticles();
      } else {
        setSearchResults([]);
        setSelectedArticle(null);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  if (!user) {
    return null;
  }

  return (
    <div 
      className="min-h-screen" 
      style={{ 
        background: 'linear-gradient(180deg, #0f1419 0%, #0a0e13 50%, #000000 100%)',
        color: '#ffffff'
      }}
    >
      <PwaHeader 
        name={user?.name || ''} 
        onLogout={() => { 
          localStorage.removeItem('token'); 
          router.push('/'); 
        }} 
      />
      
      <div style={{ padding: '20px 16px' }}>
        <div style={{ marginBottom: 24 }}>
          <PwaBackButton />
        </div>
        
        {/* Header Section */}
        <div style={{ marginBottom: 32 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 12
          }}>
            <InventoryIcon />
            <div style={{ 
              fontSize: 28, 
              fontWeight: 700,
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.02em'
            }}>
              Inventar sistema
            </div>
          </div>
          <div style={{
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: 15,
            lineHeight: '1.5'
          }}>
            Pretraga i pregled zaliha artikala kroz sve prodavnice
          </div>
        </div>

        {/* Search Section */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 16,
          padding: 20,
          marginBottom: 24,
          backdropFilter: 'blur(10px)'
        }}>
          <form onSubmit={handleSearchSubmit}>
            <div style={{ 
              position: 'relative',
              marginBottom: 16
            }}>
              <div style={{
                position: 'absolute',
                left: 16,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'rgba(255, 255, 255, 0.5)',
                pointerEvents: 'none'
              }}>
                <SearchIcon />
              </div>
              
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Unesite šifru, naziv ili barkod artikla..."
                style={{
                  width: '100%',
                  padding: '16px 16px 16px 48px',
                  borderRadius: 12,
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: '#ffffff',
                  fontSize: 16,
                  outline: 'none',
                  transition: 'all 0.2s ease'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
            
            {searchTerm.length >= 1 && (
              <div style={{
                fontSize: 13,
                color: 'rgba(255, 255, 255, 0.6)',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                {loading ? (
                  <>
                    <LoadingIcon />
                    <span>Pretraga u toku...</span>
                  </>
                ) : searchResults.length > 0 ? (
                  <span>Pronađeno {searchResults.length} artikala</span>
                ) : searchTerm.length >= 2 ? (
                  <span>Nema rezultata za "{searchTerm}"</span>
                ) : (
                  <span>Unesite najmanje 2 karaktera</span>
                )}
              </div>
            )}
          </form>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{
              fontSize: 16,
              fontWeight: 600,
              color: 'rgba(255, 255, 255, 0.9)',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <PackageIcon />
              Rezultati pretrage
            </div>
            
            <div style={{ display: 'grid', gap: 12 }}>
              {searchResults.map((article, index) => (
                <button
                  key={index}
                  onClick={() => loadInventoryForArticle(article)}
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 12,
                    padding: 16,
                    textAlign: 'left',
                    color: '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div style={{ 
                    fontWeight: 600,
                    color: '#3b82f6',
                    marginBottom: 4,
                    fontSize: 15
                  }}>
                    {article.ident}
                  </div>
                  <div style={{ 
                    color: 'rgba(255, 255, 255, 0.8)',
                    fontSize: 14,
                    lineHeight: '1.4'
                  }}>
                    {article.naziv}
                  </div>
                  {article.barcodes && article.barcodes.length > 0 && (
                    <div style={{
                      fontSize: 12,
                      color: 'rgba(255, 255, 255, 0.5)',
                      marginTop: 6
                    }}>
                      Barkodovi: {article.barcodes.slice(0, 3).join(', ')}{article.barcodes.length > 3 ? '...' : ''}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Selected Article Inventory */}
        {loadingInventory && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 16,
            padding: 32,
            textAlign: 'center'
          }}>
            <LoadingIcon />
            <div style={{ marginTop: 12, color: 'rgba(255, 255, 255, 0.7)' }}>
              Učitavam zalihe...
            </div>
          </div>
        )}

        {selectedArticle && !loadingInventory && (
          <div style={{
            background: 'linear-gradient(145deg, rgba(59, 130, 246, 0.1), rgba(29, 78, 216, 0.1))',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            borderRadius: 16,
            padding: 24,
            backdropFilter: 'blur(10px)'
          }}>
            {/* Article Header */}
            <div style={{ marginBottom: 24 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 8
              }}>
                <div style={{
                  width: 40,
                  height: 40,
                  background: 'rgba(59, 130, 246, 0.2)',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <PackageIcon />
                </div>
                <div>
                  <div style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: '#3b82f6',
                    marginBottom: 2
                  }}>
                    {selectedArticle.sku}
                  </div>
                  <div style={{
                    fontSize: 14,
                    color: 'rgba(255, 255, 255, 0.8)'
                  }}>
                    {selectedArticle.name}
                  </div>
                </div>
              </div>
              
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: selectedArticle.total_quantity > 0 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                color: selectedArticle.total_quantity > 0 ? '#22c55e' : '#ef4444',
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 600
              }}>
                <InventoryIcon />
                Ukupno: {selectedArticle.total_quantity.toLocaleString()} kom
              </div>
            </div>

            {/* Store Breakdown */}
            <div>
              <div style={{
                fontSize: 16,
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.9)',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <WarehouseIcon />
                Distribucija po prodavnicama ({stores.length} ukupno)
              </div>
              
              <div style={{ display: 'grid', gap: 8 }}>
                {selectedArticle.stores.map((store, index) => (
                  <div 
                    key={index}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                      background: store.quantity > 0 
                        ? 'rgba(255, 255, 255, 0.08)' 
                        : 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: 10,
                      fontSize: 14
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      color: 'rgba(255, 255, 255, 0.9)'
                    }}>
                      <WarehouseIcon />
                      {store.store_name.replace('Prodavnica - ', '')}
                    </div>
                    <div style={{
                      fontWeight: 600,
                      color: store.quantity > 0 ? '#22c55e' : 'rgba(255, 255, 255, 0.4)',
                      fontSize: 15
                    }}>
                      {store.quantity.toLocaleString()} kom
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!searchTerm && !selectedArticle && (
          <div style={{
            textAlign: 'center',
            padding: 60,
            color: 'rgba(255, 255, 255, 0.6)'
          }}>
            <div style={{ marginBottom: 20, opacity: 0.5 }}>
              <PackageIcon />
            </div>
            <div style={{
              fontSize: 18,
              fontWeight: 600,
              marginBottom: 8,
              color: 'rgba(255, 255, 255, 0.8)'
            }}>
              Pretraga inventara
            </div>
            <div style={{ fontSize: 15, lineHeight: '1.5' }}>
              Koristite polje za pretragu da pronađete artikle<br />
              i vidite njihove zalihe kroz sve prodavnice
            </div>
          </div>
        )}
      </div>
    </div>
  );
}