const express = require('express');
const { getManifest } = require('../services/stremio');

const router = express.Router();

router.get('/manifest.json', (req, res) => {
  res.json(getManifest());
});

module.exports = router;
