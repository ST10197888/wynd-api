const express = require('express');
const { body, validationResult } = require('express-validator');
const authenticateToken = require('../middleware/authMiddleware');
const requireOwner = require('../middleware/requireOwner');
const DeviceRegistration = require('../models/DeviceRegistration');
const NotificationPreference = require('../models/NotificationPreference');
const { getMessaging } = require('../config/firebase');

const router = express.Router();
const tokenValidation = body('fcmToken').isString().isLength({ min: 20, max: 4096 });
const invalidTokenCodes = new Set([
    'messaging/registration-token-not-registered',
    'messaging/invalid-registration-token'
]);

function rejectInvalid(req, res) {
    const errors = validationResult(req);
    if (errors.isEmpty()) return false;
    res.status(400).json({ success: false, errors: errors.array() });
    return true;
}

// A token represents an app installation, not an account. Its unique index
// ensures it belongs to only the most recently signed-in account.
router.put('/users/:userId/fcm-token', authenticateToken, requireOwner, [tokenValidation], async (req, res) => {
    if (rejectInvalid(req, res)) return;
    try {
        const { fcmToken } = req.body;
        await DeviceRegistration.findOneAndUpdate(
            { fcmToken },
            { $set: { userId: req.params.userId, lastSeenAt: new Date() } },
            { upsert: true, new: true, runValidators: true }
        );
        // Remove the legacy association so older single-token data cannot
        // deliver private notifications to the previous account.
        await NotificationPreference.updateMany(
            { fcmToken }, { $unset: { fcmToken: 1 } }
        );
        return res.status(200).json({ message: 'Device token registered.' });
    } catch (err) {
        console.error('Register FCM token error:', err.message);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});

// Logout revokes only the current installation, never the user's other phones.
router.delete('/users/:userId/fcm-token', authenticateToken, requireOwner, [tokenValidation], async (req, res) => {
    if (rejectInvalid(req, res)) return;
    try {
        await DeviceRegistration.deleteOne({ userId: req.params.userId, fcmToken: req.body.fcmToken });
        await NotificationPreference.updateOne(
            { userId: req.params.userId, fcmToken: req.body.fcmToken },
            { $unset: { fcmToken: 1 } }
        );
        return res.status(200).json({ message: 'Device unregistered.' });
    } catch (err) {
        console.error('Unregister FCM token error:', err.message);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});

router.post('/users/:userId/notifications/test', authenticateToken, requireOwner, [
    body('title').optional().isString().isLength({ max: 100 }),
    body('body').optional().isString().isLength({ max: 300 })
], async (req, res) => {
    if (rejectInvalid(req, res)) return;
    try {
        const userId = req.params.userId;
        const registrations = await DeviceRegistration.find({ userId }).select('fcmToken').lean();
        // Legacy support for registrations made before this migration.
        const legacy = await NotificationPreference.findOne({ userId }).select('fcmToken').lean();
        const tokens = [...new Set([
            ...registrations.map(r => r.fcmToken),
            ...(legacy?.fcmToken ? [legacy.fcmToken] : [])
        ])];
        if (!tokens.length) {
            return res.status(404).json({ success: false, message: 'No device registered for this user.' });
        }
        const title = req.body.title || 'Wynd weather alert';
        const messageBody = req.body.body || 'This is a test notification from the Wynd API.';
        const result = await getMessaging().sendEachForMulticast({
            tokens,
            notification: { title, body: messageBody },
            android: { priority: 'high', notification: { channelId: 'wynd_alerts' } }
        });
        const stale = result.responses.flatMap((response, index) =>
            !response.success && invalidTokenCodes.has(response.error?.code) ? [tokens[index]] : []
        );
        if (stale.length) {
            await DeviceRegistration.deleteMany({ userId, fcmToken: { $in: stale } });
            await NotificationPreference.updateOne(
                { userId, fcmToken: { $in: stale } }, { $unset: { fcmToken: 1 } }
            );
        }
        if (result.successCount === 0 && stale.length === tokens.length) {
            return res.status(410).json({ success: false, message: 'All device tokens expired. Open the app to register again.' });
        }
        return res.status(200).json({
            message: 'Test notification delivery attempted.',
            successCount: result.successCount,
            failureCount: result.failureCount,
            messageId: result.responses.find(r => r.success)?.messageId || null,
            messageIds: result.responses.filter(r => r.success).map(r => r.messageId)
        });
    } catch (err) {
        console.error('Send test notification error:', err.message);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});

module.exports = router;
