import React, { useState, useEffect, useCallback } from 'react';
import { Bell, CheckCircle, Truck, AlertTriangle, RefreshCw, Trash2, BellOff, CheckCheck } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { useNotifications } from '../context/NotificationContext';
import { PageHeader, EmptyState, Skeleton } from '../components/ui/LoadingSpinner';

const TYPE_CONFIG = {
  delivered: { icon: CheckCircle, color: 'var(--status-delivered)', label: 'Delivered' },
  out_for_delivery: { icon: Truck, color: 'var(--status-out)', label: 'Out for Delivery' },
  exception: { icon: AlertTriangle, color: 'var(--status-exception)', label: 'Exception' },
  tracking_complete: { icon: RefreshCw, color: 'var(--accent-blue)', label: 'Tracking' },
  in_transit: { icon: Truck, color: 'var(--status-transit)', label: 'In Transit' },
  info: { icon: Bell, color: 'var(--text-secondary)', label: 'Info' },
};

function NotifItem({ notif, onRead, onDelete }) {
  const cfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.info;
  const Icon = cfg.icon;

  const timeAgo = (date) => {
    const diff = Date.now() - new Date(date);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '14px 16px',
        background: notif.isRead ? 'transparent' : 'rgba(0,180,255,0.03)',
        borderBottom: '1px solid var(--border)',
        transition: 'background 0.15s',
        position: 'relative',
      }}
    >
      {!notif.isRead && (
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
          background: cfg.color, borderRadius: '3px 0 0 3px',
        }} />
      )}

      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: `${cfg.color}15`,
        border: `1px solid ${cfg.color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={16} color={cfg.color} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <div style={{ fontSize: 13, color: notif.isRead ? 'var(--text-secondary)' : 'var(--text-primary)', lineHeight: 1.4 }}>
              {notif.message}
            </div>
            {notif.details && (
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 3 }}>
                {notif.details}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
              {timeAgo(notif.createdAt)}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          {!notif.isRead && (
            <button
              onClick={() => onRead(notif._id)}
              className="btn btn-ghost"
              style={{ padding: '2px 8px', fontSize: 10 }}
            >
              Mark read
            </button>
          )}
          <button
            onClick={() => onDelete(notif._id)}
            className="btn btn-ghost"
            style={{ padding: '2px 8px', fontSize: 10, color: 'var(--text-dim)' }}
          >
            <Trash2 size={10} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const { addToast } = useToast();
  const { setUnreadCount, refreshCount } = useNotifications();

  const fetchNotifs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: 50 });
      if (filter === 'unread') params.set('unreadOnly', 'true');
      const res = await api.get(`/notifications?${params}`);
      setNotifications(res.data.data || []);
      setUnreadCount(res.data.unreadCount || 0);
    } catch {
      addToast({ message: 'Failed to load notifications', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [filter, addToast, setUnreadCount]);

  useEffect(() => { fetchNotifs(); }, [fetchNotifs]);

  const handleRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      refreshCount();
    } catch {}
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n._id !== id));
      refreshCount();
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/mark-all-read');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
      addToast({ message: 'All notifications marked as read', type: 'success' });
    } catch {}
  };

  const unread = notifications.filter(n => !n.isRead).length;

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="System alerts and shipment status updates"
        actions={
          <>
            {unread > 0 && (
              <button className="btn btn-secondary" onClick={markAllRead}>
                <CheckCheck size={13} />
                Mark All Read
              </button>
            )}
            <button className="btn btn-ghost" onClick={fetchNotifs}>
              <RefreshCw size={13} />
            </button>
          </>
        }
      />

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[
          { key: 'all', label: `All (${notifications.length})` },
          { key: 'unread', label: `Unread${unread > 0 ? ` (${unread})` : ''}` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            style={{
              padding: '5px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
              fontFamily: 'var(--font-heading)', fontWeight: 600, letterSpacing: '0.07em',
              textTransform: 'uppercase', border: 'none',
              background: filter === key ? 'var(--accent-blue)' : 'var(--bg-elevated)',
              color: filter === key ? '#000' : 'var(--text-secondary)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Type legend */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {Object.entries(TYPE_CONFIG).map(([key, { icon: Icon, color, label }]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-dim)' }}>
            <Icon size={11} color={color} />
            {label}
          </div>
        ))}
      </div>

      {/* List */}
      <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
        {loading ? (
          Array(6).fill(0).map((_, i) => (
            <div key={i} style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <Skeleton width={36} height={36} borderRadius={10} />
                <div style={{ flex: 1 }}>
                  <Skeleton height={13} width="60%" style={{ marginBottom: 6 }} />
                  <Skeleton height={11} width="30%" />
                </div>
              </div>
            </div>
          ))
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={BellOff}
            title="No notifications"
            description={filter === 'unread' ? 'You\'re all caught up!' : 'Notifications will appear here when shipment statuses change.'}
          />
        ) : (
          notifications.map(n => (
            <NotifItem key={n._id} notif={n} onRead={handleRead} onDelete={handleDelete} />
          ))
        )}
      </div>
    </div>
  );
}
