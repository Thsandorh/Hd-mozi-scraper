const express = require('express');
const { renderHomePage } = require('../views/home');

const router = express.Router();

router.get('/', (req, res) => {
  const manifestUrl = `${req.protocol}://${req.get('host')}/manifest.json`;
  res.send(renderHomePage(manifestUrl));
});

module.exports = router;
