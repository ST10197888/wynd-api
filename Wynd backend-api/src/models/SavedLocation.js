const mongoose = require("mongoose");

const savedLocationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    locationName: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    country: { type: String },
    isDefault: { type: Boolean, default: false }
}, { timestamps: { createdAt: true, updatedAt: false } });

module.exports = mongoose.model("SavedLocation", savedLocationSchema);