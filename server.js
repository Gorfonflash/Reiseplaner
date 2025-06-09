// server.js – inkl. Vorschlags-, Wetter- und Orte-Logik
const http = require('http');
const https = require('https');
const url = require('url');

const hostname = '0.0.0.0';
const port = process.env.PORT || 3000;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;

const server = http.createServer((req, res) => {
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
      res.end("Fehler beim Abrufen der Wetterdaten: " + err.message);
    });
    return;
  }

  // --- /orte-Route ---
  if (parsedUrl.pathname === '/orte') {
    const ort = query.ort || 'Bern';
    const typ = query.typ || 'museum';
    const endpoint = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(typ + ' in ' + ort)}&key=${GOOGLE_API_KEY}`;

    https.get(endpoint, (apiRes) => {
      let data = '';
      apiRes.on('data', chunk => data += chunk);
      apiRes.on('end', () => {
        res.setHeader('Content-Type', 'application/json');
        res.end(data);
      });
    }).on('error', err => {
      res.statusCode = 500;
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
      res.end(JSON.stringify({ error: err.message }));
    });
    return;
  }

  // --- /route-Route ---
  if (parsedUrl.pathname === '/route') {
    const origin = query.start;
    const destination = query.ziel;
    const mode = query.modus || 'driving';
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
