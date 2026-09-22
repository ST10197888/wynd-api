const mongoose = require("mongoose");

const notificationPreferenceSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    enabled: { type: Boolean, default: true },
    smartAlertsEnabled: { type: Boolean, default: true },
    rainAlertsEnabled: { type: Boolean, default: true },
    severeWeatherAlertsEnabled: { type: Boolean, default: true },
    dailyWeatherEnabled: { type: Boolean, default: true },
    fcmToken: { type: String }
}, { timestamps: { createdAt: false, updatedAt: true } });

module.exports = mongoose.model("NotificationPreference", notificationPreferenceSchema);