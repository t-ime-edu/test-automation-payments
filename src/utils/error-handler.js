import { Logger } from './logger.js';
import { config } from '../config/index.js';

/**
 * 오류 처리 클래스
 */
export class ErrorHandler {
  constructor(sessionId, performanceMonitor = null) {
    this.sessionId = sessionId;
    this.logger = new Logger(`ErrorHandler-${sessionId}`);
    this.performanceMonitor = performanceMonitor;
    this.retryAttempts = new Map();
  }

  /**
   * 네트워크 오류 처리
   * @param {Error} error 오류 객체
   * @param {string} operation 작업명
   * @param {Function} retryFunction 재시도 함수
   * @param {number} maxRetries 최대 재시도 횟수
   * @returns {Promise<any>}
   */
  async handleNetworkError(error, operation, retryFunction, maxRetries = 3) {
    const currentAttempts = this.retryAttempts.get(operation) || 0;
    
    this.logger.warn(`Network error in ${operation} (attempt ${currentAttempts + 1}/${maxRetries + 1}):`, error.message);
    
    if (currentAttempts >= maxRetries) {
      this.logger.error(`Max retries exceeded for ${operation}`);
      
      // 성능 모니터에 오류 기록
      if (this.performanceMonitor) {
        this.performanceMonitor.recordError({
          step: operation,
          message: `Network error after ${maxRetries} retries: ${error.message}`,
          timestamp: new Date()
        });
      }
      
      throw new Error(`Network error in ${operation} after ${maxRetries} retries: ${error.message}`);
    }
    
    // 재시도 횟수 증가
    this.retryAttempts.set(operation, currentAttempts + 1);
    
    // 지수 백오프 대기
    const backoffDelay = Math.min(1000 * Math.pow(2, currentAttempts), 10000);
    this.logger.debug(`Waiting ${backoffDelay}ms before retry...`);
    await this.wait(backoffDelay);
    
    try {
      const result = await retryFunction();
      // 성공 시 재시도 횟수 리셋
      this.retryAttempts.delete(operation);
      return result;
    } catch (retryError) {
      return this.handleNetworkError(retryError, operation, retryFunction, maxRetries);
    }
  }

  /**
   * 페이지 로딩 오류 처리
   * @param {Error} error 오류 객체
   * @param {import('playwright').Page} page 페이지 객체
   * @param {string} operation 작업명
   * @returns {Promise<string>} 스크린샷 경로
   */
  async handlePageError(error, page, operation) {
    this.logger.error(`Page error in ${operation}:`, error.message);
    
    let screenshotPath = null;
    
    try {
      // 스크린샷 캡처
      if (config.screenshotOnFailure) {
        const timestamp = Date.now(); 
        screenshotPath = `./screenshots/${new Date().toISOString().split('T')[0]}/page-error-${this.sessionId}-${operation}-${timestamp}.png`;
        await page.screenshot({ 
          path: screenshotPath, 
          fullPage: true 
        });
        this.logger.info(`Error screenshot saved: ${screenshotPath}`);
      }
      
      // 페이지 상태 로깅
      const url = page.url();
      const title = await page.title().catch(() => 'Unknown');
      
      this.logger.debug(`Page state - URL: ${url}, Title: ${title}`);
      
    } catch (screenshotError) {
      this.logger.warn('Failed to capture error screenshot:', screenshotError.message);
    }
    
    // 성능 모니터에 오류 기록
    if (this.performanceMonitor) {
      this.performanceMonitor.recordError({
        step: operation,
        message: error.message,
        screenshot: screenshotPath,
        timestamp: new Date()
      });
    }
    
    throw new RecoverableError(error.message, operation, screenshotPath);
  }

  /**
   * 결제 오류 처리
   * @param {Error} error 오류 객체
   * @param {import('playwright').Page} page 페이지 객체
   * @param {Object} paymentInfo 결제 정보
   */
  async handlePaymentError(error, page, paymentInfo) {
    this.logger.error('Payment error:', error.message);
    
    let screenshotPath = null;
    
    try {
      // 결제 상태 스크린샷 캡처
      if (config.screenshotOnFailure) {
        const timestamp = Date.now();
        screenshotPath = `./screenshots/${new Date().toISOString().split('T')[0]}/payment-error-${this.sessionId}-${timestamp}.png`;
        await page.screenshot({ 
          path: screenshotPath, 
          fullPage: true 
        });
        this.logger.info(`Payment error screenshot saved: ${screenshotPath}`);
      }
      
      // 결제 상태 정보 로깅
      this.logger.error('Payment info at error:', paymentInfo);
      
    } catch (screenshotError) {
      this.logger.warn('Failed to capture payment error screenshot:', screenshotError.message);
    }
    
    // 성능 모니터에 치명적 오류 기록
    if (this.performanceMonitor) {
      this.performanceMonitor.recordError({
        step: 'payment',
        message: `Payment failed: ${error.message}`,
        screenshot: screenshotPath,
        timestamp: new Date()
      });
    }
    
    throw new CriticalError(error.message, 'payment', screenshotPath, paymentInfo);
  }

  /**
   * 타임아웃 오류 처리
   * @param {string} operation 작업명
   * @param {number} timeout 타임아웃 시간
   * @param {import('playwright').Page} page 페이지 객체
   */
  async handleTimeoutError(operation, timeout, page) {
    const message = `Timeout after ${timeout}ms in ${operation}`;
    this.logger.error(message);
    
    let screenshotPath = null;
    
    try {
      // 타임아웃 시점의 스크린샷 캡처
      if (config.screenshotOnFailure) {
        const timestamp = Date.now();
        screenshotPath = `./screenshots/${new Date().toISOString().split('T')[0]}/timeout-${this.sessionId}-${operation}-${timestamp}.png`;
        await page.screenshot({ 
          path: screenshotPath, 
          fullPage: true 
        });
        this.logger.info(`Timeout screenshot saved: ${screenshotPath}`);
      }
      
    } catch (screenshotError) {
      this.logger.warn('Failed to capture timeout screenshot:', screenshotError.message);
    }
    
    // 성능 모니터에 오류 기록
    if (this.performanceMonitor) {
      this.performanceMonitor.recordError({
        step: operation,
        message: message,
        screenshot: screenshotPath,
        timestamp: new Date()
      });
    }
    
    throw new TimeoutError(message, operation, screenshotPath);
  }

  /**
   * 일반적인 오류 처리
   * @param {Error} error 오류 객체
   * @param {string} operation 작업명
   * @param {import('playwright').Page} page 페이지 객체 (선택사항)
   */
  async handleGenericError(error, operation, page = null) {
    this.logger.error(`Error in ${operation}:`, error.message);
    
    let screenshotPath = null;
    
    if (page && config.screenshotOnFailure) {
      try {
        const timestamp = Date.now();
        screenshotPath = `./screenshots/${new Date().toISOString().split('T')[0]}/error-${this.sessionId}-${operation}-${timestamp}.png`;
        await page.screenshot({ 
          path: screenshotPath, 
          fullPage: true 
        });
        this.logger.info(`Error screenshot saved: ${screenshotPath}`);
      } catch (screenshotError) {
        this.logger.warn('Failed to capture error screenshot:', screenshotError.message);
      }
    }
    
    // 성능 모니터에 오류 기록
    if (this.performanceMonitor) {
      this.performanceMonitor.recordError({
        step: operation,
        message: error.message,
        screenshot: screenshotPath,
        timestamp: new Date()
      });
    }
    
    return {
      error: error.message,
      operation: operation,
      screenshot: screenshotPath,
      timestamp: new Date()
    };
  }

  /**
   * 대기 함수
   * @param {number} ms 대기 시간 (밀리초)
   */
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 재시도 횟수 리셋
   * @param {string} operation 작업명 (선택사항, 없으면 모든 작업 리셋)
   */
  resetRetryAttempts(operation = null) {
    if (operation) {
      this.retryAttempts.delete(operation);
    } else {
      this.retryAttempts.clear();
    }
  }

  /**
   * 현재 재시도 상태 가져오기
   * @returns {Object}
   */
  getRetryStatus() {
    return Object.fromEntries(this.retryAttempts);
  }
}

/**
 * 복구 가능한 오류 클래스
 */
export class RecoverableError extends Error {
  constructor(message, operation, screenshot = null) {
    super(message);
    this.name = 'RecoverableError';
    this.operation = operation;
    this.screenshot = screenshot;
    this.recoverable = true;
  }
}

/**
 * 치명적 오류 클래스
 */
export class CriticalError extends Error {
  constructor(message, operation, screenshot = null, context = null) {
    super(message);
    this.name = 'CriticalError';
    this.operation = operation;
    this.screenshot = screenshot;
    this.context = context;
    this.recoverable = false;
  }
}

/**
 * 타임아웃 오류 클래스
 */
export class TimeoutError extends Error {
  constructor(message, operation, screenshot = null) {
    super(message);
    this.name = 'TimeoutError';
    this.operation = operation;
    this.screenshot = screenshot;
    this.recoverable = true;
  }
}