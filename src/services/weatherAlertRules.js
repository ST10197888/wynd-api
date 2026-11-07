
const SEVERE_CONDITIONS = new Set([
    "thunderstorm",
    "tornado",
    "squall",
    "hurricane",
    "tropical storm",
    "extreme"
]);

function dateAtOffset(now, offsetSeconds) {
    return new Date(
        now.getTime() + offsetSeconds * 1000
    ).toISOString().slice(0, 10);
}

function eventsForWeather(
    current,
    forecast,
    locationName,
    now = new Date()
) {
    const events = [];

    const name = String(locationName || "").trim();

    if (!name) {
        return events;
    }

    const condition = String(
        current?.condition || ""
    ).trim().toLowerCase();

    const weatherId = Number(current?.weatherId);

    const isSevere =
        (
            Number.isInteger(weatherId) &&
            (
                (weatherId >= 200 && weatherId < 300) ||
                weatherId === 771 ||
                weatherId === 781
            )
        ) ||
        SEVERE_CONDITIONS.has(condition) ||
        condition.includes("thunderstorm");

    const offset = Number(
        current?.timezoneOffsetSeconds ??
        forecast?.[0]?.timezoneOffsetSeconds ??
        0
    );

    const dateKey = dateAtOffset(
        now,
        Number.isFinite(offset) ? offset : 0
    );

    const locationKey = name.toLowerCase();

    if (isSevere) {
        events.push({
            category: "severe",

            eventKey:
                `severe:${locationKey}:${dateKey}:${weatherId || condition}`,

            title: "Severe weather warning",

            body:
                `${current.condition || "Severe weather"} reported in ${name}. ` +
                "Check local safety guidance."
        });
    }

    const days = Array.isArray(forecast)
        ? forecast
        : [];

    const today = days.find(day => {
        if (typeof day?.localDate === "string") {
            return day.localDate === dateKey;
        }

        const parsed = new Date(day?.date);

        return (
            !Number.isNaN(parsed.getTime()) &&
            parsed.toISOString().slice(0, 10) === dateKey
        );
    });

    const probability = today
        ? Number(
            today.maxRainProbability ??
            today.rainProbability
        )
        : NaN;

    if (
        Number.isFinite(probability) &&
        probability >= 70
    ) {
        events.push({
            category: "rain",

            eventKey:
                `rain:${locationKey}:${dateKey}`,

            title: "Rain likely today",

            body:
                `Rain probability reaches approximately ` +
                `${Math.round(probability)}% during at least one ` +
                `forecast period in ${name}.`
        });
    }

    return events;
}

module.exports = {
    eventsForWeather
};
