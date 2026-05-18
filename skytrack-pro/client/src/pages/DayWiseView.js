import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, RefreshCw, ChevronLeft, ChevronRight, MapPin, Clock, Package } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { PageHeader, StatusBadge, Skeleton, EmptyState } from '../components/ui/LoadingSpinner';

const FILTERS = ['All', 'Booked', 'In Transit', 'Out for Delivery', 'Delivered', 'Exception'];

function ShipmentCard({ consignment, onTrack }) {
  const [tracking, setTracking] = useState(false);
  const { addToast } = useToast();

  const handleTrack = async (e) => {
    e.stopPropagation();
    setTracking(true);
    try {
      await onTrack(consignment._id);
      addToast({ message: `Tracked ${consignment.consignmentNo}`, type: 'success' });
    } catch {
      addToast({ message: 'Tracking failed', type: 'error' });
    } finally {
      setTracking(false);
    }
  };

  const lastHistory = consignment.history?.[consignment.history.length - 1];

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Status color bar */}
      <div style={{
        height: 3,
        background: {
          'Delivered': 'var(--status-delivered)',
          'In Transit': 'var(--status-transit)',
          'Out for Delivery': 'var(--status-out)',
          'Booked': 'var(--status-booked)',
          'Exception': 'var(--status-exception)',
        }[consignment.currentStatus] || 'var(--border)',
      }} />

      <div style={{ padding: 14 }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--accent-blue)' }}>
              #{consignment.consignmentNo}
            </div>
            {consignment.origin && consignment.destination && (
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                {consignment.origin} → {consignment.destination}
              </div>
            )}
          </div>
          <StatusBadge status={consignment.currentStatus} />
        </div>

        {/* Location */}
        {consignment.currentLocation && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
            <MapPin size={11} />
            {consignment.currentLocation}
          </div>
        )}

        {/* Last update */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-dim)' }}>
            <Clock size={10} />
            {consignment.lastChecked
              ? `Updated ${new Date(consignment.lastChecked).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
              : 'Never tracked'
            }
          </div>
          <button
            className="btn btn-ghost"
            style={{ padding: '3px 8px', fontSize: 10 }}
            onClick={handleTrack}
            disabled={tracking}
          >
            <RefreshCw size={10} style={{ animation: tracking ? 'spin 0.8s linear infinite' : 'none' }} />
            {tracking ? '…' : 'Track'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DayWiseView() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [consignments, setConsignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const { addToast } = useToast();

  const fetchConsignments = useCallback(async (date) => {
    setLoading(true);
    try {
      const res = await api.get(`/consignments?date=${date}&limit=100`);
      setConsignments(res.data.data || []);
    } catch {
      addToast({ message: 'Failed to load consignments', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchConsignments(selectedDate);
  }, [selectedDate, fetchConsignments]);

  const handleTrack = async (id) => {
    const res = await api.post(`/consignments/${id}/track`);
    setConsignments(prev => prev.map(c => c._id === id ? res.data.data : c));
  };

  const shiftDate = (days) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const filtered = consignments.filter(c => {
    if (filter !== 'All' && c.currentStatus !== filter) return false;
    if (search && !c.consignmentNo.includes(search)) return false;
    return true;
  });

  const counts = FILTERS.reduce((acc, f) => {
    acc[f] = f === 'All' ? consignments.length : consignments.filter(c => c.currentStatus === f).length;
    return acc;
  }, {});

  const displayDate = new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  return (
    <div>
      <PageHeader
        title="Day-Wise View"
        subtitle="Browse shipments by upload date"
      />

      {/* Date navigation */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
        padding: '12px 16px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
      }}>
        <button className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={() => shiftDate(-1)}>
          <ChevronLeft size={16} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <Calendar size={16} color="var(--accent-blue)" />
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-primary)' }}>
              {displayDate}
            </div>
            {isToday && <div style={{ fontSize: 11, color: 'var(--accent-blue)', fontFamily: 'var(--font-heading)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Today</div>}
          </div>
        </div>

        <input
          type="date"
          className="input"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          style={{ width: 160, colorScheme: 'dark', fontSize: 13 }}
        />

        <button className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={() => shiftDate(1)} disabled={isToday}>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
              fontFamily: 'var(--font-heading)', fontWeight: 600, letterSpacing: '0.06em',
              textTransform: 'uppercase', border: 'none', transition: 'all 0.15s',
              background: filter === f ? 'var(--accent-blue)' : 'var(--bg-elevated)',
              color: filter === f ? '#000' : 'var(--text-secondary)',
            }}
          >
            {f} {counts[f] > 0 && <span style={{ opacity: 0.75 }}>({counts[f]})</span>}
          </button>
        ))}

        <div style={{ marginLeft: 'auto' }}>
          <input
            className="input"
            placeholder="Search number…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 180, fontSize: 12, padding: '5px 10px' }}
          />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {Array(8).fill(0).map((_, i) => (
            <div key={i} className="card" style={{ padding: 14 }}>
              <Skeleton height={14} width="60%" style={{ marginBottom: 8 }} />
              <Skeleton height={12} width="40%" style={{ marginBottom: 12 }} />
              <Skeleton height={22} width="30%" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title={consignments.length === 0 ? 'No shipments uploaded' : 'No matching shipments'}
          description={consignments.length === 0
            ? `No bill books were uploaded on ${displayDate}.`
            : `No shipments match the current filter.`
          }
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {filtered.map(c => (
            <ShipmentCard key={c._id} consignment={c} onTrack={handleTrack} />
          ))}
        </div>
      )}
    </div>
  );
}
