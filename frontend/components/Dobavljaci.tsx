import { useState, useEffect } from 'react';

interface Supplier {
  id: number;
  name: string;
  country: string;
  address: string;
  created_at: string;
}

export default function Dobavljaci() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8000/suppliers', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setSuppliers(data);
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={styles.loading}>Loading...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.headerRow}>
              <th style={styles.headerCell}>DOBAVLJAČ</th>
              <th style={styles.headerCell}>PUNI NAZIV</th>
              <th style={styles.headerCell}>DRŽAVA</th>
              <th style={styles.headerCell}>ADRESA</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((supplier) => (
              <tr key={supplier.id} style={styles.dataRow}>
                <td style={styles.dataCell}>{supplier.name}</td>
                <td style={styles.dataCell}>{supplier.name}</td>
                <td style={styles.dataCell}>{supplier.country}</td>
                <td style={styles.dataCell}>{supplier.address}</td>
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
  tableContainer: {
    border: '1px solid #ddd',
    borderRadius: '4px',
    overflow: 'auto',
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
