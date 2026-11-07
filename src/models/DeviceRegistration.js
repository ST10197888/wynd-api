const mongoose = require('mongoose');

const deviceRegistrationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    fcmToken: { type: String, required: true, unique: true },
    lastSeenAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('DeviceRegistration', deviceRegistrationSchema);
