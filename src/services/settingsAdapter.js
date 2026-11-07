const fields = ['tempUnit', 'timeFormat', 'theme', 'language', 'defaultLocation', 'notificationsEnabled'];
const toClient = s => ({
  tempUnit: s.temperatureUnit || 'C',
  timeFormat: s.timeFormat || '24h',
  theme: ({ Light: 'LIGHT', Dark: 'DARK', System: 'SYSTEM' })[s.theme] || 'SYSTEM',
  language: ({ English: 'en', Afrikaans: 'af', isiZulu: 'zu' })[s.language] || 'en',
  defaultLocation: s.defaultLocation || '',
  notificationsEnabled: s.notificationsEnabled !== false
});
function parseClient(body) {
  const values = {};
  if (!body || typeof body !== 'object' || Array.isArray(body) || !fields.some(k => Object.hasOwn(body,k))) return null;
  for (const key of Object.keys(body)) if (!fields.includes(key)) return null;
  if (Object.hasOwn(body,'tempUnit')) {
    if (!['C','F'].includes(body.tempUnit)) return null;
    values.temperatureUnit = body.tempUnit;
  }
  if (Object.hasOwn(body,'timeFormat')) {
    if (!['12h','24h'].includes(body.timeFormat)) return null;
    values.timeFormat = body.timeFormat;
  }
  if (Object.hasOwn(body,'theme')) {
    if (!['LIGHT','DARK','SYSTEM'].includes(body.theme)) return null;
    values.theme = {LIGHT:'Light',DARK:'Dark',SYSTEM:'System'}[body.theme];
  }
  if (Object.hasOwn(body,'language')) {
    if (!['en','af','zu'].includes(body.language)) return null;
    values.language = {en:'English',af:'Afrikaans',zu:'isiZulu'}[body.language];
  }
  if (Object.hasOwn(body,'defaultLocation')) {
    if (typeof body.defaultLocation !== 'string' || body.defaultLocation.length > 120) return null;
    values.defaultLocation = body.defaultLocation;
  }
  if (Object.hasOwn(body,'notificationsEnabled')) {
    if (typeof body.notificationsEnabled !== 'boolean') return null;
    values.notificationsEnabled = body.notificationsEnabled;
  }
  return values;
}
module.exports = {toClient,parseClient};
