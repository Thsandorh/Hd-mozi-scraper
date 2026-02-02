# HDMozi → RPM Magyar Stremio addon

This project is an Express-based Stremio addon that searches HDMozi content, matches it with TMDB, and generates RPM Share HLS streams. The goal is to make Hungarian movies and series easily accessible in Stremio via IMDB identifiers.

## Key features

- IMDB-based lookup (`tt1234567` or `tt1234567:1:5`).
- Movie and series handling with season/episode resolution.
- TMDB title resolution → HDMozi search → RPM Share HLS streams.
- Stremio manifest plus a simple web landing page.

## Requirements

- Node.js 24.x
- NPM (or a compatible package manager)

## Installation

```bash
npm install
```

## Run locally

```bash
node server.js
```

The default server port is `7000` (override with the `PORT` environment variable).

## Useful endpoints

- **Manifest**: `http://localhost:7000/manifest.json`
- **Stremio stream**: `http://localhost:7000/stream/:type/:id.json`
  - Movie example: `http://localhost:7000/stream/movie/tt3402138.json`
  - Series example: `http://localhost:7000/stream/series/tt0903747:1:1.json`
- **Test (IMDB)**: `http://localhost:7000/test/imdb/tt0903747`
- **Test (RPM ID)**: `http://localhost:7000/test/rpm/<videoId>`
- **Debug HTML**: `http://localhost:7000/debug/html?url=<url>`
- **Home**: `http://localhost:7000/`

## Stremio installation

Open the home page and use the “Add to Stremio” button, or paste the manifest URL into Stremio:

```
stremio://install?manifest=http://localhost:7000/manifest.json
```

## Environment variables

- `PORT` – server port (default: 7000)
- `VERCEL` – when running on Vercel, `server.js` will not start a listener

## Notes

The TMDB API key is embedded in the configuration; no extra setup is required for the current workflow.
