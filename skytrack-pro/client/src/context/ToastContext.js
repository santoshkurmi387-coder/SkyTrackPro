import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react';

// ── Toast Context ──────────────────────────────────────────────────────────────
const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(({ message, type = 'info', duration = 4000 }) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const icons = {
    success: <CheckCircle size={16} className="text-success" />,
    warning: <AlertTriangle size={16} className="text-warning" />,
    error: <XCircle size={16} className="text-danger" />,
    info: <Info size={16} className="text-accent" />,
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            {icons[toast.type]}
            <div style={{ flex: 1, fontSize: 13, lineHeight: 1.4 }}>{toast.message}</div>
            <button
              onClick={() => removeToast(toast.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 2 }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

// ── Notification Context ───────────────────────────────────────────────────────
const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshCount = useCallback(async () => {
    try {
      const { default: api } = await import('../services/api');
      const res = await api.get('/notifications?unreadOnly=true&limit=1');
      setUnreadCount(res.data.unreadCount || 0);
    } catch {}
  }, []);

  React.useEffect(() => {
    refreshCount();
    const interval = setInterval(refreshCount, 60000); // Poll every minute
    return () => clearInterval(interval);
  }, [refreshCount]);

  return (
    <NotificationContext.Provider value={{ unreadCount, setUnreadCount, refreshCount }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
};
