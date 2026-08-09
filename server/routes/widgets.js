const express = require('express');
const router = express.Router();
const axios = require('axios');
const jwt = require('jsonwebtoken');
const db = require('../database');
const analyticsDb = require('../database_analytics');
const auditDb = require('../database_audits');
const { apiCache } = require('../middleware/cache');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_widgetry_key';

// Helper to get optional user from request headers
function getOptionalUser(req) {
  const authHeader = req.header('Authorization');
  if (!authHeader) return null;
  const tokenParts = authHeader.split(' ');
  if (tokenParts.length !== 2 || tokenParts[0] !== 'Bearer') return null;
  try {
    return jwt.verify(tokenParts[1], JWT_SECRET);
  } catch (err) {
    return null;
  }
}

// GET all widgets (optionally filtered by user)
router.get('/', (req, res) => {
  try {
    const user = getOptionalUser(req);
    const widgets = db.getAll();

    let filteredWidgets = [];
    if (user) {
      // Return user's widgets and anonymous widgets
      filteredWidgets = widgets.filter(
        (w) => w.userId === user.id || !w.userId,
      );
    } else {
      // Return only anonymous widgets
      filteredWidgets = widgets.filter((w) => !w.userId);
    }

    // Attach views analytics count
    const result = filteredWidgets.map((w) => {
      const stats = analyticsDb.getAnalytics(w.id);
      return {
        ...w,
        views: stats.totalViews,
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch widgets' });
  }
});

// POST /api/widgets/reorder - Update ordering of widgets
router.post('/reorder', (req, res) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ error: 'orderedIds array is required' });
    }
    const widgets = db.getAll();
    const updated = widgets.map((w) => {
      const idx = orderedIds.indexOf(w.id);
      if (idx !== -1) {
        return { ...w, position: idx };
      }
      return w;
    });
    db.saveAll(updated);
    res.json({ success: true, message: 'Widget order updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reorder widgets' });
  }
});

// GET widget by ID
router.get('/:id', (req, res) => {
  try {
    const widget = db.getById(req.params.id);
    if (!widget) {
      return res.status(404).json({ error: 'Widget not found' });
    }

    // Anyone can read anonymous widgets, but private ones require ownership check
    if (widget.userId) {
      const user = getOptionalUser(req);
      if (!user || user.id !== widget.userId) {
        return res.status(403).json({ error: 'Access denied: private widget' });
      }
    }

    // Domain restrictions check
    if (widget.config && widget.config.allowedDomains) {
      const domains = widget.config.allowedDomains
        .split(',')
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean);

      if (domains.length > 0) {
        const refUrlStr = req.query.referrer || req.headers.referer;
        if (!refUrlStr) {
          return res.status(403).json({ error: 'Access denied: domain restriction active (no referrer found)' });
        }

        try {
          const refUrl = new URL(refUrlStr);
          const refHost = refUrl.hostname.toLowerCase();

          const isAllowed = domains.some((domain) => {
            return refHost === domain || refHost.endsWith('.' + domain);
          });

          const platformHost = req.headers.host ? req.headers.host.split(':')[0].toLowerCase() : 'localhost';
          const isPlatform = refHost === platformHost || refHost === 'localhost' || refHost === '127.0.0.1';

          if (!isAllowed && !isPlatform) {
            return res.status(403).json({ error: `Access denied: domain '${refHost}' is not allowed to embed this widget` });
          }
        } catch (e) {
          return res.status(403).json({ error: 'Access denied: invalid referrer URL' });
        }
      }
    }

    res.json(widget);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch widget' });
  }
});

// GET widget CSP directive status and header configuration
router.get('/:id/csp', (req, res) => {
  try {
    const widget = db.getById(req.params.id);
    if (!widget) {
      return res.status(404).json({ error: 'Widget not found' });
    }
    const csp =
      widget.config?.cspDirective ||
      "default-src 'self' 'unsafe-inline' https:;";
    res.setHeader('Content-Security-Policy', csp);
    res.json({ id: widget.id, cspDirective: csp, status: 'enforced' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch CSP configuration' });
  }
});

// POST trigger outbound webhook to custom target URL
router.post('/:id/trigger-webhook', async (req, res) => {
  try {
    const widget = db.getById(req.params.id);
    if (!widget) {
      return res.status(404).json({ error: 'Widget not found' });
    }

    const targetUrl = widget.config?.outboundWebhookUrl || req.body?.webhookUrl;
    if (!targetUrl) {
      return res
        .status(400)
        .json({ error: 'No outbound webhook URL configured' });
    }

    const payload = {
      event: req.body?.event || 'widget_event',
      widgetId: widget.id,
      widgetName: widget.name,
      timestamp: new Date().toISOString(),
      data: req.body?.data || {},
    };

    try {
      await axios.post(targetUrl, payload, { timeout: 5000 });
      res.json({ success: true, deliveredTo: targetUrl, payload });
    } catch (err) {
      res
        .status(502)
        .json({
          error: 'Failed to deliver webhook payload',
          details: err.message,
        });
    }
  } catch (err) {
    res.status(500).json({ error: 'Server error handling outbound webhook' });
  }
});

// POST create widget (can be associated with user)
router.post('/', (req, res) => {
  try {
    const { type, name, config } = req.body;
    if (!type) {
      return res.status(400).json({ error: 'Widget type is required' });
    }

    const user = getOptionalUser(req);
    const userId = user ? user.id : null;

    const newWidget = db.create({ type, name, config, userId });
    res.status(201).json(newWidget);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create widget' });
  }
});

// PUT update widget
router.put('/:id', (req, res) => {
  try {
    const { name, config } = req.body;
    const widget = db.getById(req.params.id);
    if (!widget) {
      return res.status(404).json({ error: 'Widget not found' });
    }

    // Check ownership if private
    if (widget.userId) {
      const user = getOptionalUser(req);
      if (!user || user.id !== widget.userId) {
        return res.status(403).json({ error: 'Access denied: private widget' });
      }
    }

    // Append version history snapshot before updating
    const history = widget.history || [];
    const newHistory = [
      ...history,
      {
        versionId: `v_${Date.now()}`,
        name: widget.name,
        config: JSON.parse(JSON.stringify(widget.config || {})),
        timestamp: new Date().toISOString(),
      },
    ];

    const user = getOptionalUser(req);
    const userId = user ? user.id : 'anonymous';
    const username = user ? user.username : 'Anonymous User';

    const changedKeys = Object.keys(config || {}).filter(
      (k) => JSON.stringify(widget.config?.[k]) !== JSON.stringify(config?.[k])
    );

    auditDb.recordLog(widget.id, userId, username, 'update_config', {
      prevName: widget.name,
      newName: name,
      changedKeys
    });

    const updated = db.update(req.params.id, {
      name,
      config,
      history: newHistory,
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update widget' });
  }
});

// GET widget version history
router.get('/:id/history', (req, res) => {
  try {
    const widget = db.getById(req.params.id);
    if (!widget) {
      return res.status(404).json({ error: 'Widget not found' });
    }
    res.json(widget.history || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch version history' });
  }
});

// GET widget audit logs
router.get('/:id/audit-logs', (req, res) => {
  try {
    const widget = db.getById(req.params.id);
    if (!widget) {
      return res.status(404).json({ error: 'Widget not found' });
    }

    if (widget.userId) {
      const user = getOptionalUser(req);
      if (!user || user.id !== widget.userId) {
        return res.status(403).json({ error: 'Access denied: private widget logs' });
      }
    }

    const logs = auditDb.getLogsForWidget(req.params.id);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve audit logs' });
  }
});

// GET public marketplace widget presets
router.get('/marketplace/public', (req, res) => {
  try {
    const widgets = db.getAll();
    const publicPresets = widgets.filter(
      (w) => w.isPublic === true || !w.userId,
    );
    res.json(publicPresets);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch marketplace presets' });
  }
});

// GET detailed analytics summary for a widget
router.get('/:id/analytics/summary', (req, res) => {
  try {
    const widget = db.getById(req.params.id);
    if (!widget) {
      return res.status(404).json({ error: 'Widget not found' });
    }
    const summary = analyticsDb.getDetailedAnalytics(req.params.id);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch detailed analytics summary' });
  }
});

// GET server-side rendered SVG image endpoint for static markdown/email embeds
router.get('/render/:id.svg', (req, res) => {
  try {
    const widget = db.getById(req.params.id);
    if (!widget) {
      return res.status(404).send('<svg xmlns="http://www.w3.org/2000/svg"><text y="20">Widget not found</text></svg>');
    }

    const title = widget.name || 'Widget';
    const type = widget.type || 'Standard';

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">
      <rect width="100%" height="100%" rx="12" fill="#1b2542"/>
      <text x="20" y="40" fill="#6366f1" font-family="sans-serif" font-size="14" font-weight="bold">${type.toUpperCase()}</text>
      <text x="20" y="80" fill="#ffffff" font-family="sans-serif" font-size="20" font-weight="bold">${title}</text>
      <text x="20" y="160" fill="#94a3b8" font-family="sans-serif" font-size="12">Powered by Widgetry Platform</text>
    </svg>`;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'max-age=60');
    res.send(svg);
  } catch (err) {
    res.status(500).send('<svg xmlns="http://www.w3.org/2000/svg"><text y="20">Rendering Error</text></svg>');
  }
});

// DELETE widget
router.delete('/:id', (req, res) => {
  try {
    const widget = db.getById(req.params.id);
    if (!widget) {
      return res.status(404).json({ error: 'Widget not found' });
    }

    // Check ownership if private
    if (widget.userId) {
      const user = getOptionalUser(req);
      if (!user || user.id !== widget.userId) {
        return res.status(403).json({ error: 'Access denied: private widget' });
      }
    }

    db.delete(req.params.id);
    res.json({ message: 'Widget deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete widget' });
  }
});

// GET weather proxy endpoint (cached for 5 minutes)
router.get('/proxy/weather', apiCache(5 * 60 * 1000), async (req, res) => {
  const city = req.query.city || 'San Francisco';
  const unit = req.query.unit || 'C';
  try {
    // 1. Geocode city name to lat/long using Open-Meteo Geocoding API
    const geocodeUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
    const geocodeRes = await axios.get(geocodeUrl);

    if (!geocodeRes.data.results || geocodeRes.data.results.length === 0) {
      return res.status(404).json({ error: 'City not found' });
    }

    const { latitude, longitude, name, country } = geocodeRes.data.results[0];

    // 2. Fetch current weather conditions
    const tempUnit = unit === 'F' ? 'fahrenheit' : 'celsius';
    const windUnit = unit === 'F' ? 'mph' : 'kmh';
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&temperature_unit=${tempUnit}&wind_speed_unit=${windUnit}`;
    const weatherRes = await axios.get(weatherUrl);

    if (!weatherRes.data.current) {
      return res
        .status(500)
        .json({ error: 'Failed to fetch weather conditions' });
    }

    const current = weatherRes.data.current;
    const temperature = current.temperature_2m;
    const humidity = current.relative_humidity_2m;
    const windSpeed = current.wind_speed_10m;
    const weathercode = current.weather_code;

    // 3. Map weather codes to friendly descriptions
    // Reference: WMO weather interpretation codes
    const weatherCodeMap = {
      0: { condition: 'Clear Sky', icon: 'Sun' },
      1: { condition: 'Mainly Clear', icon: 'CloudSun' },
      2: { condition: 'Partly Cloudy', icon: 'CloudSun' },
      3: { condition: 'Overcast', icon: 'Cloud' },
      45: { condition: 'Foggy', icon: 'CloudFog' },
      48: { condition: 'Depositing Rime Fog', icon: 'CloudFog' },
      51: { condition: 'Light Drizzle', icon: 'CloudDrizzle' },
      53: { condition: 'Moderate Drizzle', icon: 'CloudDrizzle' },
      55: { condition: 'Dense Drizzle', icon: 'CloudDrizzle' },
      61: { condition: 'Slight Rain', icon: 'CloudRain' },
      63: { condition: 'Moderate Rain', icon: 'CloudRain' },
      65: { condition: 'Heavy Rain', icon: 'CloudRain' },
      71: { condition: 'Slight Snowfall', icon: 'CloudSnow' },
      73: { condition: 'Moderate Snowfall', icon: 'CloudSnow' },
      75: { condition: 'Heavy Snowfall', icon: 'CloudSnow' },
      80: { condition: 'Slight Rain Showers', icon: 'CloudRain' },
      81: { condition: 'Moderate Rain Showers', icon: 'CloudRain' },
      82: { condition: 'Violent Rain Showers', icon: 'CloudRain' },
      95: { condition: 'Thunderstorm', icon: 'CloudLightning' },
    };

    const details = weatherCodeMap[weathercode] || {
      condition: 'Moderate Weather',
      icon: 'Cloud',
    };

    res.json({
      city: name,
      country: country || '',
      temperature,
      humidity,
      windSpeed,
      condition: details.condition,
      icon: details.icon,
      latitude,
      longitude,
    });
  } catch (err) {
    console.error('Weather Proxy Error:', err.message);
    res.status(500).json({ error: 'Weather service currently unavailable' });
  }
});

function parseRssXml(xmlString) {
  const channelTitleMatch = xmlString.match(/<channel>[\s\S]*?<title>([\s\S]*?)<\/title>/i);
  const feedTitle = channelTitleMatch ? channelTitleMatch[1].trim().replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1') : 'RSS Feed';

  const items = [];
  const itemMatches = xmlString.match(/<item>([\s\S]*?)<\/item>/gi) || [];

  for (const itemXml of itemMatches.slice(0, 3)) {
    const titleMatch = itemXml.match(/<title>([\s\S]*?)<\/title>/i);
    const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/i);

    let title = titleMatch ? titleMatch[1].trim() : 'No Title';
    let link = linkMatch ? linkMatch[1].trim() : '#';

    title = title.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1');
    link = link.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1');

    title = title
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'");

    items.push({ title, link });
  }

  return { title: feedTitle, items };
}

// GET RSS feed proxy endpoint (cached for 10 minutes)
router.get('/proxy/rss', apiCache(10 * 60 * 1000), async (req, res) => {
  const feedUrl = req.query.url;
  if (!feedUrl) {
    return res.status(400).json({ error: 'URL query parameter is required' });
  }
  try {
    const response = await axios.get(feedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Widgetry/1.0' },
      timeout: 5000,
    });
    const xml = response.data;
    if (typeof xml !== 'string') {
      return res.status(422).json({ error: 'Invalid feed content' });
    }
    const parsed = parseRssXml(xml);
    res.json(parsed);
  } catch (err) {
    console.error('RSS Proxy Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch or parse RSS feed' });
  }
});

// POST webhook data update
router.post('/:id/webhook', (req, res) => {
  try {
    const widget = db.getById(req.params.id);
    if (!widget) {
      return res.status(404).json({ error: 'Widget not found' });
    }

    const { token } = req.query;
    if (!token || token !== widget.config.webhookToken) {
      return res.status(403).json({ error: 'Invalid webhook token' });
    }

    // Merge incoming JSON payload directly into widget config
    const updatedConfig = {
      ...widget.config,
      ...req.body,
    };

    const updated = db.update(req.params.id, { config: updatedConfig });

    // Emit live WebSocket update to the widget edit room
    const io = req.app.get('io');
    if (io) {
      io.to(req.params.id).emit('config-updated', { config: updatedConfig });
    }

    res.json({
      message: 'Webhook received and widget updated successfully',
      config: updated.config,
    });
  } catch (err) {
    console.error('Webhook processing error:', err.message);
    res.status(500).json({ error: 'Failed to process webhook data' });
  }
});

// GET export widget bundle
router.get('/:id/export', (req, res) => {
  try {
    const widget = db.getById(req.params.id);
    if (!widget) {
      return res.status(404).json({ error: 'Widget not found' });
    }

    // 1. Resolve widget type React view file path
    const viewFilePath = path.join(
      __dirname,
      `../../client/src/widgets/${widget.type}/${widget.type}WidgetView.jsx`,
    );
    if (!fs.existsSync(viewFilePath)) {
      return res.status(500).json({
        error: `Widget view for type '${widget.type}' not found on server`,
      });
    }

    let viewCode = fs.readFileSync(viewFilePath, 'utf8');

    // 2. Transpile/clean React JSX code for standard Babel CDN compile in index.html
    // Remove imports
    viewCode = viewCode.replace(/import\s+.*?;/g, '');
    // Strip "export default" to let Babel resolve components globally
    viewCode = viewCode.replace(
      /export\s+default\s+function\s+(\w+)/g,
      'function $1',
    );

    // 3. Assemble self-contained standalone HTML bundle
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${widget.name || 'Widgetry Widget'}</title>
  
  <!-- Premium Outfit Google Font -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&display=swap" rel="stylesheet">
  
  <!-- React & ReactDOM CDN -->
  <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
  
  <!-- Babel standalone compiler -->
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>

  <style>
    body {
      margin: 0;
      padding: 0;
      background: transparent;
      overflow: hidden;
    }
    html, body, #root {
      height: 100%;
      width: 100%;
    }
  </style>
</head>
<body>
  <div id="root"></div>

  <script type="text/babel">
    const { useState, useEffect, useRef, useMemo, useCallback, Fragment } = React;

    // Preserved GRADIENTS map
    const GRADIENTS = {
      royal:     'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
      ocean:     'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)',
      arctic:    'linear-gradient(135deg, #2980b9 0%, #6dd5fa 50%, #ffffff 100%)',
      midnight:  'linear-gradient(135deg, #0d0d2b 0%, #1a1a5e 50%, #3d348b 100%)',
      cosmic:    'linear-gradient(135deg, #6a11cb 0%, #2575fc 100%)',
      nebula:    'linear-gradient(135deg, #3d0366 0%, #c6007e 100%)',
      aurora:    'linear-gradient(135deg, #007991 0%, #78ffd6 100%)',
      lavender:  'linear-gradient(135deg, #bdc3c7 0%, #2c3e50 100%)',
      sunset:    'linear-gradient(135deg, #f12711 0%, #f5af19 100%)',
      ember:     'linear-gradient(135deg, #c31432 0%, #240b36 100%)',
      peach:     'linear-gradient(135deg, #ed4264 0%, #ffedbc 100%)',
      gold:      'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)',
      forest:    'linear-gradient(135deg, #134e5e 0%, #71b280 100%)',
      emerald:   'linear-gradient(135deg, #0f9b58 0%, #00bf8f 100%)',
      lime:      'linear-gradient(135deg, #acb6e5 0%, #86fde8 100%)',
      neon:      'linear-gradient(135deg, #0575e6 0%, #00f260 100%)',
      synthwave: 'linear-gradient(135deg, #fc466b 0%, #3f5efb 100%)',
      cyberpunk: 'linear-gradient(135deg, #f953c6 0%, #b91d73 100%)',
      darkness:  'linear-gradient(135deg, #141e30 0%, #243b55 100%)',
      obsidian:  'linear-gradient(135deg, #1c1c1c 0%, #3d3d3d 100%)'
    };

    // Configuration object
    const widgetConfig = ${JSON.stringify(widget.config, null, 2)};

    // Component source
    ${viewCode}

    // Dynamic React mount
    const container = document.getElementById('root');
    const root = ReactDOM.createRoot(container);

    const ComponentToRender = 
      (typeof ClockWidgetView !== 'undefined' && ClockWidgetView) ||
      (typeof QuoteWidgetView !== 'undefined' && QuoteWidgetView) ||
      (typeof WeatherWidgetView !== 'undefined' && WeatherWidgetView) ||
      (typeof CountdownWidgetView !== 'undefined' && CountdownWidgetView) ||
      (typeof TodoWidgetView !== 'undefined' && TodoWidgetView) ||
      (typeof GithubStatsWidgetView !== 'undefined' && GithubStatsWidgetView) ||
      (typeof CryptoTickerWidgetView !== 'undefined' && CryptoTickerWidgetView) ||
      (typeof AnalogClockWidgetView !== 'undefined' && AnalogClockWidgetView) ||
      (typeof TriviaWidgetView !== 'undefined' && TriviaWidgetView) ||
      (typeof PomodoroWidgetView !== 'undefined' && PomodoroWidgetView) ||
      (typeof SpotifyWidgetView !== 'undefined' && SpotifyWidgetView);

    if (ComponentToRender) {
      root.render(<ComponentToRender config={widgetConfig} />);
    } else {
      root.render(<div>Error loading widget component.</div>);
    }
  </script>
</body>
</html>`;

    // 4. Create ZIP bundle
    const AdmZip = require('adm-zip');
    const zip = new AdmZip();
    zip.addFile('index.html', Buffer.from(htmlContent, 'utf-8'));

    const zipBuffer = zip.toBuffer();
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=${widget.type}-widget-${widget.id}.zip`,
    );
    res.setHeader('Content-Length', zipBuffer.length);
    res.send(zipBuffer);
  } catch (err) {
    console.error('Export Error:', err.message);
    res.status(500).json({ error: 'Failed to export widget' });
  }
});

// POST track widget impression
router.post('/:id/track', (req, res) => {
  try {
    const widget = db.getById(req.params.id);
    if (!widget) {
      return res.status(404).json({ error: 'Widget not found' });
    }

    // Get referrer domain from headers
    const rawReferrer = req.headers.referer || req.headers.referrer || null;
    analyticsDb.recordHit(req.params.id, rawReferrer);

    res.json({ message: 'Impression tracked successfully' });
  } catch (err) {
    console.error('Tracking Error:', err.message);
    res.status(500).json({ error: 'Failed to track widget impression' });
  }
});

// GET widget analytics report
router.get('/:id/analytics', (req, res) => {
  try {
    const widget = db.getById(req.params.id);
    if (!widget) {
      return res.status(404).json({ error: 'Widget not found' });
    }

    // Perform widget ownership verification if user-auth is enabled on private widgets
    if (widget.userId) {
      const user = getOptionalUser(req);
      if (!user || user.id !== widget.userId) {
        return res
          .status(403)
          .json({ error: 'Access denied: private analytics' });
      }
    }

    const report = analyticsDb.getDetailedAnalytics(req.params.id);
    res.json(report);
  } catch (err) {
    console.error('Analytics Fetch Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch widget analytics' });
  }
});

// POST share widget across team / organization scope
router.post('/:id/share-org', (req, res) => {
  try {
    const { orgId, accessLevel = 'view' } = req.body;
    const widget = db.getById(req.params.id);
    if (!widget) {
      return res.status(404).json({ error: 'Widget not found' });
    }

    const user = getOptionalUser(req);
    const userId = user ? user.id : 'anonymous';
    const username = user ? user.username : 'Anonymous User';

    auditDb.recordLog(widget.id, userId, username, 'share_org', {
      orgId,
      accessLevel
    });

    const updatedConfig = {
      ...(widget.config || {}),
      sharedOrgId: orgId,
      orgAccessLevel: accessLevel,
    };
    const updated = db.update(req.params.id, { config: updatedConfig });
    res.json({
      message: 'Widget successfully shared with organization',
      widget: updated,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to share widget with organization' });
  }
});

// Spotify OAuth credentials (developer defaults or loaded from environment / request)
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || 'dummy_spotify_client_id';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || 'dummy_spotify_client_secret';

// GET /api/widgets/spotify/login
router.get('/spotify/login', (req, res) => {
  const widgetId = req.query.widgetId;
  if (!widgetId) {
    return res.status(400).send('widgetId query parameter is required');
  }

  const host = req.headers.host;
  const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  const redirectUri = `${protocol}://${host}/api/widgets/spotify/callback`;

  const state = widgetId;
  const scope = 'user-read-currently-playing user-read-playback-state';

  const spotifyAuthUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${SPOTIFY_CLIENT_ID}&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
  
  res.redirect(spotifyAuthUrl);
});

// GET /api/widgets/spotify/callback
router.get('/spotify/callback', async (req, res) => {
  const { code, state: widgetId, error } = req.query;

  if (error) {
    return res.send(`Spotify Authorization Error: ${error}`);
  }

  if (!code || !widgetId) {
    return res.status(400).send('Missing code or state');
  }

  const host = req.headers.host;
  const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  const redirectUri = `${protocol}://${host}/api/widgets/spotify/callback`;

  try {
    if (SPOTIFY_CLIENT_ID === 'dummy_spotify_client_id') {
      throw new Error('Spotify OAuth Sandbox mode active (dummy credentials)');
    }

    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', redirectUri);
    params.append('client_id', SPOTIFY_CLIENT_ID);
    params.append('client_secret', SPOTIFY_CLIENT_SECRET);

    const tokenRes = await axios.post('https://accounts.spotify.com/api/token', params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const { access_token, refresh_token, expires_in } = tokenRes.data;

    const widget = db.getById(widgetId);
    if (!widget) {
      return res.status(404).send('Widget not found');
    }

    if (!widget.config) widget.config = {};
    widget.config.spotifyConnected = true;
    widget.config.spotifyAccessToken = access_token;
    widget.config.spotifyRefreshToken = refresh_token;
    widget.config.spotifyTokenExpiresAt = Date.now() + expires_in * 1000;

    db.update(widgetId, widget);

    res.send(`
      <html>
        <body>
          <h2>Spotify Connected successfully!</h2>
          <p>You can close this window now. Returning to editor...</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'SPOTIFY_CONNECTED' }, '*');
            }
            setTimeout(() => {
              window.close();
            }, 1500);
          </script>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('Spotify OAuth Callback Error:', err.message);
    // Simulate successful link in sandbox mode if dummy credentials used
    const widget = db.getById(widgetId);
    if (widget) {
      if (!widget.config) widget.config = {};
      widget.config.spotifyConnected = true;
      widget.config.spotifyAccessToken = 'dummy_access_token';
      widget.config.spotifyRefreshToken = 'dummy_refresh_token';
      widget.config.spotifyTokenExpiresAt = Date.now() + 3600 * 1000;
      db.update(widgetId, widget);
    }

    res.send(`
      <html>
        <body>
          <h2>Spotify Connected (Sandbox Sandbox Mode)!</h2>
          <p>Sandbox credentials linked successfully. Returning to editor...</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'SPOTIFY_CONNECTED' }, '*');
            }
            setTimeout(() => {
              window.close();
            }, 1500);
          </script>
        </body>
      </html>
    `);
  }
});

// GET /api/widgets/spotify/currently-playing/:widgetId
router.get('/spotify/currently-playing/:widgetId', async (req, res) => {
  const widget = db.getById(req.params.widgetId);
  if (!widget || !widget.config?.spotifyConnected) {
    return res.status(400).json({ error: 'Spotify account not connected' });
  }

  let { spotifyAccessToken, spotifyRefreshToken, spotifyTokenExpiresAt } = widget.config;

  if (SPOTIFY_CLIENT_ID === 'dummy_spotify_client_id' || spotifyAccessToken === 'dummy_access_token') {
    return res.json({
      isPlaying: true,
      title: 'Resonance (Sandbox Mock)',
      artist: 'HOME',
      album: 'Odyssey',
      coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=150',
      duration: 180,
      progress: Math.floor((Date.now() / 1000) % 180)
    });
  }

  // Refresh token if expired
  if (Date.now() >= spotifyTokenExpiresAt - 60000) {
    try {
      const params = new URLSearchParams();
      params.append('grant_type', 'refresh_token');
      params.append('refresh_token', spotifyRefreshToken);
      params.append('client_id', SPOTIFY_CLIENT_ID);
      params.append('client_secret', SPOTIFY_CLIENT_SECRET);

      const refreshRes = await axios.post('https://accounts.spotify.com/api/token', params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      spotifyAccessToken = refreshRes.data.access_token;
      if (refreshRes.data.refresh_token) {
        spotifyRefreshToken = refreshRes.data.refresh_token;
      }
      spotifyTokenExpiresAt = Date.now() + refreshRes.data.expires_in * 1000;

      widget.config.spotifyAccessToken = spotifyAccessToken;
      widget.config.spotifyRefreshToken = spotifyRefreshToken;
      widget.config.spotifyTokenExpiresAt = spotifyTokenExpiresAt;
      db.update(widget.id, widget);
    } catch (err) {
      console.error('Failed to refresh Spotify token:', err.message);
      return res.status(502).json({ error: 'Failed to refresh Spotify session' });
    }
  }

  try {
    const playRes = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: {
        Authorization: `Bearer ${spotifyAccessToken}`
      }
    });

    if (playRes.status === 204 || !playRes.data || !playRes.data.item) {
      return res.json({ isPlaying: false, message: 'No track currently playing' });
    }

    const track = playRes.data.item;
    res.json({
      isPlaying: playRes.data.is_playing,
      title: track.name,
      artist: track.artists.map(a => a.name).join(', '),
      album: track.album.name,
      coverUrl: track.album.images[0]?.url || '',
      duration: Math.round(track.duration_ms / 1000),
      progress: Math.round(playRes.data.progress_ms / 1000)
    });
  } catch (err) {
    console.error('Failed to fetch Spotify track details:', err.message);
    res.status(500).json({ error: 'Failed to pull current playing track info' });
  }
});

// GET /api/widgets/spotify/playlist/:playlistId/:widgetId
router.get('/spotify/playlist/:playlistId/:widgetId', async (req, res) => {
  const widget = db.getById(req.params.widgetId);
  const playlistId = req.params.playlistId;

  if (!widget || !widget.config?.spotifyConnected || SPOTIFY_CLIENT_ID === 'dummy_spotify_client_id') {
    const seed = playlistId.charCodeAt(0) || 42;
    const mockTracks = [
      {
        title: `Track Alpha (Playlist Mock ${seed})`,
        artist: 'Sonic Oasis',
        album: 'Synthesized Dreams',
        duration: 180,
        coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300'
      },
      {
        title: `Track Beta (Playlist Mock ${seed + 1})`,
        artist: 'Neon Horizon',
        album: 'Cyberpunk Odyssey',
        duration: 210,
        coverUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300'
      },
      {
        title: `Track Gamma (Playlist Mock ${seed + 2})`,
        artist: 'Astral Echo',
        album: 'Stellar Wanderer',
        duration: 240,
        coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300'
      }
    ];
    return res.json({ tracks: mockTracks });
  }

  let { spotifyAccessToken, spotifyRefreshToken, spotifyTokenExpiresAt } = widget.config;

  if (Date.now() >= spotifyTokenExpiresAt - 60000) {
    try {
      const params = new URLSearchParams();
      params.append('grant_type', 'refresh_token');
      params.append('refresh_token', spotifyRefreshToken);
      params.append('client_id', SPOTIFY_CLIENT_ID);
      params.append('client_secret', SPOTIFY_CLIENT_SECRET);

      const refreshRes = await axios.post('https://accounts.spotify.com/api/token', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      spotifyAccessToken = refreshRes.data.access_token;
      if (refreshRes.data.refresh_token) {
        spotifyRefreshToken = refreshRes.data.refresh_token;
      }
      spotifyTokenExpiresAt = Date.now() + refreshRes.data.expires_in * 1000;

      widget.config.spotifyAccessToken = spotifyAccessToken;
      widget.config.spotifyRefreshToken = spotifyRefreshToken;
      widget.config.spotifyTokenExpiresAt = spotifyTokenExpiresAt;
      db.update(widget.id, widget);
    } catch (err) {
      console.error('Failed to refresh Spotify token for playlist:', err.message);
      return res.status(502).json({ error: 'Failed to refresh Spotify session' });
    }
  }

  try {
    const response = await axios.get(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=20`, {
      headers: { Authorization: `Bearer ${spotifyAccessToken}` }
    });

    const tracks = response.data.items.map(item => {
      const track = item.track;
      return {
        title: track.name,
        artist: track.artists.map(a => a.name).join(', '),
        album: track.album.name,
        duration: Math.round(track.duration_ms / 1000),
        coverUrl: track.album.images[0]?.url || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300'
      };
    });

    res.json({ tracks });
  } catch (err) {
    console.error('Failed to fetch Spotify playlist:', err.message);
    res.status(500).json({ error: 'Failed to fetch Spotify playlist tracks' });
  }
});

module.exports = router;
