import React, { useState, useEffect } from 'react';
import { MainLayout } from '../src/components/layout/MainLayout';
import { useRouter } from 'next/router';
import { apiClient } from '../lib/apiClient';
import { colors } from '../src/theme/colors';

interface TaskRecord {
  id: number;
  date: string;
  worker: string;
  worker_id: number;
  team: string | null;
  task_type: string;
  document_id: string;
  items_count: number;
  quantity: number;
  duration: number | null;
  details: any;
}

interface WorkerSummary {
  worker_id: number;
  worker_name: string;
  tasks_completed: number;
  lines_processed: number;
  total_quantity: number;
  total_active_time: number;
}

interface TeamSummary {
  team_id: number;
  team_name: string;
  tasks_completed: number;
  lines_processed: number;
  total_quantity: number;
  time_spent: number;
}

interface User {
  id: number;
  username: string;
  full_name: string;
}

interface Team {
  id: number;
  name: string;
}

type TabMode = 'tasks' | 'workers' | 'teams';
type SortField = 'date' | 'worker' | 'task_type' | 'items_count' | 'quantity' | 'duration' | 'tasks_completed' | 'lines_processed' | 'total_quantity' | 'time_spent';
type SortOrder = 'asc' | 'desc';

const ReportsPage: React.FC = () => {
  const router = useRouter();
  const [hasAccess, setHasAccess] = useState(false);
  const [activeTab, setActiveTab] = useState<TabMode>('tasks');
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setDate(1); // First day of current month
    return date.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Sorting
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Task history filters
  const [taskType, setTaskType] = useState('ALL');
  const [selectedWorker, setSelectedWorker] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [skuFilter, setSkuFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');

  // Dropdown data
  const [usersList, setUsersList] = useState<User[]>([]);
  const [teamsList, setTeamsList] = useState<Team[]>([]);

  // Data states
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [workers, setWorkers] = useState<WorkerSummary[]>([]);
  const [teams, setTeams] = useState<TeamSummary[]>([]);

  // Detail modal
  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Check role-based access
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/');
      return;
    }
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const role = (payload.role || '').toLowerCase();
      const allowedRoles = ['admin', 'menadzer', 'sef'];
      if (allowedRoles.includes(role)) {
        setHasAccess(true);
      } else {
        alert('Nemate pristup ovoj stranici. Potrebna je admin ili menadžer uloga.');
        router.push('/dashboard');
      }
    } catch {
      router.push('/');
    }
  }, [router]);

  // Fetch users and teams for dropdowns
  useEffect(() => {
    if (!hasAccess) return;
    
    apiClient.get('/users')
      .then(data => setUsersList(Array.isArray(data) ? data : []))
      .catch(() => {});

    apiClient.get('/teams')
      .then(data => setTeamsList(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [hasAccess]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'tasks') {
        const params: any = { from: dateFrom, to: dateTo };
        if (taskType !== 'ALL') params.task_type = taskType;
        if (selectedWorker) params.worker_id = selectedWorker;
        if (selectedTeam) params.team_id = selectedTeam;
        if (skuFilter) params.sku = skuFilter;
        if (locationFilter) params.location = locationFilter;

        const query = new URLSearchParams(params).toString();
        const data = await apiClient.get(`/reports/task-history?${query}`);
        setTasks(data);
      } else if (activeTab === 'workers') {
        const query = new URLSearchParams({ from: dateFrom, to: dateTo }).toString();
        const data = await apiClient.get(`/reports/workers-summary?${query}`);
        setWorkers(data);
      } else if (activeTab === 'teams') {
        const query = new URLSearchParams({ from: dateFrom, to: dateTo }).toString();
        const data = await apiClient.get(`/reports/teams-summary?${query}`);
        setTeams(data);
      }
    } catch (err) {
      console.error('Error fetching reports:', err);
      alert('Failed to fetch reports data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasAccess) {
      fetchData();
      setCurrentPage(1); // Reset pagination on tab/filter change
    }
  }, [activeTab, dateFrom, dateTo, hasAccess]);

  const handleExportExcel = async () => {
    const token = localStorage.getItem('token');
    try {
      const query = new URLSearchParams({ from: dateFrom, to: dateTo }).toString();
      const res = await fetch(`/api/proxy/reports/export-excel?${query}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Alta_WMS_Report_${dateFrom}_to_${dateTo}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting Excel:', err);
      alert('Failed to export Excel report');
    }
  };

  const handleExportCSV = async () => {
    let csvContent = '';
    let filename = '';

    if (activeTab === 'tasks') {
      csvContent = 'Date/Time,Worker,Task Type,Document ID,Items,Quantity,Duration (min)\n';
      const data = getSortedAndPaginatedData();
      data.forEach((task: TaskRecord) => {
        csvContent += `"${formatDate(task.date)}","${task.worker}","${task.task_type}","${task.document_id}",${task.items_count},${task.quantity},${task.duration || 'N/A'}\n`;
      });
      filename = `Task_History_${dateFrom}_to_${dateTo}.csv`;
    } else if (activeTab === 'workers') {
      csvContent = 'Worker,Tasks Completed,Lines Processed,Total Quantity,Active Time (min)\n';
      const data = getSortedAndPaginatedData();
      data.forEach((w: WorkerSummary) => {
        csvContent += `"${w.worker_name}",${w.tasks_completed},${w.lines_processed},${w.total_quantity},${w.total_active_time}\n`;
      });
      filename = `Workers_Summary_${dateFrom}_to_${dateTo}.csv`;
    } else if (activeTab === 'teams') {
      csvContent = 'Team,Tasks Completed,Lines Processed,Total Quantity,Time Spent (min)\n';
      const data = getSortedAndPaginatedData();
      data.forEach((t: TeamSummary) => {
        csvContent += `"${t.team_name}",${t.tasks_completed},${t.lines_processed},${t.total_quantity},${t.time_spent}\n`;
      });
      filename = `Teams_Summary_${dateFrom}_to_${dateTo}.csv`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setCurrentPage(1); // Reset to first page on sort
  };

  const getSortedAndPaginatedData = () => {
    let data: any[] = activeTab === 'tasks' ? tasks : activeTab === 'workers' ? workers : teams;

    // Apply sorting
    if (sortField) {
      data = [...data].sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        
        if (typeof aVal === 'string') {
          return sortOrder === 'asc' 
            ? aVal.localeCompare(bVal) 
            : bVal.localeCompare(aVal);
        } else {
          return sortOrder === 'asc' 
            ? (aVal || 0) - (bVal || 0) 
            : (bVal || 0) - (aVal || 0);
        }
      });
    }

    // Apply pagination
    const startIndex = (currentPage - 1) * pageSize;
    return data.slice(startIndex, startIndex + pageSize);
  };

  const getTotalPages = () => {
    const totalItems = activeTab === 'tasks' ? tasks.length : activeTab === 'workers' ? workers.length : teams.length;
    return Math.ceil(totalItems / pageSize);
  };

  const setDatePreset = (preset: 'today' | 'week' | 'month' | 'lastMonth') => {
    const today = new Date();
    let from = new Date();
    let to = new Date();

    switch (preset) {
      case 'today':
        from = to = today;
        break;
      case 'week':
        from = new Date(today);
        from.setDate(today.getDate() - today.getDay()); // Start of week
        break;
      case 'month':
        from = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'lastMonth':
        from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        to = new Date(today.getFullYear(), today.getMonth(), 0); // Last day of previous month
        break;
    }

    setDateFrom(from.toISOString().split('T')[0]);
    setDateTo(to.toISOString().split('T')[0]);
  };

  const handlePrintDetails = () => {
    if (!selectedTask) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Task Details - ${selectedTask.document_id}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { font-size: 20px; margin-bottom: 10px; }
            .info { margin: 10px 0; padding: 10px; background: #f5f5f5; }
            .label { font-weight: bold; }
            pre { background: #f9f9f9; padding: 10px; border: 1px solid #ddd; }
          </style>
        </head>
        <body>
          <h1>Task Details</h1>
          <div class="info">
            <div><span class="label">Task Type:</span> ${selectedTask.task_type}</div>
            <div><span class="label">Document ID:</span> ${selectedTask.document_id}</div>
            <div><span class="label">Worker:</span> ${selectedTask.worker}</div>
            <div><span class="label">Date:</span> ${formatDate(selectedTask.date)}</div>
            <div><span class="label">Items Count:</span> ${selectedTask.items_count}</div>
            <div><span class="label">Quantity:</span> ${selectedTask.quantity}</div>
            <div><span class="label">Duration:</span> ${formatDuration(selectedTask.duration)}</div>
          </div>
          <h2>Details</h2>
          <pre>${JSON.stringify(selectedTask.details, null, 2)}</pre>
          <script>window.print(); window.close();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('sr-RS', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <MainLayout breadcrumb={['Izveštaji']}>
      <div style={{
        background: 'linear-gradient(180deg, #05070d 0%, #020304 100%)',
        minHeight: '100vh',
        padding: '2rem clamp(1.5rem, 2vw, 3rem)',
        boxSizing: 'border-box',
        color: colors.textPrimary,
      }}>
        {/* Hero Section */}
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{
            textTransform: 'uppercase',
            letterSpacing: 3,
            fontSize: 12,
            color: 'rgba(255,255,255,0.45)',
            marginBottom: 6,
          }}>
            Centar za izveštaje
          </div>
          <h1 style={{
            fontSize: 'clamp(2rem, 4vw, 3.5rem)',
            fontWeight: 800,
            margin: '0 0 0.75rem',
            background: 'linear-gradient(135deg, #ffd400 0%, #ffaa00 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.02em',
          }}>
            Izveštaji
          </h1>
          <p style={{
            fontSize: '1.125rem',
            color: 'rgba(255,255,255,0.6)',
            margin: 0,
            lineHeight: 1.6,
            maxWidth: '600px',
          }}>
            Detaljan pregled zadataka, performansi radnika i timova
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
            <button
              onClick={handleExportCSV}
              style={{
                background: 'rgba(250,204,21,0.1)',
                color: colors.brandYellow,
                border: '1px solid rgba(250,204,21,0.35)',
                padding: '12px 24px',
                borderRadius: 12,
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Izvezi CSV
            </button>
            <button
              onClick={handleExportExcel}
              style={{
                background: colors.brandYellow,
                color: '#000',
                border: 'none',
                padding: '12px 24px',
                borderRadius: 12,
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Izvezi Excel
            </button>
          </div>
        </div>

        {/* Date Range Filter with Presets */}
        <div style={{
          background: 'rgba(15,23,42,0.75)',
          border: '1px solid rgba(148,163,184,0.25)',
          borderRadius: 16,
          padding: 20,
          marginBottom: 24,
        }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '14px', fontWeight: '600', color: colors.brandYellow }}>Brzi izbor:</label>
            <button onClick={() => setDatePreset('today')} style={{ padding: '8px 16px', background: 'rgba(250,204,21,0.1)', color: colors.brandYellow, border: '1px solid rgba(250,204,21,0.35)', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}>Danas</button>
            <button onClick={() => setDatePreset('week')} style={{ padding: '8px 16px', background: 'rgba(250,204,21,0.1)', color: colors.brandYellow, border: '1px solid rgba(250,204,21,0.35)', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}>Ova nedelja</button>
            <button onClick={() => setDatePreset('month')} style={{ padding: '8px 16px', background: 'rgba(250,204,21,0.1)', color: colors.brandYellow, border: '1px solid rgba(250,204,21,0.35)', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}>Ovaj mesec</button>
            <button onClick={() => setDatePreset('lastMonth')} style={{ padding: '8px 16px', background: 'rgba(250,204,21,0.1)', color: colors.brandYellow, border: '1px solid rgba(250,204,21,0.35)', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}>Prošli mesec</button>
          </div>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '14px', fontWeight: '600', color: colors.textPrimary }}>Prilagođen opseg:</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{
                padding: '10px 14px',
                background: 'rgba(15,23,42,0.5)',
                border: '1px solid rgba(148,163,184,0.35)',
                borderRadius: '8px',
                fontSize: '14px',
                color: colors.textPrimary,
                flex: '0 0 160px',
              }}
            />
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>do</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{
                padding: '10px 14px',
                background: 'rgba(15,23,42,0.5)',
                border: '1px solid rgba(148,163,184,0.35)',
                borderRadius: '8px',
                fontSize: '14px',
                color: colors.textPrimary,
                flex: '0 0 160px',
              }}
            />
            <button
              onClick={fetchData}
              style={{
                padding: '10px 20px',
                background: colors.brandYellow,
                color: '#000',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                marginLeft: 'auto',
              }}
            >
              Primeni filter
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '24px',
          borderBottom: '2px solid rgba(148,163,184,0.15)',
          paddingBottom: '0',
        }}>
          {[
            { key: 'tasks', label: 'Istorija zadataka' },
            { key: 'workers', label: 'Pregled radnika' },
            { key: 'teams', label: 'Pregled timova' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabMode)}
              style={{
                padding: '14px 28px',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.key ? `3px solid ${colors.brandYellow}` : '3px solid transparent',
                fontSize: '15px',
                fontWeight: activeTab === tab.key ? '700' : '500',
                color: activeTab === tab.key ? colors.brandYellow : 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Task History Tab */}
        {activeTab === 'tasks' && (
          <>
            {/* Additional Filters */}
            <div style={{
              background: 'rgba(15,23,42,0.75)',
              border: '1px solid rgba(148,163,184,0.25)',
              borderRadius: 16,
              padding: 24,
              marginBottom: 24,
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '20px',
            }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: colors.brandYellow, marginBottom: '6px' }}>
                  Tip zadatka
                </label>
                <select
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'rgba(15,23,42,0.5)',
                    border: '1px solid rgba(148,163,184,0.35)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: colors.textPrimary,
                  }}
                >
                  <option value="ALL">Svi tipovi</option>
                  <option value="RECEIVING">Prijem</option>
                  <option value="CYCLE_COUNT">Popis</option>
                  <option value="SKART">SKART</option>
                  <option value="POVRACAJ">Povraćaj</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: colors.brandYellow, marginBottom: '6px' }}>
                  Radnik
                </label>
                <select
                  value={selectedWorker}
                  onChange={(e) => setSelectedWorker(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'rgba(15,23,42,0.5)',
                    border: '1px solid rgba(148,163,184,0.35)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: colors.textPrimary,
                  }}
                >
                  <option value="">Svi radnici</option>
                  {usersList.map(user => (
                    <option key={user.id} value={user.id}>{user.full_name || user.username}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: colors.brandYellow, marginBottom: '6px' }}>
                  Tim
                </label>
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'rgba(15,23,42,0.5)',
                    border: '1px solid rgba(148,163,184,0.35)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: colors.textPrimary,
                  }}
                >
                  <option value="">Svi timovi</option>
                  {teamsList.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: colors.brandYellow, marginBottom: '6px' }}>
                  SKU
                </label>
                <input
                  type="text"
                  value={skuFilter}
                  onChange={(e) => setSkuFilter(e.target.value)}
                  placeholder="Pretraži po SKU..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'rgba(15,23,42,0.5)',
                    border: '1px solid rgba(148,163,184,0.35)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: colors.textPrimary,
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: colors.brandYellow, marginBottom: '6px' }}>
                  Lokacija
                </label>
                <input
                  type="text"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  placeholder="Pretraži po lokaciji..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'rgba(15,23,42,0.5)',
                    border: '1px solid rgba(148,163,184,0.35)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: colors.textPrimary,
                  }}
                />
              </div>
            </div>

            {/* Tasks Table */}
            <div style={{
              background: 'rgba(15,23,42,0.75)',
              border: '1px solid rgba(148,163,184,0.25)',
              borderRadius: 16,
              overflow: 'hidden',
            }}>
              {loading ? (
                <div style={{ padding: '60px', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
                  Učitavanje zadataka...
                </div>
              ) : tasks.length === 0 ? (
                <div style={{ padding: '60px', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
                  Nema pronađenih zadataka za izabrani period i filtere.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'rgba(15,23,42,0.9)', borderBottom: '2px solid rgba(148,163,184,0.15)' }}>
                        <th onClick={() => handleSort('date')} style={{ padding: '16px 20px', textAlign: 'left', fontSize: '13px', fontWeight: '700', color: colors.brandYellow, cursor: 'pointer', userSelect: 'none' }}>Datum/Vreme {sortField === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                        <th onClick={() => handleSort('worker')} style={{ padding: '16px 20px', textAlign: 'left', fontSize: '13px', fontWeight: '700', color: colors.brandYellow, cursor: 'pointer', userSelect: 'none' }}>Radnik {sortField === 'worker' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                        <th onClick={() => handleSort('task_type')} style={{ padding: '16px 20px', textAlign: 'left', fontSize: '13px', fontWeight: '700', color: colors.brandYellow, cursor: 'pointer', userSelect: 'none' }}>Tip {sortField === 'task_type' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                        <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '13px', fontWeight: '700', color: colors.brandYellow }}>ID Dokumenta</th>
                        <th onClick={() => handleSort('items_count')} style={{ padding: '16px 20px', textAlign: 'center', fontSize: '13px', fontWeight: '700', color: colors.brandYellow, cursor: 'pointer', userSelect: 'none' }}>Stavke {sortField === 'items_count' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                        <th onClick={() => handleSort('quantity')} style={{ padding: '16px 20px', textAlign: 'center', fontSize: '13px', fontWeight: '700', color: colors.brandYellow, cursor: 'pointer', userSelect: 'none' }}>Količina {sortField === 'quantity' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                        <th onClick={() => handleSort('duration')} style={{ padding: '16px 20px', textAlign: 'center', fontSize: '13px', fontWeight: '700', color: colors.brandYellow, cursor: 'pointer', userSelect: 'none' }}>Trajanje {sortField === 'duration' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                        <th style={{ padding: '16px 20px', textAlign: 'center', fontSize: '13px', fontWeight: '700', color: colors.brandYellow }}>Akcije</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getSortedAndPaginatedData().map((task, idx) => (
                        <tr key={`${task.task_type}-${task.id}`} style={{
                          borderBottom: '1px solid rgba(148,163,184,0.1)',
                          background: idx % 2 === 0 ? 'rgba(15,23,42,0.4)' : 'rgba(15,23,42,0.2)',
                        }}>
                          <td style={{ padding: '16px 20px', fontSize: '14px', color: colors.textPrimary }}>{formatDate(task.date)}</td>
                          <td style={{ padding: '16px 20px', fontSize: '14px', color: colors.textPrimary }}>{task.worker}</td>
                          <td style={{ padding: '16px 20px', fontSize: '14px' }}>
                            <span style={{
                              padding: '4px 10px',
                              background: task.task_type === 'RECEIVING' ? 'rgba(59,130,246,0.2)' : task.task_type === 'CYCLE_COUNT' ? 'rgba(250,204,21,0.2)' : 'rgba(236,72,153,0.2)',
                              color: task.task_type === 'RECEIVING' ? '#60a5fa' : task.task_type === 'CYCLE_COUNT' ? colors.brandYellow : '#f472b6',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '600',
                            }}>
                              {task.task_type.replace('_', ' ')}
                            </span>
                          </td>
                          <td style={{ padding: '16px 20px', fontSize: '14px', color: colors.textPrimary, fontFamily: 'monospace' }}>{task.document_id}</td>
                          <td style={{ padding: '16px 20px', fontSize: '14px', color: colors.textPrimary, textAlign: 'center' }}>{task.items_count}</td>
                          <td style={{ padding: '16px 20px', fontSize: '14px', color: colors.textPrimary, textAlign: 'center', fontWeight: '600' }}>{task.quantity}</td>
                          <td style={{ padding: '16px 20px', fontSize: '14px', color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>{formatDuration(task.duration)}</td>
                          <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                            <button
                              onClick={() => {
                                setSelectedTask(task);
                                setShowDetailsModal(true);
                              }}
                              style={{
                                padding: '6px 14px',
                                background: 'rgba(250,204,21,0.1)',
                                border: '1px solid rgba(250,204,21,0.35)',
                                borderRadius: '8px',
                                fontSize: '13px',
                                fontWeight: '600',
                                color: colors.brandYellow,
                                cursor: 'pointer',
                              }}
                            >
                              Detalji
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {/* Pagination */}
              {tasks.length > 0 && (
                <div style={{ padding: '20px', borderTop: '1px solid rgba(148,163,184,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>Veličina stranice:</span>
                    <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} style={{ padding: '6px 10px', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.35)', borderRadius: '8px', fontSize: '13px', color: colors.textPrimary }}>
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                    <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', marginLeft: '16px' }}>Prikazano {Math.min((currentPage - 1) * pageSize + 1, tasks.length)}-{Math.min(currentPage * pageSize, tasks.length)} od {tasks.length}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)} style={{ padding: '8px 12px', background: currentPage === 1 ? 'rgba(15,23,42,0.5)' : 'rgba(250,204,21,0.1)', border: '1px solid rgba(148,163,184,0.35)', borderRadius: '8px', fontSize: '13px', color: currentPage === 1 ? 'rgba(255,255,255,0.3)' : colors.brandYellow, cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontWeight: 600 }}>Prethodna</button>
                    <span style={{ padding: '8px 12px', fontSize: '13px', color: colors.textPrimary }}>Stranica {currentPage} od {getTotalPages()}</span>
                    <button disabled={currentPage >= getTotalPages()} onClick={() => setCurrentPage(currentPage + 1)} style={{ padding: '8px 12px', background: currentPage >= getTotalPages() ? 'rgba(15,23,42,0.5)' : 'rgba(250,204,21,0.1)', border: '1px solid rgba(148,163,184,0.35)', borderRadius: '8px', fontSize: '13px', color: currentPage >= getTotalPages() ? 'rgba(255,255,255,0.3)' : colors.brandYellow, cursor: currentPage >= getTotalPages() ? 'not-allowed' : 'pointer', fontWeight: 600 }}>Sledeća</button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Workers Summary Tab */}
        {activeTab === 'workers' && (
          <div style={{
            background: 'rgba(15,23,42,0.75)',
            border: '1px solid rgba(148,163,184,0.25)',
            borderRadius: '16px',
            overflow: 'hidden',
          }}>
            {loading ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'rgba(255,255,255,0.6)' }}>
                Učitavanje pregleda radnika...
              </div>
            ) : workers.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'rgba(255,255,255,0.6)' }}>
                Nema podataka o radnicima za izabrani period.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'rgba(15,23,42,0.9)', borderBottom: '2px solid rgba(148,163,184,0.15)' }}>
                      <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '13px', fontWeight: '700', color: colors.brandYellow }}>Radnik</th>
                      <th onClick={() => handleSort('tasks_completed')} style={{ padding: '16px 20px', textAlign: 'center', fontSize: '13px', fontWeight: '700', color: colors.brandYellow, cursor: 'pointer', userSelect: 'none' }}>Završeni zadaci {sortField === 'tasks_completed' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                      <th onClick={() => handleSort('lines_processed')} style={{ padding: '16px 20px', textAlign: 'center', fontSize: '13px', fontWeight: '700', color: colors.brandYellow, cursor: 'pointer', userSelect: 'none' }}>Obrađene stavke {sortField === 'lines_processed' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                      <th onClick={() => handleSort('total_quantity')} style={{ padding: '16px 20px', textAlign: 'center', fontSize: '13px', fontWeight: '700', color: colors.brandYellow, cursor: 'pointer', userSelect: 'none' }}>Ukupna količina {sortField === 'total_quantity' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                      <th style={{ padding: '16px 20px', textAlign: 'center', fontSize: '13px', fontWeight: '700', color: colors.brandYellow }}>Aktivno vreme</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getSortedAndPaginatedData().map((worker, idx) => (
                      <tr key={worker.worker_id} style={{
                        borderBottom: '1px solid rgba(148,163,184,0.1)',
                        background: idx % 2 === 0 ? 'rgba(15,23,42,0.4)' : 'rgba(15,23,42,0.2)',
                      }}>
                        <td style={{ padding: '16px 20px', fontSize: '14px', color: colors.textPrimary, fontWeight: '500' }}>{worker.worker_name}</td>
                        <td style={{ padding: '16px 20px', fontSize: '14px', color: colors.textPrimary, textAlign: 'center' }}>{worker.tasks_completed}</td>
                        <td style={{ padding: '16px 20px', fontSize: '14px', color: colors.textPrimary, textAlign: 'center' }}>{worker.lines_processed}</td>
                        <td style={{ padding: '16px 20px', fontSize: '14px', color: colors.textPrimary, textAlign: 'center', fontWeight: '500' }}>{worker.total_quantity}</td>
                        <td style={{ padding: '16px 20px', fontSize: '14px', color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>{formatDuration(worker.total_active_time)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {/* Pagination */}
            {workers.length > 0 && (
              <div style={{ padding: '20px', borderTop: '1px solid rgba(148,163,184,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>Veličina stranice:</span>
                  <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} style={{ padding: '6px 10px', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.35)', borderRadius: '8px', fontSize: '13px', color: colors.textPrimary }}>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', marginLeft: '16px' }}>Prikazano {Math.min((currentPage - 1) * pageSize + 1, workers.length)}-{Math.min(currentPage * pageSize, workers.length)} od {workers.length}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)} style={{ padding: '8px 12px', background: currentPage === 1 ? 'rgba(15,23,42,0.5)' : 'rgba(250,204,21,0.1)', border: '1px solid rgba(148,163,184,0.35)', borderRadius: '8px', fontSize: '13px', color: currentPage === 1 ? 'rgba(255,255,255,0.3)' : colors.brandYellow, cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontWeight: 600 }}>Prethodna</button>
                  <span style={{ padding: '8px 12px', fontSize: '13px', color: colors.textPrimary }}>Stranica {currentPage} od {getTotalPages()}</span>
                  <button disabled={currentPage >= getTotalPages()} onClick={() => setCurrentPage(currentPage + 1)} style={{ padding: '8px 12px', background: currentPage >= getTotalPages() ? 'rgba(15,23,42,0.5)' : 'rgba(250,204,21,0.1)', border: '1px solid rgba(148,163,184,0.35)', borderRadius: '8px', fontSize: '13px', color: currentPage >= getTotalPages() ? 'rgba(255,255,255,0.3)' : colors.brandYellow, cursor: currentPage >= getTotalPages() ? 'not-allowed' : 'pointer', fontWeight: 600 }}>Sledeća</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Teams Summary Tab */}
        {activeTab === 'teams' && (
          <div style={{
            background: 'rgba(15,23,42,0.75)',
            border: '1px solid rgba(148,163,184,0.25)',
            borderRadius: '16px',
            overflow: 'hidden',
          }}>
            {loading ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'rgba(255,255,255,0.6)' }}>
                Učitavanje pregleda timova...
              </div>
            ) : teams.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'rgba(255,255,255,0.6)' }}>
                Nema podataka o timovima za izabrani period.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'rgba(15,23,42,0.9)', borderBottom: '2px solid rgba(148,163,184,0.15)' }}>
                      <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '13px', fontWeight: '700', color: colors.brandYellow }}>Tim</th>
                      <th onClick={() => handleSort('tasks_completed')} style={{ padding: '16px 20px', textAlign: 'center', fontSize: '13px', fontWeight: '700', color: colors.brandYellow, cursor: 'pointer', userSelect: 'none' }}>Završeni zadaci {sortField === 'tasks_completed' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                      <th onClick={() => handleSort('lines_processed')} style={{ padding: '16px 20px', textAlign: 'center', fontSize: '13px', fontWeight: '700', color: colors.brandYellow, cursor: 'pointer', userSelect: 'none' }}>Obrađene stavke {sortField === 'lines_processed' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                      <th onClick={() => handleSort('total_quantity')} style={{ padding: '16px 20px', textAlign: 'center', fontSize: '13px', fontWeight: '700', color: colors.brandYellow, cursor: 'pointer', userSelect: 'none' }}>Ukupna količina {sortField === 'total_quantity' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                      <th onClick={() => handleSort('time_spent')} style={{ padding: '16px 20px', textAlign: 'center', fontSize: '13px', fontWeight: '700', color: colors.brandYellow, cursor: 'pointer', userSelect: 'none' }}>Utrošeno vreme {sortField === 'time_spent' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getSortedAndPaginatedData().map((team, idx) => (
                      <tr key={team.team_id} style={{
                        borderBottom: '1px solid rgba(148,163,184,0.1)',
                        background: idx % 2 === 0 ? 'rgba(15,23,42,0.4)' : 'rgba(15,23,42,0.2)',
                      }}>
                        <td style={{ padding: '16px 20px', fontSize: '14px', color: colors.textPrimary, fontWeight: '500' }}>{team.team_name}</td>
                        <td style={{ padding: '16px 20px', fontSize: '14px', color: colors.textPrimary, textAlign: 'center' }}>{team.tasks_completed}</td>
                        <td style={{ padding: '16px 20px', fontSize: '14px', color: colors.textPrimary, textAlign: 'center' }}>{team.lines_processed}</td>
                        <td style={{ padding: '16px 20px', fontSize: '14px', color: colors.textPrimary, textAlign: 'center', fontWeight: '500' }}>{team.total_quantity}</td>
                        <td style={{ padding: '16px 20px', fontSize: '14px', color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>{formatDuration(team.time_spent)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {/* Pagination */}
            {teams.length > 0 && (
              <div style={{ padding: '20px', borderTop: '1px solid rgba(148,163,184,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>Veličina stranice:</span>
                  <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} style={{ padding: '6px 10px', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.35)', borderRadius: '8px', fontSize: '13px', color: colors.textPrimary }}>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', marginLeft: '16px' }}>Prikazano {Math.min((currentPage - 1) * pageSize + 1, teams.length)}-{Math.min(currentPage * pageSize, teams.length)} od {teams.length}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)} style={{ padding: '8px 12px', background: currentPage === 1 ? 'rgba(15,23,42,0.5)' : 'rgba(250,204,21,0.1)', border: '1px solid rgba(148,163,184,0.35)', borderRadius: '8px', fontSize: '13px', color: currentPage === 1 ? 'rgba(255,255,255,0.3)' : colors.brandYellow, cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontWeight: 600 }}>Prethodna</button>
                  <span style={{ padding: '8px 12px', fontSize: '13px', color: colors.textPrimary }}>Stranica {currentPage} od {getTotalPages()}</span>
                  <button disabled={currentPage >= getTotalPages()} onClick={() => setCurrentPage(currentPage + 1)} style={{ padding: '8px 12px', background: currentPage >= getTotalPages() ? 'rgba(15,23,42,0.5)' : 'rgba(250,204,21,0.1)', border: '1px solid rgba(148,163,184,0.35)', borderRadius: '8px', fontSize: '13px', color: currentPage >= getTotalPages() ? 'rgba(255,255,255,0.3)' : colors.brandYellow, cursor: currentPage >= getTotalPages() ? 'not-allowed' : 'pointer', fontWeight: 600 }}>Sledeća</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Task Details Modal */}
        {showDetailsModal && selectedTask && (
          <div
            onClick={() => setShowDetailsModal(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.75)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '20px',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'rgba(15,23,42,0.95)',
                border: '1px solid rgba(148,163,184,0.25)',
                borderRadius: '16px',
                padding: '32px',
                maxWidth: '800px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ fontSize: '24px', fontWeight: '600', color: colors.brandYellow, marginBottom: '8px' }}>
                    Detalji zadatka
                  </h2>
                  <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', margin: 0 }}>
                    {selectedTask.task_type.replace('_', ' ')} - {selectedTask.document_id}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handlePrintDetails}
                    style={{
                      background: colors.brandYellow,
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 16px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#000',
                    }}
                  >
                    Štampaj
                  </button>
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    style={{
                      background: 'rgba(15,23,42,0.5)',
                      border: '1px solid rgba(148,163,184,0.35)',
                      borderRadius: '8px',
                      width: '36px',
                      height: '36px',
                      cursor: 'pointer',
                      fontSize: '20px',
                      color: 'rgba(255,255,255,0.6)',
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>

              <div style={{
                background: 'rgba(15,23,42,0.5)',
                border: '1px solid rgba(148,163,184,0.15)',
                padding: '20px',
                borderRadius: '12px',
                marginBottom: '24px',
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '16px',
              }}>
                <div>
                  <div style={{ fontSize: '12px', color: colors.brandYellow, marginBottom: '4px', fontWeight: '600' }}>Datum/Vreme</div>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: colors.textPrimary }}>{formatDate(selectedTask.date)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: colors.brandYellow, marginBottom: '4px', fontWeight: '600' }}>Radnik</div>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: colors.textPrimary }}>{selectedTask.worker}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: colors.brandYellow, marginBottom: '4px', fontWeight: '600' }}>Broj stavki</div>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: colors.textPrimary }}>{selectedTask.items_count}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: colors.brandYellow, marginBottom: '4px', fontWeight: '600' }}>Ukupna količina</div>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: colors.textPrimary }}>{selectedTask.quantity}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: colors.brandYellow, marginBottom: '4px', fontWeight: '600' }}>Trajanje</div>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: colors.textPrimary }}>{formatDuration(selectedTask.duration)}</div>
                </div>
              </div>

              <h3 style={{ fontSize: '16px', fontWeight: '600', color: colors.brandYellow, marginBottom: '16px' }}>
                Pregled stavki
              </h3>

              <div style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: '12px', padding: '16px' }}>
                <pre style={{
                  fontSize: '13px',
                  color: 'rgba(255,255,255,0.8)',
                  lineHeight: '1.6',
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {JSON.stringify(selectedTask.details, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default ReportsPage;
