const mongoose = require("mongoose");

const savedLocationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    clientId: { type: String, trim: true },
    clientTimestamp: { type: Date },
    locationName: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    country: { type: String },
    isDefault: { type: Boolean, default: false }
}, { timestamps: { createdAt: true, updatedAt: false } });

savedLocationSchema.index({ userId: 1, clientId: 1 }, { unique: true, partialFilterExpression: { clientId: { $type: "string" } } });

module.exports = mongoose.model("SavedLocation", savedLocationSchema);