import { Buffer } from 'buffer';

// Polyfill Buffer
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

// Polyfill process
if (typeof global.process === 'undefined') {
  global.process = require('process');
} 