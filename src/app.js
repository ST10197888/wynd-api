require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { connectToDatabase } = require("./config/db");
const authRouter = require("./routes/auth");
const usersRouter = require("./routes/users");
const weatherRouter = require("./routes/weather");
const gamificationRouter = require("./routes/gamification");
const filesRouter = require("./routes/files");
const notificationsRouter = require("./routes/notifications");
const syncRouter = require("./routes/sync");
const settingsCompatibilityRouter = require("./routes/settingsCompatibility");
const mongoose = require("mongoose");

const app = express();

app.use(express.json({ limit: "10kb" }));
app.disable("x-powered-by");
app.use(cors({ origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",").map(x => x.trim()) : false }));

connectToDatabase().catch(err => {
    console.error("MongoDB connection error:", err.message);
});

app.get("/", (req, res) => {
    res.status(200).json({ success: true, message: "Wynd API is up and running." });
});

app.get("/health/live", (req, res) => res.status(200).json({status:"alive"}));
app.get("/health/ready", (req, res) => res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({status:mongoose.connection.readyState === 1 ? "ready" : "unavailable"}));
app.use(authRouter);
app.use(settingsCompatibilityRouter);
app.use(usersRouter);
app.use(weatherRouter);
app.use(gamificationRouter);
app.use(filesRouter);
app.use(notificationsRouter);
app.use(syncRouter);

app.use((req, res) => {
    res.status(404).json({ success: false, message: "Route not found." });
});

app.use((err, req, res, next) => {
    console.error("Server error:", err.message);
    res.status(500).json({ success: false, message: "Something went wrong on our end. Try again later." });
});

const PORT = process.env.PORT || 5000;
if (require.main === module) {
    app.listen(PORT, () => console.log(`Wynd API running on port ${PORT}`));
}

module.exports = app;