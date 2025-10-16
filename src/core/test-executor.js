/**
 * 통합 테스트 실행기
 * 모든 테스트 모드(single, multi, load)를 처리하는 핵심 클래스
 */

import { Logger } from '../utils/logger.js';
import { PerformanceMonitor } from '../utils/performance.js';
import { TestSession } from './test-session.js';
import { ReportGenerator } from '../reports/report-generator.js';
import { ConcurrentMonitor } from '../utils/concurrent-monitor.js';

export class TestExecutor {
  constructor() {
    this.logger = new Logger('TestExecutor');
    this.sessions = new Map();
    this.isRunning = false;
    this.results = [];
    this.monitor = null; // ConcurrentMonitor 인스턴스
  }

  /**
   * 단일 테스트 실행
   */
  async executeSingle(sessionId = null) {
    this.logger.info('Executing single test...');

    const session = new TestSession(sessionId);
    this.sessions.set(session.id, session);

    try {
      const result = await session.run();
      this.results.push(result);

      // 보고서 생성
      await this._generateReport('single', [result]);

      return result;
    } finally {
      this.sessions.delete(session.id);
      await session.cleanup();
    }
  }

  /**
   * 멀티 테스트 실행
   * @param {Object} options - { count, concurrency, useTabMode, tabsPerBrowser }
   */
  async executeMulti(options = {}) {
    const { count = 3, concurrency = 2, useTabMode = true, tabsPerBrowser = 10 } = options;

    this.logger.info(`Executing multi test: ${count} tests, ${concurrency} concurrent`);

    // 탭 모드 활성화 (메모리 최적화)
    if (useTabMode) {
      const { browserSessionManager } = await import('../browser/session-manager.js');
      browserSessionManager.enableSharedContextMode();
      browserSessionManager.setTabsPerBrowser(tabsPerBrowser);

      const expectedBrowsers = Math.ceil(count / tabsPerBrowser);
      this.logger.info(`🚀 Tab mode enabled - ${expectedBrowsers} browser(s) × ${tabsPerBrowser} tabs`);
      this.logger.info(`   Memory usage: ~${Math.round(count * 10)}MB (vs ${Math.round(count * 50)}MB)`);
    }

    this.isRunning = true;
    this.results = [];

    // ConcurrentMonitor 시작
    this.monitor = new ConcurrentMonitor(`multi-test-${count}`);

    const performanceMonitor = new PerformanceMonitor('multi-test');
    performanceMonitor.startTimer('total');

    try {
      // 배치 실행
      let completed = 0;
      const batchSize = Math.min(concurrency, count);

      while (completed < count && this.isRunning) {
        const currentBatch = [];
        const batchEnd = Math.min(completed + batchSize, count);

        // 배치 생성
        for (let i = completed; i < batchEnd; i++) {
          const sessionId = `test-${i + 1}`;
          const session = new TestSession(sessionId);

          // 모니터에 세션 등록
          this.monitor.registerSession(sessionId, { index: i + 1 });

          this.sessions.set(session.id, session);
          currentBatch.push(this._runSessionWithMonitoring(session));
        }

        // 배치 실행 및 결과 수집
        const batchResults = await Promise.allSettled(currentBatch);

        batchResults.forEach((result, index) => {
          const testIndex = completed + index;
          if (result.status === 'fulfilled') {
            this.results.push(result.value);
            this.logger.info(`Test ${testIndex + 1}/${count} completed`);
          } else {
            this.logger.error(`Test ${testIndex + 1}/${count} failed:`, result.reason);
            this.results.push({
              success: false,
              error: result.reason?.message || 'Unknown error',
              testIndex
            });
          }
        });

        completed = batchEnd;

        // 메모리 정리를 위한 짧은 대기
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const totalTime = performanceMonitor.endTimer('total');
      this.logger.info(`Multi test completed in ${totalTime}ms`);

      // 보고서 생성
      await this._generateReport('multi', this.results, { count, concurrency });

      return {
        success: this.results.every(r => r.success),
        results: this.results,
        summary: this._createSummary()
      };

    } finally {
      // 모니터 중지
      if (this.monitor) {
        await this.monitor.stopMonitoring();
        this.monitor = null;
      }

      this.isRunning = false;
      await this._cleanupAllSessions();
    }
  }

  /**
   * 부하 테스트 실행
   * @param {Object} options - { duration, concurrency }
   */
  async executeLoad(options = {}) {
    const { duration = 5, concurrency = 2 } = options;

    this.logger.info(`Executing load test: ${duration} minutes, ${concurrency} concurrent`);
    this.isRunning = true;
    this.results = [];

    const endTime = Date.now() + (duration * 60 * 1000);
    const performanceMonitor = new PerformanceMonitor('load-test');
    performanceMonitor.startTimer('total');

    try {
      const workers = [];

      // 동시 워커 생성
      for (let i = 0; i < concurrency; i++) {
        workers.push(this._runLoadWorker(i, endTime));
      }

      await Promise.all(workers);

      const totalTime = performanceMonitor.endTimer('total');
      this.logger.info(`Load test completed in ${totalTime}ms`);

      // 보고서 생성
      await this._generateReport('load', this.results, { duration, concurrency });

      return {
        success: this.results.filter(r => r.success).length > 0,
        results: this.results,
        summary: this._createSummary()
      };

    } finally {
      this.isRunning = false;
      await this._cleanupAllSessions();
    }
  }

  /**
   * 세션 실행 (내부 헬퍼)
   */
  async _runSession(session) {
    try {
      const result = await session.run();
      return result;
    } finally {
      this.sessions.delete(session.id);
      await session.cleanup();
    }
  }

  /**
   * 모니터링과 함께 세션 실행 (내부 헬퍼)
   */
  async _runSessionWithMonitoring(session) {
    try {
      // 세션 시작 기록
      if (this.monitor) {
        this.monitor.startSession(session.id);
      }

      // 세션에 모니터 전달
      const result = await session.run(this.monitor);

      // 세션 완료 기록
      if (this.monitor) {
        this.monitor.completeSession(session.id, result.success, result);
      }

      return result;
    } catch (error) {
      // 세션 실패 기록
      if (this.monitor) {
        this.monitor.completeSession(session.id, false);
        this.monitor.recordError(session.id, 'session-execution', error);
      }
      throw error;
    } finally {
      this.sessions.delete(session.id);
      await session.cleanup();
    }
  }

  /**
   * 부하 테스트 워커 (내부 헬퍼)
   */
  async _runLoadWorker(workerId, endTime) {
    let testCount = 0;

    while (Date.now() < endTime && this.isRunning) {
      try {
        const session = new TestSession(`worker-${workerId}-test-${testCount}`);
        this.sessions.set(session.id, session);

        const result = await this._runSession(session);
        this.results.push(result);

        testCount++;
        this.logger.debug(`Worker ${workerId}: completed test ${testCount}`);

        // 테스트 간 간격
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        this.logger.error(`Worker ${workerId} error:`, error);
        testCount++;
      }
    }

    this.logger.info(`Worker ${workerId} completed ${testCount} tests`);
  }

  /**
   * 모든 세션 정리
   */
  async _cleanupAllSessions() {
    const cleanupPromises = Array.from(this.sessions.values()).map(
      session => session.cleanup().catch(err =>
        this.logger.warn(`Session ${session.id} cleanup error:`, err)
      )
    );

    await Promise.all(cleanupPromises);
    this.sessions.clear();
  }

  /**
   * 결과 요약 생성
   */
  _createSummary() {
    const total = this.results.length;
    const successful = this.results.filter(r => r.success).length;
    const failed = total - successful;

    const times = this.results
      .filter(r => r.totalTime > 0)
      .map(r => r.totalTime);

    return {
      total,
      successful,
      failed,
      successRate: total > 0 ? Math.round((successful / total) * 100 * 100) / 100 : 0,
      avgTime: times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0,
      minTime: times.length > 0 ? Math.min(...times) : 0,
      maxTime: times.length > 0 ? Math.max(...times) : 0
    };
  }

  /**
   * 보고서 생성
   */
  async _generateReport(mode, results, config = {}) {
    try {
      const reportGenerator = new ReportGenerator();
      const report = reportGenerator.generateComprehensiveReport(results, {
        mode,
        ...config,
        count: results.length
      });

      this.logger.info(`Report generated: ${report.htmlPath}`);
      return report;
    } catch (error) {
      this.logger.error('Failed to generate report:', error);
    }
  }

  /**
   * 테스트 중지
   */
  stop() {
    this.logger.info('Stopping test execution...');
    this.isRunning = false;
  }
}
