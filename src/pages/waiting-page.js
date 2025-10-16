import { BasePage } from './base-page.js';

/**
 * 대기 페이지 처리 클래스
 */
export class WaitingPage extends BasePage {
  constructor(page, sessionId) {
    super(page, sessionId);
    
    // 대기 페이지 요소 선택자들
    this.selectors = {
      // 대기 메시지
      waitingMessage: 'text=현재 접속자가 많아 잠시 대기중',
      waitingTitle: 'text=잠시 대기중',
      
      // 대기 정보
      waitingCount: 'text=대기인원',
      estimatedTime: 'text=예상대기시간',
      
      // 경고 메시지
      refreshWarning: 'text=페이지 새로고침',
      multiTabWarning: 'text=여러 탭에서 동시접속',
      
      // 대기창 전체 컨테이너
      waitingContainer: '.waiting-container'
    };
  }

  /**
   * 대기 페이지인지 확인 (빠른 버전)
   * @returns {Promise<boolean>}
   */
  async isWaitingPage() {
    try {
      // 1. URL 먼저 확인 (가장 빠름)
      const currentUrl = this.getCurrentUrl();
      if (currentUrl.includes('waiting') || currentUrl.includes('queue')) {
        return true;
      }

      // 2. 병렬로 두 가지 동시 확인 (타임아웃 단축: 2초 → 500ms)
      const [hasWaitingMessage, hasWaitingTitle] = await Promise.all([
        this.isElementPresent(this.selectors.waitingMessage, 500),
        this.isElementPresent(this.selectors.waitingTitle, 500)
      ]);

      if (hasWaitingMessage || hasWaitingTitle) {
        return true;
      }

      return false;
    } catch (error) {
      this.logger.debug('Error checking waiting page:', error);
      return false;
    }
  }

  /**
   * 대기 정보 가져오기
   * @returns {Promise<{waitingCount: number, estimatedTime: number}>}
   */
  async getWaitingInfo() {
    try {
      let waitingCount = 0;
      let estimatedTime = 0;
      
      // 대기인원 추출
      try {
        const waitingCountElement = await this.page.locator('text=대기인원').locator('..').first();
        const countText = await waitingCountElement.textContent();
        const countMatch = countText?.match(/(\d+)명/);
        if (countMatch) {
          waitingCount = parseInt(countMatch[1]);
        }
      } catch (error) {
        this.logger.debug('Could not extract waiting count:', error);
      }
      
      // 예상대기시간 추출
      try {
        const estimatedTimeElement = await this.page.locator('text=예상대기시간').locator('..').first();
        const timeText = await estimatedTimeElement.textContent();
        const timeMatch = timeText?.match(/(\d+)초/);
        if (timeMatch) {
          estimatedTime = parseInt(timeMatch[1]);
        }
      } catch (error) {
        this.logger.debug('Could not extract estimated time:', error);
      }
      
      return { waitingCount, estimatedTime };
    } catch (error) {
      this.logger.warn('Error getting waiting info:', error);
      return { waitingCount: 0, estimatedTime: 10 }; // 기본값
    }
  }

  /**
   * 대기 완료까지 대기
   * @param {number} maxWaitTime 최대 대기 시간 (ms)
   * @returns {Promise<boolean>} 대기 완료 여부
   */
  async waitForCompletion(maxWaitTime = 300000) { // 기본 5분
    this.logger.info('Detected waiting page, starting to wait...');
    
    const startTime = Date.now();
    let lastWaitingInfo = null;
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        // 대기 페이지가 아니면 완료
        const isStillWaiting = await this.isWaitingPage();
        if (!isStillWaiting) {
          this.logger.info('Waiting completed, proceeding...');
          return true;
        }
        
        // 대기 정보 업데이트
        const waitingInfo = await this.getWaitingInfo();
        if (JSON.stringify(waitingInfo) !== JSON.stringify(lastWaitingInfo)) {
          this.logger.info(`Waiting status: ${waitingInfo.waitingCount} people ahead, estimated ${waitingInfo.estimatedTime} seconds`);
          lastWaitingInfo = waitingInfo;
        }
        
        // 예상 대기 시간이 있으면 그에 맞춰 대기, 없으면 기본 5초
        const waitInterval = waitingInfo.estimatedTime > 0 ? 
          Math.min(waitingInfo.estimatedTime * 1000, 30000) : 5000;
        
        await this.page.waitForTimeout(waitInterval);
        
      } catch (error) {
        this.logger.warn('Error during waiting:', error);
        // 오류가 발생해도 계속 대기
        await this.page.waitForTimeout(5000);
      }
    }
    
    this.logger.warn(`Waiting timeout after ${maxWaitTime}ms`);
    return false;
  }

  /**
   * 대기 페이지 처리 (자동 감지 및 대기)
   * @param {number} maxWaitTime 최대 대기 시간 (ms)
   * @returns {Promise<boolean>} 처리 완료 여부
   */
  async handleWaitingIfPresent(maxWaitTime = 300000) {
    const isWaiting = await this.isWaitingPage();

    if (!isWaiting) {
      this.logger.debug('No waiting page detected');
      return true;
    }

    this.logger.warn('⏳ WAITING PAGE DETECTED - Starting queue management');
    this.logger.info(`Max wait time: ${Math.round(maxWaitTime/1000)}s`);

    // 대기 페이지 상세 정보 로깅
    const waitingInfo = await this.getWaitingInfo();
    this.logger.info(`Queue position: ${waitingInfo.waitingCount} users ahead`);
    this.logger.info(`Estimated wait time: ${waitingInfo.estimatedTime}s`);

    // 대기 페이지 스크린샷 캡처
    try {
      const screenshotPath = await this.takeScreenshot('waiting-page');
      this.logger.info(`Waiting page screenshot saved: ${screenshotPath}`);
    } catch (error) {
      this.logger.warn('Failed to capture waiting page screenshot:', error);
    }

    // 대기 완료까지 대기
    const startTime = Date.now();
    const completed = await this.waitForCompletion(maxWaitTime);
    const actualWaitTime = Date.now() - startTime;

    if (completed) {
      this.logger.info(`✓ Successfully passed through waiting page (waited ${Math.round(actualWaitTime/1000)}s)`);
      // 대기 완료 후 잠시 대기 (페이지 안정화)
      await this.page.waitForTimeout(2000);
    } else {
      this.logger.error(`✗ FAILED to pass through waiting page after ${Math.round(actualWaitTime/1000)}s`);
      this.logger.error(`Timeout exceeded: ${Math.round(maxWaitTime/1000)}s`);
    }

    return completed;
  }

  /**
   * 대기 페이지 상태 로깅
   */
  async logWaitingStatus() {
    try {
      const waitingInfo = await this.getWaitingInfo();
      const currentUrl = this.getCurrentUrl();
      const title = await this.getTitle();
      
      this.logger.info('=== Waiting Page Status ===');
      this.logger.info(`URL: ${currentUrl}`);
      this.logger.info(`Title: ${title}`);
      this.logger.info(`Waiting Count: ${waitingInfo.waitingCount}`);
      this.logger.info(`Estimated Time: ${waitingInfo.estimatedTime} seconds`);
      this.logger.info('==========================');
      
    } catch (error) {
      this.logger.warn('Error logging waiting status:', error);
    }
  }
}