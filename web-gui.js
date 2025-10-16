#!/usr/bin/env node

/**
 * Web GUI 서버
 * 브라우저에서 테스트를 쉽게 설정하고 실행할 수 있는 웹 인터페이스
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import apiRoutes from './src/web/routes/api.routes.js';
import { config } from './src/config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// 미들웨어
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 정적 파일 (CSS, JS, images)
app.use(express.static(path.join(__dirname, 'public')));

// API 라우트
app.use('/api', apiRoutes);

// 메인 페이지
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/web/views/index.html'));
});

// 서버 시작
app.listen(port, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║     🎉 온라인 수강신청 자동화 테스트 GUI                   ║
╚════════════════════════════════════════════════════════════╝

📱 URL: http://localhost:${port}
🌍 환경: ${config.environmentName} (${config.environment})
🔗 대상 URL: ${config.baseUrl}
🏫 신청 코드: ${config.defaultAcadCd}

🚀 기능:
   • 브라우저에서 모든 설정 가능
   • 실시간 테스트 모니터링
   • 환경변수 설정 GUI
   • 멀티 테스트 모드
   • 테스트 보고서 확인

✨ 브라우저를 열고 위 URL로 접속하세요!
  `);
});

// 에러 핸들러
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n👋 Shutting down gracefully...');
  process.exit(0);
});
