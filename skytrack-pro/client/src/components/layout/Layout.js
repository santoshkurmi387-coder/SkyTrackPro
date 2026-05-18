import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Upload, Calendar, Clock, CheckCircle,
  Bell, Settings, LogOut, Package, ChevronLeft, ChevronRight,
  Zap
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/upload', icon: Upload, label: 'Upload' },
  { to: '/day-wise', icon: Calendar, label: 'Day Wise' },
  { to: '/pending', icon: Clock, label: 'Pending' },
  { to: '/delivered', icon: CheckCircle, label: 'Delivered' },
  { to: '/notifications', icon: Bell, label: 'Notifications', badge: true },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const sidebarWidth = collapsed ? 64 : 240;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{
        width: sidebarWidth,
        minWidth: sidebarWidth,
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100vh',
        zIndex: 50,
        transition: 'width 0.2s',
        overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{
          padding: collapsed ? '18px 0' : '18px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          gap: 10,
          minHeight: 64,
        }}>
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'var(--accent-blue)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Package size={18} color="#000" strokeWidth={2.5} />
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 16, letterSpacing: '0.04em', color: 'var(--text-primary)', lineHeight: 1 }}>
                  SKYTRACK
                </div>
                <div style={{ fontSize: 9, fontFamily: 'var(--font-heading)', fontWeight: 600, letterSpacing: '0.2em', color: 'var(--accent-blue)', textTransform: 'uppercase' }}>
                  PRO
                </div>
              </div>
            </div>
          )}
          {collapsed && (
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--accent-blue)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Package size={18} color="#000" strokeWidth={2.5} />
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              background: 'none', border: '1px solid var(--border)',
              borderRadius: 6, padding: 4, cursor: 'pointer',
              color: 'var(--text-secondary)', display: 'flex', alignItems: 'center',
              flexShrink: 0,
            }}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Nav Items */}
        <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto', overflowX: 'hidden' }}>
          {NAV_ITEMS.map(({ to, icon: Icon, label, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              style={{
                justifyContent: collapsed ? 'center' : undefined,
                padding: collapsed ? '10px' : '10px 16px',
                position: 'relative',
              }}
              title={collapsed ? label : undefined}
            >
              <Icon size={17} style={{ flexShrink: 0 }} />
              {!collapsed && <span style={{ flex: 1 }}>{label}</span>}
              {badge && unreadCount > 0 && (
                <span style={{
                  background: 'var(--status-exception)',
                  color: '#fff',
                  borderRadius: 10,
                  fontSize: 10,
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 700,
                  padding: collapsed ? '1px 5px' : '1px 6px',
                  minWidth: 18,
                  textAlign: 'center',
                  position: collapsed ? 'absolute' : 'static',
                  top: collapsed ? 6 : undefined,
                  right: collapsed ? 6 : undefined,
                }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: collapsed ? '12px 0' : '12px 16px',
        }}>
          {!collapsed && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 8,
              padding: '6px 8px',
              borderRadius: 8,
              background: 'var(--bg-elevated)',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'var(--accent-blue-dim)',
                border: '1px solid rgba(0,180,255,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: 'var(--accent-blue)',
                fontFamily: 'var(--font-heading)',
                flexShrink: 0,
              }}>
                {user?.username?.[0]?.toUpperCase() || 'U'}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-heading)', letterSpacing: '0.04em', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.username || 'User'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.role?.toUpperCase()}
                </div>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="nav-item"
            style={{
              width: '100%',
              justifyContent: collapsed ? 'center' : undefined,
              padding: collapsed ? '8px' : '8px 8px',
            }}
          >
            <LogOut size={15} />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{
        marginLeft: sidebarWidth,
        flex: 1,
        minHeight: '100vh',
        background: 'var(--bg-primary)',
        transition: 'margin-left 0.2s',
        backgroundImage: 'linear-gradient(rgba(0,180,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0,180,255,0.02) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }}>
        {/* Top header bar */}
        <header style={{
          borderBottom: '1px solid var(--border)',
          padding: '0 24px',
          height: 52,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 12,
          background: 'rgba(7,12,26,0.95)',
          backdropFilter: 'blur(8px)',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 10px',
            borderRadius: 20,
            background: 'var(--status-delivered-dim)',
            border: '1px solid rgba(16,185,129,0.2)',
          }}>
            <Zap size={11} color="var(--status-delivered)" />
            <span style={{ fontSize: 11, fontFamily: 'var(--font-heading)', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--status-delivered)', textTransform: 'uppercase' }}>
              Live
            </span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </header>

        <div style={{ padding: 24 }}>
          {children}
        </div>
      </main>
    </div>
  );
}
