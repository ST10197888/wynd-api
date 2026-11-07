const mongoose = require('mongoose');
const SavedLocation = require('../models/SavedLocation');
const NotificationPreference = require('../models/NotificationPreference');
const NotificationDelivery = require('../models/NotificationDelivery');
const DeviceRegistration = require('../models/DeviceRegistration');
const { fetchCurrentWeather, fetchForecast } = require('./weatherProvider');
const { getMessaging } = require('../config/firebase');
const { eventsForWeather } = require('./weatherAlertRules');

const INTERVAL_MS = Math.max(5, Number(process.env.WEATHER_ALERT_INTERVAL_MINUTES) || 15) * 60 * 1000;
const SEVERE = new Set(['thunderstorm', 'tornado', 'squall', 'hurricane', 'tropical storm', 'extreme']);
const INVALID = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token']);
let running = false;
let timer;


async function attemptDelivery(userId, event, locationName) {
  // Atomic insert prevents duplicate alert claims across concurrent scheduler instances.
  let delivery;
  try {
    delivery = await NotificationDelivery.create({ userId, eventKey: event.eventKey, category: event.category,
      locationName, title: event.title, body: event.body });
  } catch (error) {
    if (error.code === 11000) return;
    throw error;
  }
  try {
    const registrations = await DeviceRegistration.find({ userId }).select('fcmToken').lean();
    const tokens = [...new Set(registrations.map(r => r.fcmToken).filter(Boolean))];
    if (!tokens.length) {
      await NotificationDelivery.updateOne({ _id: delivery._id }, { status: 'no_devices', attemptedAt: new Date() });
      return;
    }
    // Firebase multicast supports up to 500 tokens per call.
    let successCount = 0;
    let failureCount = 0;
    const stale = [];
    for (let i = 0; i < tokens.length; i += 500) {
      const batch = tokens.slice(i, i + 500);
      const result = await getMessaging().sendEachForMulticast({
        tokens: batch,
        notification: { title: event.title, body: event.body },
        android: { priority: 'high', notification: { channelId: 'wynd_alerts' } },
        data: { category: event.category, location: locationName }
      });
      successCount += result.successCount;
      failureCount += result.failureCount;
      result.responses.forEach((response, index) => {
        if (!response.success && INVALID.has(response.error?.code)) stale.push(batch[index]);
      });
    }
    if (stale.length) await DeviceRegistration.deleteMany({ userId, fcmToken: { $in: stale } });
    await NotificationDelivery.updateOne({ _id: delivery._id }, {
      status: successCount ? 'sent' : 'failed', successCount, failureCount, attemptedAt: new Date()
    });
  } catch (error) {
    await NotificationDelivery.updateOne({ _id: delivery._id }, {
      status: 'failed', attemptedAt: new Date(), lastError: String(error.message).slice(0, 300)
    });
    console.error('Weather alert delivery failed:', error.message);
  }
}

async function scanWeatherAlerts() {
  if (running || mongoose.connection.readyState !== 1) return;
  running = true;
  try {
    const locations = await SavedLocation.find({}).select('userId locationName').lean();
    const grouped = new Map();
    for (const loc of locations) {
      const name = String(loc.locationName || '').trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (!grouped.has(key)) grouped.set(key, { name, users: new Set() });
      grouped.get(key).users.add(String(loc.userId));
    }
    for (const { name, users } of grouped.values()) {
      try {
        const [current, forecast] = await Promise.all([fetchCurrentWeather(name), fetchForecast(name)]);
        const events = eventsForWeather(current, forecast, name);
        if (!events.length) continue;
        for (const userId of users) {
          const preference = await NotificationPreference.findOne({ userId }).lean();
          if (preference?.enabled === false || preference?.smartAlertsEnabled === false) continue;
          for (const event of events) {
            if (event.category === 'rain' && preference?.rainAlertsEnabled === false) continue;
            if (event.category === 'severe' && preference?.severeWeatherAlertsEnabled === false) continue;
            await attemptDelivery(userId, event, name);
          }
        }
      } catch (error) {
        console.error(`Weather alert scan failed for ${name}:`, error.message);
      }
    }
  } finally {
    running = false;
  }
}

function startWeatherAlertScheduler() {
  if (timer || process.env.WEATHER_ALERTS_ENABLED !== 'true') return;
  timer = setInterval(() => scanWeatherAlerts().catch(err => console.error('Weather scan error:', err.message)), INTERVAL_MS);
  timer.unref?.();
  console.log(`Weather alert scheduler enabled (every ${INTERVAL_MS / 60000} minutes)`);
  scanWeatherAlerts().catch(err => console.error('Initial weather scan error:', err.message));
}

module.exports = { startWeatherAlertScheduler, scanWeatherAlerts, eventsForWeather };
