import { useState, useEffect } from 'react';

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
  item: {
    id: number;
    sku: string;
    name: string;
    supplier_id: number;
    barcode: string;
    created_at: string;
  };
}

export default function ZalihaNaLokacijama() {
  const [stockLocations, setStockLocations] = useState<StockLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchStockLocations();
  }, []);

  const fetchStockLocations = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8000/stock/by-location', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setStockLocations(data);
      }
    } catch (error) {
      console.error('Error fetching stock locations:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLocations = stockLocations.filter(location =>
    location.location_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    location.item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    location.item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    location.aisle.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div style={styles.loading}>Loading...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Zaliha na lokacijama</h3>
        <div style={styles.searchContainer}>
          <input
            type="text"
            placeholder="Find..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
        </div>
      </div>
      
      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.headerRow}>
              <th style={styles.headerCell}>PROLAZ</th>
              <th style={styles.headerCell}>LOKACIJA</th>
              <th style={styles.headerCell}>PALETA</th>
              <th style={styles.headerCell}>ARTIKL</th>
              <th style={styles.headerCell}>KOLIČINA</th>
              <th style={styles.headerCell}>DATUM ZAPRIM.</th>
            </tr>
          </thead>
          <tbody>
            {filteredLocations.map((location) => (
              <tr key={location.id} style={styles.dataRow}>
                <td style={styles.dataCell}>{location.aisle}</td>
                <td style={styles.dataCell}>{location.location_code}</td>
                <td style={styles.dataCell}>{location.pallet_id}</td>
                <td style={styles.dataCell}>{location.item.name}</td>
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
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px',
  },
  title: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#000',
    backgroundColor: '#ffc107',
    padding: '8px 16px',
    borderRadius: '4px',
  },
  searchContainer: {
    display: 'flex',
    alignItems: 'center',
  },
  searchInput: {
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    width: '200px',
  },
  tableContainer: {
    border: '1px solid #ddd',
    borderRadius: '4px',
    overflow: 'auto',
    maxHeight: '500px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '14px',
  },
  headerRow: {
    backgroundColor: '#f5f5f5',
  },
  headerCell: {
    padding: '12px 8px',
    textAlign: 'left' as const,
    fontWeight: 'bold',
    borderBottom: '1px solid #ddd',
    fontSize: '12px',
  },
  dataRow: {
    borderBottom: '1px solid #eee',
  },
  dataCell: {
    padding: '10px 8px',
    borderBottom: '1px solid #eee',
    fontSize: '12px',
  },
};
