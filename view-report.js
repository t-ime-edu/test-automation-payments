#!/usr/bin/env node

import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🎯 온라인 수강신청 테스트 보고서 뷰어');
console.log('='.repeat(50));

const reportsDir = path.join(__dirname, 'reports');
const latestReport = path.join(reportsDir, 'latest.html');

if (fs.existsSync(latestReport)) {
  console.log('📊 최신 보고서를 브라우저에서 열고 있습니다...');

  const command = process.platform === 'darwin' ? 'open' :
                 process.platform === 'win32' ? 'start' : 'xdg-open';

  exec(`${command} "${latestReport}"`, (error) => {
    if (error) {
      console.error('❌ 보고서를 여는데 실패했습니다:', error.message);
      console.log(`📄 수동으로 다음 파일을 열어주세요: ${latestReport}`);
    } else {
      console.log('✅ 보고서가 브라우저에서 열렸습니다!');
    }
  });
} else {
  console.log('❌ 생성된 보고서가 없습니다.');
  console.log('💡 먼저 테스트를 실행해주세요:');
  console.log('   npm run test:single  # 단일 테스트');
  console.log('   npm run test:multi   # 멀티 테스트');
}