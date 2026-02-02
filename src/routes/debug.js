const express = require('express');

const router = express.Router();

router.get('/debug/html', async (req, res) => {
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
      playerContainer: html.match(/player-button-container[^>]*>.*?<\/div>/s)?.[0]?.substring(0, 500)
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
