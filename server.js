// server.js – inkl. /vorschlag-Logik
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
    const zeit = parseInt(query.zeit) || 2; // Stunden
    const interessen = (query.interessen || '').split(',').map(x => x.trim().toLowerCase());

    const weatherEndpoint = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(ort)}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=de`;

    https.get(weatherEndpoint, (apiRes) => {
      let weatherData = '';
      apiRes.on('data', chunk => weatherData += chunk);
      apiRes.on('end', () => {
        const wetter = JSON.parse(weatherData);
        const zustand = (wetter.weather?.[0]?.main || '').toLowerCase();

        let antwort = `📍 Ort: ${ort}\n🕒 Zeitbudget: ${zeit}h\n🌤️ Wetter: ${wetter.weather?.[0]?.description || 'unbekannt'}\n\n`;

        const outdoor = ["wandern", "spaziergang", "see", "stadtbummel", "biergarten"];
        const indoor = ["museum", "wellness", "kino", "escape room", "kaffeehaus"];

        let vorschlaege = [];

        const istSonnig = zustand.includes("sun") || zustand.includes("klar") || zustand.includes("few clouds") || zustand.includes("wolkenlos") || zustand.includes("clouds") && !zustand.includes("rain");

        const kandidaten = istSonnig ? outdoor : indoor;
        interessen.forEach(i => {
          if (kandidaten.includes(i)) vorschlaege.push(i);
        });

        if (vorschlaege.length === 0) vorschlaege = kandidaten.slice(0, 3);

        antwort += `✨ Basierend auf Wetter und Interessen empfehlen wir dir:\n• ` + vorschlaege.join('\n• ');

        res.setHeader('Content-Type', 'text/plain');
        res.end(antwort);
      });
    }).on('error', err => {
      res.statusCode = 500;
      res.end("Fehler beim Abrufen der Wetterdaten: " + err.message);
    });
    return;
  }

  // --- Bestehende /orte-Route ---
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

  // --- Bestehende /wetter-Route ---
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

  // --- Standard ---
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Server live. Nutze /orte, /wetter oder /vorschlag?ort=Zürich&zeit=3&interessen=wandern,museum');
});

server.listen(port, hostname, () => {
  console.log(`Server läuft unter http://${hostname}:${port}/`);
});
