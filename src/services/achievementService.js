
const Achievement = require("../models/Achievement");
const WeatherCheck = require("../models/WeatherCheck");
const { eventsForWeather } = require("./weatherAlertRules");

const DEFINITIONS = [
    {
        name: "Weather Watcher",
        description: "Checked the weather 10 days in a row.",
        requirement: "10-day weather-check streak",
        target: 10
    },
    {
        name: "Storm Spotter",
        description: "Viewed a forecast during a storm warning.",
        requirement: "View storm-warning forecast",
        target: 1
    },
    {
        name: "Explorer",
        description: "Saved 5 different locations.",
        requirement: "Save five locations",
        target: 5
    }
];

function utcDateKey(date = new Date()) {
    return date.toISOString().slice(0, 10);
}

function previousUtcDateKey(dateKey) {
    const date = new Date(`${dateKey}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() - 1);
    return utcDateKey(date);
}

function calculateStreak(dateKeys, today = utcDateKey()) {
    const dates = new Set(dateKeys);
    let cursor = today;

    // Yesterday's streak is still active until today ends.
    if (!dates.has(cursor)) {
        cursor = previousUtcDateKey(cursor);
    }

    let streak = 0;

    while (dates.has(cursor)) {
        streak++;
        cursor = previousUtcDateKey(cursor);
    }

    return streak;
}

async function getOrCreateAchievement(userId, definition) {
    return Achievement.findOneAndUpdate(
        {
            userId,
            name: definition.name
        },
        {
            $setOnInsert: {
                userId,
                ...definition,
                progress: 0,
                isUnlocked: false
            }
        },
        {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
        }
    );
}

async function getWeatherStreak(userId, now = new Date()) {
    const checks = await WeatherCheck.find({ userId })
        .sort({ dateKey: -1 })
        .limit(10)
        .select("dateKey")
        .lean();

    return calculateStreak(
        checks.map(check => check.dateKey),
        utcDateKey(now)
    );
}

async function updateWeatherWatcher(userId, now = new Date()) {
    const definition = DEFINITIONS[0];
    const streak = await getWeatherStreak(userId, now);

    const record = await getOrCreateAchievement(
        userId,
        definition
    );

    // Once unlocked, an achievement stays unlocked.
    if (record.isUnlocked) {
        if (record.progress !== definition.target) {
            record.progress = definition.target;
            await record.save();
        }

        return record;
    }

    record.progress = Math.min(
        streak,
        definition.target
    );

    if (streak >= definition.target) {
        record.isUnlocked = true;
        record.unlockedAt = now;
    }

    await record.save();
    return record;
}

async function recordWeatherCheck(userId, now = new Date()) {
    if (!userId) return null;

    const dateKey = utcDateKey(now);

    // Upsert and unique index prevent duplicate daily records.
    try {
        await WeatherCheck.updateOne(
            { userId, dateKey },
            {
                $setOnInsert: {
                    userId,
                    dateKey,
                    firstCheckedAt: now
                }
            },
            { upsert: true }
        );
    } catch (error) {
        // Concurrent requests can race on the unique index.
        // The other request already created today's check.
        if (error.code !== 11000) {
            throw error;
        }
    }

    return updateWeatherWatcher(userId, now);
}

async function recordStormForecastView(
    userId,
    currentWeather,
    locationName,
    now = new Date()
) {
    if (!userId || !currentWeather) {
        return null;
    }

    const events = eventsForWeather(
        currentWeather,
        [],
        locationName,
        now
    );

    const severeEvent = events.find(
        event => event.category === "severe"
    );

    if (!severeEvent) {
        return null;
    }

    const definition = DEFINITIONS[1];

    // Atomic update makes repeat forecast views idempotent.
    return Achievement.findOneAndUpdate(
        {
            userId,
            name: definition.name
        },
        {
            $setOnInsert: {
                userId,
                ...definition
            },
            $set: {
                progress: 1,
                isUnlocked: true
            },
            $min: {
                unlockedAt: now
            }
        },
        {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
        }
    );
}

async function getAchievements(userId, locationCount) {
    await updateWeatherWatcher(userId);

    const results = [];

    for (const definition of DEFINITIONS) {
        const record = await getOrCreateAchievement(
            userId,
            definition
        );

        if (definition.name === "Explorer") {
            const count = Math.max(
                0,
                Number(locationCount) || 0
            );

            record.progress = Math.min(
                count,
                definition.target
            );

            if (count >= definition.target) {
                record.isUnlocked = true;

                if (!record.unlockedAt) {
                    record.unlockedAt = new Date();
                }
            }

            // Keep an earned achievement unlocked.
            if (record.isUnlocked) {
                record.progress = definition.target;
            }

            await record.save();
        }

        results.push({
            name: record.name,
            description: record.description,
            progress: record.progress,
            target: record.target,
            isUnlocked: record.isUnlocked
        });
    }

    return results;
}

module.exports = {
    DEFINITIONS,
    utcDateKey,
    calculateStreak,
    getWeatherStreak,
    recordWeatherCheck,
    recordStormForecastView,
    getAchievements
};
