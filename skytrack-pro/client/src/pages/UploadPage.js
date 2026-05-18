import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Image, CheckSquare, Square, AlertTriangle, CheckCircle, Loader, X, RotateCcw } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { PageHeader, Skeleton } from '../components/ui/LoadingSpinner';

const STEPS = ['upload', 'ocr', 'confirm', 'done'];

export default function UploadPage() {
  const { addToast } = useToast();

  const [step, setStep] = useState('upload');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploadId, setUploadId] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [ocrStatus, setOcrStatus] = useState('idle');
  const [extractedNumbers, setExtractedNumbers] = useState([]);
  const [ocrConfidence, setOcrConfidence] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState(null);
  const pollRef = useRef(null);

  // Cleanup preview URL
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const onDrop = useCallback(async (accepted) => {
    if (!accepted.length) return;
    const f = accepted[0];
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setStep('upload');
    setOcrStatus('uploading');

    try {
      const form = new FormData();
      form.append('billbook', f);
      form.append('date', date);
      const res = await api.post('/uploads', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadId(res.data.uploadId);
      setImageUrl(res.data.imageUrl);
      setStep('ocr');
      setOcrStatus('processing');
      startPolling(res.data.uploadId);
    } catch (err) {
      addToast({ message: err.response?.data?.message || 'Upload failed', type: 'error' });
      setOcrStatus('idle');
    }
  }, [date, addToast]);

  const startPolling = (id) => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/uploads/${id}/status`);
        const { status, extractedNumbers: nums, ocrConfidence: conf, error } = res.data;

        if (status === 'awaiting_confirmation') {
          clearInterval(pollRef.current);
          const sorted = (nums || []).sort();
          setExtractedNumbers(sorted);
          setSelected(new Set(sorted));
          setOcrConfidence(conf);
          setOcrStatus('done');
          setStep('confirm');
        } else if (status === 'error') {
          clearInterval(pollRef.current);
          setOcrStatus('error');
          addToast({ message: `OCR failed: ${error}`, type: 'error' });
        }
      } catch {}
    }, 2500);
  };

  useEffect(() => () => clearInterval(pollRef.current), []);

  const toggleNumber = (n) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(selected.size === extractedNumbers.length ? new Set() : new Set(extractedNumbers));
  };

  const handleConfirm = async () => {
    if (selected.size === 0) {
      addToast({ message: 'Select at least one consignment number', type: 'warning' });
      return;
    }
    setConfirming(true);
    try {
      const res = await api.post(`/uploads/${uploadId}/confirm`, {
        confirmedNumbers: [...selected],
      });
      setResult(res.data);
      setStep('done');
      addToast({ message: `${res.data.added} consignment(s) added to tracking queue`, type: 'success' });
    } catch (err) {
      addToast({ message: err.response?.data?.message || 'Confirmation failed', type: 'error' });
    } finally {
      setConfirming(false);
    }
  };

  const reset = () => {
    setStep('upload');
    setFile(null);
    setPreview(null);
    setUploadId(null);
    setExtractedNumbers([]);
    setSelected(new Set());
    setOcrConfidence(null);
    setOcrStatus('idle');
    setResult(null);
    clearInterval(pollRef.current);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.bmp'] },
    maxFiles: 1, disabled: step !== 'upload' || ocrStatus === 'uploading',
  });

  return (
    <div>
      <PageHeader
        title="Upload Bill Book"
        subtitle="Upload a photo of today's physical bill book to extract consignment numbers"
        actions={step !== 'upload' && (
          <button className="btn btn-ghost" onClick={reset}>
            <RotateCcw size={14} />
            Start Over
          </button>
        )}
      />

      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 28 }}>
        {[
          { key: 'upload', label: '01 Upload' },
          { key: 'ocr', label: '02 OCR Processing' },
          { key: 'confirm', label: '03 Confirm Numbers' },
          { key: 'done', label: '04 Complete' },
        ].map(({ key, label }, i) => {
          const idx = STEPS.indexOf(step);
          const thisIdx = STEPS.indexOf(key);
          const done = thisIdx < idx;
          const active = thisIdx === idx;

          return (
            <React.Fragment key={key}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 14px',
                borderRadius: 6,
                background: active ? 'var(--accent-blue-dim)' : done ? 'var(--status-delivered-dim)' : 'transparent',
                border: `1px solid ${active ? 'rgba(0,180,255,0.3)' : done ? 'rgba(16,185,129,0.25)' : 'transparent'}`,
              }}>
                <span style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: active ? 'var(--accent-blue)' : done ? 'var(--status-delivered)' : 'var(--bg-elevated)',
                  border: `1px solid ${active ? 'var(--accent-blue)' : done ? 'var(--status-delivered)' : 'var(--border-bright)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-heading)',
                  color: active ? '#000' : done ? '#000' : 'var(--text-dim)',
                  flexShrink: 0,
                }}>
                  {done ? '✓' : i + 1}
                </span>
                <span style={{
                  fontFamily: 'var(--font-heading)', fontSize: 12, fontWeight: 700,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: active ? 'var(--accent-blue)' : done ? 'var(--status-delivered)' : 'var(--text-dim)',
                }}>
                  {label}
                </span>
              </div>
              {i < 3 && (
                <div style={{ width: 24, height: 1, background: done ? 'var(--status-delivered)' : 'var(--border)', flexShrink: 0 }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: preview ? '1fr 1fr' : '1fr', gap: 20, maxWidth: preview ? '100%' : 640 }}>
        {/* Left: Upload / Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Date picker */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-heading)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 6 }}>
                Upload Date
              </label>
              <input
                type="date"
                className="input"
                value={date}
                onChange={e => setDate(e.target.value)}
                disabled={step !== 'upload'}
                style={{ colorScheme: 'dark' }}
              />
            </div>
          </div>

          {/* Dropzone */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-heading)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 6 }}>
              Bill Book Image
            </label>
            <div
              {...getRootProps()}
              className={`dropzone ${isDragActive ? 'active' : ''}`}
              style={{ minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}
            >
              <input {...getInputProps()} />
              {ocrStatus === 'uploading' ? (
                <>
                  <Loader size={32} color="var(--accent-blue)" style={{ animation: 'spin 0.8s linear infinite' }} />
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: 14, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Uploading...
                  </div>
                </>
              ) : file ? (
                <>
                  <Image size={32} color="var(--status-delivered)" />
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: 13, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--status-delivered)', textTransform: 'uppercase' }}>
                    {file.name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                    {(file.size / 1024).toFixed(0)} KB
                  </div>
                </>
              ) : (
                <>
                  <div style={{
                    width: 52, height: 52, borderRadius: 12,
                    background: 'var(--accent-blue-dim)',
                    border: '1px solid rgba(0,180,255,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Upload size={24} color="var(--accent-blue)" />
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-heading)', fontSize: 15, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-primary)', textTransform: 'uppercase', textAlign: 'center' }}>
                      {isDragActive ? 'Drop it here!' : 'Drag & Drop Bill Book Photo'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center', marginTop: 4 }}>
                      JPG, PNG, WebP, BMP • Max 10 MB
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>or click to browse</span>
                </>
              )}
            </div>
          </div>

          {/* OCR Processing State */}
          {step === 'ocr' && (
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Loader size={20} color="var(--accent-blue)" style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                <div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: 14, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                    Running OCR Engine
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>
                    Extracting consignment numbers from your image…
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {['Loading image', 'Preprocessing', 'Character recognition', 'Extracting numbers'].map((label, i) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                      background: 'var(--accent-blue)',
                      animation: `pulse-glow 1.5s ease-in-out ${i * 0.3}s infinite`,
                    }} />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Done state */}
          {step === 'done' && result && (
            <div className="card" style={{ padding: 20, borderColor: 'rgba(16,185,129,0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <CheckCircle size={20} color="var(--status-delivered)" />
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 15, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--status-delivered)' }}>
                  Successfully Queued
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  ['New Added', result.added, 'var(--status-delivered)'],
                  ['Duplicates Skipped', result.duplicates, 'var(--text-dim)'],
                ].map(([label, val, color]) => (
                  <div key={label} style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 24, fontFamily: 'var(--font-heading)', fontWeight: 800, color }}>{val}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-heading)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Confirm Numbers */}
        {(step === 'confirm' || step === 'done') && (
          <div className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{
              padding: '14px 16px',
              borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 14, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                  Extracted Numbers
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                  {extractedNumbers.length} found · {selected.size} selected
                  {ocrConfidence && ` · ${ocrConfidence.toFixed(0)}% confidence`}
                </div>
              </div>
              {step === 'confirm' && (
                <button
                  className="btn btn-ghost"
                  style={{ padding: '4px 10px', fontSize: 11 }}
                  onClick={toggleAll}
                >
                  {selected.size === extractedNumbers.length ? (
                    <><Square size={12} /> Deselect All</>
                  ) : (
                    <><CheckSquare size={12} /> Select All</>
                  )}
                </button>
              )}
            </div>

            {/* OCR confidence warning */}
            {ocrConfidence !== null && ocrConfidence < 70 && (
              <div style={{
                padding: '10px 14px',
                background: 'var(--warning-dim)',
                borderBottom: '1px solid rgba(245,158,11,0.2)',
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 12, color: 'var(--warning)',
              }}>
                <AlertTriangle size={13} />
                Low OCR confidence ({ocrConfidence.toFixed(0)}%). Review carefully.
              </div>
            )}

            {/* Numbers list */}
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: 380 }}>
              {extractedNumbers.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
                  No consignment numbers detected. Try a higher quality image.
                </div>
              ) : (
                extractedNumbers.map(n => {
                  const isSelected = selected.has(n);
                  const isDone = step === 'done';
                  return (
                    <div
                      key={n}
                      onClick={() => !isDone && toggleNumber(n)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 14px',
                        cursor: isDone ? 'default' : 'pointer',
                        background: isSelected ? 'var(--accent-blue-dim)' : 'transparent',
                        borderBottom: '1px solid var(--border)',
                        transition: 'background 0.1s',
                      }}
                    >
                      {isDone ? (
                        <CheckCircle size={14} color="var(--status-delivered)" />
                      ) : isSelected ? (
                        <CheckSquare size={14} color="var(--accent-blue)" />
                      ) : (
                        <Square size={14} color="var(--text-dim)" />
                      )}
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: '0.08em', color: isSelected ? 'var(--accent-blue)' : 'var(--text-secondary)', flex: 1 }}>
                        {n}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{n.length} digits</span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Confirm button */}
            {step === 'confirm' && (
              <div style={{ padding: 14, borderTop: '1px solid var(--border)' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleConfirm}
                  disabled={confirming || selected.size === 0}
                  style={{ width: '100%', padding: '11px 20px' }}
                >
                  {confirming ? (
                    <><Loader size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Processing...</>
                  ) : (
                    <><CheckCircle size={14} /> Confirm & Add {selected.size} Consignment{selected.size !== 1 ? 's' : ''}</>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
