import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Eye, EyeOff, Loader } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function LoginPage() {
  const { login } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      addToast({ message: 'Enter email and password', type: 'warning' });
      return;
    }
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      addToast({ message: err.response?.data?.message || 'Login failed', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      backgroundImage: `
        radial-gradient(ellipse 80% 60% at 50% -10%, rgba(0,180,255,0.12) 0%, transparent 70%),
        linear-gradient(rgba(0,180,255,0.025) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,180,255,0.025) 1px, transparent 1px)
      `,
      backgroundSize: 'auto, 40px 40px, 40px 40px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'var(--accent-blue)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 0 32px rgba(0,180,255,0.4)',
          }}>
            <Package size={28} color="#000" strokeWidth={2.5} />
          </div>
          <h1 style={{
            fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 900,
            letterSpacing: '0.08em', color: 'var(--text-primary)', textTransform: 'uppercase',
          }}>
            SKYTRACK <span style={{ color: 'var(--accent-blue)' }}>PRO</span>
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
            SkyKing Courier — Dispatch Management
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 32,
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        }}>
          <h2 style={{
            fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 700,
            letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 24,
            color: 'var(--text-primary)',
          }}>
            Sign In
          </h2>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-heading)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 6 }}>
                Email
              </label>
              <input
                className="input"
                type="email"
                placeholder="admin@skytrackpro.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                autoFocus
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-heading)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 6 }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input"
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(s => !s)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ marginTop: 8, padding: '11px 20px', fontSize: 14, width: '100%' }}
            >
              {loading ? (
                <>
                  <Loader size={15} style={{ animation: 'spin 0.8s linear infinite' }} />
                  Authenticating...
                </>
              ) : 'Sign In'}
            </button>
          </form>

          <div style={{ marginTop: 20, padding: '12px 14px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-heading)', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 6 }}>
              Demo Credentials
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              <div>admin@skytrackpro.com</div>
              <div>admin123</div>
            </div>
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--text-dim)' }}>
          SkyKing Courier Service · Internal Tool
        </p>
      </div>
    </div>
  );
}
