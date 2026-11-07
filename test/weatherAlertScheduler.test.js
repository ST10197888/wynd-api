const test = require('node:test');
const assert = require('node:assert/strict');
const { eventsForWeather } = require('../src/services/weatherAlertRules');
const now = new Date('2026-11-07T09:00:00Z');
test('creates severe and rain events with stable daily keys', () => {
  const events = eventsForWeather({ condition: 'Thunderstorm' }, [{ date: '2026-11-07', rainProbability: 85 }], 'Johannesburg', now);
  assert.equal(events.length, 2);
  assert.equal(events[0].category, 'severe');
  assert.equal(events[1].eventKey, 'rain:johannesburg:2026-11-07');
});
test('does not alert on mild weather or low rain probability', () => {
  assert.deepEqual(eventsForWeather({ condition: 'Clouds' }, [{ date: '2026-11-07', rainProbability: 40 }], 'Pretoria', now), []);
});
