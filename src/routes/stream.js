const express = require('express');
const { extractStreamFromImdb } = require('../services/stream');
const { buildStremioStreams } = require('../services/stremio');

const router = express.Router();

router.get('/stream/:type/:id.json', async (req, res) => {
  try {
    const { type, id } = req.params;
    console.log(`🎬 Stremio stream request: ${type} - ${id}`);

    let imdbId;
    let season;
    let episode;

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

    const result = await extractStreamFromImdb(imdbId, season, episode);

    res.json({
      streams: buildStremioStreams(result)
    });
  } catch (error) {
    console.error(`❌ Stremio endpoint error: ${error.message}`);
    res.json({ streams: [] });
  }
});

module.exports = router;
