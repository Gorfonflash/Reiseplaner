# Reiseplaner API

This project exposes a small HTTP server implemented in `server.js`. The API covers points of interest, weather data, directions and activity suggestions. Additional helper endpoints provide photos and day plans. The full schema for all endpoints can be found in [openapi.json](openapi.json).

Key additions:
- `/foto` – resolves a Places `photo_reference` to the final CDN URL.
- `/tagesablauf` – produces a simple timetable for the day.
- `/vorschlag` – suggestions include audience tags (`familie`, `paar`, `adrenalin`) and now validate input using **zod**.
- `/route` – supports public transit via `modus=transit` and optional `abfahrt`.

## Requirements

 - **Node.js** version 16 or later (not included in this repository).
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

Install the required dependencies first:

```bash
npm install
```

Then start the server:

```bash
npm start
```
