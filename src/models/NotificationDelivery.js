const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  eventKey: { type: String, required: true },
  category: { type: String, enum: ['rain', 'severe'], required: true },
  locationName: { type: String, required: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  status: { type: String, enum: ['pending', 'sent', 'failed', 'no_devices'], default: 'pending' },
  successCount: { type: Number, default: 0 },
  failureCount: { type: Number, default: 0 },
  attemptedAt: Date,
  lastError: String
}, { timestamps: true });
schema.index({ userId: 1, eventKey: 1 }, { unique: true });
module.exports = mongoose.model('NotificationDelivery', schema);
