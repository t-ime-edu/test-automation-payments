/**
 * API 라우트
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { TestManagerService } from '../services/test-manager.service.js';
import { ConfigService } from '../services/config.service.js';

const router = express.Router();
const testManager = new TestManagerService();
const configService = new ConfigService();

// 설정 API
router.get('/config', (req, res) => {
  try {
    const config = configService.getConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/config', (req, res) => {
  try {
    const result = configService.updateConfig(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 테스트 실행 API
router.post('/run-test', async (req, res) => {
  try {
    // 비동기로 테스트 시작
    testManager.runTest(req.body).catch(error => {
      console.error('Test execution error:', error);
    });

    res.json({ success: true, message: 'Test started' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/stop-test', (req, res) => {
  try {
    const result = testManager.stopTest();
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/status', (req, res) => {
  const status = testManager.getStatus();
  res.json(status);
});


export default router;
