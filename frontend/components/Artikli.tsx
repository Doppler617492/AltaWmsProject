import { useState, useEffect } from 'react';

interface Item {
  id: number;
  sku: string;
  name: string;
  supplier_id: number;
  barcode: string;
  created_at: string;
  supplier: {
    id: number;
    name: string;
    country: string;
    address: string;
    created_at: string;
  };
}

interface StockLocation {
  id: number;
  item_id: number;
  location_code: string;
  pallet_id: string;
  quantity_value: string;
  quantity_uom: string;
  received_at: string;
  zone_name: string;
  aisle: string;
  reserved_qty: string;
  free_qty: string;
  created_at: string;
}

export default function Artikli() {
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [stockLocations, setStockLocations] = useState<StockLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const token = localStorage.getItem('token'); // Changed from 'authToken' to 'token'
      const response = await fetch('http://localhost:8000/items', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setItems(data);
        if (data.length > 0) {
          setSelectedItem(data[0]);
          fetchStockLocations(data[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStockLocations = async (itemId: number) => {
    try {
      const token = localStorage.getItem('token'); // Changed from 'authToken' to 'token'
      const response = await fetch(`http://localhost:8000/items/${itemId}/stock`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setStockLocations(data);
      }
    } catch (error) {
      console.error('Error fetching stock locations:', error);
    }
  };

  const handleItemSelect = (item: Item) => {
    setSelectedItem(item);
    fetchStockLocations(item.id);
  };

  const filteredItems = items.filter(item =>
    item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.supplier.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div style={styles.loading}>Loading...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.layout}>
        {/* Left Panel - Items List */}
        <div style={styles.leftPanel}>
          <div style={styles.searchContainer}>
            <input
              type="text"
              placeholder="Pretraži artikle..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={styles.searchInput}
            />
          </div>
          
          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.headerRow}>
                  <th style={styles.headerCell}>DOBAVLJAČ</th>
                  <th style={styles.headerCell}>IDENT</th>
                  <th style={styles.headerCell}>ARTIKAL</th>
                  <th style={styles.headerCell}>BARCODE</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, idx) => (
                  <tr
                    key={item.id}
                    style={{
                      ...styles.dataRow,
                      background: selectedItem?.id === item.id ? styles.selectedRow.backgroundColor : (idx % 2 === 0 ? 'rgba(255,193,7,0.04)' : 'transparent')
                    }}
                    onClick={() => handleItemSelect(item)}
                  >
                    <td style={styles.dataCell}>{item.supplier.name}</td>
                    <td style={styles.dataCell}>{item.sku}</td>
                    <td style={styles.dataCell}>{item.name}</td>
                    <td style={styles.dataCell}>{item.barcode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Panel - Selected Item Stock */}
        <div style={styles.rightPanel}>
          <h3 style={styles.rightPanelTitle}>Izabrani artikal u skladištu</h3>
          {selectedItem && (
            <div style={styles.selectedItemInfo}>
              <p><strong>Artikal:</strong> {selectedItem.name}</p>
              <p><strong>SKU:</strong> {selectedItem.sku}</p>
              <p><strong>Dobavljač:</strong> {selectedItem.supplier.name}</p>
            </div>
          )}
          
          <div style={styles.stockTableContainer}>
            <table style={styles.stockTable}>
              <thead>
                <tr style={styles.headerRow}>
                  <th style={styles.headerCell}>LOKACIJA</th>
                  <th style={styles.headerCell}>PALETA</th>
                  <th style={styles.headerCell}>KOLIČINA</th>
                  <th style={styles.headerCell}>DATUM ZAPRIMANJA</th>
                </tr>
              </thead>
              <tbody>
                {stockLocations.map((location, idx) => (
                  <tr key={location.id} style={{ ...styles.dataRow, background: idx % 2 === 0 ? 'rgba(255,193,7,0.04)' : 'transparent' }}>
                    <td style={styles.dataCell}>{location.location_code}</td>
                    <td style={styles.dataCell}>{location.pallet_id}</td>
                    <td style={styles.dataCell}>
                      {location.quantity_value} {location.quantity_uom}
                    </td>
                    <td style={styles.dataCell}>
                      {new Date(location.received_at).toLocaleDateString('sr-Latn-RS')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    width: '100%',
  },
  loading: {
    textAlign: 'center' as const,
    padding: '40px',
    fontSize: '18px',
  },
  layout: {
    display: 'flex',
    gap: '20px',
    height: '600px',
  },
  leftPanel: {
    flex: '1',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  rightPanel: {
    flex: '1',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  searchContainer: {
    marginBottom: '15px',
  },
  searchInput: {
    width: '100%',
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
  },
  tableContainer: {
    flex: '1',
    overflow: 'auto',
    border: '1px solid #ffc107',
    borderRadius: '8px',
    background: '#0a0a0a',
    color: '#fff',
  },
  stockTableContainer: {
    flex: '1',
    overflow: 'auto',
    border: '1px solid #ffc107',
    borderRadius: '8px',
    background: '#0a0a0a',
    color: '#fff',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '14px',
  },
  stockTable: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '14px',
  },
  headerRow: {
    backgroundColor: '#000',
  },
  headerCell: {
    padding: '12px 8px',
    textAlign: 'left' as const,
    fontWeight: 'bold',
    borderBottom: '1px solid #000',
    fontSize: '12px',
    color: '#ffc107',
  },
  dataRow: {
    cursor: 'pointer',
    borderBottom: '1px solid #333',
  },
  selectedRow: {
    backgroundColor: 'rgba(255,193,7,0.15)',
  },
  dataCell: {
    padding: '10px 8px',
    borderBottom: '1px solid #333',
    fontSize: '12px',
    color: '#fff',
  },
  rightPanelTitle: {
    margin: '0 0 15px 0',
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#ffc107',
  },
  selectedItemInfo: {
    backgroundColor: '#0f1117',
    padding: '15px',
    borderRadius: '8px',
    border: '1px solid #2c2f36',
    marginBottom: '15px',
    fontSize: '14px',
    color: '#e5e7eb',
  },
};
