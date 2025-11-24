import React, { useState, useEffect } from 'react';
import { MainLayout } from '../src/components/layout/MainLayout';
import { useRouter } from 'next/router';
import axios from 'axios';
import { API_BASE_URL } from '../config';

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
    const token = localStorage.getItem('token');
    
    axios.get(`${API_BASE_URL}/users`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(res => setUsersList(res.data || [])).catch(() => {});

    axios.get(`${API_BASE_URL}/teams`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(res => setTeamsList(res.data || [])).catch(() => {});
  }, [hasAccess]);

  const fetchData = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      if (activeTab === 'tasks') {
        const params: any = { from: dateFrom, to: dateTo };
        if (taskType !== 'ALL') params.task_type = taskType;
        if (selectedWorker) params.worker_id = selectedWorker;
        if (selectedTeam) params.team_id = selectedTeam;
        if (skuFilter) params.sku = skuFilter;
        if (locationFilter) params.location = locationFilter;

        const res = await axios.get(`${API_BASE_URL}/reports/task-history`, {
          headers: { Authorization: `Bearer ${token}` },
          params,
        });
        setTasks(res.data);
      } else if (activeTab === 'workers') {
        const res = await axios.get(`${API_BASE_URL}/reports/workers-summary`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { from: dateFrom, to: dateTo },
        });
        setWorkers(res.data);
      } else if (activeTab === 'teams') {
        const res = await axios.get(`${API_BASE_URL}/reports/teams-summary`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { from: dateFrom, to: dateTo },
        });
        setTeams(res.data);
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
      const res = await axios.get(`${API_BASE_URL}/reports/export-excel`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { from: dateFrom, to: dateTo },
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
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
    <MainLayout>
      <div style={{ padding: '32px 40px', maxWidth: '1600px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: '600', color: '#1a1a1a', marginBottom: '8px' }}>
              Reporting Center
            </h1>
            <p style={{ fontSize: '15px', color: '#666', margin: 0 }}>
              Comprehensive task history, worker summaries, and compliance reports
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleExportCSV}
              style={{
                background: '#10b981',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>
            <button
              onClick={handleExportExcel}
              style={{
                background: '#2563eb',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export Excel
            </button>
          </div>
        </div>

        {/* Date Range Filter with Presets */}
        <div style={{
          background: 'white',
          padding: '24px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          marginBottom: '24px',
        }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '14px', fontWeight: '500', color: '#444' }}>Quick Select:</label>
            <button onClick={() => setDatePreset('today')} style={{ padding: '8px 16px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}>Today</button>
            <button onClick={() => setDatePreset('week')} style={{ padding: '8px 16px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}>This Week</button>
            <button onClick={() => setDatePreset('month')} style={{ padding: '8px 16px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}>This Month</button>
            <button onClick={() => setDatePreset('lastMonth')} style={{ padding: '8px 16px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}>Last Month</button>
          </div>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '14px', fontWeight: '500', color: '#444' }}>Custom Range:</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{
                padding: '10px 14px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                flex: '0 0 160px',
              }}
            />
            <span style={{ color: '#888' }}>to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{
                padding: '10px 14px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                flex: '0 0 160px',
              }}
            />
            <button
              onClick={fetchData}
              style={{
                padding: '10px 20px',
                background: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                marginLeft: 'auto',
              }}
            >
              Apply Filter
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '24px',
          borderBottom: '2px solid #e5e7eb',
          paddingBottom: '0',
        }}>
          {[
            { key: 'tasks', label: 'Task History' },
            { key: 'workers', label: 'Workers Summary' },
            { key: 'teams', label: 'Teams Summary' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabMode)}
              style={{
                padding: '14px 28px',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.key ? '3px solid #2563eb' : '3px solid transparent',
                fontSize: '15px',
                fontWeight: activeTab === tab.key ? '600' : '500',
                color: activeTab === tab.key ? '#2563eb' : '#6b7280',
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
              background: 'white',
              padding: '20px 24px',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              marginBottom: '24px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '16px',
            }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#555', marginBottom: '6px' }}>
                  Task Type
                </label>
                <select
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                >
                  <option value="ALL">All Types</option>
                  <option value="RECEIVING">Receiving</option>
                  <option value="CYCLE_COUNT">Cycle Count</option>
                  <option value="SKART">SKART</option>
                  <option value="POVRACAJ">Povraćaj</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#555', marginBottom: '6px' }}>
                  Worker
                </label>
                <select
                  value={selectedWorker}
                  onChange={(e) => setSelectedWorker(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                >
                  <option value="">All Workers</option>
                  {usersList.map(user => (
                    <option key={user.id} value={user.id}>{user.full_name || user.username}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#555', marginBottom: '6px' }}>
                  Team
                </label>
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                >
                  <option value="">All Teams</option>
                  {teamsList.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#555', marginBottom: '6px' }}>
                  SKU
                </label>
                <input
                  type="text"
                  value={skuFilter}
                  onChange={(e) => setSkuFilter(e.target.value)}
                  placeholder="Search by SKU..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#555', marginBottom: '6px' }}>
                  Location
                </label>
                <input
                  type="text"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  placeholder="Search by location..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                />
              </div>
            </div>

            {/* Tasks Table */}
            <div style={{
              background: 'white',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              overflow: 'hidden',
            }}>
              {loading ? (
                <div style={{ padding: '60px', textAlign: 'center', color: '#999' }}>
                  Loading tasks...
                </div>
              ) : tasks.length === 0 ? (
                <div style={{ padding: '60px', textAlign: 'center', color: '#999' }}>
                  No tasks found for the selected date range and filters.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                        <th onClick={() => handleSort('date')} style={{ padding: '16px 20px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#374151', cursor: 'pointer', userSelect: 'none' }}>Date/Time {sortField === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                        <th onClick={() => handleSort('worker')} style={{ padding: '16px 20px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#374151', cursor: 'pointer', userSelect: 'none' }}>Worker {sortField === 'worker' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                        <th onClick={() => handleSort('task_type')} style={{ padding: '16px 20px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#374151', cursor: 'pointer', userSelect: 'none' }}>Task Type {sortField === 'task_type' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                        <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#374151' }}>Document ID</th>
                        <th onClick={() => handleSort('items_count')} style={{ padding: '16px 20px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#374151', cursor: 'pointer', userSelect: 'none' }}>Items {sortField === 'items_count' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                        <th onClick={() => handleSort('quantity')} style={{ padding: '16px 20px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#374151', cursor: 'pointer', userSelect: 'none' }}>Quantity {sortField === 'quantity' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                        <th onClick={() => handleSort('duration')} style={{ padding: '16px 20px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#374151', cursor: 'pointer', userSelect: 'none' }}>Duration {sortField === 'duration' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                        <th style={{ padding: '16px 20px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#374151' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getSortedAndPaginatedData().map((task, idx) => (
                        <tr key={`${task.task_type}-${task.id}`} style={{
                          borderBottom: '1px solid #f3f4f6',
                          background: idx % 2 === 0 ? 'white' : '#fafbfc',
                        }}>
                          <td style={{ padding: '16px 20px', fontSize: '14px', color: '#1f2937' }}>{formatDate(task.date)}</td>
                          <td style={{ padding: '16px 20px', fontSize: '14px', color: '#1f2937' }}>{task.worker}</td>
                          <td style={{ padding: '16px 20px', fontSize: '14px' }}>
                            <span style={{
                              padding: '4px 10px',
                              background: task.task_type === 'RECEIVING' ? '#dbeafe' : task.task_type === 'CYCLE_COUNT' ? '#fef3c7' : '#fce7f3',
                              color: task.task_type === 'RECEIVING' ? '#1e40af' : task.task_type === 'CYCLE_COUNT' ? '#92400e' : '#9f1239',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '500',
                            }}>
                              {task.task_type.replace('_', ' ')}
                            </span>
                          </td>
                          <td style={{ padding: '16px 20px', fontSize: '14px', color: '#1f2937', fontFamily: 'monospace' }}>{task.document_id}</td>
                          <td style={{ padding: '16px 20px', fontSize: '14px', color: '#1f2937', textAlign: 'center' }}>{task.items_count}</td>
                          <td style={{ padding: '16px 20px', fontSize: '14px', color: '#1f2937', textAlign: 'center', fontWeight: '500' }}>{task.quantity}</td>
                          <td style={{ padding: '16px 20px', fontSize: '14px', color: '#6b7280', textAlign: 'center' }}>{formatDuration(task.duration)}</td>
                          <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                            <button
                              onClick={() => {
                                setSelectedTask(task);
                                setShowDetailsModal(true);
                              }}
                              style={{
                                padding: '6px 14px',
                                background: '#f3f4f6',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                fontSize: '13px',
                                fontWeight: '500',
                                color: '#374151',
                                cursor: 'pointer',
                              }}
                            >
                              Details
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
                <div style={{ padding: '20px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', color: '#6b7280' }}>Page size:</span>
                    <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}>
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                    <span style={{ fontSize: '14px', color: '#6b7280', marginLeft: '16px' }}>Showing {Math.min((currentPage - 1) * pageSize + 1, tasks.length)}-{Math.min(currentPage * pageSize, tasks.length)} of {tasks.length}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)} style={{ padding: '8px 12px', background: currentPage === 1 ? '#f3f4f6' : 'white', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}>Previous</button>
                    <span style={{ padding: '8px 12px', fontSize: '13px', color: '#374151' }}>Page {currentPage} of {getTotalPages()}</span>
                    <button disabled={currentPage >= getTotalPages()} onClick={() => setCurrentPage(currentPage + 1)} style={{ padding: '8px 12px', background: currentPage >= getTotalPages() ? '#f3f4f6' : 'white', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', cursor: currentPage >= getTotalPages() ? 'not-allowed' : 'pointer' }}>Next</button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Workers Summary Tab */}
        {activeTab === 'workers' && (
          <div style={{
            background: 'white',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            overflow: 'hidden',
          }}>
            {loading ? (
              <div style={{ padding: '60px', textAlign: 'center', color: '#999' }}>
                Loading workers summary...
              </div>
            ) : workers.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', color: '#999' }}>
                No worker data found for the selected date range.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                      <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#374151' }}>Worker</th>
                      <th onClick={() => handleSort('tasks_completed')} style={{ padding: '16px 20px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#374151', cursor: 'pointer', userSelect: 'none' }}>Tasks Completed {sortField === 'tasks_completed' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                      <th onClick={() => handleSort('lines_processed')} style={{ padding: '16px 20px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#374151', cursor: 'pointer', userSelect: 'none' }}>Lines Processed {sortField === 'lines_processed' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                      <th onClick={() => handleSort('total_quantity')} style={{ padding: '16px 20px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#374151', cursor: 'pointer', userSelect: 'none' }}>Total Quantity {sortField === 'total_quantity' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                      <th style={{ padding: '16px 20px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#374151' }}>Active Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getSortedAndPaginatedData().map((worker, idx) => (
                      <tr key={worker.worker_id} style={{
                        borderBottom: '1px solid #f3f4f6',
                        background: idx % 2 === 0 ? 'white' : '#fafbfc',
                      }}>
                        <td style={{ padding: '16px 20px', fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>{worker.worker_name}</td>
                        <td style={{ padding: '16px 20px', fontSize: '14px', color: '#1f2937', textAlign: 'center' }}>{worker.tasks_completed}</td>
                        <td style={{ padding: '16px 20px', fontSize: '14px', color: '#1f2937', textAlign: 'center' }}>{worker.lines_processed}</td>
                        <td style={{ padding: '16px 20px', fontSize: '14px', color: '#1f2937', textAlign: 'center', fontWeight: '500' }}>{worker.total_quantity}</td>
                        <td style={{ padding: '16px 20px', fontSize: '14px', color: '#6b7280', textAlign: 'center' }}>{formatDuration(worker.total_active_time)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {/* Pagination */}
            {workers.length > 0 && (
              <div style={{ padding: '20px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', color: '#6b7280' }}>Page size:</span>
                  <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span style={{ fontSize: '14px', color: '#6b7280', marginLeft: '16px' }}>Showing {Math.min((currentPage - 1) * pageSize + 1, workers.length)}-{Math.min(currentPage * pageSize, workers.length)} of {workers.length}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)} style={{ padding: '8px 12px', background: currentPage === 1 ? '#f3f4f6' : 'white', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}>Previous</button>
                  <span style={{ padding: '8px 12px', fontSize: '13px', color: '#374151' }}>Page {currentPage} of {getTotalPages()}</span>
                  <button disabled={currentPage >= getTotalPages()} onClick={() => setCurrentPage(currentPage + 1)} style={{ padding: '8px 12px', background: currentPage >= getTotalPages() ? '#f3f4f6' : 'white', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', cursor: currentPage >= getTotalPages() ? 'not-allowed' : 'pointer' }}>Next</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Teams Summary Tab */}
        {activeTab === 'teams' && (
          <div style={{
            background: 'white',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            overflow: 'hidden',
          }}>
            {loading ? (
              <div style={{ padding: '60px', textAlign: 'center', color: '#999' }}>
                Loading teams summary...
              </div>
            ) : teams.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', color: '#999' }}>
                No team data found for the selected date range.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                      <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#374151' }}>Team</th>
                      <th onClick={() => handleSort('tasks_completed')} style={{ padding: '16px 20px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#374151', cursor: 'pointer', userSelect: 'none' }}>Tasks Completed {sortField === 'tasks_completed' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                      <th onClick={() => handleSort('lines_processed')} style={{ padding: '16px 20px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#374151', cursor: 'pointer', userSelect: 'none' }}>Lines Processed {sortField === 'lines_processed' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                      <th onClick={() => handleSort('total_quantity')} style={{ padding: '16px 20px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#374151', cursor: 'pointer', userSelect: 'none' }}>Total Quantity {sortField === 'total_quantity' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                      <th onClick={() => handleSort('time_spent')} style={{ padding: '16px 20px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#374151', cursor: 'pointer', userSelect: 'none' }}>Time Spent {sortField === 'time_spent' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getSortedAndPaginatedData().map((team, idx) => (
                      <tr key={team.team_id} style={{
                        borderBottom: '1px solid #f3f4f6',
                        background: idx % 2 === 0 ? 'white' : '#fafbfc',
                      }}>
                        <td style={{ padding: '16px 20px', fontSize: '14px', color: '#1f2937', fontWeight: '500' }}>{team.team_name}</td>
                        <td style={{ padding: '16px 20px', fontSize: '14px', color: '#1f2937', textAlign: 'center' }}>{team.tasks_completed}</td>
                        <td style={{ padding: '16px 20px', fontSize: '14px', color: '#1f2937', textAlign: 'center' }}>{team.lines_processed}</td>
                        <td style={{ padding: '16px 20px', fontSize: '14px', color: '#1f2937', textAlign: 'center', fontWeight: '500' }}>{team.total_quantity}</td>
                        <td style={{ padding: '16px 20px', fontSize: '14px', color: '#6b7280', textAlign: 'center' }}>{formatDuration(team.time_spent)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {/* Pagination */}
            {teams.length > 0 && (
              <div style={{ padding: '20px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', color: '#6b7280' }}>Page size:</span>
                  <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span style={{ fontSize: '14px', color: '#6b7280', marginLeft: '16px' }}>Showing {Math.min((currentPage - 1) * pageSize + 1, teams.length)}-{Math.min(currentPage * pageSize, teams.length)} of {teams.length}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)} style={{ padding: '8px 12px', background: currentPage === 1 ? '#f3f4f6' : 'white', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}>Previous</button>
                  <span style={{ padding: '8px 12px', fontSize: '13px', color: '#374151' }}>Page {currentPage} of {getTotalPages()}</span>
                  <button disabled={currentPage >= getTotalPages()} onClick={() => setCurrentPage(currentPage + 1)} style={{ padding: '8px 12px', background: currentPage >= getTotalPages() ? '#f3f4f6' : 'white', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', cursor: currentPage >= getTotalPages() ? 'not-allowed' : 'pointer' }}>Next</button>
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
              background: 'rgba(0,0,0,0.5)',
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
                background: 'white',
                borderRadius: '16px',
                padding: '32px',
                maxWidth: '800px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#1a1a1a', marginBottom: '8px' }}>
                    Task Details
                  </h2>
                  <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>
                    {selectedTask.task_type.replace('_', ' ')} - {selectedTask.document_id}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handlePrintDetails}
                    style={{
                      background: '#2563eb',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 16px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: 'white',
                    }}
                  >
                    Print
                  </button>
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    style={{
                      background: '#f3f4f6',
                      border: 'none',
                      borderRadius: '8px',
                      width: '36px',
                      height: '36px',
                      cursor: 'pointer',
                      fontSize: '20px',
                      color: '#6b7280',
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>

              <div style={{
                background: '#f9fafb',
                padding: '20px',
                borderRadius: '12px',
                marginBottom: '24px',
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '16px',
              }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Date/Time</div>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>{formatDate(selectedTask.date)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Worker</div>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>{selectedTask.worker}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Items Count</div>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>{selectedTask.items_count}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Total Quantity</div>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>{selectedTask.quantity}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Duration</div>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>{formatDuration(selectedTask.duration)}</div>
                </div>
              </div>

              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937', marginBottom: '16px' }}>
                Item Breakdown
              </h3>

              <div style={{ background: '#fafbfc', borderRadius: '12px', padding: '16px' }}>
                <pre style={{
                  fontSize: '13px',
                  color: '#374151',
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
