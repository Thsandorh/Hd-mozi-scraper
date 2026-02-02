const { CONFIG } = require('./config');
const { getVideoInfo } = require('./rpm');

// 🔍 HDMOZI URL CONSTRUCTION (Direct URLs)
function createHdmoziUrl(mediaInfo, season = null, episode = null) {
  try {
    console.log(`🔗 Creating HDMozi URL from: "${mediaInfo.title}" (${mediaInfo.type})`);

    // Normalize Hungarian title for URL path
    let urlTitle = mediaInfo.title
      .toLowerCase()
      // Hungarian specific characters
      .replace(/[áàâäã]/g, 'a')
      .replace(/[éèêë]/g, 'e')
      .replace(/[íìîï]/g, 'i')
      .replace(/[óòôöőõ]/g, 'o')
      .replace(/[úùûüűũ]/g, 'u')
      .replace(/[ýÿ]/g, 'y')
      .replace(/[ç]/g, 'c')
      .replace(/[ñ]/g, 'n')
      .replace(/[ß]/g, 'ss')
      // Convert special characters to dashes (including /, :, etc.)
      .replace(/[\/\:\.\,\;\!\?\(\)\[\]]/g, '-')
      // Remove other special characters
      .replace(/[^a-z0-9\s\-]/g, '')
      // Normalize spaces and multiple dashes to single dashes
      .replace(/[\s\-]+/g, '-')
      // Remove leading/trailing dashes
      .replace(/^-+|-+$/g, '');

    let finalUrl;

    if (mediaInfo.type === 'movie') {
      // Movies: https://hdmozi.hu/movies/jatsz-ma/
      finalUrl = `${CONFIG.hdmozi.baseUrl}/movies/${urlTitle}/`;
    } else if (mediaInfo.type === 'series' && season && episode) {
      // Episodes: https://hdmozi.hu/episodes/alien-fold-1x1/
      finalUrl = `${CONFIG.hdmozi.baseUrl}/episodes/${urlTitle}-${season}x${episode}/`;
    } else if (mediaInfo.type === 'series') {
      // Series page without specific episode
      finalUrl = `${CONFIG.hdmozi.baseUrl}/series/${urlTitle}/`;
    }

    if (finalUrl) {
      console.log(`✅ HDMozi URL: "${mediaInfo.title}" -> ${finalUrl}`);
      return finalUrl;
    }

    return null;
  } catch (error) {
    console.error(`❌ HDMozi URL construction error: ${error.message}`);
    return null;
  }
}

// 🔎 HDMOZI SEARCH-BASED URL RESOLVER (reduces 404 by using site search)
async function resolveHdmoziUrl(mediaInfo, season = null, episode = null) {
  try {
    const query = encodeURIComponent(mediaInfo.title);
    const searchUrl = `${CONFIG.hdmozi.baseUrl}/?s=${query}`;
    console.log(`🔎 HDMozi search: ${searchUrl}`);

    const resp = await fetch(searchUrl, {
      headers: {
        'User-Agent': CONFIG.hdmozi.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      }
    });
    if (!resp.ok) throw new Error(`HDMozi search failed: ${resp.status}`);

    const html = await resp.text();

    // Extract result blocks
    const results = [];
    const detailsPattern = /<div class="details">([\s\S]*?)<\/div>\s*<\/div>/gi;
    let m;
    while ((m = detailsPattern.exec(html)) !== null) {
      const block = m[1];
      const titleMatch = block.match(/<div class="title">\s*<a href="([^"]+)">([^<]+)<\/a>/i);
      if (!titleMatch) continue;
      const href = titleMatch[1];
      const title = titleMatch[2].trim();
      const yearMatch = block.match(/<span class="year">\s*(\d{4})\s*<\/span>/i);
      const year = yearMatch ? parseInt(yearMatch[1]) : null;
      const type = href.includes('/movies/') ? 'movie' : (
        (href.includes('/series/') || href.includes('/tvshows/') || href.includes('/episodes/')) ? 'series' : 'unknown'
      );
      results.push({ href, title, year, type, block });
    }

    if (!results.length) {
      console.log('⚠️ No search results, fallback to direct URL');
      return createHdmoziUrl(mediaInfo, season, episode);
    }

    // Normalization for matching
    const norm = (s) => s.toLowerCase()
      .replace(/[áàâäã]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[íìîï]/g, 'i')
      .replace(/[óòôöőõ]/g, 'o').replace(/[úùûüűũ]/g, 'u').replace(/[ýÿ]/g, 'y')
      .replace(/[ç]/g, 'c').replace(/[ñ]/g, 'n').replace(/[ß]/g, 'ss')
      .replace(/[^a-z0-9]+/g, ' ').trim();

    const targetTitle = norm(mediaInfo.title);

    // Score results
    const scored = results.map(r => {
      const rt = norm(r.title);
      let score = 0;
      if (rt === targetTitle) score += 100;              // exact normalized title
      else if (rt.includes(targetTitle) || targetTitle.includes(rt)) score += 60; // partial
      if (mediaInfo.year && r.year) {
        const diff = Math.abs(mediaInfo.year - r.year);
        score += Math.max(0, 30 - diff * 10); // prefer same year
      }
      if (mediaInfo.type === r.type) score += 15;        // type match
      // Prefer canonical paths
      if (r.href.includes('/movies/') || r.href.includes('/series/')) score += 5;
      return { ...r, score };
    }).sort((a, b) => b.score - a.score);

    const best = scored[0];
    if (!best || best.score < 40) {
      console.log('⚠️ No good match from search, fallback to direct URL');
      return createHdmoziUrl(mediaInfo, season, episode);
    }

    // Build final URL
    let finalUrl = best.href;
    if (mediaInfo.type === 'series' && season && episode) {
      // Derive base series slug from search result (supports /series/, /tvshows/, /episodes/)
      const href = best.href.replace(/\/$/, '');
      const lastSeg = href.split('/').pop();
      let seriesSlug;

      if (href.includes('/series/') || href.includes('/tvshows/')) {
        seriesSlug = lastSeg; // may include trailing -YYYY
      } else if (href.includes('/episodes/')) {
        // strip trailing -<season>x<episode>
        const mSlug = lastSeg.match(/(.+)-\d+x\d+$/);
        seriesSlug = mSlug ? mSlug[1] : lastSeg;
      } else {
        return createHdmoziUrl(mediaInfo, season, episode);
      }

      // Validate slug roughly matches target words
      const norm = (s) => s.toLowerCase()
        .replace(/[áàâäã]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[íìîï]/g, 'i')
        .replace(/[óòôöőõ]/g, 'o').replace(/[úùûüűũ]/g, 'u').replace(/[ýÿ]/g, 'y')
        .replace(/[ç]/g, 'c').replace(/[ñ]/g, 'n').replace(/[ß]/g, 'ss')
        .replace(/[^a-z0-9]+/g, ' ').trim();
      const slugWords = norm(seriesSlug.replace(/[-_]+/g, ' ')).split(/\s+/);
      const targetWords = norm(mediaInfo.title).split(/\s+/);
      const isShortSingleWord = targetWords.length === 1 && targetWords[0].length <= 4;
      const wordsMatch = isShortSingleWord
        ? slugWords.includes(targetWords[0])
        : targetWords.every(w => w.length <= 2 || slugWords.includes(w));

      if (!wordsMatch) {
        console.log(`⚠️ Search top result slug "${seriesSlug}" does not match target title words "${mediaInfo.title}", using direct slug URL instead.`);
        return createHdmoziUrl(mediaInfo, season, episode);
      }

      finalUrl = `${CONFIG.hdmozi.baseUrl}/episodes/${seriesSlug}-${season}x${episode}/`;
    }

    console.log(`✅ Resolved HDMozi URL via search: ${finalUrl}`);
    return finalUrl;

  } catch (e) {
    console.log(`⚠️ HDMozi search resolver failed: ${e.message}`);
    return createHdmoziUrl(mediaInfo, season, episode);
  }
}

// 🕷️ HDMOZI SCRAPING - EXTRACT RPM ID (Direct URL)
async function extractRpmIdFromHdmozi(hdmoziUrl) {
  try {
    console.log(`🕷️ Scraping HDMozi: ${hdmoziUrl}`);

    const response = await fetch(hdmoziUrl, {
      headers: {
        'User-Agent': CONFIG.hdmozi.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      }
    });

    if (!response.ok) {
      console.log(`⚠️ HDMozi returned ${response.status} for ${hdmoziUrl}`);
      // If this is an episodes URL and 404, try base series page to re-discover slug
      const m = hdmoziUrl.match(/\/episodes\/([^\/]+)-(\d+)x(\d+)\/?$/);
      if (response.status === 404 && m) {
        const seriesSlug = m[1];
        const season = m[2];
        const episode = m[3];

        // 1) Try same episode URL but without trailing year in slug
        const slugNoYear = seriesSlug.replace(/-\d{4}$/, '');
        if (slugNoYear !== seriesSlug) {
          const noYearUrl = `${CONFIG.hdmozi.baseUrl}/episodes/${slugNoYear}-${season}x${episode}/`;
          console.log(`🔁 Trying episode without year: ${noYearUrl}`);
          const noYearResp = await fetch(noYearUrl, { headers: { 'User-Agent': CONFIG.hdmozi.userAgent } });
          if (noYearResp.ok) {
            console.log('✅ Episode without year exists, retrying scrape');
            return await extractRpmIdFromHdmozi(noYearUrl);
          }
        }

        // 2) Try series pages under /tvshows/ and /series/ with/without year
        const candidates = [
          `${CONFIG.hdmozi.baseUrl}/tvshows/${seriesSlug}/`,
          `${CONFIG.hdmozi.baseUrl}/series/${seriesSlug}/`,
          ...(slugNoYear !== seriesSlug ? [
            `${CONFIG.hdmozi.baseUrl}/tvshows/${slugNoYear}/`,
            `${CONFIG.hdmozi.baseUrl}/series/${slugNoYear}/`
          ] : [])
        ];

        for (const seriesUrl of candidates) {
          console.log(`🔁 Trying series page to re-derive episode: ${seriesUrl}`);
          const seriesResp = await fetch(seriesUrl, { headers: { 'User-Agent': CONFIG.hdmozi.userAgent } });
          if (!seriesResp.ok) continue;
          const seriesHtml = await seriesResp.text();

          // Look for both with-year and without-year episode links
          const epNoYearRe = new RegExp(`/episodes/${slugNoYear}-0*${season}x0*${episode}/`, 'i');
          const epFullRe = new RegExp(`/episodes/${seriesSlug}-0*${season}x0*${episode}/`, 'i');
          if (epNoYearRe.test(seriesHtml)) {
            const fixedUrl = `${CONFIG.hdmozi.baseUrl}/episodes/${slugNoYear}-${season}x${episode}/`;
            console.log(`✅ Found episode link (no year), retrying: ${fixedUrl}`);
            return await extractRpmIdFromHdmozi(fixedUrl);
          }
          if (epFullRe.test(seriesHtml)) {
            const fixedUrl = `${CONFIG.hdmozi.baseUrl}/episodes/${seriesSlug}-${season}x${episode}/`;
            console.log(`✅ Found episode link (with year), retrying: ${fixedUrl}`);
            return await extractRpmIdFromHdmozi(fixedUrl);
          }
        }
      }
      throw new Error(`HDMozi request failed: ${response.status}`);
    }

    const html = await response.text();
    console.log(`📄 Got HDMozi HTML (${html.length} chars)`);

    // DEBUG: Save HTML to file when explicitly enabled (use /tmp on serverless)
    if (process.env.DEBUG_HDMOZI_HTML === '1') {
      const fs = require('fs');
      const path = require('path');
      const debugPath = path.join('/tmp', 'hdmozi_debug.html');
      fs.writeFileSync(debugPath, html);
      console.log(`💾 Saved HTML to ${debugPath} for inspection`);
    }

    // 1) Try to extract RPM ID directly from iframe/src
    {
      // Match protocol-relative and absolute forms
      const iframeMatch = html.match(/<iframe[^>]*src=["'](?:https?:)?\/\/rpmshare\.rpmstream\.live\/#([a-zA-Z0-9_-]+)["'][^>]*>/i);
      if (iframeMatch) {
        console.log(`✅ RPM ID found in iframe src: ${iframeMatch[1]}`);
        return iframeMatch[1];
      }

      // More general src capture, then parse fragment
      const srcMatch = html.match(/src=["']([^"']*rpmshare\.rpmstream\.live[^"']*)["']/i);
      if (srcMatch) {
        try {
          const raw = srcMatch[1];
          const normalized = raw.startsWith('//') ? `https:${raw}` : raw;
          const urlObj = new URL(normalized);
          const frag = (urlObj.hash || '').replace(/^#/, '');
          if (frag) {
            console.log(`✅ RPM ID found from URL fragment: ${frag}`);
            return frag;
          }
        } catch (e) {
          console.log(`⚠️ Failed to parse src URL: ${e.message}`);
        }
      }
    }

    // If not found in static HTML, continue with legacy domain checks below
    if (html.includes('rpmshare.rpmstream.live')) {
      console.log('✅ RPM content found in HTML!');

      // Try simple regex patterns
      const patterns = [
        /rpmshare\.rpmstream\.live\/#([a-zA-Z0-9]+)/,
        /\/\/rpmshare\.rpmstream\.live\/#([a-zA-Z0-9]+)/,
        /https?:\/\/rpmshare\.rpmstream\.live\/#([a-zA-Z0-9]+)/,
        /src=["'][^"']*rpmshare\.rpmstream\.live\/#([a-zA-Z0-9]+)["']/
      ];

      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) {
          console.log(`✅ Found RPM ID with simple pattern: ${match[1]}`);
          return match[1];
        }
      }
    }

    console.log('🎬 Trying DooPlayer API since JS loads content dynamically...');
    const dooPlayerRpm = await extractRpmIdFromDooPlayer(hdmoziUrl, html);
    if (dooPlayerRpm) {
      console.log(`✅ DooPlayer API returned RPM ID: ${dooPlayerRpm}`);
      return dooPlayerRpm;
    }

    console.log('❌ No RPM ID found with simple patterns, trying complex...');
    return await extractRpmIdFromHtml(html);

  } catch (error) {
    console.error(`❌ HDMozi scraping error: ${error.message}`);
    return null;
  }
}

// 🔎 Detect Videa embed and extract ID
function findVideaIdInHtml(html) {
  const patterns = [
    /<iframe[^>]*src=["'](?:https?:)?\/\/(?:www\.)?videa\.hu\/player\?[^"']*v=([A-Za-z0-9_-]{6,})[^"']*["'][^>]*>/i,
    /https?:\/\/(?:www\.)?videa\.hu\/player\?[^"'\s>]*v=([A-Za-z0-9_-]{6,})/i,
    /(?:https?:)?\/\/(?:www\.)?videa\.hu\/player\?[^"'\s>]*v=([A-Za-z0-9_-]{6,})/i
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) return m[1];
  }
  return null;
}

// 🎬 Extract RPM ID from DooPlayer API (WordPress dynamic loading)
async function extractRpmIdFromDooPlayer(hdmoziUrl, html) {
  try {
    // Extract post ID from HTML (look in data attributes and IDs)
    const postIdMatch = html.match(/data-post\s*=\s*['"](\d+)['"]/) ||
                        html.match(/post_id['"]\s*:\s*['"]*(\d+)['"]*/) ||
                        html.match(/"post"\s*:\s*(\d+)/) ||
                        html.match(/postid['"]\s*:\s*['"]*(\d+)['"]*/) ||
                        html.match(/wp-post-(\d+)/) ||
                        html.match(/<[^>]*data-post\s*=\s*['"](\d+)['"][^>]*>/) ||
                        html.match(/player-option[^>]*data-post\s*=\s*['"](\d+)['"]/);

    if (!postIdMatch) {
      console.log('❌ No post ID found for DooPlayer API');
      // Debug: look for player elements more broadly
      const playerElements = html.match(/<li[^>]*player-option[^>]*>/g) || [];
      console.log(`🔍 Found ${playerElements.length} player elements:`);
      playerElements.forEach((el, i) => {
        console.log(`   Player ${i}: ${el.substring(0, 100)}...`);
      });
      return null;
    }

    const postId = postIdMatch[1];
    console.log(`🆔 Found post ID: ${postId}`);

    // Parse dtAjax config block if present (choose correct endpoint)
    let adminAjaxUrl = null;
    let restApiUrl = null;
    let playMethod = null;
    try {
      const dtAjaxBlock = html.match(/var\s+dtAjax\s*=\s*(\{[\s\S]*?\})\s*;/i) || html.match(/dtAjax\s*=\s*(\{[\s\S]*?\})/i);
      if (dtAjaxBlock && dtAjaxBlock[1]) {
        const raw = dtAjaxBlock[1].replace(/\\\//g, '/');
        const json = JSON.parse(raw);
        adminAjaxUrl = json.url ? json.url : null;          // e.g. "/wp-admin/admin-ajax.php"
        restApiUrl = json.player_api ? json.player_api : null; // e.g. "https://.../wp-json/dooplayer/v2/"
        playMethod = json.play_method ? String(json.play_method).toLowerCase() : null; // "admin_ajax"|"rest_api"
        console.log(`🧭 dtAjax parsed: play_method=${playMethod}, url=${adminAjaxUrl}, player_api=${restApiUrl}`);
      }
    } catch (e) {
      console.log(`⚠️ Failed to parse dtAjax: ${e.message}`);
    }

    // Helper to absolutize URLs
    const absolutize = (u) => {
      if (!u) return null;
      if (u.startsWith('http://') || u.startsWith('https://')) return u;
      if (u.startsWith('//')) return `https:${u}`;
      try {
        return new URL(u, 'https://hdmozi.hu').href;
      } catch { return u; }
    };

    // Decide endpoint: prefer admin-ajax when available, fallback to player_api, then hardcoded admin-ajax
    let apiUrl = null;
    if (playMethod && playMethod.includes('admin') && adminAjaxUrl) {
      apiUrl = absolutize(adminAjaxUrl);
    } else if (restApiUrl) {
      apiUrl = absolutize(restApiUrl);
    }
    if (!apiUrl) apiUrl = 'https://hdmozi.hu/wp-admin/admin-ajax.php';

    console.log(`🔗 DooPlayer chosen endpoint: ${apiUrl}`);

    // Detect type: tv for episode URLs, else movie; override if data-type available
    let dooType = /\/episodes\//.test(hdmoziUrl) ? 'tv' : 'movie';
    const typeMatch = html.match(/player-option[^>]*data-type=['"](\w+)['"]/i);
    if (typeMatch) {
      dooType = typeMatch[1].toLowerCase();
    }
    console.log(`🎚️ DooPlayer type: ${dooType}`);

    // Gather available player numbers from DOM, fallback to 1..5
    const numSet = new Set();
    (html.match(/player-option-([0-9]+)/g) || []).forEach(m => {
      const n = parseInt(m.split('-').pop());
      if (!isNaN(n)) numSet.add(n);
    });
    (html.match(/data-nume=['"](\d+)['"]/gi) || []).forEach(m => {
      const n = parseInt((m.match(/['"](\d+)['"]/) || [])[1]);
      if (!isNaN(n)) numSet.add(n);
    });
    const playersToTry = numSet.size ? Array.from(numSet).sort((a, b) => a - b) : [1, 2, 3, 4, 5];
    console.log(`🎛️ Players to try: ${playersToTry.join(', ')}`);

    // Try player options
    for (const playerNum of playersToTry) {
      try {
        console.log(`🎬 Trying player option ${playerNum} at ${apiUrl}...`);

        const form = new URLSearchParams({
          'action': 'doo_player_ajax',
          'post': String(postId),
          'nume': String(playerNum),
          'type': dooType
        });

        const apiResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'hu-HU,hu;q=0.9,en-US;q=0.8,en;q=0.7',
            'Origin': 'https://hdmozi.hu',
            'Referer': hdmoziUrl,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: form
        });

        console.log(`🌐 API Response status: ${apiResponse.status} ${apiResponse.statusText}`);

        if (apiResponse.ok) {
          const apiData = await apiResponse.text();
          console.log(`📋 API Response ${playerNum} (${apiData.length} chars)`);

          // Save each response for debugging
          try { require('fs').writeFileSync(`doo_response_${playerNum}.html`, apiData); } catch {}

          // Try to parse as JSON first (DooPlayer returns JSON)
          try {
            const jsonResponse = JSON.parse(apiData);
            if (jsonResponse && jsonResponse.embed_url) {
              console.log(` Found embed_url in JSON: ${jsonResponse.embed_url}`);
              // Extract Videa ID from embed_url, support protocol-relative URLs
              const videaIdFromJson = findVideaIdInHtml(jsonResponse.embed_url);
              if (videaIdFromJson) {
                console.log(`✅ Found Videa ID from DooPlayer JSON ${playerNum}: ${videaIdFromJson}`);
                return `videa:${videaIdFromJson}`;
              }
            }
          } catch (jsonError) {
            console.log('⚠️ Not a JSON response, trying HTML parsing...');
          }

          // Quick check for RPM content in API response
          const simpleRpmMatch = apiData.match(/rpmshare\.rpmstream\.live\/#([a-zA-Z0-9]+)/);
          if (simpleRpmMatch) {
            console.log(`✅ Found RPM ID from DooPlayer API (simple): ${simpleRpmMatch[1]}`);
            return simpleRpmMatch[1];
          }
          const rpmId = await extractRpmIdFromHtml(apiData);
          if (rpmId) {
            console.log(`✅ Found RPM ID from DooPlayer API (complex): ${rpmId}`);
            return rpmId;
          }
          // Fallback: try to extract Videa ID from HTML response
          const videaIdFromHtmlA = findVideaIdInHtml(apiData);
          if (videaIdFromHtmlA) {
            console.log(`✅ Found Videa ID from DooPlayer HTML ${playerNum}: ${videaIdFromHtmlA}`);
            return `videa:${videaIdFromHtmlA}`;
          }

        } else {
          console.log(`❌ API request failed: ${apiResponse.status}`);
        }
      } catch (playerError) {
        console.log(`⚠️ Player ${playerNum} failed: ${playerError.message}`);
      }
    }

    // Fallback: If REST API exists and we used admin-ajax, try REST as a last resort
    if (restApiUrl && (!playMethod || playMethod.includes('admin'))) {
      try {
        const restEndpoint = absolutize(restApiUrl);
        console.log(`🧪 Fallback to REST endpoint: ${restEndpoint}`);
        const restResp = await fetch(restEndpoint, { headers: { 'Referer': hdmoziUrl } });
        if (restResp.ok) {
          const data = await restResp.text();
          const rpmId = await extractRpmIdFromHtml(data);
          if (rpmId) return rpmId;
        }
      } catch (e) {
        console.log(`⚠️ REST fallback failed: ${e.message}`);
      }
    }

    return null;

  } catch (error) {
    console.error(`❌ DooPlayer API error: ${error.message}`);
    return null;
  }
}

// 🔍 Extract RPM ID from HTML content
async function extractRpmIdFromHtml(html) {
  try {
    // Enhanced RPM ID patterns (more specific to avoid false positives)
    const rpmPatterns = [
      // Primary iframe and URL patterns (support protocol-relative and JSON-escaped slashes)
      /<iframe[^>]*src=["'](?:https?:)?(?:\\\/|\/){2}rpmshare\.rpmstream\.live(?:\\\/|\/)#([a-zA-Z0-9]{4,})["'][^>]*>/gi,
      /(?:https?:)?(?:\\\/|\/){2}rpmshare\.rpmstream\.live(?:\\\/|\/)#([a-zA-Z0-9]{4,})/gi,
      /rpmshare\.rpmstream\.live(?:\\\/|\/)#([a-zA-Z0-9]{4,})/gi,
      // Generic RPM paths (escaped and unescaped)
      /rpmshare\.rpmstream\.live(?:\\\/|\/)(?:video|watch|embed)(?:\\\/|\/)\b([a-zA-Z0-9]{4,})\b/gi,
      /rpmshare\.rpmstream\.live\/([a-zA-Z0-9]{4,})/g,
      /rpmshare\.rpmstream\.live\/video\/([a-zA-Z0-9]{4,})/g,
      /rpmshare\.rpmstream\.live\/watch\/([a-zA-Z0-9]{4,})/g,
      /rpmshare\.rpmstream\.live\/embed\/([a-zA-Z0-9]{4,})/g,
      /rpmshare\.rpmstream\.live[^"']*id=([a-zA-Z0-9]{4,})/g,
      /rpm[_-]?share[_-]([a-zA-Z0-9]{4,})/gi,
      /data-rpm-id=['"]([a-zA-Z0-9]{4,})['"]/gi,
      /rpm[_-]?id['"]\s*:\s*['"]([a-zA-Z0-9]{4,})['"]/gi,
      /rpm['"]\s*:\s*['"]([a-zA-Z0-9]{4,})['"]/gi,
      // Background image patterns (for dynamic player content)
      /background-image:\s*url\([^)]*\/([a-zA-Z0-9_-]{15,})\/[^)]*\)/gi,
      /url\(&quot;\/([a-zA-Z0-9_-]{15,})\/tab\/[^&]*&quot;\)/gi,
      /\/([a-zA-Z0-9_-]{20,})\/tab\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\//gi,
      // More specific patterns to avoid "000000" and similar
      /rpm\/([a-z0-9]{4,8})[^a-z0-9]/gi,
      /player[^"']*\/([a-z0-9]{4,8})['"]/gi,
      /stream[^"']*\/([a-z0-9]{4,8})['"]/gi
    ];

    console.log('🔍 Searching for RPM ID in HTML...');

    // First, let's see if we can find the iframe at all
    const iframeCheck = html.includes('rpmshare.rpmstream.live');
    console.log(`🔍 Contains rpmshare.rpmstream.live: ${iframeCheck}`);

    if (iframeCheck) {
      // Extract the exact iframe line for debugging
      const iframeMatch = html.match(/<iframe[^>]*rpmshare\.rpmstream\.live[^>]*>/i);
      if (iframeMatch) {
        console.log(`🎬 Found iframe: ${iframeMatch[0]}`);
      }

      // Try the simplest possible pattern first (also support JSON-escaped slashes)
      const simpleMatch = html.match(/rpmshare\.rpmstream\.live(?:\\\/|\/)#([a-zA-Z0-9]+)/);
      if (simpleMatch) {
        console.log(`✅ Simple pattern match: ${simpleMatch[1]}`);
        return simpleMatch[1];
      }
    }

    for (const pattern of rpmPatterns) {
      const matches = [...html.matchAll(pattern)];
      console.log(`🔍 Pattern ${pattern.source}: ${matches.length} matches`);

      if (matches.length > 0) {
        for (let i = 0; i < matches.length; i++) {
          const rpmId = matches[i][1];
          console.log(`   Match ${i}: "${rpmId}" (full: "${matches[i][0].substring(0, 100)}")`);

          // Filter out common false positives
          if (rpmId === '000000' || rpmId === '111111' || rpmId === '123456' ||
              rpmId.match(/^0+$/) || rpmId.match(/^1+$/) || rpmId.length < 4 ||
              rpmId.includes('wp-content') || rpmId.includes('assets') ||
              rpmId.includes('uploads')) {
            console.log(`   ⚠️  Skipping false positive RPM ID: ${rpmId}`);
            continue;
          }

          console.log(`✅ Found RPM ID: ${rpmId} (pattern: ${pattern.source})`);
          return rpmId;
        }
      }
    }

    // Look in embedded scripts
    const scriptPattern = /<script[^>]*>(.*?)<\/script>/gs;
    const scripts = [...html.matchAll(scriptPattern)];

    for (const scriptMatch of scripts) {
      const scriptContent = scriptMatch[1];
      for (const pattern of rpmPatterns) {
        const matches = [...scriptContent.matchAll(pattern)];
        if (matches.length > 0) {
          const rpmId = matches[0][1];
          console.log(`✅ Found RPM ID in script: ${rpmId}`);
          return rpmId;
        }
      }
    }

    // Look for JavaScript that might load the player
    console.log('🔍 Searching for JavaScript player loading...');

    // Search for AJAX endpoints, player IDs, or other clues
    const jsPatterns = [
      /ajax[^"']*player[^"']*url[^"']*["']([^"']*)/gi,
      /player[^"']*ajax[^"']*["']([^"']*)/gi,
      /load[^"']*player[^"']*["']([^"']*)/gi,
      /rpm[^"']*["']([a-zA-Z0-9]{4,})["']/gi,
      /player[^"']*id[^"']*["']([a-zA-Z0-9]{4,})["']/gi,
      /data-player[^"']*["']([^"']*)/gi,
      /data-source[^"']*["']([^"']*)/gi,
      /video[^"']*source[^"']*["']([^"']*)/gi
    ];

    for (const pattern of jsPatterns) {
      const matches = [...html.matchAll(pattern)];
      if (matches.length > 0) {
        console.log(`🔍 JS Pattern ${pattern.source}: found ${matches.length} matches`);
        matches.forEach((match, i) => {
          console.log(`   JS Match ${i}: "${match[1]}"`);
        });
      }
    }

    // Look for potential player container IDs or class names
    const playerContainerMatches = html.match(/class=["'][^"']*player[^"']*["']/gi) || [];
    const idContainerMatches = html.match(/id=["'][^"']*player[^"']*["']/gi) || [];

    if (playerContainerMatches.length > 0) {
      console.log(`🎬 Found player containers: ${playerContainerMatches.join(', ')}`);
    }
    if (idContainerMatches.length > 0) {
      console.log(`🎬 Found player IDs: ${idContainerMatches.join(', ')}`);
    }

    // Look in script tags for any clues
    const scriptTags = html.match(/<script[^>]*>(.*?)<\/script>/gis) || [];
    console.log(`📜 Found ${scriptTags.length} script tags, searching for RPM references...`);

    for (let i = 0; i < Math.min(scriptTags.length, 10); i++) {
      const script = scriptTags[i];
      if (script.includes('k6nwn')) {
        console.log(`📜 Script ${i} contains k6nwn! FOUND IT!`);
        console.log(`    Full script content: ${script}`);

        // Extract k6nwn from this script
        const k6nwnExtract = script.match(/k6nwn/gi);
        if (k6nwnExtract) {
          console.log('✅ Successfully extracted k6nwn from script!');
          return 'k6nwn';
        }
      } else if (script.includes('rpm') || script.includes('player')) {
        console.log(`📜 Script ${i} contains RPM/player keywords`);
        console.log(`    ${script.substring(0, 300)}...`);
      }
    }

    console.log('❌ No RPM ID found with any pattern (likely JS-loaded)');
    console.log(`🔍 HTML sample: ${html.substring(0, 500)}...`);

    // Find JS files that might load the iframe dynamically
    console.log('🔍 Searching for external JS files...');
    const jsFiles = html.match(/<script[^>]*src=["']([^"']+)["'][^>]*>/gi) || [];
    console.log(`📜 Found ${jsFiles.length} external JS files:`);

    for (let i = 0; i < jsFiles.length; i++) {
      const srcMatch = jsFiles[i].match(/src=["']([^"']+)["']/);
      if (srcMatch) {
        console.log(`   JS ${i}: ${srcMatch[1]}`);
      }
    }

    // SUPER SIMPLE SEARCH - Just look for ANY 5-8 character alphanumeric string
    console.log('🔍 SUPER SIMPLE SEARCH - Looking for ANY potential IDs...');

    // Look for RPM iframe first (most direct method)
    console.log('🔍 Looking for RPM iframe directly...');

    // More flexible regex that handles both // and https:// protocols
    const iframePatterns = [
      /<iframe[^>]*src=["'](?:https?:)?\/\/rpmshare\.rpmstream\.live\/#([a-zA-Z0-9]+)["'][^>]*>/i,
      /src=["']\/\/rpmshare\.rpmstream\.live\/#([a-zA-Z0-9]+)["']/i,
      /rpmshare\.rpmstream\.live\/#([a-zA-Z0-9]+)/i
    ];

    for (const pattern of iframePatterns) {
      const match = html.match(pattern);
      if (match) {
        console.log(`🎉 FOUND RPM ID: ${match[1]} (pattern: ${pattern.source})`);
        return match[1];
      }
    }

    // Look for any 4-8 char alphanumeric strings that could be IDs (extended range)
    const potentialIds = html.match(/[a-zA-Z0-9]{4,8}/g) || [];
    console.log(`🎯 Found ${potentialIds.length} potential ID candidates`);

    // Filter for likely video IDs (exclude HTML junk)
    const htmlJunk = new Set([
      'DOCTYPE', 'prefix', 'charset', 'apple', 'touch', 'hdmozi', 'content', 'uploads', 'smile',
      'mobile', 'capable', 'status', 'style', 'black', 'theme', 'color', 'viewport', 'width',
      'height', 'device', 'initial', 'scale', 'shrink', 'title', 'property', 'description',
      'image', 'locale', 'updated', 'time', 'author', 'section', 'published', 'favicon',
      'icon', 'sizes', 'type', 'script', 'window', 'https', 'jQuery', 'ready', 'function',
      'document', 'length', 'version', 'async', 'defer', 'onload', 'innerHTML', 'getElementById',
      'className', 'setAttribute', 'getAttribute', 'appendChild', 'createElement'
    ]);

    const likelyIds = potentialIds.filter(id => {
      // Exclude pure numbers, HTML junk, and common words
      return !/^\d+$/.test(id) &&
             !htmlJunk.has(id) &&
             !/^(true|false|null|undefined|none|auto|left|right|top|bottom|center|middle)$/i.test(id) &&
             id.length >= 4 && id.length <= 8 &&
             /^[a-zA-Z0-9]+$/.test(id); // Only alphanumeric
    });

    console.log(`🎯 After filtering: ${likelyIds.length} likely IDs`);
    console.log(`   First 20 candidates: ${likelyIds.slice(0, 20).join(', ')}`);

    // Look for likely RPM IDs (5-8 chars, can be all lowercase like "xmkjy")
    const rpmCandidates = likelyIds.filter(id => {
      const hasNumbers = /\d/.test(id);
      const notCommonWord = !/^(Alien|online|filmek|sonline|ndash|robots|techblis|Platinum|shortcut)$/i.test(id);
      // Accept if it has numbers OR is mixed case OR is all lowercase (RPM sometimes uses all-lowercase like xmkjy)
      const looksLikeRpm = hasNumbers || (/[a-z]/.test(id) && /[A-Z]/.test(id)) || (/^[a-z]{5,8}$/.test(id));
      return notCommonWord && looksLikeRpm && id.length >= 5;
    });

    console.log(`🎯 RPM candidates: ${rpmCandidates.slice(0, 10).join(', ')}`);



    // Test the most promising candidates first
    for (const testId of rpmCandidates.slice(0, 5)) { // Test top 5
      try {
        console.log(`🧪 Testing promising RPM ID: ${testId}`);
        const testResult = await getVideoInfo(testId);
        if (testResult && testResult.title) {
          console.log(`🎉 WORKING RPM ID FOUND: ${testId} -> ${testResult.title}`);
          return testId;
        }
      } catch (error) {
        console.log(`   ❌ ${testId} failed: ${error.message}`);
      }
    }

    return null;

  } catch (error) {
    console.error(`❌ RPM ID extraction error: ${error.message}`);
    return null;
  }
}

module.exports = {
  createHdmoziUrl,
  resolveHdmoziUrl,
  extractRpmIdFromHdmozi,
  findVideaIdInHtml,
  extractRpmIdFromDooPlayer,
  extractRpmIdFromHtml
};
