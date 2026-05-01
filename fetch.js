import https from 'node:https';
import fs from 'node:fs';

https.get('https://matthewlincoln.net/pokopia-housing-solver/assets/index-Bx7x4bkz.js', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => fs.writeFileSync('solver.js', data));
});
