const test = require('node:test');
const assert = require('node:assert/strict');
const {toClient, parseClient} = require('../src/services/settingsAdapter');
test('settings adapter maps server fields to Android contract', () => {
  assert.deepEqual(toClient({temperatureUnit:'F',theme:'Dark',language:'isiZulu',notificationsEnabled:false}), {
    tempUnit:'F',timeFormat:'24h',theme:'DARK',language:'zu',defaultLocation:'',notificationsEnabled:false
  });
});
test('settings adapter rejects invalid values', () => {
  assert.equal(parseClient({theme:'UNSAFE'}), null);
  assert.equal(parseClient({notificationsEnabled:'false'}), null);
  assert.equal(parseClient({unknown:true}), null);
});
test('settings adapter accepts valid Android values', () => {
  assert.deepEqual(parseClient({tempUnit:'C',theme:'SYSTEM',language:'en'}), {
    temperatureUnit:'C',theme:'System',language:'English'
  });
});
