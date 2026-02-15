const express = require('express');
const cors = require('cors');
const { registerRoutes } = require('./lib/routes');

function normalizeBasePath(basePath) {
  if (!basePath || basePath === '/') {
    return '';
  }

  const normalized = `/${String(basePath).trim()}`.replace(/\/+/g, '/').replace(/\/$/, '');
  return normalized === '/' ? '' : normalized;
}

const app = express();
const PORT = Number(process.env.PORT) || 7000;
const APP_BASE_PATH = normalizeBasePath(process.env.APP_BASE_PATH);

app.use(cors());
app.use(express.json());

const router = express.Router();
registerRoutes(router);

app.use('/', router);
if (APP_BASE_PATH) {
  app.use(APP_BASE_PATH, router);
}

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  if (APP_BASE_PATH) {
    console.log(`Base path: ${APP_BASE_PATH}`);
  }
});

module.exports = app;
