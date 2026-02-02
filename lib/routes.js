const { buildStremioStreams } = require('./stremio');
const { extractStreamFromImdb } = require('./workflow');
const { extractRpmStream } = require('./rpm');

function registerRoutes(app) {
  // 🌐 STREMIO ADDON ENDPOINTS
  app.get('/manifest.json', (req, res) => {
    const manifest = {
      id: 'streamapp.magyarfilmeksorozatok.hdmozi',
      version: '2.0.0',
      name: 'HDMozi→RPM Magyar',
      description: '🇭🇺 Magyar filmek és sorozatok HDMozi-ról automatikus RPM streamekkel (IMDB alapú)',
      logo: 'https://dl.stremio.com/addon-logo.png',
      background: 'https://dl.stremio.com/addon-background.jpg',
      resources: ['stream'],
      types: ['movie', 'series'],
      catalogs: [],
      idPrefixes: ['tt'],
      behaviorHints: {
        configurable: false,
        configurationRequired: false
      }
    };

    res.json(manifest);
  });

  // 🎬 STREMIO STREAM ENDPOINT
  app.get('/stream/:type/:id.json', async (req, res) => {
    try {
      const { type, id } = req.params;
      console.log(`🎬 Stremio stream request: ${type} - ${id}`);

      let result;
      let imdbId, season, episode;

      if (id.startsWith('tt')) {
        if (id.includes(':')) {
          const parts = id.split(':');
          imdbId = parts[0];
          season = parseInt(parts[1], 10);
          episode = parseInt(parts[2], 10);
        } else {
          imdbId = id;
        }
      } else {
        return res.json({ streams: [] });
      }

      result = await extractStreamFromImdb(imdbId, season, episode);

      res.json({
        streams: buildStremioStreams(result)
      });

    } catch (error) {
      console.error(`❌ Stremio endpoint error: ${error.message}`);
      res.json({ streams: [] });
    }
  });

  // 🧪 TEST ENDPOINTS
  // Legacy RPM ID test
  app.get('/test/rpm/:videoId', async (req, res) => {
    try {
      const { videoId } = req.params;
      console.log(`🧪 Testing legacy RPM ID: ${videoId}`);
      const result = await extractRpmStream(videoId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // IMDB ID test
  app.get('/test/imdb/:imdbId', async (req, res) => {
    try {
      const { imdbId } = req.params;
      const { season, episode } = req.query;

      console.log(`🧪 Testing IMDB workflow: ${imdbId}${season ? ` S${season}E${episode}` : ''}`);

      const result = await extractStreamFromImdb(
        imdbId,
        season ? parseInt(season) : null,
        episode ? parseInt(episode) : null
      );

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 🔍 DEBUG: Raw HTML viewer
  app.get('/debug/html', async (req, res) => {
    try {
      const { url } = req.query;
      if (!url) {
        return res.json({ error: 'Missing url parameter' });
      }

      console.log(`🔍 DEBUG: Fetching HTML from ${url}`);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`Fetch failed: ${response.status}`);
      }

      const html = await response.text();

      // Search for specific patterns
      const rpmMatches = [];
      const patterns = [
        /background-image:\s*url\([^)]*\/([a-zA-Z0-9_-]{15,})\/[^)]*\)/gi,
        /url\(&quot;\/([a-zA-Z0-9_-]{15,})\/tab\/[^&]*&quot;\)/gi,
        /\/([a-zA-Z0-9_-]{20,})\/tab\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\//gi,
        /player-button-container.*?background-image.*?url.*?\/([a-zA-Z0-9_-]{15,})\//gis
      ];

      patterns.forEach((pattern, index) => {
        const matches = [...html.matchAll(pattern)];
        matches.forEach(match => {
          rpmMatches.push({
            pattern: index,
            patternStr: pattern.toString(),
            id: match[1],
            fullMatch: match[0].substring(0, 200)
          });
        });
      });

      res.json({
        success: true,
        url,
        htmlLength: html.length,
        rpmMatches,
        htmlSample: html.substring(0, 2000),
        // Look for player container specifically
        playerContainer: html.match(/player-button-container[^>]*>.*?<\/div>/s)?.[0]?.substring(0, 500)
      });

    } catch (error) {
      res.json({
        success: false,
        error: error.message
      });
    }
  });

  // 🏠 HOME PAGE
  app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>HDMozi→RPM Magyar</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                margin: 40px;
                background: #1a1a1a;
                color: #fff;
                line-height: 1.6;
            }
            h1 { color: #4CAF50; margin-bottom: 20px; }
            .status {
                background: #333;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
                border-left: 4px solid #4CAF50;
            }
            .workflow {
                background: #2a2a2a;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
            }
            .test-links {
                background: #334;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
            }
            .ready { color: #4CAF50; font-weight: bold; }
            .config { color: #ff9800; }
            a { color: #2196F3; text-decoration: none; }
            a:hover { text-decoration: underline; }
            ol { margin: 10px 0; padding-left: 20px; }
            li { margin-bottom: 8px; }
            code {
                background: #444;
                padding: 4px 8px;
                border-radius: 4px;
                font-family: monospace;
            }
        </style>
    </head>
    <body>
        <h1>🇭🇺 HDMozi→RPM Magyar Addon v2.0</h1>

        <div class="status">
            <h3>📊 Status:</h3>
            <p><span class="ready">✅ READY TO USE</span> - No configuration required!</p>
            <p><strong>TMDB API:</strong> ✅ Hardcoded key</p>
            <p><strong>HDMozi:</strong> ✅ Scraping ready</p>
            <p><strong>RPM Share:</strong> ✅ M3U8 extraction ready</p>
        </div>

        <div class="workflow">
            <h3>🔄 Automatic Workflow:</h3>
            <ol>
                <li><strong>Stremio</strong> sends IMDB ID (tt1234567 vagy tt1234567:1:5)</li>
                <li><strong>TMDB API</strong> → Film/sorozat cím + évad/epizód info</li>
                <li><strong>HDMozi URL</strong> → Automatikus URL építés</li>
                <li><strong>HDMozi scraping</strong> → RPM Share ID kinyerése</li>
                <li><strong>RPM extraction</strong> → M3U8 stream URL-ek + feliratok</li>
                <li><strong>Stremio lejátszó</strong> → Lejátszás</li>
            </ol>
        </div>

        <div class="test-links">
            <h3>🧪 Test Endpoints:</h3>
            <h4>🆔 IMDB-based (Stremio format):</h4>
            <ul>
                <li><a href="/stream/series/tt13623632:1:1.json">/stream/series/tt13623632:1:1.json</a> - Alien: Föld S01E01</li>
                <li><a href="/stream/movie/tt28996126.json">/stream/movie/tt28996126.json</a> - Senki 2</li>
            </ul>

            <h4>🔧 Manual tests:</h4>
            <ul>
                <li><a href="/test/imdb/tt13623632">/test/imdb/tt13623632</a> - Alien: Föld TMDB lookup</li>
                <li><a href="/test/imdb/tt28996126">/test/imdb/tt28996126</a> - Senki 2 TMDB lookup</li>
            </ul>

            <h4>📱 Stremio Integration:</h4>
            <p><strong>Manifest URL:</strong></p>
            <p><code>${req.protocol}://${req.get('host')}/manifest.json</code></p>
            <p><a href="/manifest.json">📋 View Manifest</a></p>
        </div>

        <div class="status">
            <h3>⚡ Features:</h3>
            <ul>
                <li>🇭🇺 <strong>100% Magyar tartalom</strong> - HDMozi forrás</li>
                <li>🎯 <strong>IMDB automatizmus</strong> - Nincs kézi ID keresés</li>
                <li>📺 <strong>Sorozat támogatás</strong> - Season/Episode parsing</li>
                <li>🎬 <strong>M3U8 streamek</strong> - Közvetlen lejátszás</li>
                <li>📝 <strong>Felirat támogatás</strong> - Ha elérhető</li>
                <li>⚡ <strong>Gyors működés</strong> - Optimalizált workflow</li>
            </ul>
        </div>
    </body>
    </html>
  `);
  });
}

module.exports = {
  registerRoutes
};
