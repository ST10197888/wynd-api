const express = require('express');
const authenticateToken = require('../middleware/authMiddleware');
const UserSettings = require('../models/UserSettings');
const router = express.Router();
const {toClient,parseClient} = require('../services/settingsAdapter');
router.get('/settings', authenticateToken, async (req,res) => {
  try {
    const settings = await UserSettings.findOne({userId:req.user.userId}).lean();
    return res.json(toClient(settings || {}));
  } catch(e) { console.error('Get mobile settings:',e.message); return res.status(500).json({success:false,message:'Internal server error.'}); }
});
router.put('/settings', authenticateToken, async (req,res) => {
  const changes = parseClient(req.body);
  if (!changes) return res.status(400).json({success:false,message:'Invalid mobile settings.'});
  try {
    const settings = await UserSettings.findOneAndUpdate({userId:req.user.userId}, {$set:changes,$setOnInsert:{userId:req.user.userId}}, {upsert:true,new:true,runValidators:true,setDefaultsOnInsert:true}).lean();
    return res.json(toClient(settings));
  } catch(e) { console.error('Update mobile settings:',e.message); return res.status(500).json({success:false,message:'Internal server error.'}); }
});
module.exports = router;
