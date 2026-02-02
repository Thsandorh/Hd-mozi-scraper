const express = require('express');
const cors = require('cors');

const manifestRouter = require('./routes/manifest');
const streamRouter = require('./routes/stream');
const testRouter = require('./routes/test');
const debugRouter = require('./routes/debug');
const homeRouter = require('./routes/home');

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use(manifestRouter);
  app.use(streamRouter);
  app.use(testRouter);
  app.use(debugRouter);
  app.use(homeRouter);

  return app;
}

module.exports = { createApp };
