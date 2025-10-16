#!/usr/bin/env node

/**
 * CLI 통합 진입점
 * 모든 테스트 모드를 하나의 CLI로 실행
 */

import { TestExecutor } from './src/core/test-executor.js';
import { config } from './src/config/index.js';
import { Logger } from './src/utils/logger.js';
import { browserSessionManager } from './src/browser/session-manager.js';

const logger = new Logger('CLI');

/**
 * 사용법 출력
 */
function printUsage() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║     🎓 온라인 수강신청 자동화 테스트                       ║
╚════════════════════════════════════════════════════════════╝

📋 사용법:
  node cli.js [모드] [옵션]

🎯 실행 모드:
  single              단일 테스트 실행 (기본값)
  multi               여러 테스트 동시 실행
  load                부하 테스트 (시간 기반)

⚙️  옵션:
  -c, --count <개수>       테스트 개수 (multi 모드, 기본값: 3)
  -p, --parallel <개수>    동시 실행 개수 (기본값: 2)
  -d, --duration <분>      실행 시간(분) - 부하테스트용 (기본값: 5)
  --no-tab-mode           탭 모드 비활성화 (각 세션마다 독립 Context)
  -h, --help              도움말 출력

📝 실행 예시:
  node cli.js                         # 단일 테스트
  node cli.js single                  # 단일 테스트
  node cli.js multi -c 40 -p 20      # 40개 테스트를 20개씩 동시 실행 (자동: 2 브라우저 × 20 탭)
  node cli.js multi -c 38 -p 20      # 38개 테스트 (자동: 1 브라우저 × 20탭 + 1 브라우저 × 18탭)
  node cli.js multi -c 400 -p 50     # 400명 동접 테스트 (자동: 8 브라우저 × 50 탭)
  node cli.js multi -c 5 --no-tab-mode  # 탭 모드 비활성화
  node cli.js load -d 10 -p 2        # 10분 동안 2개씩 부하 테스트

🚀 npm scripts:
  npm run test:single                 # 단일 테스트
  npm run test:multi                  # 멀티 테스트
  npm run test:load                   # 부하 테스트
  npm run gui                         # Web GUI 실행
`);
}

/**
 * 커맨드라인 인자 파싱
 */
function parseArgs() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  const options = {
    mode: 'single',
    count: 3,
    concurrency: 2,
    duration: 5,
    useTabMode: true  // 기본값: 탭 모드 활성화
  };

  // 첫 번째 인자가 모드인지 확인
  if (args.length > 0 && !args[0].startsWith('-')) {
    const mode = args[0].toLowerCase();
    if (['single', 'multi', 'load'].includes(mode)) {
      options.mode = mode;
      args.shift();
    }
  }

  // 옵션 파싱
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '-c':
      case '--count':
        options.count = parseInt(args[++i]) || 3;
        break;
      case '-p':
      case '--parallel':
      case '--concurrency':
        options.concurrency = parseInt(args[++i]) || 2;
        break;
      case '-d':
      case '--duration':
        options.duration = parseInt(args[++i]) || 5;
        break;
      case '--no-tab-mode':
        options.useTabMode = false;
        break;
    }
  }

  // 탭 모드일 경우 동시성(concurrency)만큼 탭 생성
  if (options.useTabMode) {
    options.tabsPerBrowser = Math.max(1, options.concurrency);
  } else {
    options.tabsPerBrowser = 1;
  }

  return options;
}

/**
 * 메인 함수
 */
async function main() {
  const startTime = Date.now();

  try {
    // 설정 검증
    config.validate();
    logger.info('Configuration validated');

    // 인자 파싱
    const options = parseArgs();

    // 헤더 출력
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎓 온라인 수강신청 자동화 테스트`);
    console.log(`모드: ${options.mode.toUpperCase()}`);
    console.log(`환경: ${config.environmentName} (${config.environment})`);
    console.log(`URL: ${config.baseUrl}`);
    console.log(`학원코드: ${config.defaultAcadCd}`);

    if (options.mode === 'multi') {
      console.log(`설정: 총 ${options.count}개를 ${options.concurrency}개씩 동시 실행`);
    } else if (options.mode === 'load') {
      console.log(`설정: ${options.duration}분간 ${options.concurrency}개씩 동시 실행`);
    }

    console.log(`${'='.repeat(60)}\n`);

    // TestExecutor 생성
    const executor = new TestExecutor();

    // 모드별 실행
    let result;

    switch (options.mode) {
      case 'single':
        result = await executor.executeSingle();
        break;

      case 'multi':
        result = await executor.executeMulti({
          count: options.count,
          concurrency: options.concurrency,
          useTabMode: options.useTabMode,
          tabsPerBrowser: options.tabsPerBrowser
        });
        break;

      case 'load':
        result = await executor.executeLoad({
          duration: options.duration,
          concurrency: options.concurrency
        });
        break;

      default:
        logger.error(`Unknown mode: ${options.mode}`);
        printUsage();
        process.exit(1);
    }

    // 결과 출력
    const totalTime = Math.round((Date.now() - startTime) / 1000);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 테스트 완료`);
    console.log(`${'='.repeat(60)}`);

    if (result.summary) {
      const summary = result.summary;
      console.log(`✅ 성공: ${summary.successful}/${summary.total} (${summary.successRate}%)`);
      console.log(`⏱️  평균 시간: ${Math.round(summary.avgTime / 1000)}초`);
      console.log(`⏱️  총 실행 시간: ${totalTime}초`);
    } else {
      console.log(`결과: ${result.success ? '✅ 성공' : '❌ 실패'}`);
      console.log(`⏱️  실행 시간: ${totalTime}초`);
    }

    console.log(`${'='.repeat(60)}\n`);

    // 종료 코드
    if (result.success || (result.summary && result.summary.successful > 0)) {
      logger.info('Test completed successfully');
      process.exit(0);
    } else {
      logger.error('Test failed');
      process.exit(1);
    }

  } catch (error) {
    logger.error('Test execution failed:', error);
    process.exit(1);
  } finally {
    // 브라우저 정리
    try {
      await browserSessionManager.cleanup();
    } catch (cleanupError) {
      logger.warn('Browser cleanup error:', cleanupError);
    }
  }
}

// 프로세스 종료 시그널 처리
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, cleaning up...');
  try {
    await browserSessionManager.cleanup();
  } catch (error) {
    logger.error('Cleanup error:', error);
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, cleaning up...');
  try {
    await browserSessionManager.cleanup();
  } catch (error) {
    logger.error('Cleanup error:', error);
  }
  process.exit(0);
});

// 처리되지 않은 예외 처리
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// 메인 함수 실행
main();
