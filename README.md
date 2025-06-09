# Reiseplaner API

This project exposes a small HTTP server implemented in `server.js`. The API covers points of interest, weather data, directions and activity suggestions. The full schema for all endpoints can be found in [openapi.json](openapi.json).

## Requirements

- **Node.js** (not included in this repository).
- Environment variables:
  - `GOOGLE_API_KEY` – Google Maps/Places API key.
  - `OPENWEATHER_API_KEY` – OpenWeather API key.
  - `PORT` – optional port (defaults to `3000`).

## Running the server

Set the required API keys and start the server:

```bash
export GOOGLE_API_KEY=yourGoogleKey
export OPENWEATHER_API_KEY=yourOpenWeatherKey
node server.js
