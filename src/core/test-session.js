/**
 * 테스트 세션 클래스
 * 하나의 완전한 테스트 실행을 담당
 */

import { Logger } from '../utils/logger.js';
import { PerformanceMonitor } from '../utils/performance.js';
import { ErrorHandler } from '../utils/error-handler.js';
import { testDataGenerator } from '../data/index.js';
import { browserSessionManager } from '../browser/session-manager.js';
import { FlowManager } from './flow-manager.js';

export class TestSession {
  constructor(sessionId = null) {
    this.id = sessionId || testDataGenerator.generateSessionId();
    this.logger = new Logger(`Session-${this.id}`);
    this.performanceMonitor = new PerformanceMonitor(this.id);
    this.errorHandler = new ErrorHandler(this.id, this.performanceMonitor);

    this.context = null;
    this.page = null;
    this.flowManager = null;

    this.result = {
      sessionId: this.id,
      success: false,
      startTime: new Date(),
      endTime: null,
      totalTime: 0,
      stepTimes: {},
      errors: [],
      screenshots: [],
      studentInfo: null,
      classSelection: null
    };
  }

  /**
   * 테스트 실행
   * @param {ConcurrentMonitor} monitor - 선택적 동접 모니터
   */
  async run(monitor = null) {
    this.logger.info('Starting test session...');
    this.performanceMonitor.startTimer('total');

    try {
      // 1. 브라우저 세션 생성
      await this._setupBrowser();

      // 2. 테스트 데이터 생성
      await this._generateTestData();

      // 3. FlowManager를 통한 전체 플로우 실행 (모니터 전달)
      this.flowManager = new FlowManager(this.page, this.id, monitor);
      const flowResult = await this.flowManager.executeFullFlow(this.result.studentInfo);

      // 4. 결과 병합
      Object.assign(this.result, flowResult);
      this.result.success = flowResult.success;

      this.logger.info(`Test session completed: ${this.result.success ? 'SUCCESS' : 'FAILED'}`);

    } catch (error) {
      this.logger.error('Test session failed:', error);

      const errorInfo = await this.errorHandler.handleGenericError(
        error,
        'test-session',
        this.page
      );

      this.result.errors.push(errorInfo);
      this.result.success = false;

      // 모니터에 에러 기록
      if (monitor) {
        monitor.recordError(this.id, 'test-session', error);
      }

      // 에러 스크린샷
      await this._captureErrorScreenshot();

    } finally {
      this.result.endTime = new Date();
      this.result.totalTime = this.performanceMonitor.endTimer('total');
    }

    return this.result;
  }

  /**
   * 브라우저 설정
   */
  async _setupBrowser() {
    this.logger.debug('Setting up browser...');
    this.performanceMonitor.startTimer('browser-setup');

    try {
      this.context = await browserSessionManager.createSession(this.id);

      // 탭 모드에서는 이미 생성된 페이지 가져오기
      if (browserSessionManager.useSharedContext) {
        this.page = browserSessionManager.pages.get(this.id);
      } else {
        this.page = await this.context.newPage();
      }

      this.result.stepTimes['browser-setup'] = this.performanceMonitor.endTimer('browser-setup');
      this.logger.debug('Browser setup completed');
    } catch (error) {
      this.performanceMonitor.endTimer('browser-setup');
      throw new Error(`Browser setup failed: ${error.message}`);
    }
  }

  /**
   * 테스트 데이터 생성
   */
  async _generateTestData() {
    this.logger.debug('Generating test data...');
    this.performanceMonitor.startTimer('data-generation');

    try {
      this.result.studentInfo = testDataGenerator.generateStudentInfo();

      this.result.stepTimes['data-generation'] = this.performanceMonitor.endTimer('data-generation');
      this.logger.debug(`Test data generated for: ${this.result.studentInfo.name}`);
    } catch (error) {
      this.performanceMonitor.endTimer('data-generation');
      throw new Error(`Data generation failed: ${error.message}`);
    }
  }

  /**
   * 에러 스크린샷 캡처
   */
  async _captureErrorScreenshot() {
    if (!this.page || this.page.isClosed()) {
      return;
    }

    try {
      const timestamp = Date.now();
      const screenshotPath = `./screenshots/${new Date().toISOString().split('T')[0]}/error-${this.id}-${timestamp}.png`;

      await this.page.screenshot({
        path: screenshotPath,
        fullPage: true
      });

      this.result.screenshots.push(screenshotPath);
      this.logger.info(`Error screenshot saved: ${screenshotPath}`);
    } catch (error) {
      this.logger.warn('Failed to capture error screenshot:', error);
    }
  }

  /**
   * 세션 정리
   */
  async cleanup() {
    this.logger.debug('Cleaning up session...');

    try {
      if (this.page && !this.page.isClosed()) {
        await this.page.close();
      }

      if (this.context) {
        await browserSessionManager.closeSession(this.id);
      }

      // 가비지 컬렉션 힌트
      if (global.gc) {
        global.gc();
      }

      this.logger.debug('Session cleanup completed');
    } catch (error) {
      this.logger.warn('Session cleanup error:', error);
    }
  }
}
