# HDMozi -> RPM Magyar Stremio addon

Express-alapu Stremio addon, ami IMDB azonosito alapjan HDMozi/RPM streameket ad vissza.

## Futtatas

```bash
node server.js
```

Alapertelmezett port: `7000` (felulirhato `PORT` env valtozoval).

## Fontos endpointok

- Configure oldal: `http://localhost:7000/configure`
- Manifest: `http://localhost:7000/manifest.json`
- Config manifest: `http://localhost:7000/:config/manifest.json`
- Stream: `http://localhost:7000/stream/:type/:id.json`
- Config stream: `http://localhost:7000/:config/stream/:type/:id.json`

## cPanel / CloudLinux beallitasok

- Application root: `<ADDON_NEV>` projekt mappa (ahol a `server.js` van)
- Application URL: `</ vagy /addon-path>`
- Application startup file: `server.js`

### Kotelezo / ajanlott env valtozok

- `APP_BASE_PATH`: `<ures vagy /addon-path>`
- `PORT`: opcionális, ha a szolgaltato ad kulon portot

## Node verzio

- A projekt `>=18` Node verziot tamogat.
