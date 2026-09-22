const express = require("express");
const { body, validationResult } = require("express-validator");
const authenticateToken = require("../middleware/authMiddleware");
const UserSettings = require("../models/UserSettings");
const SavedLocation = require("../models/SavedLocation");

const router = express.Router();
const MAX_SAVED_LOCATIONS = 10;

router.put("/users/:userId/settings", authenticateToken, [
    body("temperatureUnit").optional().isIn(["C", "F"]),
    body("windSpeedUnit").optional().isIn(["km/h", "mph"]),
    body("theme").optional().isIn(["Light", "Dark", "System"]),
    body("language").optional().isIn(["English", "Afrikaans", "isiZulu"])
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }
        const settings = await UserSettings.findOneAndUpdate(
            { userId: req.params.userId },
            { $set: req.body },
            { new: true, upsert: true }
        );
        return res.status(200).json({ message: "Settings updated successfully.", settings });
    } catch (err) {
        console.error("Update settings error:", err.message);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
});

router.get("/users/:userId/locations", authenticateToken, async (req, res) => {
    try {
        const locations = await SavedLocation.find({ userId: req.params.userId });
        return res.status(200).json({ locations });
    } catch (err) {
        console.error("Get locations error:", err.message);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
});

router.post("/users/:userId/locations", authenticateToken, [
    body("locationName").notEmpty().withMessage("locationName is required."),
    body("latitude").isFloat().withMessage("latitude must be a number."),
    body("longitude").isFloat().withMessage("longitude must be a number.")
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
        await SavedLocation.create({ userId: req.params.userId, locationName, latitude, longitude, country });
        const locations = await SavedLocation.find({ userId: req.params.userId });
        return res.status(201).json({ message: "Location saved.", locations });
    } catch (err) {
        console.error("Save location error:", err.message);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
});

router.delete("/users/:userId/locations", authenticateToken, [
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