
const express = require("express");

const optionalAuth = require("../middleware/optionalAuth");
const WeatherCache = require("../models/WeatherCache");

const {
    fetchCurrentWeather,
    fetchForecast
} = require("../services/weatherProvider");

const {
    recordWeatherCheck,
    recordStormForecastView
} = require("../services/achievementService");

const router = express.Router();

const CACHE_TTL_MINUTES = 30;

async function getCachedWeather(location) {
    let cache = await WeatherCache.findOne({
        locationName: location
    });

    if (!cache || cache.expiresAt < new Date()) {
        const [weatherData, forecastData] =
            await Promise.all([
                fetchCurrentWeather(location),
                fetchForecast(location)
            ]);

        const now = new Date();

        const expiresAt = new Date(
            now.getTime() +
            CACHE_TTL_MINUTES * 60 * 1000
        );

        cache = await WeatherCache.findOneAndUpdate(
            { locationName: location },
            {
                weatherData,
                forecastData,
                cachedAt: now,
                expiresAt
            },
            {
                new: true,
                upsert: true
            }
        );
    }

    return cache;
}

async function updateWeatherAchievements(
    userId,
    cache,
    location,
    viewedForecast
) {
    if (!userId) return;

    // Gamification failures must not prevent weather retrieval.
    try {
        await recordWeatherCheck(userId);

        if (viewedForecast) {
            await recordStormForecastView(
                userId,
                cache.weatherData,
                location
            );
        }
    } catch (error) {
        console.error(
            "Weather achievement update error:",
            error.message
        );
    }
}

router.get(
    "/weather/current",
    optionalAuth,
    async (req, res) => {
        try {
            const location = String(
                req.query.location || ""
            ).trim();

            if (!location) {
                return res.status(400).json({
                    success: false,
                    message:
                        "location query parameter is required."
                });
            }

            const cache =
                await getCachedWeather(location);

            const weather = cache.weatherData;

            const basicResponse = {
                location: weather.locationName,
                temperature: weather.temperature,
                condition: weather.condition,
                humidity: weather.humidity
            };

            if (req.user) {
                await updateWeatherAchievements(
                    req.user.userId,
                    cache,
                    location,
                    false
                );

                return res.status(200).json({
                    ...basicResponse,
                    windSpeed: weather.windSpeed,
                    rainProbability: weather.rainProbability,
                    uvIndex: weather.uvIndex
                });
            }

            return res.status(200).json(
                basicResponse
            );
        } catch (error) {
            console.error(
                "Current weather error:",
                error.message
            );

            return res.status(500).json({
                success: false,
                message: "Internal server error."
            });
        }
    }
);

router.get(
    "/weather/forecast",
    optionalAuth,
    async (req, res) => {
        try {
            const location = String(
                req.query.location || ""
            ).trim();

            if (!location) {
                return res.status(400).json({
                    success: false,
                    message:
                        "location query parameter is required."
                });
            }

            const cache =
                await getCachedWeather(location);

            const forecastData =
                Array.isArray(cache.forecastData)
                    ? cache.forecastData
                    : [];

            const forecast = forecastData.map(
                day => {
                    const basicDay = {
                        date: day.date,
                        minTemperature:
                            day.minTemperature,
                        maxTemperature:
                            day.maxTemperature,
                        condition: day.condition
                    };

                    if (!req.user) {
                        return basicDay;
                    }

                    return {
                        ...basicDay,
                        rainProbability:
                            day.rainProbability,
                        humidity: day.humidity,
                        windSpeed: day.windSpeed
                    };
                }
            );

            if (req.user) {
                await updateWeatherAchievements(
                    req.user.userId,
                    cache,
                    location,
                    true
                );
            }

            return res.status(200).json({
                location,
                forecast
            });
        } catch (error) {
            console.error(
                "Forecast error:",
                error.message
            );

            return res.status(500).json({
                success: false,
                message: "Internal server error."
            });
        }
    }
);

module.exports = router;
