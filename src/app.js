require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { connectToDatabase } = require("./config/db");
const authRouter = require("./routes/auth");
const usersRouter = require("./routes/users");
const weatherRouter = require("./routes/weather");
const gamificationRouter = require("./routes/gamification");

const app = express();

app.use(express.json({ limit: "10kb" }));
app.use(cors());

connectToDatabase().catch(err => {
    console.error("MongoDB connection error:", err.message);
});

app.get("/", (req, res) => {
    res.status(200).json({ success: true, message: "Wynd API is up and running." });
});

app.use(authRouter);
app.use(usersRouter);
app.use(weatherRouter);
app.use(gamificationRouter);

app.use((req, res) => {
    res.status(404).json({ success: false, message: "Route not found." });
});

app.use((err, req, res, next) => {
    console.error("Server error:", err.message);
    res.status(500).json({ success: false, message: "Something went wrong on our end. Try again later." });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Wynd API running on port ${PORT}`);
});

module.exports = app;