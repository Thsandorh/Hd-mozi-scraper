function renderHomePage(manifestUrl) {
  const installUrl = `stremio://install?manifest=${encodeURIComponent(manifestUrl)}`;
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>HDMozi→RPM Magyar</title>
        <style>
          :root {
            color-scheme: dark;
            --bg: #0b0f17;
            --card: #121826;
            --card-2: #161f32;
            --border: #243047;
            --text: #e6edf7;
            --muted: #a0aec0;
            --accent: #61dafb;
            --accent-2: #22c55e;
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: "Inter", "Segoe UI", system-ui, -apple-system, sans-serif;
            background: radial-gradient(circle at top, #1a2236, #0b0f17 55%);
            color: var(--text);
          }
          a { color: inherit; text-decoration: none; }
          .container {
            max-width: 1100px;
            margin: 0 auto;
            padding: 32px 20px 64px;
          }
          header {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }
          .badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 12px;
            border-radius: 999px;
            background: rgba(34, 197, 94, 0.15);
            border: 1px solid rgba(34, 197, 94, 0.35);
            color: #8fffc1;
            font-size: 0.85rem;
            font-weight: 600;
            width: fit-content;
          }
          .hero {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 24px;
            margin-top: 24px;
          }
          .hero h1 {
            font-size: clamp(2rem, 3vw, 3rem);
            margin: 0;
          }
          .hero p {
            color: var(--muted);
            font-size: 1.05rem;
            line-height: 1.6;
          }
          .card {
            background: linear-gradient(145deg, var(--card), var(--card-2));
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 20px;
            box-shadow: 0 14px 40px rgba(0, 0, 0, 0.3);
          }
          .cta-group {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            margin-top: 16px;
          }
          .btn {
            border: none;
            padding: 12px 18px;
            border-radius: 10px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.15s ease, box-shadow 0.15s ease;
          }
          .btn-primary {
            background: var(--accent);
            color: #0b0f17;
            box-shadow: 0 10px 24px rgba(97, 218, 251, 0.3);
          }
          .btn-secondary {
            background: transparent;
            border: 1px solid var(--border);
            color: var(--text);
          }
          .btn-discord {
            background: linear-gradient(135deg, #5865f2, #4752c4);
            color: #f4f6ff;
            box-shadow: 0 10px 24px rgba(88, 101, 242, 0.35);
          }
          .btn:hover { transform: translateY(-1px); }
          .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 16px;
            margin-top: 24px;
          }
          .list {
            display: grid;
            gap: 12px;
            margin: 0;
            padding: 0;
            list-style: none;
            color: var(--muted);
          }
          .pill {
            display: inline-flex;
            align-items: center;
            padding: 6px 12px;
            border-radius: 999px;
            background: rgba(97, 218, 251, 0.15);
            border: 1px solid rgba(97, 218, 251, 0.3);
            font-size: 0.85rem;
            font-weight: 600;
            color: var(--accent);
          }
          .manifest {
            display: flex;
            align-items: center;
            gap: 12px;
            background: #0d1524;
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 12px;
            margin-top: 12px;
          }
          .manifest input {
            flex: 1;
            background: transparent;
            border: none;
            color: var(--text);
            font-size: 0.95rem;
          }
          .manifest input:focus { outline: none; }
          footer {
            margin-top: 40px;
            color: var(--muted);
            font-size: 0.85rem;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <header>
            <span class="badge">✅ Live & ready — no config required</span>
            <div class="hero">
              <div>
                <h1>HDMozi → RPM Magyar</h1>
                <p>
                  A Stremio addon for Hungarian movies and series from HDMozi, with
                  automatic RPM extraction and IMDB-based matching.
                </p>
                <div class="cta-group">
                  <a class="btn btn-primary" href="${installUrl}">Add to Stremio</a>
                  <a class="btn btn-secondary" href="/manifest.json">View Manifest</a>
                  <a class="btn btn-discord" href="https://discord.gg/wAqzj96Shz" target="_blank" rel="noreferrer">Join Discord</a>
                </div>
              </div>
              <div class="card">
                <span class="pill">Manifest URL</span>
                <div class="manifest">
                  <input id="manifestUrl" readonly value="${manifestUrl}" />
                  <button class="btn btn-secondary" id="copyManifest">Copy</button>
                </div>
                <p style="color: var(--muted); margin-top: 12px;">
                  Use the manifest URL inside Stremio or share it with friends.
                </p>
              </div>
            </div>
          </header>

          <section class="grid">
            <div class="card">
              <h3>Workflow</h3>
              <ul class="list">
                <li>1. Stremio sends IMDB ID (tt1234567 or tt1234567:1:5).</li>
                <li>2. TMDB lookup resolves the title and season/episode.</li>
                <li>3. HDMozi search builds the best matching URL.</li>
                <li>4. RPM Share extraction returns playable HLS streams.</li>
              </ul>
            </div>
            <div class="card">
              <h3>Quick tests</h3>
              <ul class="list">
                <li><a href="/stream/series/tt13623632:1:1.json">Alien: Earth S01E01</a></li>
                <li><a href="/stream/movie/tt28996126.json">Nobody 2</a></li>
                <li><a href="/test/imdb/tt13623632">TMDB lookup (series)</a></li>
                <li><a href="/test/imdb/tt28996126">TMDB lookup (movie)</a></li>
              </ul>
            </div>
            <div class="card">
              <h3>Features</h3>
              <ul class="list">
                <li>Hungarian catalog via HDMozi.</li>
                <li>Automatic IMDB-based matching.</li>
                <li>Series season/episode support.</li>
                <li>HLS streams with subtitle passthrough.</li>
              </ul>
            </div>
          </section>

          <footer>
            Powered by HDMozi scraping, TMDB lookup, and RPM Share decryption.
          </footer>
        </div>

        <script>
          const copyButton = document.getElementById('copyManifest');
          const manifestInput = document.getElementById('manifestUrl');
          copyButton.addEventListener('click', async () => {
            try {
              await navigator.clipboard.writeText(manifestInput.value);
              copyButton.textContent = 'Copied!';
              setTimeout(() => (copyButton.textContent = 'Copy'), 1600);
            } catch (err) {
              manifestInput.select();
              document.execCommand('copy');
              copyButton.textContent = 'Copied!';
              setTimeout(() => (copyButton.textContent = 'Copy'), 1600);
            }
          });
        </script>
      </body>
    </html>
  `;
}

module.exports = { renderHomePage };
