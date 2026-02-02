const express = require('express');
const { extractRpmStream } = require('../services/rpm');
const { extractStreamFromImdb } = require('../services/stream');

const router = express.Router();

router.get('/test/rpm/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    console.log(`🧪 Testing legacy RPM ID: ${videoId}`);
    const result = await extractRpmStream(videoId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/test/imdb/:imdbId', async (req, res) => {
  try {
    const { imdbId } = req.params;
    const { season, episode } = req.query;

    console.log(`🧪 Testing IMDB workflow: ${imdbId}${season ? ` S${season}E${episode}` : ''}`);

    const result = await extractStreamFromImdb(
      imdbId,
      season ? parseInt(season, 10) : null,
      episode ? parseInt(episode, 10) : null
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
