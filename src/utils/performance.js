import { Logger } from './logger.js';

/**
 * 성능 모니터링 클래스
 */
export class PerformanceMonitor {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.logger = new Logger(`PerformanceMonitor-${sessionId}`);
    this.timers = new Map();
    this.metrics = {
      stepTimes: {},
      stepCounts: {},
      pageLoadTimes: {},
      totalRequests: 0,
      failedRequests: 0,
      errors: []
    };
    this.startTime = Date.now();
  }

  /**
   * 타이머 시작
   * @param {string} operation 작업명
   */
  startTimer(operation) {
    const startTime = Date.now();
    this.timers.set(operation, startTime);
    this.logger.debug(`Timer started: ${operation}`);
  }

  /**
   * 타이머 종료 및 시간 기록
   * @param {string} operation 작업명
   * @returns {number} 소요 시간 (ms)
   */
  endTimer(operation) {
    const startTime = this.timers.get(operation);
    if (!startTime) {
      this.logger.warn(`Timer not found: ${operation}`);
      return 0;
    }

    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // 타이머 제거
    this.timers.delete(operation);
    
    // 메트릭 업데이트
    if (!this.metrics.stepTimes[operation]) {
      this.metrics.stepTimes[operation] = [];
      this.metrics.stepCounts[operation] = 0;
    }
    
    this.metrics.stepTimes[operation].push(duration);
    this.metrics.stepCounts[operation]++;
    
    this.logger.debug(`Timer ended: ${operation} - ${duration}ms`);
    return duration;
  }

  /**
   * 페이지 로딩 시간 기록
   * @param {string} url 페이지 URL
   * @param {number} loadTime 로딩 시간 (ms)
   */
  recordPageLoad(url, loadTime) {
    const pageName = this.extractPageName(url);
    
    if (!this.metrics.pageLoadTimes[pageName]) {
      this.metrics.pageLoadTimes[pageName] = [];
    }
    
    this.metrics.pageLoadTimes[pageName].push(loadTime);
    this.logger.debug(`Page load recorded: ${pageName} - ${loadTime}ms`);
  }

  /**
   * URL에서 페이지명 추출
   * @param {string} url 
   * @returns {string}
   */
  extractPageName(url) {
    if (url.includes('list.do')) return 'course-list';
    if (url.includes('applyRegister01.do')) return 'basic-info';
    if (url.includes('applyRegister02.do')) return 'detailed-info';
    if (url.includes('applyRegister03.do')) return 'class-selection';
    if (url.includes('applyRegister04')) return 'payment';
    if (url.includes('searchSchoolPopup.do')) return 'school-search';
    return 'unknown';
  }

  /**
   * 오류 기록
   * @param {import('../types/index.js').TestError} error 오류 정보
   */
  recordError(error) {
    this.metrics.errors.push({
      ...error,
      sessionId: this.sessionId,
      timestamp: new Date()
    });
    
    this.metrics.failedRequests++;
    this.logger.error(`Error recorded: ${error.step} - ${error.message}`);
  }

  /**
   * 요청 수 증가
   */
  incrementRequests() {
    this.metrics.totalRequests++;
  }

  /**
   * 실패한 요청 수 증가
   */
  incrementFailedRequests() {
    this.metrics.failedRequests++;
  }

  /**
   * 평균 시간 계산
   * @param {number[]} times 시간 배열
   * @returns {number}
   */
  calculateAverage(times) {
    if (times.length === 0) return 0;
    return times.reduce((sum, time) => sum + time, 0) / times.length;
  }

  /**
   * 최대값 계산
   * @param {number[]} times 시간 배열
   * @returns {number}
   */
  calculateMax(times) {
    if (times.length === 0) return 0;
    return Math.max(...times);
  }

  /**
   * 최소값 계산
   * @param {number[]} times 시간 배열
   * @returns {number}
   */
  calculateMin(times) {
    if (times.length === 0) return 0;
    return Math.min(...times);
  }

  /**
   * 백분위수 계산
   * @param {number[]} times 시간 배열
   * @param {number} percentile 백분위수 (0-100)
   * @returns {number}
   */
  calculatePercentile(times, percentile) {
    if (times.length === 0) return 0;
    
    const sorted = [...times].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * 현재 메트릭 가져오기
   * @returns {import('../types/index.js').PerformanceMetrics}
   */
  getMetrics() {
    const totalTime = Date.now() - this.startTime;
    
    // 단계별 평균 시간 계산
    const stepAverages = {};
    for (const [step, times] of Object.entries(this.metrics.stepTimes)) {
      stepAverages[step] = this.calculateAverage(times);
    }
    
    // 페이지 로딩 평균 시간 계산
    const pageLoadAverages = {};
    for (const [page, times] of Object.entries(this.metrics.pageLoadTimes)) {
      pageLoadAverages[page] = this.calculateAverage(times);
    }
    
    // 전체 응답 시간 계산
    const allTimes = Object.values(this.metrics.stepTimes).flat();
    
    return {
      sessionId: this.sessionId,
      totalTime: totalTime,
      stepTimes: stepAverages,
      stepCounts: { ...this.metrics.stepCounts },
      pageLoadTimes: pageLoadAverages,
      totalRequests: this.metrics.totalRequests,
      failedRequests: this.metrics.failedRequests,
      averageResponseTime: this.calculateAverage(allTimes),
      maxResponseTime: this.calculateMax(allTimes),
      minResponseTime: this.calculateMin(allTimes),
      p95ResponseTime: this.calculatePercentile(allTimes, 95),
      p99ResponseTime: this.calculatePercentile(allTimes, 99),
      errorCount: this.metrics.errors.length,
      errorRate: this.metrics.totalRequests > 0 ? 
        (this.metrics.failedRequests / this.metrics.totalRequests) * 100 : 0
    };
  }

  /**
   * 상세 메트릭 가져오기 (디버깅용)
   * @returns {Object}
   */
  getDetailedMetrics() {
    return {
      ...this.getMetrics(),
      rawStepTimes: { ...this.metrics.stepTimes },
      rawPageLoadTimes: { ...this.metrics.pageLoadTimes },
      errors: [...this.metrics.errors],
      activeTimers: Array.from(this.timers.keys())
    };
  }

  /**
   * 메트릭 리셋
   */
  reset() {
    this.timers.clear();
    this.metrics = {
      stepTimes: {},
      stepCounts: {},
      pageLoadTimes: {},
      totalRequests: 0,
      failedRequests: 0,
      errors: []
    };
    this.startTime = Date.now();
    this.logger.debug('Performance metrics reset');
  }

  /**
   * 메트릭 요약 로그 출력
   */
  logSummary() {
    const metrics = this.getMetrics();
    
    this.logger.info('=== Performance Summary ===');
    this.logger.info(`Total Time: ${metrics.totalTime}ms`);
    this.logger.info(`Total Requests: ${metrics.totalRequests}`);
    this.logger.info(`Failed Requests: ${metrics.failedRequests}`);
    this.logger.info(`Error Rate: ${metrics.errorRate.toFixed(2)}%`);
    this.logger.info(`Average Response Time: ${metrics.averageResponseTime.toFixed(2)}ms`);
    this.logger.info(`Max Response Time: ${metrics.maxResponseTime}ms`);
    this.logger.info(`Min Response Time: ${metrics.minResponseTime}ms`);
    
    if (Object.keys(metrics.stepTimes).length > 0) {
      this.logger.info('Step Times:');
      for (const [step, avgTime] of Object.entries(metrics.stepTimes)) {
        this.logger.info(`  ${step}: ${avgTime.toFixed(2)}ms (${metrics.stepCounts[step]} times)`);
      }
    }
    
    if (Object.keys(metrics.pageLoadTimes).length > 0) {
      this.logger.info('Page Load Times:');
      for (const [page, avgTime] of Object.entries(metrics.pageLoadTimes)) {
        this.logger.info(`  ${page}: ${avgTime.toFixed(2)}ms`);
      }
    }
    
    this.logger.info('=========================');
  }
}