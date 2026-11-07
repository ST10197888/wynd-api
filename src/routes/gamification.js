
const express = require("express");

const authenticateToken = require("../middleware/authMiddleware");
const DailyFact = require("../models/DailyFact");
const SavedLocation = require("../models/SavedLocation");

const { dummyFacts } = require("../data/dummyData");
const { getAchievements } = require("../services/achievementService");

const router = express.Router();

router.get(
    "/gamification/daily-fact",
    authenticateToken,
    async (req, res) => {
        try {
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);

            const index =
                Math.floor(today.getTime() / 86400000) %
                dummyFacts.length;

            const fact = await DailyFact.findOneAndUpdate(
                { date: today },
                {
                    $setOnInsert: {
                        date: today,
                        ...dummyFacts[index]
                    }
                },
                {
                    upsert: true,
                    new: true,
                    setDefaultsOnInsert: true
                }
            );

            return res.status(200).json({
                fact: fact.factText
            });
        } catch (error) {
            console.error(
                "Daily fact error:",
                error.message
            );

            return res.status(500).json({
                success: false,
                message: "Internal server error."
            });
        }
    }
);

router.get(
    "/gamification/achievements",
    authenticateToken,
    async (req, res) => {
        try {
            const userId = req.user.userId;

            const locationCount =
                await SavedLocation.countDocuments({
                    userId
                });

            const achievements =
                await getAchievements(
                    userId,
                    locationCount
                );

            return res.status(200).json({
                achievements
            });
        } catch (error) {
            console.error(
                "Achievements error:",
                error.message
            );

            return res.status(500).json({
                success: false,
                message: "Internal server error."
            });
        }
    }
);

module.exports = router;
