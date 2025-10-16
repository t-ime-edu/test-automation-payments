import { Logger } from './logger.js';
import { KoreanReportGenerator } from './korean-report-generator.js';
import fs from 'fs';
import path from 'path';

/**
 * 동접 테스트용 실시간 모니터링 클래스
 * 400명 동접 테스트 시 실시간 상태 추적
 */
export class ConcurrentMonitor {
  constructor(testName = 'concurrent-test') {
    this.testName = testName;
    this.logger = new Logger('ConcurrentMonitor');
    this.startTime = Date.now();

    // 통계 데이터
    this.stats = {
      total: 0,
      running: 0,
      completed: 0,
      failed: 0,
      waiting: 0, // 대기 페이지에 걸린 세션 수
      stepStats: {
        'step1-course': 0,
        'step2-basic': 0,
        'step3-detailed': 0,
        'step4-class': 0,
        'step5-payment': 0
      },
      errorsByStep: {},
      errorsByType: {},
      waitingPageEncounters: 0, // 대기 페이지 발생 횟수
      avgWaitTime: 0
    };

    // 세션별 상태 추적
    this.sessions = new Map();

    // 로그 파일 설정 - 날짜별 폴더 + 테스트별 폴더로 정리
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS

    // 날짜별 폴더 + 테스트별 폴더 생성 (예: reports/monitoring/2025-10-15/10-30-45-multi-test-2/)
    const testDirName = `${timeStr}-${testName}`;
    this.logDir = path.join(process.cwd(), 'reports', 'monitoring', dateStr, testDirName);
    this.ensureLogDirectory();

    this.logFile = path.join(this.logDir, 'test.log');
    this.statsFile = path.join(this.logDir, 'stats.json');

    // 실시간 모니터링 시작
    this.startMonitoring();
  }

  /**
   * 로그 디렉토리 생성
   */
  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * 실시간 모니터링 시작
   */
  startMonitoring() {
    this.monitorInterval = setInterval(() => {
      this.printStatus();
      this.saveStats();
    }, 5000); // 5초마다 상태 출력

    this.logger.info('🚀 Concurrent monitoring started');
    this.logger.info(`Log file: ${this.logFile}`);
    this.logger.info(`Stats file: ${this.statsFile}`);
  }

  /**
   * 모니터링 중지
   */
  async stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }

    // 최종 통계 저장
    this.printFinalReport();
    this.saveStats();

    // 한글 보고서 생성
    await this.generateKoreanReport();

    this.logger.info('🏁 Concurrent monitoring stopped');
  }

  /**
   * 한글 보고서 생성
   */
  async generateKoreanReport() {
    try {
      const reportGenerator = new KoreanReportGenerator();
      const reportPath = reportGenerator.generateReport(this.statsFile);
      this.logger.info(`📄 한글 보고서: ${reportPath}`);
      console.log(`\n📄 한글 보고서가 생성되었습니다: ${reportPath}\n`);
    } catch (error) {
      this.logger.error('한글 보고서 생성 실패:', error);
    }
  }

  /**
   * 세션 등록
   */
  registerSession(sessionId, metadata = {}) {
    this.sessions.set(sessionId, {
      sessionId,
      status: 'registered',
      currentStep: 'init',
      startTime: Date.now(),
      errors: [],
      waitingEncountered: false,
      waitTime: 0,
      ...metadata
    });

    this.stats.total++;
    this.logEvent('SESSION_REGISTERED', { sessionId, total: this.stats.total });
  }

  /**
   * 세션 시작
   */
  startSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'running';
      session.actualStartTime = Date.now();
      this.stats.running++;

      this.logEvent('SESSION_STARTED', { sessionId, running: this.stats.running });
    }
  }

  /**
   * 세션 단계 업데이트
   */
  updateSessionStep(sessionId, step) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.currentStep = step;
      session.lastStepTime = Date.now();

      this.stats.stepStats[step] = (this.stats.stepStats[step] || 0) + 1;

      this.logEvent('STEP_UPDATE', { sessionId, step });
    }
  }

  /**
   * 대기 페이지 발생 기록
   */
  recordWaitingPage(sessionId, waitTime, queuePosition) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.waitingEncountered = true;
      session.waitTime = waitTime;
      session.queuePosition = queuePosition;

      this.stats.waiting++;
      this.stats.waitingPageEncounters++;
      this.stats.avgWaitTime = ((this.stats.avgWaitTime * (this.stats.waitingPageEncounters - 1)) + waitTime) / this.stats.waitingPageEncounters;

      this.logEvent('WAITING_PAGE', {
        sessionId,
        waitTime,
        queuePosition,
        totalWaiting: this.stats.waiting,
        avgWaitTime: Math.round(this.stats.avgWaitTime)
      });
    }
  }

  /**
   * 대기 페이지 통과 기록
   */
  recordWaitingPagePassed(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session && session.waitingEncountered) {
      this.stats.waiting = Math.max(0, this.stats.waiting - 1);

      this.logEvent('WAITING_PASSED', { sessionId, remainingWaiting: this.stats.waiting });
    }
  }

  /**
   * 세션 완료
   */
  completeSession(sessionId, success = true, result = {}) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = success ? 'completed' : 'failed';
      session.endTime = Date.now();
      session.duration = session.endTime - (session.actualStartTime || session.startTime);
      session.result = result;

      this.stats.running = Math.max(0, this.stats.running - 1);

      if (success) {
        this.stats.completed++;
        this.logEvent('SESSION_COMPLETED', {
          sessionId,
          duration: session.duration,
          completed: this.stats.completed
        });
      } else {
        this.stats.failed++;
        this.logEvent('SESSION_FAILED', {
          sessionId,
          duration: session.duration,
          failed: this.stats.failed,
          errors: session.errors
        });
      }
    }
  }

  /**
   * 에러 기록
   */
  recordError(sessionId, step, error) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.errors.push({
        step,
        message: error.message || error,
        timestamp: Date.now()
      });

      // 단계별 에러 집계
      this.stats.errorsByStep[step] = (this.stats.errorsByStep[step] || 0) + 1;

      // 에러 타입별 집계
      const errorType = this.categorizeError(error.message || error);
      this.stats.errorsByType[errorType] = (this.stats.errorsByType[errorType] || 0) + 1;

      this.logEvent('ERROR', {
        sessionId,
        step,
        error: error.message || error,
        errorType
      });
    }
  }

  /**
   * 에러 분류
   */
  categorizeError(errorMessage) {
    if (!errorMessage) return 'Unknown';

    const msg = errorMessage.toLowerCase();

    if (msg.includes('timeout')) return 'Timeout';
    if (msg.includes('waiting') || msg.includes('queue')) return 'WaitingPage';
    if (msg.includes('network') || msg.includes('connection')) return 'Network';
    if (msg.includes('element') || msg.includes('selector')) return 'UIElement';
    if (msg.includes('navigation')) return 'Navigation';
    if (msg.includes('click')) return 'Click';

    return 'Other';
  }

  /**
   * 이벤트 로그 기록
   */
  logEvent(eventType, data) {
    const timestamp = new Date().toISOString();
    const elapsed = Date.now() - this.startTime;

    const logEntry = {
      timestamp,
      elapsed: Math.round(elapsed / 1000),
      eventType,
      ...data
    };

    // 파일에 로그 추가
    const logLine = JSON.stringify(logEntry) + '\n';
    fs.appendFileSync(this.logFile, logLine);
  }

  /**
   * 실시간 상태 출력
   */
  printStatus() {
    const elapsed = Math.round((Date.now() - this.startTime) / 1000);
    const successRate = this.stats.total > 0
      ? ((this.stats.completed / this.stats.total) * 100).toFixed(1)
      : 0;

    console.log('\n' + '='.repeat(80));
    console.log(`📊 CONCURRENT TEST STATUS (${elapsed}s elapsed)`);
    console.log('='.repeat(80));
    console.log(`Total: ${this.stats.total} | Running: ${this.stats.running} | Completed: ${this.stats.completed} | Failed: ${this.stats.failed}`);
    console.log(`Success Rate: ${successRate}% | Waiting: ${this.stats.waiting} users`);

    if (this.stats.waitingPageEncounters > 0) {
      console.log(`⏳ Waiting Page: ${this.stats.waitingPageEncounters} encounters, Avg wait: ${Math.round(this.stats.avgWaitTime)}s`);
    }

    if (Object.keys(this.stats.errorsByType).length > 0) {
      console.log('\n🚨 Error Summary:');
      Object.entries(this.stats.errorsByType)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .forEach(([type, count]) => {
          console.log(`  ${type}: ${count}`);
        });
    }

    console.log('='.repeat(80) + '\n');
  }

  /**
   * 최종 보고서 출력
   */
  printFinalReport() {
    const elapsed = Math.round((Date.now() - this.startTime) / 1000);
    const successRate = this.stats.total > 0
      ? ((this.stats.completed / this.stats.total) * 100).toFixed(2)
      : 0;

    console.log('\n' + '='.repeat(80));
    console.log('🏁 FINAL TEST REPORT');
    console.log('='.repeat(80));
    console.log(`Test Duration: ${elapsed}s (${Math.round(elapsed / 60)}m ${elapsed % 60}s)`);
    console.log(`Total Sessions: ${this.stats.total}`);
    console.log(`Completed: ${this.stats.completed} (${successRate}%)`);
    console.log(`Failed: ${this.stats.failed}`);
    console.log(`\n⏳ Waiting Page Statistics:`);
    console.log(`  Encounters: ${this.stats.waitingPageEncounters}`);
    console.log(`  Average Wait Time: ${Math.round(this.stats.avgWaitTime)}s`);

    if (Object.keys(this.stats.errorsByStep).length > 0) {
      console.log('\n📊 Errors by Step:');
      Object.entries(this.stats.errorsByStep)
        .sort(([, a], [, b]) => b - a)
        .forEach(([step, count]) => {
          console.log(`  ${step}: ${count}`);
        });
    }

    if (Object.keys(this.stats.errorsByType).length > 0) {
      console.log('\n🚨 Errors by Type:');
      Object.entries(this.stats.errorsByType)
        .sort(([, a], [, b]) => b - a)
        .forEach(([type, count]) => {
          console.log(`  ${type}: ${count}`);
        });
    }

    console.log('='.repeat(80) + '\n');

    this.logger.info(`Final report saved to: ${this.statsFile}`);
  }

  /**
   * 통계 저장
   */
  saveStats() {
    const statsData = {
      testName: this.testName,
      startTime: this.startTime,
      currentTime: Date.now(),
      elapsed: Date.now() - this.startTime,
      stats: this.stats,
      sessions: Array.from(this.sessions.values())
    };

    fs.writeFileSync(this.statsFile, JSON.stringify(statsData, null, 2));
  }

  /**
   * 통계 가져오기
   */
  getStats() {
    return {
      ...this.stats,
      elapsed: Date.now() - this.startTime,
      successRate: this.stats.total > 0
        ? ((this.stats.completed / this.stats.total) * 100).toFixed(2)
        : 0
    };
  }
}
