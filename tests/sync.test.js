'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('docs/js/core.js is an up-to-date copy of backend/Core.gs (run: node tools/sync-core.js)', () => {
  const root = path.join(__dirname, '..');
  const src = fs.readFileSync(path.join(root, 'backend', 'Core.gs'), 'utf8').replace(/\r\n/g, '\n');
  const copy = fs.readFileSync(path.join(root, 'docs', 'js', 'core.js'), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(copy.slice(copy.indexOf('\n') + 1), src);
});
