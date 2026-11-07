
const test = require("node:test");
const assert = require("node:assert/strict");

const {
    eventsForWeather
} = require("../src/services/weatherAlertRules");

const now = new Date("2026-11-07T23:30:00Z");

test(
    "matches the location-local date across UTC midnight",
    () => {
        const current = {
            condition: "Clouds",
            timezoneOffsetSeconds: 7200
        };

        const forecast = [{
            localDate: "2026-11-08",
            maxRainProbability: 85,
            rainProbability: 40
        }];

        const events = eventsForWeather(
            current,
            forecast,
            "Durban",
            now
        );

        assert.equal(events.length, 1);
        assert.equal(
            events[0].eventKey,
            "rain:durban:2026-11-08"
        );
    }
);

test(
    "uses the maximum forecast-period probability for alerts",
    () => {
        const events = eventsForWeather(
            {
                condition: "Clear",
                timezoneOffsetSeconds: 0
            },
            [{
                localDate: "2026-11-07",
                rainProbability: 30,
                maxRainProbability: 90
            }],
            "Durban",
            new Date("2026-11-07T12:00:00Z")
        );

        assert.equal(events[0].category, "rain");
    }
);

test(
    "detects thunderstorm using OpenWeatherMap weather ID",
    () => {
        const events = eventsForWeather(
            {
                condition: "Thunderstorms",
                weatherId: 211
            },
            [],
            "Durban",
            now
        );

        assert.equal(events[0].category, "severe");
    }
);

test(
    "does not alert on mild weather or low rain probability",
    () => {
        const events = eventsForWeather(
            {
                condition: "Clouds"
            },
            [{
                localDate: "2026-11-07",
                maxRainProbability: 40
            }],
            "Durban",
            new Date("2026-11-07T12:00:00Z")
        );

        assert.deepEqual(events, []);
    }
);

test(
    "handles missing or invalid forecast dates safely",
    () => {
        assert.deepEqual(
            eventsForWeather(
                { condition: "Clear" },
                [{ date: "invalid" }],
                "Durban",
                now
            ),
            []
        );

        assert.deepEqual(
            eventsForWeather(
                { condition: "Clear" },
                null,
                "Durban",
                now
            ),
            []
        );
    }
);
