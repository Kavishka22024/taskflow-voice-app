// Copies backend/Core.gs -> docs/js/core.js so the browser demo runs the exact same business logic.
// Run after every change to Core.gs:   node tools/sync-core.js
// (tests/sync.test.js fails if you forget.)
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = path.join(root, 'backend', 'Core.gs');
const dst = path.join(root, 'docs', 'js', 'core.js');
const banner = '/* GENERATED COPY of backend/Core.gs - do not edit here. Run: node tools/sync-core.js */\n';
fs.writeFileSync(dst, banner + fs.readFileSync(src, 'utf8'));
console.log('Copied Core.gs -> docs/js/core.js');
