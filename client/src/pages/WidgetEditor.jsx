import React, { useState, useEffect, useRef } from 'react';
import { widgetRegistry } from '../widgets';
import * as LucideIcons from 'lucide-react';
import { io } from 'socket.io-client';
import { saveDraft, getDraft, clearDraft } from '../utils/indexedDB';

const AnalyticsTrendChart = ({ analyticsData }) => {
  const [timeframe, setTimeframe] = useState('daily');
  if (!analyticsData) return null;

  const data = timeframe === 'hourly'
    ? analyticsData.hourlyBreakdown
    : timeframe === 'weekly'
      ? analyticsData.weeklyBreakdown
      : analyticsData.dailyBreakdown;

  if (!data || data.length === 0) return null;

  const maxViews = Math.max(...data.map(d => d.views), 1);
  const height = 120;
  const width = 360;
  const padding = 20;

  const chartHeight = height - padding * 2;
  const chartWidth = width - padding * 2;

  const points = data.map((d, index) => {
    const x = padding + (index / (data.length - 1)) * chartWidth;
    const y = height - padding - (d.views / maxViews) * chartHeight;
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;

  const shouldShowLabel = (idx) => {
    if (timeframe === 'hourly') return idx % 6 === 0 || idx === data.length - 1;
    return true;
  };

  return (
    <div style={{
      background: 'rgba(0, 0, 0, 0.25)',
      padding: '1rem',
      borderRadius: '10px',
      border: '1px solid rgba(255,255,255,0.05)',
      marginTop: '1.25rem',
      marginBottom: '1.25rem'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.75rem'
      }}>
        <h4 style={{
          fontSize: '0.85rem',
          color: 'var(--text-secondary)',
          margin: 0,
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          Views Trend
        </h4>
        <div style={{
          display: 'flex',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '6px',
          padding: '2px',
          gap: '2px'
        }}>
          {['hourly', 'daily', 'weekly'].map((t) => (
            <button
              key={t}
              onClick={() => setTimeframe(t)}
              style={{
                background: timeframe === t ? '#6366f1' : 'none',
                color: timeframe === t ? '#fff' : 'rgba(255,255,255,0.6)',
                border: 'none',
                borderRadius: '4px',
                padding: '0.2rem 0.5rem',
                fontSize: '0.7rem',
                fontWeight: '600',
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all 0.15s'
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="rgba(255,255,255,0.05)" strokeDasharray="3,3" />
          <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="rgba(255,255,255,0.05)" strokeDasharray="3,3" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.1)" />

          <path
            d={`${pathD} L ${width - padding},${height - padding} L ${padding},${height - padding} Z`}
            fill="url(#sparkline-gradient)"
            opacity="0.15"
          />

          <path
            d={pathD}
            fill="none"
            stroke="#6366f1"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {data.map((d, index) => {
            const [x, y] = points[index].split(',');
            return (
              <g key={index}>
                <circle
                  cx={x}
                  cy={y}
                  r="4"
                  fill="#818cf8"
                  stroke="#131a30"
                  strokeWidth="2"
                />
                <text
                  x={x}
                  y={y - 8}
                  textAnchor="middle"
                  fill="#fff"
                  fontSize="8"
                  fontWeight="bold"
                >
                  {d.views}
                </text>
                {shouldShowLabel(index) && (
                  <text
                    x={x}
                    y={height - 4}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.4)"
                    fontSize="7"
                  >
                    {d.label}
                  </text>
                )}
              </g>
            );
          })}

          <defs>
            <linearGradient id="sparkline-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
};

const STYLE_PRESETS = {
  slate: {
    textColor: '#f8fafc',
    backgroundStyle: 'solid',
    backgroundColor: '#334155',
    borderRadius: '12px',
    glowEnable: false,
    borderStyle: 'solid',
    borderWidth: '1px',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    opacity: 1.0,
    customScrollbar: true,
  },
  cyberpunk: {
    textColor: '#00ffff',
    backgroundStyle: 'solid',
    backgroundColor: '#070714',
    borderRadius: '0px',
    glowEnable: true,
    glowColor: '#ff007f',
    glowBlur: '20px',
    borderStyle: 'solid',
    borderWidth: '2px',
    borderColor: '#00ffff',
    opacity: 0.95,
    customScrollbar: true,
    customCSS: `div { font-family: 'Courier New', monospace; text-shadow: 0 0 5px #00ffff; }`,
  },
  autumn: {
    textColor: '#fef3c7',
    backgroundStyle: 'gradient',
    gradientName: 'sunset',
    borderRadius: '24px',
    glowEnable: true,
    glowColor: '#b45309',
    glowBlur: '10px',
    borderStyle: 'none',
    borderWidth: '0px',
    opacity: 1.0,
    customScrollbar: false,
  },
  glassmorphism: {
    textColor: '#ffffff',
    backgroundStyle: 'solid',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: '16px',
    glowEnable: false,
    borderStyle: 'solid',
    borderWidth: '1px',
    borderColor: 'rgba(255, 255, 255, 0.15)',
    opacity: 1.0,
    customScrollbar: true,
    customCSS: `div { backdrop-filter: blur(12px) !important; }`,
  },
  darkness: {
    textColor: '#e2e8f0',
    backgroundStyle: 'gradient',
    gradientName: 'darkness',
    borderRadius: '12px',
    glowEnable: false,
    borderStyle: 'none',
    borderWidth: '0px',
    opacity: 1.0,
    customScrollbar: true,
  }
};

export default function WidgetEditor({
  navigate,
  initialId,
  initialType,
  isNew,
  token,
  user,
}) {
  const [widgetType, setWidgetType] = useState(initialType || 'clock');
  const [widgetName, setWidgetName] = useState('');
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [widgetId, setWidgetId] = useState(initialId || null);
  const [copied, setCopied] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudits, setLoadingAudits] = useState(false);
  const [pendingDraft, setPendingDraft] = useState(null);

  const fetchAuditLogs = async () => {
    if (!widgetId) return;
    setLoadingAudits(true);
    try {
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`/api/widgets/${widgetId}/audit-logs`, {
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data);
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoadingAudits(false);
    }
  };

  const socketRef = useRef(null);

  const fetchAnalytics = async () => {
    if (!widgetId) return;
    setLoadingAnalytics(true);
    try {
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`/api/widgets/${widgetId}/analytics`, {
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        setAnalyticsData(data);
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const generateWebhookToken = () => {
    if (window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  };

  // Load existing widget data if editing
  useEffect(() => {
    if (!isNew && initialId) {
      fetchWidget(initialId);
    } else if (isNew && initialType) {
      const typeDetails = widgetRegistry[initialType];
      if (typeDetails) {
        setWidgetType(initialType);
        setWidgetName(`New ${typeDetails.name}`);
        setConfig({
          ...(typeDetails.defaultConfig || {}),
          webhookToken: generateWebhookToken(),
        });
        getDraft('new').then((draft) => {
          if (draft) setPendingDraft(draft);
        });
      } else {
        // Fallback if invalid type
        navigate('/');
      }
    }
  }, [initialId, initialType, isNew, token]);

  // Handle Socket.io collaboration connection
  useEffect(() => {
    if (widgetId) {
      const socketUrl = window.location.origin.includes('5173')
        ? 'http://localhost:5001'
        : window.location.origin;

      const socket = io(socketUrl);
      socketRef.current = socket;

      socket.emit('join-widget', widgetId);

      socket.on('config-updated', ({ name, config }) => {
        if (name !== undefined) setWidgetName(name);
        if (config !== undefined) setConfig(config);
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [widgetId]);

  const fetchWidget = async (id) => {
    try {
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`/api/widgets/${id}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setWidgetId(data.id);
        setWidgetType(data.type);
        setWidgetName(data.name);

        let loadedConfig = data.config || {};
        if (!loadedConfig.webhookToken) {
          loadedConfig = {
            ...loadedConfig,
            webhookToken: generateWebhookToken(),
          };
        }
        setConfig(loadedConfig);
        getDraft(id).then((draft) => {
          if (draft) {
            const hasChanges = draft.name !== data.name || JSON.stringify(draft.config) !== JSON.stringify(loadedConfig);
            if (hasChanges) {
              setPendingDraft(draft);
            }
          }
        });
      } else {
        alert('Widget not found');
        navigate('/');
      }
    } catch (err) {
      console.error('Error fetching widget:', err);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!config || Object.keys(config).length === 0 || loading) return;

    const timer = setTimeout(() => {
      saveDraft(widgetId || 'new', widgetName, config);
    }, 2000);

    return () => clearTimeout(timer);
  }, [config, widgetName, widgetId, loading]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        type: widgetType,
        name: widgetName,
        config,
      };

      const url = isNew ? '/api/widgets' : `/api/widgets/${widgetId}`;
      const method = isNew ? 'POST' : 'PUT';

      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        clearDraft(widgetId || 'new');
        clearDraft(data.id);
        if (isNew) {
          window.history.pushState({}, '', `/edit/${data.id}`);
          window.dispatchEvent(new Event('navigate'));
        } else {
          alert('Widget saved successfully!');
        }
      } else {
        alert('Failed to save widget');
      }
    } catch (err) {
      console.error('Error saving widget:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleConfigChange = (newConfig) => {
    setConfig(newConfig);
    if (socketRef.current && widgetId) {
      socketRef.current.emit('edit-config', { widgetId, config: newConfig });
    }
  };

  const getSelectedPreset = () => {
    for (const [name, preset] of Object.entries(STYLE_PRESETS)) {
      const isMatch = Object.keys(preset).every((key) => {
        return config[key] === preset[key];
      });
      if (isMatch) return name;
    }
    return 'custom';
  };

  const handlePresetChange = (presetName) => {
    if (presetName === 'custom') return;
    const currentPreset = getSelectedPreset();
    if (currentPreset === 'custom') {
      if (!window.confirm('Applying this preset template will overwrite your current custom style configurations. Do you want to proceed?')) {
        return;
      }
    }
    const presetStyles = STYLE_PRESETS[presetName];
    if (presetStyles) {
      handleConfigChange({
        ...config,
        ...presetStyles,
      });
    }
  };

  const handleNameChange = (newName) => {
    setWidgetName(newName);
    if (socketRef.current && widgetId) {
      socketRef.current.emit('edit-config', { widgetId, name: newName });
    }
  };

  const getEmbedCode = () => {
    if (isNew || !widgetId) {
      return '<!-- Save your widget first to generate your embed code! -->';
    }
    return `<iframe src="${window.location.origin}/widget/render/${widgetId}" width="100%" height="200" style="border:none;border-radius:12px;" scrolling="no"></iframe>`;
  };

  const handleCopyCode = () => {
    if (isNew || !widgetId) return;
    navigator.clipboard.writeText(getEmbedCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '4rem',
          color: 'var(--text-secondary)',
        }}
      >
        <p>Loading widget editor...</p>
      </div>
    );
  }

  const typeDetails = widgetRegistry[widgetType];
  if (!typeDetails) {
    return (
      <div style={{ padding: '2rem' }}>Widget type details not found.</div>
    );
  }

  // Resolve config and render views
  const ConfigComponent = typeDetails.config;
  const ViewComponent = typeDetails.view;

  return (
    <div className="editor-layout" style={{ margin: '-2rem' }}>
      {/* Sidebar Controls */}
      <aside className="editor-sidebar">
        <div>
          <button
            className="btn btn-secondary"
            style={{
              marginBottom: '0.75rem',
              width: '100%',
              justifyContent: 'flex-start',
            }}
            onClick={() => navigate('/')}
          >
            <LucideIcons.ArrowLeft size={16} />
            <span>Back to Dashboard</span>
          </button>

          {!isNew && widgetId && (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <button
                className="btn btn-secondary"
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  gap: '0.4rem',
                  border: '1px solid rgba(99, 102, 241, 0.4)',
                  background: 'rgba(99, 102, 241, 0.05)',
                  fontSize: '0.78rem',
                  padding: '0.5rem 0.25rem',
                }}
                onClick={() => {
                  setIsAnalyticsOpen(true);
                  fetchAnalytics();
                }}
              >
                <LucideIcons.BarChart3 size={15} style={{ color: '#818cf8' }} />
                <span style={{ color: '#818cf8', fontWeight: '600' }}>
                  Analytics
                </span>
              </button>
              <button
                className="btn btn-secondary"
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  gap: '0.4rem',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  background: 'rgba(245, 158, 11, 0.05)',
                  fontSize: '0.78rem',
                  padding: '0.5rem 0.25rem',
                }}
                onClick={() => {
                  setIsAuditOpen(true);
                  fetchAuditLogs();
                }}
              >
                <LucideIcons.ClipboardList size={15} style={{ color: '#fbbf24' }} />
                <span style={{ color: '#fbbf24', fontWeight: '600' }}>
                  Audit Logs
                </span>
              </button>
            </div>
          )}

          <div className="config-group">
            <h3>Basic Info</h3>
            <div className="config-field">
              <label>Widget Name</label>
              <input
                type="text"
                value={widgetName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="My Custom Widget"
              />
            </div>
            <div className="config-field">
              <label>Hover Tooltip Text</label>
              <input
                type="text"
                value={config.tooltipText || ''}
                onChange={(e) => handleConfigChange({ ...config, tooltipText: e.target.value })}
                placeholder="Tooltip text shown on hover"
              />
            </div>
          </div>

          <div className="config-group">
            <h3>Style Presets</h3>
            <div className="config-field">
              <label>Apply Style Template</label>
              <select
                value={getSelectedPreset()}
                onChange={(e) => handlePresetChange(e.target.value)}
              >
                <option value="custom">Custom Styling (Manual)</option>
                <option value="slate">Minimalist Slate</option>
                <option value="cyberpunk">Neon Cyberpunk</option>
                <option value="autumn">Autumn Forest</option>
                <option value="glassmorphism">Frosted Glass</option>
                <option value="darkness">Pitch Black</option>
              </select>
            </div>
          </div>

          <div className="config-group">
            <h3>Border & Frame</h3>
            <div className="config-row">
              <div className="config-field">
                <label>Border Style</label>
                <select
                  value={config.borderStyle || 'none'}
                  onChange={(e) => handleConfigChange({ ...config, borderStyle: e.target.value })}
                >
                  <option value="none">None</option>
                  <option value="solid">Solid</option>
                  <option value="dashed">Dashed</option>
                  <option value="dotted">Dotted</option>
                  <option value="double">Double</option>
                </select>
              </div>
              <div className="config-field">
                <label>Border Width</label>
                <select
                  value={config.borderWidth || '0px'}
                  onChange={(e) => handleConfigChange({ ...config, borderWidth: e.target.value })}
                >
                  <option value="0px">None (0px)</option>
                  <option value="1px">Thin (1px)</option>
                  <option value="2px">Medium (2px)</option>
                  <option value="4px">Thick (4px)</option>
                  <option value="8px">Extra Thick (8px)</option>
                </select>
              </div>
            </div>
            {config.borderStyle && config.borderStyle !== 'none' && (
              <div className="config-field">
                <label>Border Color</label>
                <input
                  type="color"
                  value={config.borderColor || '#ffffff'}
                  onChange={(e) => handleConfigChange({ ...config, borderColor: e.target.value })}
                />
              </div>
            )}
            <div className="config-field">
              <label>Widget Opacity ({Math.round((config.opacity !== undefined ? config.opacity : 1) * 100)}%)</label>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={config.opacity !== undefined ? config.opacity : 1.0}
                onChange={(e) => handleConfigChange({ ...config, opacity: parseFloat(e.target.value) })}
                style={{ width: '100%', accentColor: '#6366f1' }}
              />
            </div>
            <div className="config-field toggle-field">
              <label>Enable Border Glow</label>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={config.glowEnable === true}
                  onChange={(e) => handleConfigChange({ ...config, glowEnable: e.target.checked })}
                />
                <span className="slider"></span>
              </label>
            </div>
            {config.glowEnable && (
              <div className="config-row">
                <div className="config-field">
                  <label>Glow Color</label>
                  <input
                    type="color"
                    value={config.glowColor || '#6366f1'}
                    onChange={(e) => handleConfigChange({ ...config, glowColor: e.target.value })}
                  />
                </div>
                <div className="config-field">
                  <label>Glow Blur ({config.glowBlur || '10px'})</label>
                  <select
                    value={config.glowBlur || '10px'}
                    onChange={(e) => handleConfigChange({ ...config, glowBlur: e.target.value })}
                  >
                    <option value="5px">Subtle (5px)</option>
                    <option value="10px">Medium (10px)</option>
                    <option value="20px">Strong (20px)</option>
                    <option value="30px">Intense (30px)</option>
                    <option value="40px">Extra Intense (40px)</option>
                  </select>
                </div>
              </div>
            )}
            <div className="config-field toggle-field">
              <label>Custom Scrollbar</label>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={config.customScrollbar === true}
                  onChange={(e) => handleConfigChange({ ...config, customScrollbar: e.target.checked })}
                />
                <span className="slider"></span>
              </label>
            </div>
          </div>
          <div className="config-group">
            <h3>Access Security</h3>
            <div className="config-field">
              <label>Allowed Domains (comma-separated)</label>
              <input
                type="text"
                value={config.allowedDomains || ''}
                onChange={(e) => handleConfigChange({ ...config, allowedDomains: e.target.value })}
                placeholder="e.g. myblog.com, mysite.org"
              />
              <small style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '0.25rem', display: 'block' }}>
                Leave blank to allow embedding on any website.
              </small>
            </div>
          </div>
        </div>

        {/* Dynamic widget config fields */}
        <ConfigComponent
          config={config}
          onChange={handleConfigChange}
          token={token}
        />

        <div style={{ marginTop: 'auto', display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn btn-secondary"
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={() => {
              if (window.confirm('Are you sure you want to reset all configurations to defaults? This will erase all custom settings, styling templates, and custom CSS details.')) {
                handleConfigChange(typeDetails.defaultConfig || {});
              }
            }}
            type="button"
          >
            Reset Defaults
          </button>
          <button
            className="btn btn-primary"
            style={{ flex: 2, justifyContent: 'center' }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Widget'}
          </button>
        </div>
      </aside>

      {/* Main Preview canvas */}
      <main className="editor-main">
        <div className="preview-container">
          <div className="preview-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span>Live Interactive Preview</span>
            <button
              onClick={() => setIsFullscreenPreview(true)}
              className="btn btn-secondary"
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', gap: '0.25rem', border: '1px solid rgba(255,255,255,0.1)' }}
              type="button"
            >
              <LucideIcons.Maximize2 size={12} />
              <span>Fullscreen</span>
            </button>
          </div>
          <div className="preview-frame-wrapper">
            <div
              className={config.customScrollbar ? 'custom-scrollbar' : ''}
              style={{
                width: '100%',
                height: '200px',
                overflow: 'hidden',
                borderRadius: config.borderRadius || '12px',
                border: config.borderWidth && config.borderWidth !== '0px' && config.borderStyle && config.borderStyle !== 'none'
                  ? `${config.borderWidth} ${config.borderStyle} ${config.borderColor || 'transparent'}`
                  : 'none',
                opacity: config.opacity !== undefined ? config.opacity : 1.0,
                boxShadow: config.glowEnable
                  ? `0 0 ${config.glowBlur || '10px'} ${config.glowColor || '#6366f1'}`
                  : 'none',
              }}
              title={config.tooltipText || ''}
            >
              {/* Render the View component live with current config state */}
              <ViewComponent config={config} />
            </div>
          </div>

          {/* Embed Code Panel */}
          <div className="embed-box">
            <div className="embed-header">
              <h4>Get Embed Link</h4>
              {!isNew && widgetId && (
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                    onClick={handleCopyCode}
                  >
                    {copied ? (
                      <>
                        <LucideIcons.Check
                          size={14}
                          style={{ color: 'var(--success)' }}
                        />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <LucideIcons.Copy size={14} />
                        <span>Copy Code</span>
                      </>
                    )}
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{
                      padding: '0.4rem 0.75rem',
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                    onClick={() => {
                      window.open(`/api/widgets/${widgetId}/export`, '_blank');
                    }}
                    title="Export stand-alone HTML package"
                  >
                    <LucideIcons.Download size={14} />
                    <span>Export ZIP</span>
                  </button>
                </div>
              )}
            </div>
            <pre className="embed-code">
              <code>{getEmbedCode()}</code>
            </pre>
            {isNew && (
              <p
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                  marginTop: '0.5rem',
                }}
              >
                * Save this widget to generate a deployable embed code.
              </p>
            )}
          </div>

          {/* Webhooks Integration Panel */}
          <div className="embed-box" style={{ marginTop: '1.5rem' }}>
            <div className="embed-header">
              <h4>Webhook Integration</h4>
              {!isNew && widgetId && (
                <button
                  className="btn btn-secondary"
                  style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                  onClick={() => {
                    const url = `${window.location.origin}/api/widgets/${widgetId}/webhook?token=${config.webhookToken}`;
                    navigator.clipboard.writeText(url);
                    setCopiedWebhook(true);
                    setTimeout(() => setCopiedWebhook(false), 2000);
                  }}
                >
                  <LucideIcons.Copy size={14} />
                  <span>Copy URL</span>
                </button>
              )}
            </div>
            <p
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                margin: '0.5rem 0',
              }}
            >
              Update this widget's configuration in real-time by sending a POST
              request.
            </p>
            {!isNew && widgetId ? (
              <>
                <pre
                  className="embed-code"
                  style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
                >
                  <code>{`${window.location.origin}/api/widgets/${widgetId}/webhook?token=${config.webhookToken}`}</code>
                </pre>
                <h5
                  style={{
                    margin: '0.75rem 0 0.25rem 0',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                  }}
                >
                  Sample payload (curl)
                </h5>
                <pre
                  className="embed-code"
                  style={{ whiteSpace: 'pre-wrap', fontSize: '0.75rem' }}
                >
                  <code>{`curl -X POST "${window.location.origin}/api/widgets/${widgetId}/webhook?token=${config.webhookToken}" \\
  -H "Content-Type: application/json" \\
  -d '{"textColor": "#ff007f"}'`}</code>
                </pre>
              </>
            ) : (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                * Save this widget to generate a secure webhook integration URL.
              </p>
            )}
          </div>
        </div>
      </main>

      {/* Analytics Modal overlay */}
      {isAnalyticsOpen && (
        <div
          className="modal-overlay"
          onClick={() => setIsAnalyticsOpen(false)}
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '500px',
              background: 'rgba(30, 41, 59, 0.85)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
              borderRadius: '16px',
              padding: '2rem',
            }}
          >
            <div
              className="modal-header"
              style={{ border: 'none', padding: 0, marginBottom: '1.5rem' }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <LucideIcons.BarChart3 size={24} style={{ color: '#6366f1' }} />
                <h2 style={{ fontSize: '1.5rem', fontWeight: '800' }}>
                  Widget Analytics
                </h2>
              </div>
              <button
                className="modal-close"
                onClick={() => setIsAnalyticsOpen(false)}
                style={{ color: 'var(--text-muted)' }}
              >
                <LucideIcons.X size={20} />
              </button>
            </div>

            {loadingAnalytics ? (
              <p
                style={{
                  textAlign: 'center',
                  color: 'var(--text-secondary)',
                  padding: '2rem 0',
                }}
              >
                Loading analytics data...
              </p>
            ) : !analyticsData || analyticsData.totalViews === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '2rem 0',
                  color: 'var(--text-secondary)',
                }}
              >
                <p style={{ fontSize: '2.5rem', margin: 0 }}>📊</p>
                <h3
                  style={{ margin: '0.75rem 0 0.25rem 0', fontSize: '1.1rem' }}
                >
                  No data collected yet
                </h3>
                <p
                  style={{
                    fontSize: '0.82rem',
                    color: 'var(--text-muted)',
                    maxWidth: '320px',
                    margin: '0 auto',
                  }}
                >
                  Embed your widget on websites. Once people view your widget,
                  referrers and views will show up here!
                </p>
              </div>
            ) : (
              <div>
                {/* Stats summary */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '1rem',
                    marginBottom: '1.5rem',
                  }}
                >
                  <div
                    style={{
                      background: 'rgba(0,0,0,0.2)',
                      padding: '1rem',
                      borderRadius: '10px',
                      textAlign: 'center',
                      border: '1px solid rgba(255,255,255,0.05)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      Total Views
                    </div>
                    <div
                      style={{
                        fontSize: '1.75rem',
                        fontWeight: '800',
                        color: '#fff',
                        marginTop: '0.25rem',
                      }}
                    >
                      {analyticsData.totalViews}
                    </div>
                  </div>
                  <div
                    style={{
                      background: 'rgba(0,0,0,0.2)',
                      padding: '1rem',
                      borderRadius: '10px',
                      textAlign: 'center',
                      border: '1px solid rgba(255,255,255,0.05)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      Referrers
                    </div>
                    <div
                      style={{
                        fontSize: '1.75rem',
                        fontWeight: '800',
                        color: '#fff',
                        marginTop: '0.25rem',
                      }}
                    >
                      {analyticsData.referrers.length}
                    </div>
                  </div>
                </div>

                {analyticsData && (
                  <AnalyticsTrendChart analyticsData={analyticsData} />
                )}

                {/* Referrers breakdown */}
                <h4
                  style={{
                    fontSize: '0.9rem',
                    color: 'var(--text-secondary)',
                    marginBottom: '0.75rem',
                  }}
                >
                  Top Referrer Domains
                </h4>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    paddingRight: '0.25rem',
                  }}
                >
                  {analyticsData.referrers.map((ref) => {
                    const pct = Math.round(
                      (ref.count / analyticsData.totalViews) * 100,
                    );
                    return (
                      <div
                        key={ref.domain}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.25rem',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifycontent: 'space-between',
                            fontSize: '0.85rem',
                          }}
                        >
                          <span
                            style={{
                              color: '#fff',
                              fontWeight: '500',
                              wordBreak: 'break-all',
                            }}
                          >
                            {ref.domain}
                          </span>
                          <span
                            style={{
                              color: 'var(--text-secondary)',
                              marginLeft: 'auto',
                            }}
                          >
                            {ref.count} ({pct}%)
                          </span>
                        </div>
                        <div
                          style={{
                            width: '100%',
                            height: '6px',
                            background: 'rgba(255, 255, 255, 0.08)',
                            borderRadius: '3px',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: `${pct}%`,
                              background: '#6366f1',
                              borderRadius: '3px',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {copied && (
        <div
          className="toast-animation"
          style={{
            position: 'fixed',
            bottom: '2rem',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(16, 185, 129, 0.95)',
            backdropFilter: 'blur(8px)',
            color: '#ffffff',
            padding: '0.75rem 1.5rem',
            borderRadius: '50px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 0 15px rgba(16, 185, 129, 0.4)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontWeight: '600',
            fontSize: '0.9rem',
          }}
        >
          <LucideIcons.CheckCircle2 size={16} />
          <span>Embed code copied to clipboard!</span>
        </div>
      )}

      {copiedWebhook && (
        <div
          className="toast-animation"
          style={{
            position: 'fixed',
            bottom: '2rem',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(16, 185, 129, 0.95)',
            backdropFilter: 'blur(8px)',
            color: '#ffffff',
            padding: '0.75rem 1.5rem',
            borderRadius: '50px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 0 15px rgba(16, 185, 129, 0.4)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontWeight: '600',
            fontSize: '0.9rem',
          }}
        >
          <LucideIcons.CheckCircle2 size={16} />
          <span>Webhook URL copied to clipboard!</span>
        </div>
      )}

      {isFullscreenPreview && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: '#0b0f19',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '4rem',
            boxSizing: 'border-box',
          }}
        >
          <button
            onClick={() => setIsFullscreenPreview(false)}
            className="btn btn-secondary"
            style={{
              position: 'absolute',
              top: '2rem',
              right: '2rem',
              padding: '0.5rem 1rem',
              fontSize: '0.85rem',
              gap: '0.4rem',
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.05)',
              backdropFilter: 'blur(8px)',
              zIndex: 100000,
            }}
            type="button"
          >
            <LucideIcons.Minimize2 size={16} />
            <span>Close Fullscreen</span>
          </button>

          <div
            className={config.customScrollbar ? 'custom-scrollbar' : ''}
            style={{
              width: '100%',
              maxWidth: '800px',
              height: '450px',
              overflow: 'hidden',
              borderRadius: config.borderRadius || '12px',
              border: config.borderWidth && config.borderWidth !== '0px' && config.borderStyle && config.borderStyle !== 'none'
                ? `${config.borderWidth} ${config.borderStyle} ${config.borderColor || 'transparent'}`
                : 'none',
              opacity: config.opacity !== undefined ? config.opacity : 1.0,
              boxShadow: config.glowEnable
                ? `0 0 ${config.glowBlur || '20px'} ${config.glowColor || '#6366f1'}`
                : '0 20px 50px rgba(0,0,0,0.5)',
            }}
            title={config.tooltipText || ''}
          >
            <ViewComponent config={config} />
          </div>
        </div>
      )}

      {/* Audit Logs Modal overlay */}
      {isAuditOpen && (
        <div
          className="modal-overlay"
          onClick={() => setIsAuditOpen(false)}
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '500px',
              background: 'rgba(30, 41, 59, 0.85)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
              borderRadius: '16px',
              padding: '2rem',
            }}
          >
            <div
              className="modal-header"
              style={{ border: 'none', padding: 0, marginBottom: '1.5rem' }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <LucideIcons.ClipboardList size={24} style={{ color: '#fbbf24' }} />
                <h2 style={{ fontSize: '1.5rem', fontWeight: '800' }}>
                  Workspace Audit Logs
                </h2>
              </div>
              <button
                className="modal-close"
                onClick={() => setIsAuditOpen(false)}
                style={{ color: 'var(--text-muted)' }}
              >
                <LucideIcons.X size={20} />
              </button>
            </div>

            {loadingAudits ? (
              <p
                style={{
                  textAlign: 'center',
                  padding: '2rem',
                  color: 'var(--text-secondary)',
                }}
              >
                Loading audit history...
              </p>
            ) : !auditLogs || auditLogs.length === 0 ? (
              <p
                style={{
                  textAlign: 'center',
                  padding: '2rem',
                  color: 'var(--text-muted)',
                  fontSize: '0.9rem',
                }}
              >
                No audit entries recorded for this widget yet.
              </p>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  maxHeight: '350px',
                  overflowY: 'auto',
                  paddingRight: '0.5rem',
                }}
              >
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      background: 'rgba(0, 0, 0, 0.2)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      borderRadius: '8px',
                      padding: '0.75rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span>👤 {log.username}</span>
                      <span>{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    <div style={{ fontSize: '0.82rem', fontWeight: '600', color: '#fff', marginTop: '0.15rem' }}>
                      {log.action === 'share_org' ? '🔗 Widget Shared with Org' : '⚙️ Configuration Updated'}
                    </div>
                    {log.details && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                        {log.action === 'share_org' ? (
                          <span>Organization ID: <code>{log.details.orgId}</code> ({log.details.accessLevel})</span>
                        ) : (
                          <span>
                            Changed fields:{' '}
                            {log.details.changedKeys && log.details.changedKeys.length > 0 ? (
                              log.details.changedKeys.map(k => <code key={k} style={{ margin: '0 2px', background: 'rgba(255,255,255,0.08)', padding: '1px 3px', borderRadius: '3px' }}>{k}</code>)
                            ) : (
                              <span style={{ fontStyle: 'italic' }}>None (Metadata/Name only)</span>
                            )}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Draft Recovery Modal */}
      {pendingDraft && (
        <div className="modal-overlay" style={{ zIndex: 200000 }}>
          <div
            className="modal"
            style={{
              maxWidth: '420px',
              background: 'rgba(30, 41, 59, 0.9)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
              borderRadius: '16px',
              padding: '2rem',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>💾</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '0.5rem', color: '#fff' }}>
              Restore Unsaved Draft?
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              We detected unsaved changes from{' '}
              <strong style={{ color: '#fff' }}>
                {new Date(pendingDraft.timestamp).toLocaleString()}
              </strong>{' '}
              for this widget. Would you like to restore your progress?
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                className="btn btn-primary"
                style={{
                  background: '#6366f1',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.5rem 1.25rem',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  if (pendingDraft.name) setWidgetName(pendingDraft.name);
                  if (pendingDraft.config) setConfig(pendingDraft.config);
                  setPendingDraft(null);
                }}
              >
                Restore Draft
              </button>
              <button
                className="btn btn-secondary"
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: 'var(--text-secondary)',
                  borderRadius: '8px',
                  padding: '0.5rem 1.25rem',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  clearDraft(widgetId || 'new');
                  setPendingDraft(null);
                }}
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
