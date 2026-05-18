import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package, Truck, CheckCircle, AlertTriangle, Clock,
  RefreshCw, Upload, TrendingUp, MapPin, ArrowRight, Zap
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { PageHeader, Skeleton, StatusBadge } from '../components/ui/LoadingSpinner';

function StatCard({ label, value, icon: Icon, color, dimColor, sublabel, onClick }) {
  return (
    <div
      className="stat-card"
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        borderTop: `2px solid ${color}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{
            fontSize: 11, fontFamily: 'var(--font-heading)', fontWeight: 700,
            letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-secondary)',
            marginBottom: 8,
          }}>
            {label}
          </div>
          <div style={{
            fontSize: 38, fontFamily: 'var(--font-heading)', fontWeight: 800,
            color: 'var(--text-primary)', lineHeight: 1,
          }}>
            {value ?? '—'}
          </div>
          {sublabel && (
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-dim)' }}>
              {sublabel}
            </div>
          )}
        </div>
        <div style={{
          width: 44, height: 44, borderRadius: 10,
          background: dimColor,
          border: `1px solid ${color}33`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={20} color={color} />
        </div>
      </div>
    </div>
  );
}

function ActivityItem({ item }) {
  const timeAgo = (date) => {
    const diff = Date.now() - new Date(date);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const lastHistory = item.history?.[item.history.length - 1];

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 14px',
      borderRadius: 8,
      transition: 'background 0.15s',
      cursor: 'default',
    }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{
        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
        background: {
          'Delivered': 'var(--status-delivered)',
          'In Transit': 'var(--status-transit)',
          'Out for Delivery': 'var(--status-out)',
          'Exception': 'var(--status-exception)',
          'Booked': 'var(--status-booked)',
        }[item.currentStatus] || 'var(--text-dim)',
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-blue)', flexShrink: 0 }}>
            #{item.consignmentNo}
          </span>
          <StatusBadge status={item.currentStatus} />
        </div>
        {item.currentLocation && (
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
            <MapPin size={10} />
            {item.currentLocation}
          </div>
        )}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>
        {timeAgo(item.lastChecked)}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const { addToast } = useToast();
  const navigate = useNavigate();

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/stats');
      setStats(res.data.data);
    } catch (err) {
      addToast({ message: 'Failed to load dashboard stats', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const triggerTracking = async () => {
    setTriggering(true);
    try {
      await api.post('/stats/run-tracking');
      addToast({ message: 'Tracking job started in background', type: 'success' });
      setTimeout(fetchStats, 3000);
    } catch {
      addToast({ message: 'Failed to trigger tracking', type: 'error' });
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Real-time overview of all SkyKing consignments"
        actions={
          <>
            <button
              className="btn btn-secondary"
              onClick={triggerTracking}
              disabled={triggering}
              style={{ gap: 6 }}
            >
              <RefreshCw size={14} style={{ animation: triggering ? 'spin 1s linear infinite' : 'none' }} />
              {triggering ? 'Running...' : 'Track Now'}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => navigate('/upload')}
            >
              <Upload size={14} />
              Upload Bill Book
            </button>
          </>
        }
      />

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
        marginBottom: 24,
      }}>
        {loading ? (
          Array(6).fill(0).map((_, i) => (
            <div key={i} className="stat-card">
              <Skeleton height={80} />
            </div>
          ))
        ) : (
          <>
            <StatCard
              label="Total Active"
              value={stats?.total}
              icon={Package}
              color="var(--accent-blue)"
              dimColor="var(--accent-blue-dim)"
              sublabel="All consignments"
              onClick={() => navigate('/day-wise')}
            />
            <StatCard
              label="Delivered Today"
              value={stats?.deliveredToday}
              icon={CheckCircle}
              color="var(--status-delivered)"
              dimColor="var(--status-delivered-dim)"
              sublabel="Since midnight"
              onClick={() => navigate('/delivered')}
            />
            <StatCard
              label="In Transit"
              value={stats?.inTransit}
              icon={Truck}
              color="var(--status-transit)"
              dimColor="var(--status-transit-dim)"
              sublabel="Moving now"
              onClick={() => navigate('/pending')}
            />
            <StatCard
              label="Out for Delivery"
              value={stats?.outForDelivery}
              icon={TrendingUp}
              color="var(--status-out)"
              dimColor="var(--status-out-dim)"
              sublabel="On last mile"
              onClick={() => navigate('/pending')}
            />
            <StatCard
              label="Pending / Booked"
              value={stats?.pending}
              icon={Clock}
              color="var(--status-booked)"
              dimColor="var(--status-booked-dim)"
              sublabel="Not yet picked up"
              onClick={() => navigate('/pending')}
            />
            <StatCard
              label="Exceptions"
              value={stats?.exception}
              icon={AlertTriangle}
              color="var(--status-exception)"
              dimColor="var(--status-exception-dim)"
              sublabel={stats?.staleCount > 0 ? `${stats.staleCount} stale >24h` : 'Needs attention'}
              onClick={() => navigate('/pending')}
            />
          </>
        )}
      </div>

      {/* Bottom two-col layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16, alignItems: 'start' }}>
        {/* Recent Activity */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{
            padding: '16px 14px 12px',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={15} color="var(--accent-blue)" />
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 14, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Recent Activity
              </h2>
            </div>
            <button
              className="btn btn-ghost"
              style={{ padding: '4px 8px', fontSize: 11 }}
              onClick={fetchStats}
            >
              <RefreshCw size={12} />
              Refresh
            </button>
          </div>

          <div>
            {loading ? (
              Array(8).fill(0).map((_, i) => (
                <div key={i} style={{ padding: '10px 14px' }}>
                  <Skeleton height={14} width="60%" style={{ marginBottom: 6 }} />
                  <Skeleton height={11} width="40%" />
                </div>
              ))
            ) : stats?.recentActivity?.length > 0 ? (
              stats.recentActivity.map(item => (
                <ActivityItem key={item._id} item={item} />
              ))
            ) : (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
                No recent activity. Upload a bill book to get started.
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Quick Links */}
          <div className="card" style={{ padding: 16 }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 12 }}>
              Quick Access
            </h3>
            {[
              { label: 'Upload Bill Book', to: '/upload', icon: Upload, color: 'var(--accent-blue)' },
              { label: 'Pending Shipments', to: '/pending', icon: Clock, color: 'var(--warning)' },
              { label: 'Delivered Archive', to: '/delivered', icon: CheckCircle, color: 'var(--status-delivered)' },
              { label: 'Day-Wise View', to: '/day-wise', icon: Package, color: 'var(--status-transit)' },
            ].map(({ label, to, icon: Icon, color }) => (
              <button
                key={to}
                onClick={() => navigate(to)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 10px', borderRadius: 8, cursor: 'pointer',
                  background: 'none', border: 'none', color: 'var(--text-secondary)',
                  transition: 'all 0.15s', marginBottom: 2, textAlign: 'left',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                <div style={{ width: 30, height: 30, borderRadius: 7, background: `${color}20`, border: `1px solid ${color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={14} color={color} />
                </div>
                <span style={{ flex: 1, fontFamily: 'var(--font-heading)', fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {label}
                </span>
                <ArrowRight size={12} />
              </button>
            ))}
          </div>

          {/* Status Legend */}
          <div className="card" style={{ padding: 16 }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 12 }}>
              Status Legend
            </h3>
            {[
              ['Booked', 'var(--status-booked)', 'Consignment registered'],
              ['In Transit', 'var(--status-transit)', 'Moving between hubs'],
              ['Out for Delivery', 'var(--status-out)', 'On last-mile delivery'],
              ['Delivered', 'var(--status-delivered)', 'Successfully delivered'],
              ['Exception', 'var(--status-exception)', 'Requires attention'],
            ].map(([label, color, desc]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 12, fontFamily: 'var(--font-heading)', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>{label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
