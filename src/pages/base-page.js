import { config } from '../config/index.js';
import { Logger } from '../utils/logger.js';

/**
 * 기본 페이지 클래스
 */
export class BasePage {
  constructor(page, sessionId) {
    this.page = page;
    this.sessionId = sessionId;
    this.logger = new Logger(`BasePage-${sessionId}`);
    // BASE_URL에서 마지막 경로 부분 제거하여 기본 도메인만 사용
    const baseUrl = config.baseUrl;
    this.baseUrl = baseUrl.replace(/\/apply\/request\/list\.do.*$/, '');
  }

  /**
   * 페이지 이동
   * @param {string} url 이동할 URL
   * @param {number} timeout 타임아웃 (ms)
   */
  async navigate(url, timeout = config.waitTimeout) {
    let targetUrl;

    // URL이 이미 포함되어 있는지 확인
    if (url.startsWith('http') || url.startsWith('//')) {
      targetUrl = url;
      this.logger.debug(`Navigating to full URL: ${targetUrl}`);
    } else {
      // 상대 경로인 경우 BASE_URL에 붙여서 이동
      targetUrl = `${this.baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
      this.logger.debug(`Navigating to relative URL: ${targetUrl}`);
    }

    await this.page.goto(targetUrl, { timeout, waitUntil: 'networkidle' });
    this.logger.info(`Successfully navigated to: ${targetUrl}`);
  }

  /**
   * 요소 존재 확인
   * @param {string} selector CSS 선택자
   * @param {number} timeout 타임아웃 (ms)
   * @returns {Promise<boolean>}
   */
  async isElementPresent(selector, timeout = 5000) {
    try {
      await this.page.waitForSelector(selector, { timeout });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 요소 클릭 가능 상태까지 대기
   * @param {string} selector CSS 선택자
   * @param {number} timeout 타임아웃 (ms)
   */
  async waitForClickable(selector, timeout = config.waitTimeout) {
    await this.page.waitForSelector(selector, { 
      state: 'visible', 
      timeout 
    });
    
    // 요소가 클릭 가능한 상태인지 확인
    // :has-text()는 Playwright에서 지원하지 않으므로 대체 방법 사용
    await this.page.waitForFunction(
      (sel) => {
        const element = document.querySelector(sel);
        // 요소가 존재하고 비활성화되지 않았으며 화면에 보이는지 확인
        return element && !element.disabled && element.offsetParent !== null;
      },
      selector,
      { timeout }
    );
  }

  /**
   * 안전한 클릭 (재시도 포함)
   * @param {string} selector CSS 선택자
   * @param {number} maxRetries 최대 재시도 횟수
   */
  async safeClick(selector, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        // 요소가 존재하고 클릭 가능하도록 대기
        await this.page.waitForSelector(selector, { 
          state: 'visible', 
          timeout: config.waitTimeout 
        });
        
        // 간단한 클릭 시도
        await this.page.click(selector);
        this.logger.debug(`Clicked: ${selector}`);
        return;
      } catch (error) {
        this.logger.warn(`Click attempt ${i + 1} failed for ${selector}:`, error);
        if (i === maxRetries - 1) {
          throw error;
        }
        await this.page.waitForTimeout(1000); // 1초 대기 후 재시도
      }
    }
  }

  /**
   * 안전한 텍스트 입력
   * @param {string} selector CSS 선택자
   * @param {string} text 입력할 텍스트
   * @param {boolean} clear 기존 텍스트 지우기 여부
   */
  async safeType(selector, text, clear = true) {
    await this.waitForClickable(selector);
    
    if (clear) {
      await this.page.fill(selector, '');
    }
    
    await this.page.type(selector, text, { delay: 50 }); // 자연스러운 타이핑 속도
    this.logger.debug(`Typed "${text}" into: ${selector}`);
  }

  /**
   * 드롭다운 선택
   * @param {string} selector CSS 선택자
   * @param {string} value 선택할 값
   */
  async selectOption(selector, value) {
    await this.waitForClickable(selector);
    await this.page.selectOption(selector, value);
    this.logger.debug(`Selected "${value}" from: ${selector}`);
  }

  /**
   * 체크박스 상태 설정
   * @param {string} selector CSS 선택자
   * @param {boolean} checked 체크 여부
   */
  async setCheckbox(selector, checked = true) {
    await this.waitForClickable(selector);
    await this.page.setChecked(selector, checked);
    this.logger.debug(`Set checkbox ${selector} to: ${checked}`);
  }

  /**
   * 스크린샷 캡처
   * @param {string} name 스크린샷 이름
   * @returns {Promise<string>} 스크린샷 경로
   */
  async takeScreenshot(name) {
    const timestamp = Date.now();
    const filename = `screenshot-${this.sessionId}-${name}-${timestamp}.png`;
    const path = `./screenshots/${filename}`;
    
    await this.page.screenshot({ 
      path, 
      fullPage: true 
    });
    
    this.logger.debug(`Screenshot saved: ${path}`);
    return path;
  }

  /**
   * 페이지 제목 가져오기
   * @returns {Promise<string>}
   */
  async getTitle() {
    return await this.page.title();
  }

  /**
   * 현재 URL 가져오기
   * @returns {string}
   */
  getCurrentUrl() {
    return this.page.url();
  }

  /**
   * 페이지 새로고침
   */
  async refresh() {
    await this.page.reload({ waitUntil: 'networkidle' });
    this.logger.debug('Page refreshed');
  }

  /**
   * 뒤로 가기
   */
  async goBack() {
    await this.page.goBack({ waitUntil: 'networkidle' });
    this.logger.debug('Navigated back');
  }

  /**
   * 랜덤 지연
   * @param {number} min 최소 지연 시간 (ms)
   * @param {number} max 최대 지연 시간 (ms)
   */
  async randomDelay(min = 500, max = 2000) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await this.page.waitForTimeout(delay);
    this.logger.debug(`Random delay: ${delay}ms`);
  }
}