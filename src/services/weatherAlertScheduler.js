
const mongoose = require("mongoose");

const SavedLocation = require("../models/SavedLocation");
const NotificationPreference = require("../models/NotificationPreference");
const NotificationDelivery = require("../models/NotificationDelivery");
const DeviceRegistration = require("../models/DeviceRegistration");

const {
    fetchCurrentWeather,
    fetchForecast
} = require("./weatherProvider");

const { getMessaging } = require("../config/firebase");
const { eventsForWeather } = require("./weatherAlertRules");

const configuredMinutes = Number(
    process.env.WEATHER_ALERT_INTERVAL_MINUTES
);

const INTERVAL_MS = (
    Number.isFinite(configuredMinutes) &&
    configuredMinutes >= 5
        ? configuredMinutes
        : 15
) * 60 * 1000;

const INVALID = new Set([
    "messaging/registration-token-not-registered",
    "messaging/invalid-registration-token"
]);

let running = false;
let timer;

async function attemptDelivery(userId, event, locationName) {
    let delivery;

    try {
        // Requires a unique MongoDB index on userId + eventKey.
        delivery = await NotificationDelivery.create({
            userId,
            eventKey: event.eventKey,
            category: event.category,
            locationName,
            title: event.title,
            body: event.body
        });
    } catch (error) {
        if (error.code === 11000) {
            return "duplicate";
        }

        throw error;
    }

    try {
        const registrations = await DeviceRegistration
            .find({ userId })
            .select("fcmToken")
            .lean();

        const tokens = [
            ...new Set(
                registrations
                    .map(registration => registration.fcmToken)
                    .filter(Boolean)
            )
        ];

        if (!tokens.length) {
            await NotificationDelivery.updateOne(
                { _id: delivery._id },
                {
                    status: "no_devices",
                    attemptedAt: new Date()
                }
            );

            return "no_devices";
        }

        let successCount = 0;
        let failureCount = 0;

        const stale = [];

        for (let i = 0; i < tokens.length; i += 500) {
            const batch = tokens.slice(i, i + 500);

            const result = await getMessaging()
                .sendEachForMulticast({
                    tokens: batch,

                    notification: {
                        title: event.title,
                        body: event.body
                    },

                    android: {
                        priority: "high",
                        notification: {
                            channelId: "wynd_alerts"
                        }
                    },

                    data: {
                        category: event.category,
                        location: locationName
                    }
                });

            successCount += result.successCount;
            failureCount += result.failureCount;

            result.responses.forEach((response, index) => {
                if (
                    !response.success &&
                    INVALID.has(response.error?.code)
                ) {
                    stale.push(batch[index]);
                }
            });
        }

        if (stale.length) {
            await DeviceRegistration.deleteMany({
                userId,
                fcmToken: { $in: stale }
            });
        }

        await NotificationDelivery.updateOne(
            { _id: delivery._id },
            {
                status: successCount > 0
                    ? "sent"
                    : "failed",

                successCount,
                failureCount,
                attemptedAt: new Date()
            }
        );

        return successCount > 0
            ? "sent"
            : "failed";

    } catch (error) {
        await NotificationDelivery.updateOne(
            { _id: delivery._id },
            {
                status: "failed",
                attemptedAt: new Date(),
                lastError: String(error.message).slice(0, 300)
            }
        );

        console.error(
            "Weather alert delivery failed:",
            error.message
        );

        return "failed";
    }
}

async function scanWeatherAlerts() {
    if (running) {
        return;
    }

    if (mongoose.connection.readyState !== 1) {
        console.log(
            "Weather alert scan deferred: MongoDB is not connected"
        );
        return;
    }

    running = true;

    const stats = {
        locations: 0,
        events: 0,
        attempts: 0,
        sent: 0,
        duplicates: 0,
        failures: 0
    };

    try {
        const locations = await SavedLocation
            .find({})
            .select("userId locationName")
            .lean();

        const grouped = new Map();

        for (const loc of locations) {
    const name = String(
        loc.locationName || ""
    ).trim();

    if (!name || !loc.userId) {
        continue;
    }

    // Ignore locations created by bulk-sync tests.
    if (
        /^Bulk City\s+\d+\s+\d+$/i.test(name)
    ) {
        continue;
    }

            const key = name.toLowerCase();

            if (!grouped.has(key)) {
                grouped.set(key, {
                    name,
                    users: new Set()
                });
            }

            grouped.get(key).users.add(
                String(loc.userId)
            );
        }

        stats.locations = grouped.size;

        for (const { name, users } of grouped.values()) {
            try {
                const [current, forecast] =
                    await Promise.all([
                        fetchCurrentWeather(name),
                        fetchForecast(name)
                    ]);

                const events = eventsForWeather(
                    current,
                    forecast,
                    name
                );

                stats.events += events.length;

                for (const userId of users) {
                    const preference =
                        await NotificationPreference
                            .findOne({ userId })
                            .lean();

                    if (
                        preference?.enabled === false ||
                        preference?.smartAlertsEnabled === false
                    ) {
                        continue;
                    }

                    for (const event of events) {
                        if (
                            event.category === "rain" &&
                            preference?.rainAlertsEnabled === false
                        ) {
                            continue;
                        }

                        if (
                            event.category === "severe" &&
                            preference?.severeWeatherAlertsEnabled === false
                        ) {
                            continue;
                        }

                        stats.attempts++;

                        const outcome = await attemptDelivery(
                            userId,
                            event,
                            name
                        );

                        if (outcome === "sent") {
                            stats.sent++;
                        }

                        if (outcome === "duplicate") {
                            stats.duplicates++;
                        }

                        if (outcome === "failed") {
                            stats.failures++;
                        }
                    }
                }

            } catch (error) {
                stats.failures++;

                console.error(
                    `Weather alert scan failed for ${name}:`,
                    error.message
                );
            }
        }

        console.log(
            "Weather alert scan completed:",
            stats
        );

    } finally {
        running = false;
    }
}

function startWeatherAlertScheduler() {
    if (
        timer ||
        process.env.WEATHER_ALERTS_ENABLED !== "true"
    ) {
        return;
    }

    const runScan = () =>
        scanWeatherAlerts().catch(error =>
            console.error(
                "Weather scan error:",
                error.message
            )
        );

    timer = setInterval(
        runScan,
        INTERVAL_MS
    );

    timer.unref?.();

    console.log(
        `Weather alert scheduler enabled ` +
        `(every ${INTERVAL_MS / 60000} minutes)`
    );

    if (mongoose.connection.readyState === 1) {
        runScan();
    } else {
        mongoose.connection.once(
            "connected",
            runScan
        );

        console.log(
            "Weather alert scheduler waiting for MongoDB connection"
        );
    }
}

module.exports = {
    startWeatherAlertScheduler,
    scanWeatherAlerts,
    eventsForWeather
};
