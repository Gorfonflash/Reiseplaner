@@ -7,41 +7,41 @@ This project exposes a small HTTP server implemented in `server.js`. The API cov
- **Node.js** (not included in this repository).
- Environment variables:
  - `GOOGLE_API_KEY` – Google Maps/Places API key.
  - `OPENWEATHER_API_KEY` – OpenWeather API key.
  - `PORT` – optional port (defaults to `3000`).

## Running the server

Set the required API keys and start the server:
Set the required API keys and start the server using **npm**:

```bash
export GOOGLE_API_KEY=yourGoogleKey
export OPENWEATHER_API_KEY=yourOpenWeatherKey
node server.js
npm start
```

Visit `http://localhost:3000/` or specify a custom `PORT`.

## Endpoints

See [openapi.json](openapi.json) for the complete specification. Short descriptions are listed below:

- **`/vorschlag`** – activity recommendations based on the weather and a list of interests.
- **`/orte`** – search for places of a specific type in a city.
- **`/orte`** – search for places of a specific type in a city. Supports an optional `maxDist` (meters) parameter to limit the distance.
- **`/geocode`** – geocode an address to latitude/longitude.
- **`/poi`** – points of interest near coordinates.
- **`/route`** – calculate a route between two places. Requires `start` and `ziel`. Returns a JSON message if start and destination are identical.
- **`/transportzeit`** – public transport travel time between two places.
- **`/wetter`** – current weather for a city.

### Special `/route` behaviour

The `start` and `ziel` parameters are mandatory. If one of them is missing the server returns:

```json
{"error": "Start oder Ziel fehlt"}
```

When both parameters refer to the same place, the API does not call Google Maps. Instead it immediately responds with:
