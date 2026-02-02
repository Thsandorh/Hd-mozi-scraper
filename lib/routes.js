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
    const manifestUrl = `${req.protocol}://${req.get('host')}/manifest.json`;
    const stremioInstallUrl = `stremio://install?manifest=${encodeURIComponent(manifestUrl)}`;
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>HDMozi→RPM Magyar</title>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
            :root {
                color-scheme: dark;
                --bg: #0b0f1c;
                --panel: rgba(19, 26, 45, 0.9);
                --panel-light: rgba(30, 40, 66, 0.9);
                --text: #f5f7ff;
                --muted: #b7c3ff;
                --accent: #7c5cff;
                --accent-2: #42e3ff;
                --success: #4ade80;
                --warning: #fbbf24;
            }
            * {
                box-sizing: border-box;
            }
            body {
                font-family: "Inter", "Segoe UI", system-ui, -apple-system, sans-serif;
                margin: 0;
                background: radial-gradient(circle at top, rgba(66, 227, 255, 0.2), transparent 45%),
                    radial-gradient(circle at 20% 20%, rgba(124, 92, 255, 0.25), transparent 35%),
                    var(--bg);
                color: var(--text);
                line-height: 1.6;
            }
            a {
                color: inherit;
                text-decoration: none;
            }
            .container {
                max-width: 1100px;
                margin: 0 auto;
                padding: 48px 24px 80px;
            }
            .hero {
                background: linear-gradient(135deg, rgba(124, 92, 255, 0.25), rgba(66, 227, 255, 0.2));
                border: 1px solid rgba(124, 92, 255, 0.35);
                border-radius: 24px;
                padding: 32px;
                display: grid;
                gap: 20px;
                box-shadow: 0 24px 70px rgba(0, 0, 0, 0.35);
            }
            .hero h1 {
                margin: 0;
                font-size: clamp(28px, 4vw, 40px);
            }
            .hero p {
                margin: 0;
                color: var(--muted);
                max-width: 720px;
            }
            .pill {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 6px 14px;
                border-radius: 999px;
                background: rgba(74, 222, 128, 0.15);
                color: var(--success);
                font-weight: 600;
                font-size: 14px;
                border: 1px solid rgba(74, 222, 128, 0.35);
                width: fit-content;
            }
            .actions {
                display: flex;
                flex-wrap: wrap;
                gap: 12px;
            }
            .btn {
                padding: 12px 18px;
                border-radius: 12px;
                border: 1px solid transparent;
                font-weight: 600;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
            }
            .btn:hover {
                transform: translateY(-1px);
                box-shadow: 0 10px 24px rgba(0, 0, 0, 0.3);
            }
            .btn-primary {
                background: linear-gradient(135deg, var(--accent), var(--accent-2));
                color: #0b0f1c;
            }
            .btn-outline {
                border-color: rgba(124, 92, 255, 0.6);
                color: var(--text);
                background: rgba(124, 92, 255, 0.12);
            }
            .grid {
                display: grid;
                gap: 20px;
                margin-top: 28px;
            }
            @media (min-width: 880px) {
                .grid {
                    grid-template-columns: repeat(3, 1fr);
                }
            }
            .card {
                background: var(--panel);
                border-radius: 18px;
                padding: 24px;
                border: 1px solid rgba(124, 92, 255, 0.25);
                box-shadow: 0 18px 50px rgba(0, 0, 0, 0.35);
            }
            .card h3 {
                margin-top: 0;
            }
            .card p,
            .card li {
                color: var(--muted);
            }
            .status-grid {
                display: grid;
                gap: 14px;
                margin-top: 16px;
            }
            .status-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 10px 14px;
                background: rgba(15, 23, 42, 0.6);
                border-radius: 12px;
                border: 1px solid rgba(148, 163, 184, 0.15);
            }
            .tag {
                font-weight: 700;
                color: var(--success);
            }
            .manifest-box {
                background: rgba(15, 23, 42, 0.8);
                padding: 14px;
                border-radius: 12px;
                border: 1px solid rgba(148, 163, 184, 0.2);
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            .manifest-box code {
                background: rgba(124, 92, 255, 0.12);
                color: var(--text);
                padding: 10px 12px;
                border-radius: 10px;
                overflow-wrap: anywhere;
            }
            .steps {
                list-style: none;
                padding: 0;
                margin: 0;
                display: grid;
                gap: 12px;
            }
            .step {
                padding: 12px 16px;
                background: rgba(15, 23, 42, 0.55);
                border-radius: 12px;
                border: 1px solid rgba(148, 163, 184, 0.2);
            }
            .discord {
                background: linear-gradient(135deg, rgba(88, 101, 242, 0.25), rgba(66, 227, 255, 0.12));
                border: 1px solid rgba(88, 101, 242, 0.4);
            }
            .footer {
                margin-top: 32px;
                text-align: center;
                color: rgba(148, 163, 184, 0.8);
                font-size: 14px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <section class="hero">
                <div class="pill">✅ READY TO USE — nincs konfiguráció</div>
                <h1>🇭🇺 HDMozi→RPM Magyar Addon v2.0</h1>
                <p>
                    Modern Stremio kiegészítő magyar filmekhez és sorozatokhoz. IMDB alapú automatikus
                    keresés, HDMozi scraping és RPM share stream kinyerés egy kattintással.
                </p>
                <div class="actions">
                    <a class="btn btn-primary" id="install-btn" href="${stremioInstallUrl}" rel="noopener">🚀 1‑kattintás Stremio telepítés</a>
                    <a class="btn btn-outline" href="/manifest.json">📋 Manifest megnyitása</a>
                    <a class="btn btn-outline" href="https://discord.gg/GnKRAwwdcQ" target="_blank" rel="noopener">💬 Discord közösség</a>
                </div>
                <div class="manifest-box">
                    <strong>Stremio manifest link</strong>
                    <code id="manifest-url">${manifestUrl}</code>
                    <button class="btn btn-outline" id="copy-btn" type="button">📎 Link másolása</button>
                </div>
            </section>

            <section class="grid">
                <div class="card">
                    <h3>📊 Rendszer státusz</h3>
                    <div class="status-grid">
                        <div class="status-item">
                            <span>TMDB API</span>
                            <span class="tag">✅ Hardcoded key</span>
                        </div>
                        <div class="status-item">
                            <span>HDMozi scraping</span>
                            <span class="tag">✅ Ready</span>
                        </div>
                        <div class="status-item">
                            <span>RPM Share</span>
                            <span class="tag">✅ M3U8 extraction</span>
                        </div>
                    </div>
                </div>

                <div class="card">
                    <h3>🔄 Stremio 1‑kattintás flow</h3>
                    <ul class="steps">
                        <li class="step">1. Stremio elküldi az IMDB ID-t (tt1234567 vagy tt1234567:1:5)</li>
                        <li class="step">2. TMDB API → cím + évad/epizód adatok</li>
                        <li class="step">3. HDMozi URL építés + scraping</li>
                        <li class="step">4. RPM Share ID → M3U8 + feliratok</li>
                        <li class="step">5. Stremio lejátszó azonnal indul</li>
                    </ul>
                </div>

                <div class="card discord">
                    <h3>💬 Közösség & támogatás</h3>
                    <p>
                        Csatlakozz a Discord közösséghez frissítésekért, hibajelentéshez vagy új ötletekhez.
                    </p>
                    <a class="btn btn-primary" href="https://discord.gg/GnKRAwwdcQ" target="_blank" rel="noopener">
                        🎧 Discord meghívó
                    </a>
                </div>
            </section>

            <section class="grid">
                <div class="card">
                    <h3>🧪 Teszt endpointok</h3>
                    <p><strong>IMDB (Stremio formátum):</strong></p>
                    <ul>
                        <li><a href="/stream/series/tt13623632:1:1.json">/stream/series/tt13623632:1:1.json</a> - Alien: Föld S01E01</li>
                        <li><a href="/stream/movie/tt28996126.json">/stream/movie/tt28996126.json</a> - Senki 2</li>
                    </ul>
                    <p><strong>Manuális tesztek:</strong></p>
                    <ul>
                        <li><a href="/test/imdb/tt13623632">/test/imdb/tt13623632</a> - Alien: Föld TMDB lookup</li>
                        <li><a href="/test/imdb/tt28996126">/test/imdb/tt28996126</a> - Senki 2 TMDB lookup</li>
                    </ul>
                </div>

                <div class="card">
                    <h3>⚡ Fő funkciók</h3>
                    <ul>
                        <li>🇭🇺 100% magyar tartalom (HDMozi forrás)</li>
                        <li>🎯 IMDB automatizmus, nincs kézi ID keresés</li>
                        <li>📺 Sorozat támogatás (Season/Episode parsing)</li>
                        <li>🎬 M3U8 streamek közvetlen lejátszással</li>
                        <li>📝 Felirat támogatás, ha elérhető</li>
                        <li>⚡ Gyors működés optimalizált workflow-val</li>
                    </ul>
                </div>

                <div class="card">
                    <h3>📱 1‑kattintás telepítés</h3>
                    <p>Nyisd meg Stremio-ban az alábbi gombbal vagy másold ki a manifest URL-t.</p>
                    <div class="actions">
                        <a class="btn btn-primary" id="install-btn-2" href="${stremioInstallUrl}" rel="noopener">➕ Addon telepítés</a>
                        <button class="btn btn-outline" id="copy-btn-2" type="button">📎 Manifest másolása</button>
                    </div>
                </div>
            </section>

            <div class="footer">HDMozi→RPM Magyar • Stremio addon • v2.0</div>
        </div>

        <script>
            const manifestUrl = '${manifestUrl}';

            const copyButtons = [document.getElementById('copy-btn'), document.getElementById('copy-btn-2')];
            copyButtons.forEach((button) => {
                if (!button) return;
                button.addEventListener('click', async () => {
                    try {
                        await navigator.clipboard.writeText(manifestUrl);
                        button.textContent = '✅ Manifest bemásolva';
                        setTimeout(() => {
                            button.textContent = button.id === 'copy-btn' ? '📎 Link másolása' : '📎 Manifest másolása';
                        }, 2000);
                    } catch (error) {
                        button.textContent = '⚠️ Másolás nem sikerült';
                    }
                });
            });
        </script>
    </body>
    </html>
    `);
  });
}

module.exports = {
  registerRoutes
};
