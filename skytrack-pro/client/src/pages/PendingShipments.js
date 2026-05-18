import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock, AlertTriangle, RefreshCw, Download, CheckSquare,
  Square, ChevronUp, ChevronDown, MapPin, Zap
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { PageHeader, StatusBadge, EmptyState, Skeleton, Pagination } from '../components/ui/LoadingSpinner';

const STATUS_OPTIONS = ['All', 'Booked', 'In Transit', 'Out for Delivery', 'Exception'];
const SORT_OPTIONS = [
  { value: 'uploadDate', label: 'Date Added' },
  { value: 'lastChecked', label: 'Last Updated' },
  { value: 'currentStatus', label: 'Status' },
  { value: 'consignmentNo', label: 'Consignment No' },
];

export default function PendingShipments() {
  const [consignments, setConsignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('uploadDate');
  const [sortDir, setSortDir] = useState('asc');
  const [selected, setSelected] = useState(new Set());
  const [bulkTracking, setBulkTracking] = useState(false);
  const { addToast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        pending: 'true',
        page,
        limit: 30,
        sort: `${sortDir === 'desc' ? '-' : ''}${sortBy}`,
      });
      if (filter !== 'All') params.set('status', filter);
      if (search) params.set('search', search);

      const res = await api.get(`/consignments?${params}`);
      setConsignments(res.data.data || []);
      setPagination(res.data.pagination || { total: 0, pages: 1 });
    } catch {
      addToast({ message: 'Failed to load pending shipments', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, filter, search, sortBy, sortDir, addToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSort = (field) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('asc'); }
  };

  const toggleSelect = (id) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    setSelected(selected.size === consignments.length ? new Set() : new Set(consignments.map(c => c._id)));
  };

  const bulkTrack = async () => {
    if (selected.size === 0) return;
    setBulkTracking(true);
    try {
      await api.post('/consignments/bulk-track', { ids: [...selected] });
      addToast({ message: `Tracking ${selected.size} shipments in background`, type: 'info' });
      setSelected(new Set());
      setTimeout(fetchData, 5000);
    } catch {
      addToast({ message: 'Bulk tracking failed', type: 'error' });
    } finally {
      setBulkTracking(false);
    }
  };

  const exportCSV = async () => {
    try {
      const params = new URLSearchParams({ pending: 'true' });
      if (filter !== 'All') params.set('status', filter);
      const res = await api.get(`/consignments/export/csv?${params}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = 'pending-shipments.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch {
      addToast({ message: 'Export failed', type: 'error' });
    }
  };

  const isStale = (c) => {
    if (!c.lastChecked) return true;
    return Date.now() - new Date(c.lastChecked) > 24 * 60 * 60 * 1000;
  };

  const SortIcon = ({ field }) => {
    if (sortBy !== field) return <ChevronUp size={12} style={{ opacity: 0.3 }} />;
    return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  const TH = ({ field, label, children }) => (
    <th
      onClick={() => field && handleSort(field)}
      style={{ cursor: field ? 'pointer' : 'default', userSelect: 'none' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {children || label}
        {field && <SortIcon field={field} />}
      </div>
    </th>
  );

  return (
    <div>
      <PageHeader
        title="Pending Shipments"
        subtitle="All undelivered consignments across all dates"
        actions={
          <>
            {selected.size > 0 && (
              <button
                className="btn btn-secondary"
                onClick={bulkTrack}
                disabled={bulkTracking}
              >
                <Zap size={13} style={{ animation: bulkTracking ? 'spin 0.8s linear infinite' : 'none' }} />
                Track Selected ({selected.size})
              </button>
            )}
            <button className="btn btn-secondary" onClick={exportCSV}>
              <Download size={13} />
              Export CSV
            </button>
            <button className="btn btn-secondary" onClick={fetchData}>
              <RefreshCw size={13} />
              Refresh
            </button>
          </>
        }
      />

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {STATUS_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => { setFilter(s); setPage(1); }}
              style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
                fontFamily: 'var(--font-heading)', fontWeight: 600, letterSpacing: '0.07em',
                textTransform: 'uppercase', border: 'none',
                background: filter === s ? 'var(--accent-blue)' : 'var(--bg-elevated)',
                color: filter === s ? '#000' : 'var(--text-secondary)',
              }}
            >
              {s}
            </button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <input
            className="input"
            placeholder="Search consignment…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ width: 200, fontSize: 12, padding: '5px 10px' }}
          />
          <select
            className="input"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            style={{ width: 160, fontSize: 12, padding: '5px 10px', colorScheme: 'dark' }}
          >
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Summary bar */}
      <div style={{
        display: 'flex', gap: 16, padding: '10px 14px',
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: '10px 10px 0 0',
        borderBottom: 'none',
      }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>{pagination.total}</strong> pending
        </span>
        {selected.size > 0 && (
          <span style={{ fontSize: 12, color: 'var(--accent-blue)' }}>
            {selected.size} selected
          </span>
        )}
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 36, padding: '10px 12px' }}>
                  <button onClick={toggleSelectAll} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}>
                    {selected.size === consignments.length && consignments.length > 0
                      ? <CheckSquare size={14} color="var(--accent-blue)" />
                      : <Square size={14} />
                    }
                  </button>
                </th>
                <TH field="consignmentNo" label="Consignment No" />
                <TH field="uploadDate" label="Upload Date" />
                <TH field="currentStatus" label="Status" />
                <th>Location</th>
                <TH field="lastChecked" label="Last Checked" />
                <th>Days</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array(8).fill(0).map((_, i) => (
                  <tr key={i}>
                    {Array(8).fill(0).map((_, j) => (
                      <td key={j}><Skeleton height={13} width={j === 0 ? 14 : `${60 + j * 10}%`} /></td>
                    ))}
                  </tr>
                ))
              ) : consignments.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 0 }}>
                    <EmptyState icon={Clock} title="No pending shipments" description="All caught up! No undelivered consignments." />
                  </td>
                </tr>
              ) : (
                consignments.map(c => {
                  const stale = isStale(c);
                  const days = Math.floor((Date.now() - new Date(c.uploadDate)) / (1000 * 60 * 60 * 24));
                  return (
                    <tr key={c._id}>
                      <td style={{ padding: '10px 12px' }}>
                        <button onClick={() => toggleSelect(c._id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}>
                          {selected.has(c._id)
                            ? <CheckSquare size={14} color="var(--accent-blue)" />
                            : <Square size={14} />
                          }
                        </button>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {stale && <AlertTriangle size={11} color="var(--warning)" title="Not updated in 24h" />}
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-blue)', letterSpacing: '0.06em' }}>
                            {c.consignmentNo}
                          </span>
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {new Date(c.uploadDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </td>
                      <td><StatusBadge status={c.currentStatus} /></td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 160 }}>
                        {c.currentLocation ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <MapPin size={10} style={{ flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {c.currentLocation}
                            </span>
                          </div>
                        ) : '—'}
                      </td>
                      <td style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: stale ? 'var(--warning)' : 'var(--text-dim)' }}>
                        {c.lastChecked
                          ? new Date(c.lastChecked).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                          : <span style={{ color: 'var(--text-dim)' }}>Never</span>
                        }
                      </td>
                      <td style={{ fontSize: 12, color: days > 7 ? 'var(--warning)' : 'var(--text-secondary)' }}>
                        {days}d
                      </td>
                      <td>
                        <TrackButton consignmentId={c._id} onTracked={(updated) => {
                          setConsignments(prev => prev.map(x => x._id === c._id ? updated : x));
                          addToast({ message: `Tracked ${c.consignmentNo}`, type: 'success' });
                        }} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pages={pagination.pages} total={pagination.total} onPage={setPage} />
      </div>
    </div>
  );
}

function TrackButton({ consignmentId, onTracked }) {
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  const track = async () => {
    setLoading(true);
    try {
      const res = await api.post(`/consignments/${consignmentId}/track`);
      onTracked(res.data.data);
    } catch (err) {
      addToast({ message: err.response?.data?.message || 'Track failed', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: 11 }} onClick={track} disabled={loading}>
      <RefreshCw size={10} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
      Track
    </button>
  );
}
