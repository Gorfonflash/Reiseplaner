// server.js – inkl. Vorschlags-, Wetter- und Orte-Logik
const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');
const i18next = require('i18next');
const { z } = require('zod');

const hostname = '0.0.0.0';
const port = process.env.PORT || 3000;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;

const missingKeys = [];
if (!GOOGLE_API_KEY) missingKeys.push('GOOGLE_API_KEY');
if (!OPENWEATHER_API_KEY) missingKeys.push('OPENWEATHER_API_KEY');

if (missingKeys.length) {
  console.error(`Missing API keys: ${missingKeys.join(', ')}.`);
  console.error(
    'Endpoints will respond with an error until the keys are provided.'
  );
}

i18next.init({
  fallbackLng: 'en',
  resources: {
    en: { translation: JSON.parse(fs.readFileSync(path.join(__dirname, 'locales/en/translation.json'), 'utf8')) },
    de: { translation: JSON.parse(fs.readFileSync(path.join(__dirname, 'locales/de/translation.json'), 'utf8')) }
  }
});

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // meters
  const toRad = deg => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const activityTags = {
  'wandern': ['familie', 'adrenalin'],
  'spaziergang': ['familie'],
  'see': ['familie', 'paar'],
  'stadtbummel': ['familie', 'paar'],
  'biergarten': ['paar'],
  'museum': ['familie', 'paar'],
  'wellness': ['paar'],
  'kino': ['familie', 'paar'],
  'escape room': ['familie', 'adrenalin'],
  'kaffeehaus': ['paar']
};

function sendError(res, code, message) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ status: code, message }));
}

function fetchWeather(ort, lang) {
  return new Promise((resolve, reject) => {
    const endpoint =
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(ort)}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=${lang}`;
    https
      .get(endpoint, apiRes => {
        let data = '';
        apiRes.on('data', c => (data += c));
        apiRes.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      })
      .on('error', reject);
  });
}

function fetchPlaces(ort, typ, maxDist) {
  return new Promise((resolve, reject) => {
    const geoUrl =
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(ort)}&key=${GOOGLE_API_KEY}`;
    https
      .get(geoUrl, geoRes => {
        let geoData = '';
        geoRes.on('data', c => (geoData += c));
        geoRes.on('end', () => {
          try {
            const geo = JSON.parse(geoData);
            const loc = geo.results?.[0]?.geometry?.location;
            if (!loc) throw new Error('Geocoding fehlgeschlagen');

            const placeUrl =
              `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(typ)}&location=${loc.lat},${loc.lng}&rankby=distance&key=${GOOGLE_API_KEY}`;
            https
              .get(placeUrl, apiRes => {
                let data = '';
                apiRes.on('data', c => (data += c));
                apiRes.on('end', () => {
                  try {
                    const result = JSON.parse(data);
                    if (Array.isArray(result.results)) {
                      result.results.forEach(p => {
                        const pl = p.geometry?.location;
                        if (pl) {
                          p.distance = haversineDistance(loc.lat, loc.lng, pl.lat, pl.lng);
                        }
                      });
                      if (maxDist) {
                        result.results = result.results.filter(p => p.distance <= maxDist);
                      }
                      result.results.sort((a, b) => {
                        if (a.distance !== b.distance) return a.distance - b.distance;
                        return (b.rating || 0) - (a.rating || 0);
                      });
                    }
                    resolve(result);
                  } catch (err) {
                    reject(err);
                  }
                });
              })
              .on('error', reject);
          } catch (err) {
            reject(err);
          }
        });
      })
      .on('error', reject);
  });
}

const vorschlagSchema = z.object({
  ort: z.string().min(1).default('Bern'),
  zeit: z
    .preprocess(v => (v === undefined ? undefined : parseInt(v, 10)), z.number().int().positive())
    .default(2),
  interessen: z
    .preprocess(v => (typeof v === 'string' ? v.split(',').map(s => s.trim()).filter(Boolean) : []), z.array(z.string()))
    .default([]),
  format: z.string().optional()
});

const server = http.createServer((req, res) => {
  if (missingKeys.length) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain');
    res.end(
      'Server misconfigured: Missing API keys - ' + missingKeys.join(',')
    );
    return;
  }
  const parsedUrl = url.parse(req.url, true);
  const query = parsedUrl.query;
  const lang = (req.headers['accept-language'] || 'en').split(',')[0].split('-')[0];
  i18next.changeLanguage(lang);

  // --- Vorschlagslogik ---
  if (parsedUrl.pathname === '/vorschlag') {
    const parsed = vorschlagSchema.safeParse(query);
    if (!parsed.success) {
      sendError(res, 400, parsed.error.errors.map(e => e.message).join('; '));
      return;
    }

    const { ort, zeit, interessen, format } = parsed.data;

    fetchWeather(ort, lang)
      .then(async wetter => {
        const wetterBeschreibung = (wetter.weather?.[0]?.description || '').toLowerCase();
        const istSonnig =
          wetterBeschreibung.includes('clear') ||
          wetterBeschreibung.includes('sonne') ||
          wetterBeschreibung.includes('klar') ||
          wetterBeschreibung.includes('few clouds') ||
          (wetterBeschreibung.includes('clouds') && !wetterBeschreibung.includes('rain'));

        const outdoor = ['wandern', 'spaziergang', 'see', 'stadtbummel', 'biergarten'];
        const indoor = ['museum', 'wellness', 'kino', 'escape room', 'kaffeehaus'];

        const kandidaten = istSonnig ? outdoor : indoor;
        let vorschlaege = interessen.filter(i => kandidaten.includes(i));

        if (vorschlaege.length === 0) {
          vorschlaege = kandidaten.slice(0, 3);
        }

        const ortPromises = vorschlaege.map(v =>
          fetchPlaces(ort, v).then(r => r.results?.[0]?.name).catch(() => null)
        );
        const placeNames = await Promise.all(ortPromises);

        const items = vorschlaege.map((v, idx) => ({
          name: v,
          tags: activityTags[v] || [],
          ort: placeNames[idx]
        }));

        const antwortText =
          `📍 ${i18next.t('ort')}: ${ort}\n` +
          `🕒 ${i18next.t('zeitbudget')}: ${zeit}h\n` +
          `🌤️ ${i18next.t('wetter')}: ${wetterBeschreibung || 'unbekannt'}\n\n` +
          `✨ ${i18next.t('empfehlung')}\n• ` +
          items.map(i => i.name).join('\n• ');

        if (format === 'json') {
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({ ort, zeit, wetter: wetterBeschreibung, vorschlaege: items })
          );
        } else {
          res.setHeader('Content-Type', 'text/plain');
          res.end(antwortText);
        }
      })
      .catch(err => {
        sendError(res, 500, 'Fehler beim Abrufen der Daten: ' + err.message);
      });
    return;
  }

  // --- /orte-Route ---
  if (parsedUrl.pathname === '/orte') {
    const ort = query.ort || 'Bern';
    const typ = query.typ || 'museum';
    const maxDist = parseInt(query.maxDist) || null;

    fetchPlaces(ort, typ, maxDist)
      .then(result => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result));
      })
      .catch(err => {
        sendError(res, 500, err.message);
      });
    return;
  }

  // --- /geocode-Route ---
  if (parsedUrl.pathname === '/geocode') {
    const adresse = query.adresse || '';
    const endpoint = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(adresse)}&key=${GOOGLE_API_KEY}`;

    https.get(endpoint, apiRes => {
      let data = '';
      apiRes.on('data', chunk => data += chunk);
      apiRes.on('end', () => {
        res.setHeader('Content-Type', 'application/json');
        res.end(data);
      });
    }).on('error', err => {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message }));
    });
    return;
  }

  // --- /foto-Route ---
  if (parsedUrl.pathname === '/foto') {
    const reference = query.reference || '';
    const maxwidth = parseInt(query.maxwidth) || 400;
    if (!reference) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'reference fehlt' }));
      return;
    }

    const photoEndpoint = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxwidth}&photoreference=${encodeURIComponent(reference)}&key=${GOOGLE_API_KEY}`;
    https.get(photoEndpoint, apiRes => {
      const cdnUrl = apiRes.headers.location;
      if (!cdnUrl) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Kein Foto gefunden' }));
        return;
      }
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ url: cdnUrl }));
    }).on('error', err => {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message }));
    });
    return;
  }

  // --- /poi-Route ---
  if (parsedUrl.pathname === '/poi') {
    const lat = query.lat;
    const lng = query.lng;
    const typ = query.typ || 'tourist_attraction';
    const endpoint = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=2000&type=${encodeURIComponent(typ)}&key=${GOOGLE_API_KEY}`;

    https.get(endpoint, apiRes => {
      let data = '';
      apiRes.on('data', chunk => data += chunk);
      apiRes.on('end', () => {
        res.setHeader('Content-Type', 'application/json');
        res.end(data);
      });
    }).on('error', err => {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message }));
    });
    return;
  }

  // --- /route-Route ---
  if (parsedUrl.pathname === '/route') {
    const origin = (query.start || query.von || '').trim();
    const destination = (query.ziel || query.nach || '').trim();
    const mode = query.modus || 'driving';

    if (!origin || !destination) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Start oder Ziel fehlt' }));
      return;
    }

    if (origin.toLowerCase() === destination.toLowerCase()) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ message: 'Start und Ziel identisch' }));
      return;
    }

    let extra = '';
    if (mode === 'transit') {
      const when = query.abfahrt ? encodeURIComponent(query.abfahrt) : 'now';
      extra = `&departure_time=${when}`;
    }
    const endpoint = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=${encodeURIComponent(mode)}${extra}&key=${GOOGLE_API_KEY}`;

    https.get(endpoint, apiRes => {
      let data = '';
      apiRes.on('data', chunk => data += chunk);
      apiRes.on('end', () => {
        res.setHeader('Content-Type', 'application/json');
        res.end(data);
      });
    }).on('error', err => {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message }));
    });
    return;
  }

  // --- /transportzeit-Route ---
  if (parsedUrl.pathname === '/transportzeit') {
    const userOrt = (query.userOrt || '').trim();
    const zielOrt = (query.zielOrt || '').trim();
    if (!userOrt || !zielOrt) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Start oder Ziel fehlt' }));
      return;
    }

    if (userOrt.toLowerCase() === zielOrt.toLowerCase()) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ message: 'Start und Ziel identisch' }));
      return;
    }

    const endpoint = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(userOrt)}&destination=${encodeURIComponent(zielOrt)}&mode=transit&departure_time=now&key=${GOOGLE_API_KEY}`;
    https.get(endpoint, apiRes => {
      let data = '';
        apiRes.on('data', chunk => data += chunk);
        apiRes.on('end', () => {
          try {
            const result = JSON.parse(data);
            const leg = result.routes?.[0]?.legs?.[0];
            const dauer = leg?.duration?.text || 'unbekannt';
            const abfahrt = leg?.departure_time?.text || 'unbekannt';
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ dauer, abfahrt }));
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      }).on('error', err => {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: err.message }));
      });
    return;
  }

  // --- /tagesablauf-Route ---
  if (parsedUrl.pathname === '/tagesablauf') {
    const start = query.start || '09:00';
    const tz = query.tz || 'Europe/Berlin'; // kept for API compatibility
    const dauerAkt = parseInt(query.dauerAktivitaet) || 60;

    const [startHour, startMinute] = start.split(':').map(Number);
    const toMinutes = (h, m) => h * 60 + m;
    const format = mins => {
      const h = Math.floor(mins / 60) % 24;
      const m = mins % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const startTotal = toMinutes(startHour, startMinute);
    const plan = [
      { step: 'Anreise', time: format(startTotal) },
      { step: 'Aktivität', time: format(startTotal + 30) },
      { step: 'Essen', time: format(startTotal + 30 + dauerAkt) },
      { step: 'Rückreise', time: format(startTotal + 90 + dauerAkt) }
    ];
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ plan }));
    return;
  }

  // --- /wetter-Route ---
  if (parsedUrl.pathname === '/wetter') {
    const ort = query.ort || 'Bern';
    fetchWeather(ort, lang)
      .then(data => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
      })
      .catch(err => {
        sendError(res, 500, err.message);
      });
    return;
  }

  // --- Standard-Antwort ---
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end(i18next.t('server_live'));
});

server.listen(port, hostname, () => {
  console.log(`Server läuft unter http://${hostname}:${port}/`);
});

