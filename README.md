# Reiseplaner API

This project exposes a small HTTP server implemented in `server.js`. The API covers points of interest, weather data, directions and activity suggestions. The full schema for all endpoints can be found in [openapi.json](openapi.json).

## Requirements

- **Node.js** (not included in this repository).
- Environment variables:
  - `GOOGLE_API_KEY` – Google Maps/Places API key.
  - `OPENWEATHER_API_KEY` – OpenWeather API key.
  - `PORT` – optional port (defaults to `3000`).


## Running the server

Set your API keys using environment variables. You may also define `PORT` to override the default of `3000`.

```bash
export GOOGLE_API_KEY=yourGoogleKey
export OPENWEATHER_API_KEY=yourOpenWeatherKey
export PORT=8080   # optional
```

Start the server with **npm**:

```bash
npm start
```
