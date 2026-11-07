const SEVERE = new Set(["thunderstorm", "tornado", "squall", "hurricane", "tropical storm", "extreme"]);
function eventsForWeather(current, forecast, locationName, now = new Date()) {
  const events = [];
  const condition = String(current.condition || '').toLowerCase();
  const dateKey = now.toISOString().slice(0, 10);
  const locationKey = locationName.trim().toLowerCase();
  if (SEVERE.has(condition)) {
    events.push({ category: 'severe', eventKey: `severe:${locationKey}:${dateKey}:${condition}`,
      title: 'Severe weather warning', body: `${current.condition} reported in ${locationName}. Check local safety guidance.` });
  }
  const today = forecast.find(day => new Date(day.date).toISOString().slice(0, 10) === dateKey);
  if (today && Number(today.rainProbability) >= 70) {
    events.push({ category: 'rain', eventKey: `rain:${locationKey}:${dateKey}`,
      title: 'Rain likely today', body: `Rain probability is approximately ${Math.round(today.rainProbability)}% in ${locationName}.` });
  }
  return events;
}

module.exports = { eventsForWeather };
