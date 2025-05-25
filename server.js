const http = require('http');
const https = require('https');
const url = require('url');

const hostname = '0.0.0.0';
const port = process.env.PORT || 3000;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);

  // 📍 GOOGLE PLACES: Ortetypen wie Restaurant, Museum usw.
  if (parsedUrl.pathname === '/orte') {
    const ort = parsedUrl.query.ort || 'Bern';
    const typ = parsedUrl.query.typ || 'museum';

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

  // 🌦️ OPENWEATHER: aktuelles Wetter für eine Stadt
  if (parsedUrl.pathname === '/wetter') {
    const ort = parsedUrl.query.ort || 'Bern';
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

  // 🔁 Standardausgabe
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Server ist live. Nutze /orte?ort=Bern&typ=restaurant oder /wetter?ort=Zürich');
});

server.listen(port, hostname, () => {
  console.log(`Server läuft unter http://${hostname}:${port}/`);
});
