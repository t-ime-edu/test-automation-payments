/**
 * API 라우트
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { TestManagerService } from '../services/test-manager.service.js';
import { ConfigService } from '../services/config.service.js';
import { ReportGenerator } from '../../reports/report-generator.js';

const router = express.Router();
const testManager = new TestManagerService();
const configService = new ConfigService();
const reportGenerator = new ReportGenerator();

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

// 보고서 API
router.get('/reports/latest', (req, res) => {
  const latestPath = path.join(process.cwd(), 'reports', 'latest.html');

  if (fs.existsSync(latestPath)) {
    const html = fs.readFileSync(latestPath, 'utf8');
    res.send(html);
  } else {
    res.status(404).send(`
      <html>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h2>📋 보고서가 없습니다</h2>
          <p>아직 생성된 테스트 보고서가 없습니다.</p>
          <p>테스트를 실행한 후 다시 확인해주세요.</p>
        </body>
      </html>
    `);
  }
});

router.get('/reports/list', (req, res) => {
  try {
    const reports = reportGenerator.getRecentReports(10);
    const reportsDir = path.join(process.cwd(), 'reports');

    const validReports = reports.filter(report => {
      const htmlPath = path.join(reportsDir, report.filename.replace('.json', '.html'));
      return fs.existsSync(htmlPath);
    });

    res.json(validReports);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/reports/download/txt', (req, res) => {
  const latestTxtPath = path.join(process.cwd(), 'reports', 'latest.txt');

  if (fs.existsSync(latestTxtPath)) {
    const txtData = fs.readFileSync(latestTxtPath, 'utf8');
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `test-report-${timestamp}.txt`;

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(txtData);
  } else {
    res.status(404).send('TXT report not found');
  }
});

router.get('/reports/:filename', (req, res) => {
  const filename = req.params.filename;
  const reportPath = path.join(process.cwd(), 'reports', filename);

  if (!fs.existsSync(reportPath)) {
    return res.status(404).json({ error: 'Report not found' });
  }

  if (filename.endsWith('.html')) {
    const html = fs.readFileSync(reportPath, 'utf8');
    res.send(html);
  } else if (filename.endsWith('.json')) {
    const jsonData = fs.readFileSync(reportPath, 'utf8');
    res.json(JSON.parse(jsonData));
  } else if (filename.endsWith('.txt')) {
    const txtData = fs.readFileSync(reportPath, 'utf8');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(txtData);
  } else {
    res.status(400).json({ error: 'Unsupported file format' });
  }
});

export default router;
