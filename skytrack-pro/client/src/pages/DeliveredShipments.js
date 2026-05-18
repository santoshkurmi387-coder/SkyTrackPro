import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  CheckCircle, Upload, Download, Search, User, Calendar,
  Clock, Image, ChevronDown, ChevronUp, Package
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { PageHeader, Skeleton, EmptyState, Pagination } from '../components/ui/LoadingSpinner';

const API_BASE = process.env.REACT_APP_API_URL?.replace('/api', '') || '';

function TimelineDot({ status, active }) {
  const colors = {
    'Booked': 'var(--status-booked)',
    'In Transit': 'var(--status-transit)',
    'Out for Delivery': 'var(--status-out)',
    'Delivered': 'var(--status-delivered)',
    'Exception': 'var(--status-exception)',
  };
  return (
    <div className={`timeline-dot ${active ? 'active' : ''}`} style={{
      borderColor: active ? (colors[status] || 'var(--accent-blue)') : undefined,
      background: active ? `${colors[status]}22` : undefined,
    }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: active ? (colors[status] || 'var(--accent-blue)') : 'var(--border-bright)' }} />
    </div>
  );
}

function DeliveredCard({ consignment, onPodUploaded }) {
  const [expanded, setExpanded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();
  const { addToast } = useToast();

  const handlePodUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append('pod', file);
    try {
      const res = await api.post(`/consignments/${consignment._id}/pod`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onPodUploaded(consignment._id, res.data.podImageRef);
      addToast({ message: 'POD uploaded successfully', type: 'success' });
    } catch {
      addToast({ message: 'POD upload failed', type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const timeline = [
    { label: 'Booked', done: true },
    { label: 'In Transit', done: true },
    { label: 'Out for Delivery', done: true },
    { label: 'Delivered', done: true },
  ];

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {/* Green top bar */}
      <div style={{ height: 3, background: 'var(--status-delivered)' }} />

      <div style={{ padding: 16 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
          {/* Bill book thumbnail */}
          {consignment.imageRef && (
            <div style={{
              width: 52, height: 52, borderRadius: 8, overflow: 'hidden',
              border: '1px solid var(--border)', flexShrink: 0,
              background: 'var(--bg-elevated)',
            }}>
              <img
                src={`${API_BASE}${consignment.imageRef}`}
                alt="Bill book"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={e => { e.target.style.display = 'none'; }}
              />
            </div>
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--accent-blue)', marginBottom: 4 }}>
              #{consignment.consignmentNo}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 11, color: 'var(--text-secondary)' }}>
              {consignment.deliveredAt && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Calendar size={10} />
                  {new Date(consignment.deliveredAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              {consignment.deliveredTo && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <User size={10} />
                  {consignment.deliveredTo}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <span style={{
              padding: '3px 10px', borderRadius: 20, fontSize: 11,
              fontFamily: 'var(--font-heading)', fontWeight: 600, letterSpacing: '0.08em',
              textTransform: 'uppercase',
              background: 'var(--status-delivered-dim)',
              color: 'var(--status-delivered)',
              border: '1px solid rgba(16,185,129,0.3)',
            }}>
              ✓ Delivered
            </span>
            <button
              onClick={() => setExpanded(!expanded)}
              className="btn btn-ghost"
              style={{ padding: '4px 8px' }}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>

        {/* Mini timeline */}
        <div style={{ display: 'flex', gap: 0, alignItems: 'center', marginBottom: 12 }}>
          {timeline.map((t, i) => (
            <React.Fragment key={t.label}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: 12, height: 12, borderRadius: '50%',
                  background: t.done ? 'var(--status-delivered)' : 'var(--bg-elevated)',
                  border: `2px solid ${t.done ? 'var(--status-delivered)' : 'var(--border)'}`,
                  flexShrink: 0,
                }} />
                <div style={{ fontSize: 9, fontFamily: 'var(--font-heading)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.done ? 'var(--status-delivered)' : 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                  {t.label}
                </div>
              </div>
              {i < timeline.length - 1 && (
                <div style={{ flex: 1, height: 1, background: 'var(--status-delivered)', margin: '0 4px', marginBottom: 20 }} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* POD section */}
        <div style={{
          padding: '10px 12px', borderRadius: 8,
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-heading)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 3 }}>
              Proof of Delivery
            </div>
            {consignment.isPODUploaded ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--status-delivered)' }}>
                <CheckCircle size={12} />
                POD uploaded
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>No POD uploaded yet</div>
            )}
          </div>

          {consignment.isPODUploaded ? (
            <a
              href={`${API_BASE}${consignment.podImageRef}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost"
              style={{ padding: '4px 10px', fontSize: 11, textDecoration: 'none' }}
            >
              <Image size={12} />
              View POD
            </a>
          ) : (
            <>
              <input type="file" ref={fileRef} onChange={handlePodUpload} accept="image/*" style={{ display: 'none' }} />
              <button
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: 11 }}
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                <Upload size={11} />
                {uploading ? 'Uploading…' : 'Upload POD'}
              </button>
            </>
          )}
        </div>

        {/* Expanded: history */}
        {expanded && consignment.history?.length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-heading)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 12 }}>
              Tracking History
            </div>
            {consignment.history.map((h, i) => (
              <div key={i} className="timeline-item">
                <TimelineDot status={h.status} active={i === consignment.history.length - 1} />
                <div style={{ fontSize: 12 }}>
                  <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, letterSpacing: '0.04em', color: 'var(--text-primary)', textTransform: 'uppercase', fontSize: 11 }}>
                    {h.status}
                  </div>
                  {h.description && (
                    <div style={{ color: 'var(--text-secondary)', marginTop: 1 }}>{h.description}</div>
                  )}
                  <div style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                    {h.timestamp ? new Date(h.timestamp).toLocaleString('en-IN') : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DeliveredShipments() {
  const [consignments, setConsignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const { addToast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ delivered: 'true', page, limit: 20 });
      if (search) params.set('search', search);
      const res = await api.get(`/consignments?${params}`);
      setConsignments(res.data.data || []);
      setPagination(res.data.pagination || { total: 0, pages: 1 });
    } catch {
      addToast({ message: 'Failed to load delivered shipments', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, search, addToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handlePodUploaded = (id, ref) => {
    setConsignments(prev => prev.map(c => c._id === id ? { ...c, isPODUploaded: true, podImageRef: ref } : c));
  };

  const exportCSV = async () => {
    try {
      const res = await api.get('/consignments/export/csv?status=Delivered', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = 'delivered-shipments.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch {
      addToast({ message: 'Export failed', type: 'error' });
    }
  };

  return (
    <div>
      <PageHeader
        title="Delivered Shipments"
        subtitle="30-day archive of delivered consignments with POD management"
        actions={
          <button className="btn btn-secondary" onClick={exportCSV}>
            <Download size={13} />
            Export CSV
          </button>
        }
      />

      {/* Search */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
          <input
            className="input"
            placeholder="Search by consignment number…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ paddingLeft: 32 }}
          />
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0 }}>
          <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>{pagination.total}</strong> delivered (last 30 days)
        </div>
      </div>

      {/* Cards grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 14 }}>
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="card" style={{ padding: 16 }}>
              <Skeleton height={16} width="50%" style={{ marginBottom: 8 }} />
              <Skeleton height={12} width="35%" style={{ marginBottom: 16 }} />
              <Skeleton height={40} />
            </div>
          ))}
        </div>
      ) : consignments.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No delivered shipments"
          description="Delivered consignments from the last 30 days will appear here."
        />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 14, marginBottom: 20 }}>
            {consignments.map(c => (
              <DeliveredCard key={c._id} consignment={c} onPodUploaded={handlePodUploaded} />
            ))}
          </div>
          <Pagination page={page} pages={pagination.pages} total={pagination.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}
