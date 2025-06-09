// server.js – inkl. Vorschlags-, Wetter- und Orte-Logik
const http = require('http');
const https = require('https');
const url = require('url');

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

const server = http.createServer((req, res) => {
  if (missingKeys.length) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain');
    res.end(
      'Server misconfigured: Missing API keys - ' + missingKeys.join(', ')
    );
    return;
  }
  const parsedUrl = url.parse(req.url, true);
  const query = parsedUrl.query;

  // --- Vorschlagslogik ---
  if (parsedUrl.pathname === '/vorschlag') {
    const ort = query.ort || 'Bern';
    const zeit = parseInt(query.zeit) || 2;
    const interessen = (query.interessen || '')
      .split(',')
      .map(x => x.trim().toLowerCase())
      .filter(Boolean);

    const weatherEndpoint = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(ort)}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=de`;

    https.get(weatherEndpoint, (apiRes) => {
      let weatherData = '';
      apiRes.on('data', chunk => weatherData += chunk);
      apiRes.on('end', () => {
        const wetter = JSON.parse(weatherData);
        const wetterBeschreibung = (wetter.weather?.[0]?.description || '').toLowerCase();
        const istSonnig = wetterBeschreibung.includes("clear") ||
                          wetterBeschreibung.includes("sonne") ||
                          wetterBeschreibung.includes("klar") ||
                          wetterBeschreibung.includes("few clouds") ||
                          (wetterBeschreibung.includes("clouds") && !wetterBeschreibung.includes("rain"));

        const outdoor = ["wandern", "spaziergang", "see", "stadtbummel", "biergarten"];
        const indoor = ["museum", "wellness", "kino", "escape room", "kaffeehaus"];

        const kandidaten = istSonnig ? outdoor : indoor;
        let vorschlaege = interessen.filter(i => kandidaten.includes(i));

        if (vorschlaege.length === 0) {
          vorschlaege = kandidaten.slice(0, 3);
        }

        const antwortText = `📍 Ort: ${ort}\n🕒 Zeitbudget: ${zeit}h\n🌤️ Wetter: ${wetterBeschreibung || 'unbekannt'}\n\n✨ Basierend auf Wetter und Interessen empfehlen wir dir:\n• ` + vorschlaege.join('\n• ');

        if (query.format === "json") {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            ort,
            zeit,
            wetter: wetterBeschreibung,
            vorschlaege
          }));
        } else {
          res.setHeader('Content-Type', 'text/plain');
          res.end(antwortText);
        }
      });
    }).on('error', err => {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain');
      res.end("Fehler beim Abrufen der Wetterdaten: " + err.message);
    });
    return;
  }

  // --- /orte-Route ---
  if (parsedUrl.pathname === '/orte') {
    const ort = query.ort || 'Bern';
    const typ = query.typ || 'museum';
    const maxDist = parseInt(query.maxDist) || null;

    const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(ort)}&key=${GOOGLE_API_KEY}`;
    https.get(geoUrl, geoRes => {
      let geoData = '';
      geoRes.on('data', c => geoData += c);
      geoRes.on('end', () => {
        try {
          const geo = JSON.parse(geoData);
          const loc = geo.results?.[0]?.geometry?.location;
          if (!loc) throw new Error('Geocoding fehlgeschlagen');

          const placeUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(typ)}&location=${loc.lat},${loc.lng}&rankby=distance&key=${GOOGLE_API_KEY}`;
          https.get(placeUrl, apiRes => {
            let data = '';
            apiRes.on('data', c => data += c);
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
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(result));
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
    const origin = (query.start || '').trim();
    const destination = (query.ziel || '').trim();
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

    const endpoint = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=${encodeURIComponent(mode)}&key=${GOOGLE_API_KEY}`;

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

  // --- /wetter-Route ---
  if (parsedUrl.pathname === '/wetter') {
    const ort = query.ort || 'Bern';
    const endpoint = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(ort)}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=de`;

    https.get(endpoint, (apiRes) => {
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

  // --- Standard-Antwort ---
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Server live. Nutze /orte, /wetter oder /vorschlag?ort=currentlocations&zeit=3&interessen=wandern,museum');
});

server.listen(port, hostname, () => {
  console.log(`Server läuft unter http://${hostname}:${port}/`);
});
