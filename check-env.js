#!/usr/bin/env node

import dotenv from 'dotenv';
import { config } from './src/config/index.js';

// .env 파일 로드
dotenv.config();

console.log('=== Environment Variables ===');
console.log('BASE_URL:', process.env.BASE_URL || 'Not set');
console.log('MAX_CONCURRENT_TESTS:', process.env.MAX_CONCURRENT_TESTS || 'Not set');
console.log('TEST_DURATION:', process.env.TEST_DURATION || 'Not set');
console.log('WAIT_TIMEOUT:', process.env.WAIT_TIMEOUT || 'Not set');
console.log('HEADLESS:', process.env.HEADLESS || 'Not set');
console.log('SCREENSHOT_ON_FAILURE:', process.env.SCREENSHOT_ON_FAILURE || 'Not set');
console.log('LOG_LEVEL:', process.env.LOG_LEVEL || 'Not set');
console.log('');

console.log('=== Config Validation ===');
try {
  config.validate();
  console.log('✓ Configuration is valid');
} catch (error) {
  console.log('✗ Configuration validation failed:');
  console.log(error.message);
}

console.log('');
console.log('=== Testing URL Access ===');
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const https = require('https');

if (process.env.BASE_URL) {
  console.log(`Testing access to: ${process.env.BASE_URL}`);
  
  // 간단한 HTTP 요청으로 연결 확인
  const url = new URL(process.env.BASE_URL);
  const options = {
    hostname: url.hostname,
    port: url.port,
    path: url.pathname,
    method: 'GET',
    timeout: 5000
  };

  const req = https.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Headers: ${JSON.stringify(res.headers)}`);
    res.on('data', (chunk) => {
      // 데이터 수신
    });
    res.on('end', () => {
      console.log('Connection test completed');
    });
  });

  req.on('error', (err) => {
    console.log(`Connection failed: ${err.message}`);
  });

  req.on('timeout', () => {
    console.log('Connection timed out');
    req.destroy();
  });

  req.setTimeout(5000);
  req.end();
} else {
  console.log('BASE_URL is not set in environment variables');
}