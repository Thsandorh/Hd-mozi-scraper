const { CONFIG } = require('../config');
const { getVideoInfo } = require('./rpm');

function createHdmoziUrl(mediaInfo, season = null, episode = null) {
  try {
    console.log(`🔗 Creating HDMozi URL from: "${mediaInfo.title}" (${mediaInfo.type})`);

    let urlTitle = mediaInfo.title
      .toLowerCase()
      .replace(/[áàâäã]/g, 'a')
      .replace(/[éèêë]/g, 'e')
      .replace(/[íìîï]/g, 'i')
      .replace(/[óòôöőõ]/g, 'o')
      .replace(/[úùûüűũ]/g, 'u')
      .replace(/[ýÿ]/g, 'y')
      .replace(/[ç]/g, 'c')
      .replace(/[ñ]/g, 'n')
      .replace(/[ß]/g, 'ss')
      .replace(/[\/\:\.\,\;\!\?\(\)\[\]]/g, '-')
      .replace(/[^a-z0-9\s\-]/g, '')
      .replace(/[\s\-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    let finalUrl;

    if (mediaInfo.type === 'movie') {
      finalUrl = `${CONFIG.hdmozi.baseUrl}/movies/${urlTitle}/`;
    } else if (mediaInfo.type === 'series' && season && episode) {
      finalUrl = `${CONFIG.hdmozi.baseUrl}/episodes/${urlTitle}-${season}x${episode}/`;
    } else if (mediaInfo.type === 'series') {
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

    const norm = (s) => s.toLowerCase()
      .replace(/[áàâäã]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[íìîï]/g, 'i')
      .replace(/[óòôöőõ]/g, 'o').replace(/[úùûüűũ]/g, 'u').replace(/[ýÿ]/g, 'y')
      .replace(/[ç]/g, 'c').replace(/[ñ]/g, 'n').replace(/[ß]/g, 'ss')
      .replace(/[^a-z0-9]+/g, ' ').trim();

    const targetTitle = norm(mediaInfo.title);

    const scored = results.map(r => {
      const rt = norm(r.title);
      let score = 0;
      if (rt === targetTitle) score += 100;
      else if (rt.includes(targetTitle) || targetTitle.includes(rt)) score += 60;
      if (mediaInfo.year && r.year) {
        const diff = Math.abs(mediaInfo.year - r.year);
        score += Math.max(0, 30 - diff * 10);
      }
      if (mediaInfo.type === r.type) score += 15;
      if (r.href.includes('/movies/') || r.href.includes('/series/')) score += 5;
      return { ...r, score };
    }).sort((a, b) => b.score - a.score);

    const best = scored[0];
    if (!best || best.score < 40) {
      console.log('⚠️ No good match from search, fallback to direct URL');
      return createHdmoziUrl(mediaInfo, season, episode);
    }

    let finalUrl = best.href;
    if (mediaInfo.type === 'series' && season && episode) {
      const href = best.href.replace(/\/$/, '');
      const lastSeg = href.split('/').pop();
      let seriesSlug;

      if (href.includes('/series/') || href.includes('/tvshows/')) {
        seriesSlug = lastSeg;
      } else if (href.includes('/episodes/')) {
        const mSlug = lastSeg.match(/(.+)-\d+x\d+$/);
        seriesSlug = mSlug ? mSlug[1] : lastSeg;
      } else {
        return createHdmoziUrl(mediaInfo, season, episode);
      }

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
      const m = hdmoziUrl.match(/\/episodes\/([^\/]+)-(\d+)x(\d+)\/?$/);
      if (response.status === 404 && m) {
        const seriesSlug = m[1];
        const season = m[2];
        const episode = m[3];

        const slugNoYear = seriesSlug.replace(/-\d{4}$/, '');
        if (slugNoYear !== seriesSlug) {
          const noYearUrl = `${CONFIG.hdmozi.baseUrl}/episodes/${slugNoYear}-${season}x${episode}/`;
          console.log(`🔁 Trying episode without year: ${noYearUrl}`);
          const noYearResp = await fetch(noYearUrl, { headers: { 'User-Agent': CONFIG.hdmozi.userAgent } });
          if (noYearResp.ok) {
            console.log(`✅ Episode without year exists, retrying scrape`);
            return await extractRpmIdFromHdmozi(noYearUrl);
          }
        }

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

    if (process.env.DEBUG_HDMOZI_HTML === '1') {
      const fs = require('fs');
      const path = require('path');
      const debugPath = path.join('/tmp', 'hdmozi_debug.html');
      fs.writeFileSync(debugPath, html);
      console.log(`💾 Saved HTML to ${debugPath} for inspection`);
    }

    {
      const iframeMatch = html.match(/<iframe[^>]*src=["'](?:https?:)?\/\/rpmshare\.rpmstream\.live\/#([a-zA-Z0-9_-]+)["'][^>]*>/i);
      if (iframeMatch) {
        console.log(`✅ RPM ID found in iframe src: ${iframeMatch[1]}`);
        return iframeMatch[1];
      }

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

    if (html.includes('rpmshare.rpmstream.live')) {
      console.log(`✅ RPM content found in HTML!`);

      const patterns = [
        /background-image:\s*url\([^)]*\/([a-zA-Z0-9_-]{5,})\//gi,
        /url\(&quot;\/([a-zA-Z0-9_-]{5,})\/tab\/[^&]*&quot;\)/gi,
        /\/([a-zA-Z0-9_-]{15,})\/tab\//gi,
        /player-button-container.*?background-image.*?url.*?\/([a-zA-Z0-9_-]{5,})\//gis,
        /\/tab\/([^\/]+)\//gi,
        /"id":"([a-zA-Z0-9_-]{5,})"/g,
        /"videoId":"([a-zA-Z0-9_-]{5,})"/g,
        /video_id"\s*:\s*"([a-zA-Z0-9_-]{5,})"/g,
        /id=([a-zA-Z0-9_-]{5,})/g
      ];

      for (const pattern of patterns) {
        const matches = [...html.matchAll(pattern)];
        console.log(`🔍 Pattern ${pattern.source} found ${matches.length} matches`);

        for (const match of matches) {
          const id = match[1];
          if (id && id.length >= 5) {
            console.log(`✅ Potential RPM ID: ${id}`);

            try {
              const videoInfo = await getVideoInfo(id);
              if (videoInfo && videoInfo.title) {
                console.log(`🎉 Valid RPM ID found: ${id} -> ${videoInfo.title}`);
                return id;
              }
            } catch (e) {
              console.log(`⚠️ ID ${id} invalid: ${e.message}`);
            }
          }
        }
      }
    }

    const dooPlayerId = await extractRpmIdFromDooPlayer(hdmoziUrl, html);
    if (dooPlayerId) {
      return dooPlayerId;
    }

    return await extractRpmIdFromHtml(html);
  } catch (error) {
    console.error(`❌ RPM ID extraction error: ${error.message}`);
    return null;
  }
}

function findVideaIdInHtml(html) {
  try {
    const match = html.match(/videa\.hu\/player\?v=([a-zA-Z0-9_-]+)/i);
    if (match) return match[1];

    const dataMatch = html.match(/data-video="([a-zA-Z0-9_-]+)"/i);
    if (dataMatch) return dataMatch[1];

    return null;
  } catch (_) {
    return null;
  }
}

async function extractRpmIdFromDooPlayer(hdmoziUrl, html) {
  try {
    const match = html.match(/doo_player_ajax\s*:\s*\{[^}]*"url"\s*:\s*"([^"]+)"[^}]*\}/i);
    if (!match) return null;

    const ajaxUrl = match[1].replace(/\\\//g, '/');
    console.log(`🎬 DooPlayer AJAX URL: ${ajaxUrl}`);

    const response = await fetch(ajaxUrl, {
      headers: {
        'User-Agent': CONFIG.hdmozi.userAgent,
        'Referer': hdmoziUrl,
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    if (!response.ok) {
      throw new Error(`DooPlayer AJAX failed: ${response.status}`);
    }

    const data = await response.json();

    if (data && data.embed_url) {
      const embed = data.embed_url;
      if (embed.includes('rpmshare.rpmstream.live/#')) {
        const rpmMatch = embed.match(/#([a-zA-Z0-9_-]+)/);
        if (rpmMatch) {
          console.log(`✅ RPM ID found in DooPlayer embed URL: ${rpmMatch[1]}`);
          return rpmMatch[1];
        }
      }

      if (embed.includes('videa.hu')) {
        const videaMatch = embed.match(/videa\.hu\/player\?v=([a-zA-Z0-9_-]+)/i);
        if (videaMatch) {
          return `videa:${videaMatch[1]}`;
        }
      }
    }

    return null;
  } catch (error) {
    console.log(`⚠️ DooPlayer extraction failed: ${error.message}`);
    return null;
  }
}

async function extractRpmIdFromHtml(html) {
  try {
    const idMatch = html.match(/"video_id"\s*:\s*"([a-zA-Z0-9_-]{5,})"/i);
    if (idMatch) {
      console.log(`✅ RPM ID found in HTML: ${idMatch[1]}`);
      return idMatch[1];
    }

    console.log(`❌ No RPM ID found with any pattern (likely JS-loaded)`);
    console.log(`🔍 HTML sample: ${html.substring(0, 500)}...`);

    console.log(`🔍 Searching for external JS files...`);
    const jsFiles = html.match(/<script[^>]*src=["']([^"']+)["'][^>]*>/gi) || [];
    console.log(`📜 Found ${jsFiles.length} external JS files:`);

    for (let i = 0; i < jsFiles.length; i++) {
      const srcMatch = jsFiles[i].match(/src=["']([^"']+)["']/);
      if (srcMatch) {
        console.log(`   JS ${i}: ${srcMatch[1]}`);
      }
    }

    console.log(`🔍 SUPER SIMPLE SEARCH - Looking for ANY potential IDs...`);
    console.log(`🔍 Looking for RPM iframe directly...`);

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

    const potentialIds = html.match(/[a-zA-Z0-9]{4,8}/g) || [];
    console.log(`🎯 Found ${potentialIds.length} potential ID candidates`);

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
      return !/^\d+$/.test(id) &&
        !htmlJunk.has(id) &&
        !/^(true|false|null|undefined|none|auto|left|right|top|bottom|center|middle)$/i.test(id) &&
        id.length >= 4 && id.length <= 8 &&
        /^[a-zA-Z0-9]+$/.test(id);
    });

    console.log(`🎯 After filtering: ${likelyIds.length} likely IDs`);
    console.log(`   First 20 candidates: ${likelyIds.slice(0, 20).join(', ')}`);

    const rpmCandidates = likelyIds.filter(id => {
      const hasNumbers = /\d/.test(id);
      const notCommonWord = !/^(Alien|online|filmek|sonline|ndash|robots|techblis|Platinum|shortcut)$/i.test(id);
      const looksLikeRpm = hasNumbers || (/[a-z]/.test(id) && /[A-Z]/.test(id)) || (/^[a-z]{5,8}$/.test(id));
      return notCommonWord && looksLikeRpm && id.length >= 5;
    });

    console.log(`🎯 RPM candidates: ${rpmCandidates.slice(0, 10).join(', ')}`);

    for (const testId of rpmCandidates.slice(0, 5)) {
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
