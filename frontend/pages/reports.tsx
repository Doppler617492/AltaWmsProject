import React, { useState, useEffect } from 'react';
import { MainLayout } from '../src/components/layout/MainLayout';
import axios from 'axios';
import config from '../config';

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

type TabMode = 'tasks' | 'workers' | 'teams';

const ReportsPage: React.FC = () => {
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

  // Task history filters
  const [taskType, setTaskType] = useState('ALL');
  const [selectedWorker, setSelectedWorker] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [skuFilter, setSkuFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');

  // Data states
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [workers, setWorkers] = useState<WorkerSummary[]>([]);
  const [teams, setTeams] = useState<TeamSummary[]>([]);

  // Detail modal
  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

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

        const res = await axios.get(`${config.API_BASE_URL}/reports/task-history`, {
          headers: { Authorization: `Bearer ${token}` },
          params,
        });
        setTasks(res.data);
      } else if (activeTab === 'workers') {
        const res = await axios.get(`${config.API_BASE_URL}/reports/workers-summary`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { from: dateFrom, to: dateTo },
        });
        setWorkers(res.data);
      } else if (activeTab === 'teams') {
        const res = await axios.get(`${config.API_BASE_URL}/reports/teams-summary`, {
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
    fetchData();
  }, [activeTab, dateFrom, dateTo]);

  const handleExportExcel = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await axios.get(`${config.API_BASE_URL}/reports/export-excel`, {
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

        {/* Date Range Filter */}
        <div style={{
          background: 'white',
          padding: '24px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          marginBottom: '24px',
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
        }}>
          <label style={{ fontSize: '14px', fontWeight: '500', color: '#444' }}>Date Range:</label>
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
              background: '#f3f4f6',
              border: '1px solid #d1d5db',
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
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
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
                        <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#374151' }}>Date/Time</th>
                        <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#374151' }}>Worker</th>
                        <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#374151' }}>Task Type</th>
                        <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#374151' }}>Document ID</th>
                        <th style={{ padding: '16px 20px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#374151' }}>Items</th>
                        <th style={{ padding: '16px 20px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#374151' }}>Quantity</th>
                        <th style={{ padding: '16px 20px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#374151' }}>Duration</th>
                        <th style={{ padding: '16px 20px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#374151' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.map((task, idx) => (
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
                      <th style={{ padding: '16px 20px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#374151' }}>Tasks Completed</th>
                      <th style={{ padding: '16px 20px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#374151' }}>Lines Processed</th>
                      <th style={{ padding: '16px 20px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#374151' }}>Total Quantity</th>
                      <th style={{ padding: '16px 20px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#374151' }}>Active Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workers.map((worker, idx) => (
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
                      <th style={{ padding: '16px 20px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#374151' }}>Tasks Completed</th>
                      <th style={{ padding: '16px 20px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#374151' }}>Lines Processed</th>
                      <th style={{ padding: '16px 20px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#374151' }}>Total Quantity</th>
                      <th style={{ padding: '16px 20px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#374151' }}>Time Spent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teams.map((team, idx) => (
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
