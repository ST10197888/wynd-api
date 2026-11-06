const express = require("express");
const { body, validationResult } = require("express-validator");
const authenticateToken = require("../middleware/authMiddleware");
const requireOwner = require("../middleware/requireOwner");
const NotificationPreference = require("../models/NotificationPreference");
const { getMessaging } = require("../config/firebase");

const router = express.Router();

router.put("/users/:userId/fcm-token", authenticateToken, requireOwner, [
    body("fcmToken").isString().isLength({ min: 20, max: 4096 }).withMessage("fcmToken is required.")
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }
        const { fcmToken } = req.body;
        await NotificationPreference.updateMany(
            { fcmToken, userId: { $ne: req.params.userId } },
            { $unset: { fcmToken: 1 } }
        );
        await NotificationPreference.findOneAndUpdate(
            { userId: req.params.userId },
            { $set: { fcmToken } },
            { upsert: true, new: true }
        );
        return res.status(200).json({ message: "Device token saved." });
    } catch (err) {
        console.error("Save FCM token error:", err.message);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
});

router.post("/users/:userId/notifications/test", authenticateToken, requireOwner, [
    body("title").optional().isString().isLength({ max: 100 }),
    body("body").optional().isString().isLength({ max: 300 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }
        const preference = await NotificationPreference.findOne({ userId: req.params.userId });
        if (!preference || !preference.fcmToken) {
            return res.status(404).json({ success: false, message: "No device registered for this user." });
        }
        const title = req.body.title || "Wynd weather alert";
        const messageBody = req.body.body || "This is a test notification from the Wynd API.";
        try {
            const messageId = await getMessaging().send({
                token: preference.fcmToken,
                notification: { title, body: messageBody },
                android: { priority: "high", notification: { channelId: "wynd_alerts" } }
            });
            return res.status(200).json({ message: "Test notification sent.", messageId });
        } catch (sendError) {
            if (
                sendError.code === "messaging/registration-token-not-registered" ||
                sendError.code === "messaging/invalid-registration-token"
            ) {
                await NotificationPreference.updateOne({ userId: req.params.userId }, { $unset: { fcmToken: 1 } });
                return res.status(410).json({ success: false, message: "Device token is no longer valid. Open the app to register again." });
            }
            throw sendError;
        }
    } catch (err) {
        console.error("Send test notification error:", err.message);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
});

module.exports = router;