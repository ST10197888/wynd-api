
const mongoose = require("mongoose");

const weatherCheckSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        dateKey: {
            type: String,
            required: true,
            match: /^\d{4}-\d{2}-\d{2}$/
        },

        firstCheckedAt: {
            type: Date,
            default: Date.now
        }
    },
    { timestamps: true }
);

// One check per user per UTC calendar day.
weatherCheckSchema.index(
    { userId: 1, dateKey: 1 },
    { unique: true }
);

module.exports = mongoose.model(
    "WeatherCheck",
    weatherCheckSchema
);
