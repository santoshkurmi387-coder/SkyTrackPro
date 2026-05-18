import React from 'react';

// ── Status Badge ────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  'Delivered': { cls: 'badge-delivered', dot: 'var(--status-delivered)' },
  'In Transit': { cls: 'badge-transit', dot: 'var(--status-transit)' },
  'Out for Delivery': { cls: 'badge-out', dot: 'var(--status-out)' },
  'Booked': { cls: 'badge-booked', dot: 'var(--status-booked)' },
  'Exception': { cls: 'badge-exception', dot: 'var(--status-exception)' },
  'Unknown': { cls: 'badge-booked', dot: 'var(--status-booked)' },
};

export function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['Unknown'];
  return (
    <span className={`badge ${cfg.cls}`}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {status}
    </span>
  );
}

// ── Loading Spinner ─────────────────────────────────────────────────────────────
export default function LoadingSpinner({ fullScreen, size = 32 }) {
  const spinner = (
    <div style={{
      width: size, height: size,
      border: `3px solid var(--border)`,
      borderTopColor: 'var(--accent-blue)',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    }} />
  );

  if (fullScreen) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        background: 'var(--bg-primary)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 16, zIndex: 9999,
      }}>
        {spinner}
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 13, letterSpacing: '0.1em', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
          Loading SkyTrack Pro...
        </div>
      </div>
    );
  }

  return spinner;
}

// ── Skeleton ─────────────────────────────────────────────────────────────────────
export function Skeleton({ width = '100%', height = 16, borderRadius = 6, style = {} }) {
  return (
    <div
      className="skeleton"
      style={{ width, height, borderRadius, ...style }}
    />
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '60px 24px', gap: 16,
    }}>
      {Icon && (
        <div style={{
          width: 64, height: 64, borderRadius: 16,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-bright)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={28} color="var(--text-dim)" />
        </div>
      )}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
          {title}
        </div>
        {description && (
          <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-secondary)', maxWidth: 320 }}>
            {description}
          </div>
        )}
      </div>
      {action}
    </div>
  );
}

// ── Page Header ───────────────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start',
      justifyContent: 'space-between', marginBottom: 24, gap: 16,
    }}>
      <div>
        <h1 style={{
          fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 800,
          letterSpacing: '0.04em', color: 'var(--text-primary)', textTransform: 'uppercase', lineHeight: 1,
        }}>
          {title}
        </h1>
        {subtitle && (
          <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
            {subtitle}
          </div>
        )}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}

// ── Data Table Pagination ──────────────────────────────────────────────────────────
export function Pagination({ page, pages, total, onPage }) {
  if (pages <= 1) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 16px', borderTop: '1px solid var(--border)',
    }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
        Page {page} of {pages} ({total} total)
      </span>
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          className="btn btn-ghost"
          style={{ padding: '4px 10px', fontSize: 12 }}
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
        >
          Prev
        </button>
        {Array.from({ length: Math.min(5, pages) }, (_, i) => {
          const p = Math.max(1, Math.min(page - 2, pages - 4)) + i;
          return (
            <button
              key={p}
              className={`btn ${p === page ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '4px 10px', fontSize: 12, minWidth: 32 }}
              onClick={() => onPage(p)}
            >
              {p}
            </button>
          );
        })}
        <button
          className="btn btn-ghost"
          style={{ padding: '4px 10px', fontSize: 12 }}
          onClick={() => onPage(page + 1)}
          disabled={page >= pages}
        >
          Next
        </button>
      </div>
    </div>
  );
}
