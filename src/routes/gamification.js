const express = require('express');
const authenticateToken = require('../middleware/authMiddleware');
const Achievement = require('../models/Achievement');
const DailyFact = require('../models/DailyFact');
const SavedLocation = require('../models/SavedLocation');
const { dummyFacts } = require('../data/dummyData');
const router = express.Router();
const definitions = [
  {name:'Weather Watcher',description:'Checked the weather 10 days in a row.',requirement:'10-day weather-check streak',target:10},
  {name:'Storm Spotter',description:'Viewed a forecast during a storm warning.',requirement:'View storm-warning forecast',target:1},
  {name:'Explorer',description:'Saved 5 different locations.',requirement:'Save five locations',target:5}
];
router.get('/gamification/daily-fact', authenticateToken, async (req,res) => {
  try {
    const today = new Date(); today.setUTCHours(0,0,0,0);
    const index = Math.floor(today.getTime()/86400000) % dummyFacts.length;
    const fact = await DailyFact.findOneAndUpdate({date:today}, {$setOnInsert:{date:today,...dummyFacts[index]}}, {upsert:true,new:true,setDefaultsOnInsert:true});
    return res.json({fact:fact.factText});
  } catch(err) { console.error('Daily fact error:',err.message); return res.status(500).json({success:false,message:'Internal server error.'}); }
});
router.get('/gamification/achievements', authenticateToken, async (req,res) => {
  try {
    const userId = req.user.userId;
    const locations = await SavedLocation.countDocuments({userId});
    const achievements = [];
    for (const definition of definitions) {
      const record = await Achievement.findOneAndUpdate({userId,name:definition.name},{$setOnInsert:{userId,...definition}},{upsert:true,new:true,setDefaultsOnInsert:true});
      if (definition.name === 'Explorer') {
        record.progress = Math.min(locations,definition.target);
        record.isUnlocked = locations >= definition.target;
        if (record.isUnlocked && !record.unlockedAt) record.unlockedAt = new Date();
        await record.save();
      }
      achievements.push({name:record.name,description:record.description,progress:record.progress,target:record.target,isUnlocked:record.isUnlocked});
    }
    return res.json({achievements});
  } catch(err) { console.error('Achievements error:',err.message); return res.status(500).json({success:false,message:'Internal server error.'}); }
});
module.exports = router;
