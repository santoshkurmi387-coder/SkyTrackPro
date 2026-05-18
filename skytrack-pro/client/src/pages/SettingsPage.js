import React, { useState, useEffect } from 'react';
import {
  Settings, Bell, Clock, Eye, Shield, Save, Loader,
  Trash2, RefreshCw, Image, Database
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { PageHeader } from '../components/ui/LoadingSpinner';

function Section({ title, icon: Icon, children }) {
  return (
    <div className="card" style={{ padding: 20, marginBottom: 16 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 18, paddingBottom: 14,
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: 'var(--accent-blue-dim)',
          border: '1px solid rgba(0,180,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={14} color="var(--accent-blue)" />
        </div>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 14, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

function ToggleSetting({ label, description, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(30,45,74,0.5)' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{label}</div>
        {description && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{description}</div>}
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 42, height: 22, borderRadius: 11, padding: 2, cursor: 'pointer',
          background: value ? 'var(--accent-blue)' : 'var(--bg-elevated)',
          border: `1px solid ${value ? 'var(--accent-blue)' : 'var(--border-bright)'}`,
          transition: 'all 0.2s', display: 'flex', alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <div style={{
          width: 16, height: 16, borderRadius: '50%',
          background: value ? '#000' : 'var(--text-dim)',
          transform: value ? 'translateX(20px)' : 'translateX(0)',
          transition: 'transform 0.2s, background 0.2s',
        }} />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const { addToast } = useToast();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    api.get('/settings')
      .then(res => setSettings(res.data.data))
      .catch(() => addToast({ message: 'Failed to load settings', type: 'error' }))
      .finally(() => setLoading(false));

    setPushSupported('Notification' in window && 'serviceWorker' in navigator);
    checkPushSubscription();
  }, []);

  const checkPushSubscription = async () => {
    if (!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.ready.catch(() => null);
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription().catch(() => null);
    setPushSubscribed(!!sub);
  };

  const update = (key, val) => setSettings(prev => ({ ...prev, [key]: val }));

  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await api.put('/settings', {
        trackingIntervalHours: settings.trackingIntervalHours,
        notifyOnDelivered: settings.notifyOnDelivered,
        notifyOnOutForDelivery: settings.notifyOnOutForDelivery,
        notifyOnException: settings.notifyOnException,
        notifyOnInTransit: settings.notifyOnInTransit,
        ocrConfidenceThreshold: settings.ocrConfidenceThreshold,
      });
      addToast({ message: 'Settings saved', type: 'success' });
    } catch {
      addToast({ message: 'Failed to save settings', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const subscribePush = async () => {
    setSubscribing(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        addToast({ message: 'Notification permission denied', type: 'warning' });
        setSubscribing(false);
        return;
      }

      const { data: { key } } = await api.get('/push/vapid-public-key');
      if (!key) {
        addToast({ message: 'Push notifications not configured on server', type: 'warning' });
        setSubscribing(false);
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      });

      await api.post('/push/subscribe', { subscription: sub.toJSON() });
      setPushSubscribed(true);
      addToast({ message: 'Push notifications enabled!', type: 'success' });
    } catch (err) {
      addToast({ message: `Push setup failed: ${err.message}`, type: 'error' });
    } finally {
      setSubscribing(false);
    }
  };

  const unsubscribePush = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      await api.post('/push/unsubscribe');
      setPushSubscribed(false);
      addToast({ message: 'Push notifications disabled', type: 'info' });
    } catch {
      addToast({ message: 'Failed to unsubscribe', type: 'error' });
    }
  };

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>
      <Loader size={24} style={{ animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
    </div>
  );

  return (
    <div style={{ maxWidth: 700 }}>
      <PageHeader
        title="Settings"
        subtitle="Configure tracking, notifications, and OCR preferences"
        actions={
          <button className="btn btn-primary" onClick={saveSettings} disabled={saving}>
            {saving ? <Loader size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Save size={14} />}
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        }
      />

      {/* Tracking */}
      <Section title="Tracking Schedule" icon={Clock}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-heading)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 8 }}>
            Auto-Tracking Interval
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[2, 5, 12, 24].map(h => (
              <button
                key={h}
                onClick={() => update('trackingIntervalHours', h)}
                style={{
                  padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
                  fontFamily: 'var(--font-heading)', fontSize: 13, fontWeight: 600,
                  letterSpacing: '0.06em', border: 'none',
                  background: settings?.trackingIntervalHours === h ? 'var(--accent-blue)' : 'var(--bg-elevated)',
                  color: settings?.trackingIntervalHours === h ? '#000' : 'var(--text-secondary)',
                  borderColor: settings?.trackingIntervalHours === h ? 'var(--accent-blue)' : 'var(--border)',
                }}
              >
                Every {h}h
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8 }}>
            The system will automatically track all active consignments at this interval.
            More frequent tracking may increase server load.
          </div>
        </div>
      </Section>

      {/* Notifications */}
      <Section title="Notification Preferences" icon={Bell}>
        <ToggleSetting
          label="Delivered"
          description="Notify when a consignment is delivered"
          value={settings?.notifyOnDelivered ?? true}
          onChange={v => update('notifyOnDelivered', v)}
        />
        <ToggleSetting
          label="Out for Delivery"
          description="Notify when shipment is out for delivery"
          value={settings?.notifyOnOutForDelivery ?? true}
          onChange={v => update('notifyOnOutForDelivery', v)}
        />
        <ToggleSetting
          label="Exception"
          description="Notify on delivery exceptions (requires attention)"
          value={settings?.notifyOnException ?? true}
          onChange={v => update('notifyOnException', v)}
        />
        <ToggleSetting
          label="In Transit"
          description="Notify when shipment starts moving"
          value={settings?.notifyOnInTransit ?? false}
          onChange={v => update('notifyOnInTransit', v)}
        />
      </Section>

      {/* Browser Push */}
      <Section title="Browser Push Notifications" icon={Bell}>
        <div style={{ marginBottom: 14, fontSize: 13, color: 'var(--text-secondary)' }}>
          {pushSupported
            ? 'Receive browser push notifications for important status changes, even when the app is closed.'
            : 'Your browser does not support push notifications.'
          }
        </div>
        {pushSupported && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              flex: 1, padding: '10px 14px', borderRadius: 8,
              background: pushSubscribed ? 'var(--status-delivered-dim)' : 'var(--bg-elevated)',
              border: `1px solid ${pushSubscribed ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
              fontSize: 12,
              color: pushSubscribed ? 'var(--status-delivered)' : 'var(--text-dim)',
            }}>
              {pushSubscribed ? '✓ Push notifications are enabled' : 'Push notifications are disabled'}
            </div>
            {pushSubscribed ? (
              <button className="btn btn-danger" onClick={unsubscribePush} style={{ flexShrink: 0 }}>
                Disable
              </button>
            ) : (
              <button
                className="btn btn-primary"
                onClick={subscribePush}
                disabled={subscribing}
                style={{ flexShrink: 0 }}
              >
                {subscribing ? <Loader size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Bell size={13} />}
                Enable
              </button>
            )}
          </div>
        )}
      </Section>

      {/* OCR */}
      <Section title="OCR Settings" icon={Eye}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                Confidence Threshold
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                Show a warning if OCR confidence is below this level
              </div>
            </div>
            <div style={{
              padding: '4px 12px', borderRadius: 6,
              background: 'var(--accent-blue-dim)',
              border: '1px solid rgba(0,180,255,0.3)',
              fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 600,
              color: 'var(--accent-blue)',
            }}>
              {settings?.ocrConfidenceThreshold ?? 60}%
            </div>
          </div>
          <input
            type="range"
            min="0" max="100" step="5"
            value={settings?.ocrConfidenceThreshold ?? 60}
            onChange={e => update('ocrConfidenceThreshold', parseInt(e.target.value))}
            style={{
              width: '100%', cursor: 'pointer',
              accentColor: 'var(--accent-blue)',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
            <span>0% — Accept all</span>
            <span>100% — Max precision</span>
          </div>
        </div>
      </Section>

      {/* Data management */}
      <Section title="Data Management" icon={Database}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            {
              label: 'Export All Consignments',
              desc: 'Download complete tracking history as CSV',
              icon: Database,
              action: async () => {
                const res = await api.get('/consignments/export/csv', { responseType: 'blob' });
                const url = URL.createObjectURL(res.data);
                const a = document.createElement('a');
                a.href = url; a.download = 'all-consignments.csv'; a.click();
                URL.revokeObjectURL(url);
              },
              label2: 'Export CSV',
            },
            {
              label: 'Force Tracking Run',
              desc: 'Manually trigger the auto-tracking job now',
              icon: RefreshCw,
              action: async () => {
                await api.post('/stats/run-tracking');
                addToast({ message: 'Tracking job started in background', type: 'success' });
              },
              label2: 'Run Now',
            },
          ].map(({ label, desc, icon: Icon, action, label2 }) => (
            <div key={label} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', borderRadius: 8,
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            }}>
              <Icon size={16} color="var(--text-secondary)" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>{desc}</div>
              </div>
              <button
                className="btn btn-secondary"
                style={{ padding: '5px 12px', fontSize: 12, flexShrink: 0 }}
                onClick={action}
              >
                {label2}
              </button>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
