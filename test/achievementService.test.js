
const test = require("node:test");
const assert = require("node:assert/strict");

const {
    utcDateKey,
    calculateStreak
} = require("../src/services/achievementService");

test("converts timestamps to UTC date keys", () => {
    const date = new Date(
        "2026-11-07T23:45:00Z"
    );

    assert.equal(
        utcDateKey(date),
        "2026-11-07"
    );
});

test("counts consecutive weather-check days", () => {
    const dates = [
        "2026-11-07",
        "2026-11-06",
        "2026-11-05"
    ];

    assert.equal(
        calculateStreak(dates, "2026-11-07"),
        3
    );
});

test("does not count duplicate dates", () => {
    const dates = [
        "2026-11-07",
        "2026-11-07",
        "2026-11-06"
    ];

    assert.equal(
        calculateStreak(dates, "2026-11-07"),
        2
    );
});

test("keeps yesterday's streak active", () => {
    const dates = [
        "2026-11-06",
        "2026-11-05"
    ];

    assert.equal(
        calculateStreak(dates, "2026-11-07"),
        2
    );
});

test("resets a streak after a missed day", () => {
    const dates = [
        "2026-11-05",
        "2026-11-04"
    ];

    assert.equal(
        calculateStreak(dates, "2026-11-07"),
        0
    );
});

test("recognizes a ten-day streak", () => {
    const dates = [];

    for (let day = 1; day <= 10; day++) {
        dates.push(
            `2026-11-${String(day).padStart(2, "0")}`
        );
    }

    assert.equal(
        calculateStreak(dates, "2026-11-10"),
        10
    );
});
