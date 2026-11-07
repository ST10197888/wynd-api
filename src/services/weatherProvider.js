
const BASE_URL = "https://api.openweathermap.org/data/2.5";

function getApiKey() {
    const key = process.env.OPENWEATHER_API_KEY;

    if (!key) {
        throw new Error("OPENWEATHER_API_KEY is not set.");
    }

    return key;
}

async function requestWeather(path, location) {
    const url = `${BASE_URL}/${path}?q=${encodeURIComponent(location)}&appid=${getApiKey()}&units=metric`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(
            `OpenWeatherMap ${path} request failed (HTTP ${response.status})`
        );
    }

    const data = await response.json();

    if (data.cod && Number(data.cod) !== 200) {
        throw new Error(
            `OpenWeatherMap error: ${data.message || data.cod}`
        );
    }

    return data;
}

function localParts(unixSeconds, timezoneOffsetSeconds) {
    const shifted = new Date(
        (unixSeconds + timezoneOffsetSeconds) * 1000
    );

    return {
        date: shifted.toISOString().slice(0, 10),
        hour: shifted.getUTCHours()
    };
}

async function fetchCurrentWeather(location) {
    const data = await requestWeather("weather", location);

    return {
        locationName: data.name || location,
        latitude: data.coord.lat,
        longitude: data.coord.lon,
        temperature: data.main.temp,
        feelsLike: data.main.feels_like,
        condition: data.weather[0].main,
        weatherId: data.weather[0].id,
        humidity: data.main.humidity,
        windSpeed: data.wind.speed,
        rainProbability: undefined,
        uvIndex: undefined,
        timezoneOffsetSeconds: Number(data.timezone) || 0,
        observedAt: new Date(data.dt * 1000)
    };
}

async function fetchForecast(location) {
    const data = await requestWeather("forecast", location);

    if (!Array.isArray(data.list)) {
        throw new Error(
            "OpenWeatherMap forecast response has no list."
        );
    }

    const timezoneOffsetSeconds =
        Number(data.city?.timezone) || 0;

    const byDay = new Map();

    for (const entry of data.list) {
        if (!Number.isFinite(Number(entry.dt))) {
            continue;
        }

        const { date, hour } = localParts(
            Number(entry.dt),
            timezoneOffsetSeconds
        );

        if (!byDay.has(date)) {
            byDay.set(date, []);
        }

        byDay.get(date).push({ entry, hour });
    }

    return [...byDay.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(0, 5)
        .map(([day, entries]) => {
            const items = entries.map(({ entry }) => entry);

            const midday = entries.reduce((closest, item) =>
                Math.abs(item.hour - 12) <
                Math.abs(closest.hour - 12)
                    ? item
                    : closest
            ).entry;

            const probabilities = items.map(
                entry => Number(entry.pop) || 0
            );

            const average = values =>
                values.reduce(
                    (sum, value) => sum + value,
                    0
                ) / values.length;

            return {
                date: new Date(`${day}T00:00:00.000Z`),
                localDate: day,
                timezoneOffsetSeconds,

                minTemperature: Math.min(
                    ...items.map(entry => entry.main.temp)
                ),

                maxTemperature: Math.max(
                    ...items.map(entry => entry.main.temp)
                ),

                condition: midday.weather[0].main,

                rainProbability: Math.round(
                    average(probabilities) * 100
                ),

                maxRainProbability: Math.round(
                    Math.max(...probabilities) * 100
                ),

                humidity: Math.round(
                    average(
                        items.map(entry => entry.main.humidity)
                    )
                ),

                windSpeed: average(
                    items.map(entry => entry.wind.speed)
                )
            };
        });
}

module.exports = {
    fetchCurrentWeather,
    fetchForecast
};
