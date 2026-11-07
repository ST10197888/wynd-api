const express = require("express");
const { body, validationResult } = require("express-validator");
const authenticateToken = require("../middleware/authMiddleware");
const requireOwner = require("../middleware/requireOwner");
const UserSettings = require("../models/UserSettings");
const SavedLocation = require("../models/SavedLocation");

const router = express.Router();
const MAX_SAVED_LOCATIONS = 10;

const settingsFields = ["temperatureUnit", "windSpeedUnit", "precipitationUnit", "timeFormat", "theme", "language", "notificationsEnabled", "smartAlertsEnabled", "automaticLocationEnabled", "biometricEnabled", "defaultLocation"];

router.get("/users/:userId/settings", authenticateToken, requireOwner, async (req, res) => {
    try {
        const settings = await UserSettings.findOne({ userId: req.user.userId });
        return res.status(200).json({ settings: settings || { userId: req.user.userId } });
    } catch (err) {
        console.error("Get settings error:", err.message);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
});

router.put("/users/:userId/settings", authenticateToken, requireOwner, [
    body("temperatureUnit").optional().isIn(["C", "F"]),
    body("windSpeedUnit").optional().isIn(["km/h", "mph"]),
    body("precipitationUnit").optional().isIn(["mm", "in"]),
    body("timeFormat").optional().isIn(["12h", "24h"]),
    body("theme").optional().isIn(["Light", "Dark", "System"]),
    body("language").optional().isIn(["English", "Afrikaans", "isiZulu"]),
    body("defaultLocation").optional().isString().isLength({ max: 120 }),
    ...["notificationsEnabled", "smartAlertsEnabled", "automaticLocationEnabled", "biometricEnabled"].map(field => body(field).optional().isBoolean())
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
        const changes = Object.fromEntries(settingsFields.filter(key => Object.prototype.hasOwnProperty.call(req.body, key)).map(key => [key, req.body[key]]));
        if (!Object.keys(changes).length) return res.status(400).json({ success: false, message: "No recognized settings supplied." });
        const settings = await UserSettings.findOneAndUpdate(
            { userId: req.user.userId },
            { $set: changes, $setOnInsert: { userId: req.user.userId } },
            { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
        );
        return res.status(200).json({ message: "Settings updated successfully.", settings });
    } catch (err) {
        console.error("Update settings error:", err.message);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
});

router.get("/users/:userId/locations", authenticateToken, requireOwner, async (req, res) => {
    try {
        const locations = await SavedLocation.find({ userId: req.params.userId });
        return res.status(200).json({ locations });
    } catch (err) {
        console.error("Get locations error:", err.message);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
});

router.post("/users/:userId/locations", authenticateToken, requireOwner, [
    body("locationName").notEmpty().withMessage("locationName is required."),
    body("latitude").isFloat({ min: -90, max: 90 }).withMessage("latitude must be a number."),
    body("longitude").isFloat({ min: -180, max: 180 }).withMessage("longitude must be a number.")
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }
        const count = await SavedLocation.countDocuments({ userId: req.params.userId });
        if (count >= MAX_SAVED_LOCATIONS) {
            return res.status(403).json({ success: false, message: `You can save a maximum of ${MAX_SAVED_LOCATIONS} locations.` });
        }
        const { locationName, latitude, longitude, country } = req.body;
        await SavedLocation.create({ userId: req.user.userId, locationName, latitude, longitude, country });
        const locations = await SavedLocation.find({ userId: req.params.userId });
        return res.status(201).json({ message: "Location saved.", locations });
    } catch (err) {
        console.error("Save location error:", err.message);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
});

router.delete("/users/:userId/locations", authenticateToken, requireOwner, [
    body("locationName").notEmpty().withMessage("locationName is required.")
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }
        await SavedLocation.findOneAndDelete({ userId: req.params.userId, locationName: req.body.locationName });
        const locations = await SavedLocation.find({ userId: req.params.userId });
        return res.status(200).json({ message: "Location removed.", locations });
    } catch (err) {
        console.error("Delete location error:", err.message);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
});

module.exports = router;