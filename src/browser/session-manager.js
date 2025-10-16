import { chromium } from 'playwright';
import { config } from '../config/index.js';
import { Logger } from '../utils/logger.js';

/**
 * 브라우저 세션 관리자 클래스 (다중 브라우저 지원)
 */
export class BrowserSessionManager {
  constructor() {
    this.browsers = new Map(); // browserId -> browser 인스턴스
    this.sharedContexts = new Map(); // browserId -> shared context
    this.contexts = new Map(); // sessionId -> context
    this.pages = new Map(); // sessionId -> page
    this.sessionToBrowser = new Map(); // sessionId -> browserId
    this.logger = new Logger('BrowserSessionManager');
    this.useSharedContext = false;
    this.tabsPerBrowser = 10; // 브라우저당 최대 탭 수
    this.browserStarting = new Map(); // browserId -> starting promise
    this.contextCreating = new Map(); // browserId -> context creating promise
    this.sessionCounter = 0; // 자동 브라우저 할당을 위한 카운터
  }

  /**
   * 브라우저당 탭 수 설정
   */
  setTabsPerBrowser(count) {
    this.tabsPerBrowser = count;
    this.logger.info(`Tabs per browser set to: ${count}`);
  }

  /**
   * 세션 ID들을 브라우저별로 분배
   */
  _distributeSessions(sessionIds) {
    const distribution = new Map(); // browserId -> sessionIds[]

    sessionIds.forEach((sessionId, index) => {
      const browserId = `browser-${Math.floor(index / this.tabsPerBrowser)}`;

      if (!distribution.has(browserId)) {
        distribution.set(browserId, []);
      }

      distribution.get(browserId).push(sessionId);
    });

    return distribution;
  }

  /**
   * 브라우저 인스턴스 시작
   */
  async startBrowser(browserId = 'browser-0') {
    // 이미 브라우저가 있으면 반환
    if (this.browsers.has(browserId)) {
      return this.browsers.get(browserId);
    }

    // 브라우저가 시작 중이면 대기
    if (this.browserStarting.has(browserId)) {
      this.logger.debug(`Browser ${browserId} already starting, waiting...`);
      return this.browserStarting.get(browserId);
    }

    this.logger.info(`Starting browser: ${browserId}...`);

    // Promise 저장하여 race condition 방지
    const startingPromise = chromium.launch({
      headless: config.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    }).then(browser => {
      this.browsers.set(browserId, browser);
      this.browserStarting.delete(browserId);
      this.logger.info(`Browser ${browserId} started successfully`);
      return browser;
    }).catch(error => {
      this.browserStarting.delete(browserId);
      this.logger.error(`Failed to start browser ${browserId}:`, error);
      throw error;
    });

    this.browserStarting.set(browserId, startingPromise);
    return startingPromise;
  }

  /**
   * 탭 모드 활성화 (메모리 최적화)
   */
  enableSharedContextMode() {
    this.useSharedContext = true;
    this.logger.info('✓ Shared context mode enabled (memory optimized)');
  }

  /**
   * 공유 Context 생성 (탭 모드용)
   */
  async getOrCreateSharedContext(browserId = 'browser-0') {
    // 이미 Context가 있으면 반환
    if (this.sharedContexts.has(browserId)) {
      this.logger.debug(`Using existing shared context for ${browserId}`);
      return this.sharedContexts.get(browserId);
    }

    // Context가 생성 중이면 대기
    if (this.contextCreating.has(browserId)) {
      this.logger.debug(`Shared context for ${browserId} already creating, waiting...`);
      const context = await this.contextCreating.get(browserId);
      this.logger.debug(`Shared context for ${browserId} ready after waiting`);
      return context;
    }

    const browser = await this.startBrowser(browserId);

    this.logger.info(`Creating shared context for ${browserId}...`);

    // Promise 저장하여 race condition 방지
    const creatingPromise = browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ignoreHTTPSErrors: true,
      acceptDownloads: false
    }).then(context => {
      this.sharedContexts.set(browserId, context);
      this.contextCreating.delete(browserId);
      this.logger.info(`Shared context created for ${browserId}`);
      return context;
    }).catch(error => {
      this.contextCreating.delete(browserId);
      this.logger.error(`Failed to create shared context for ${browserId}:`, error);
      throw error;
    });

    this.contextCreating.set(browserId, creatingPromise);
    return creatingPromise;
  }

  /**
   * 단일 브라우저 세션 생성
   */
  async createSession(sessionId, browserId = null) {
    // browserId가 지정되지 않았으면 자동 할당
    if (!browserId) {
      const browserIndex = Math.floor(this.sessionCounter / this.tabsPerBrowser);
      browserId = `browser-${browserIndex}`;
      this.sessionCounter++;
      this.logger.debug(`Auto-assigning session ${sessionId} to ${browserId} (counter: ${this.sessionCounter})`);
    }

    const browser = await this.startBrowser(browserId);

    // 세션 -> 브라우저 매핑 저장
    this.sessionToBrowser.set(sessionId, browserId);

    // 탭 모드: 공유 Context에서 새 Page만 생성
    if (this.useSharedContext) {
      this.logger.debug(`Creating tab in ${browserId}: ${sessionId}`);

      const context = await this.getOrCreateSharedContext(browserId);
      const page = await context.newPage();

      this.pages.set(sessionId, page);
      this.contexts.set(sessionId, context);

      this.logger.debug(`Tab created in ${browserId}: ${sessionId}`);
      return context;
    }

    // 기존 방식: 독립적인 Context 생성
    this.logger.debug(`Creating session in ${browserId}: ${sessionId}`);

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ignoreHTTPSErrors: true,
      acceptDownloads: false,
      storageState: undefined
    });

    if (config.screenshotOnFailure || config.videoOnFailure) {
      await context.tracing.start({
        screenshots: config.screenshotOnFailure,
        snapshots: true
      });
    }

    this.contexts.set(sessionId, context);
    this.logger.debug(`Session created in ${browserId}: ${sessionId}`);

    return context;
  }

  /**
   * 다중 브라우저 세션 생성
   */
  async createMultipleSessions(sessionIds) {
    this.logger.info(`Creating ${sessionIds.length} sessions across multiple browsers...`);

    // 세션들을 브라우저별로 분배
    const distribution = this._distributeSessions(sessionIds);

    this.logger.info(`Distribution: ${distribution.size} browsers, ~${this.tabsPerBrowser} tabs each`);

    const sessions = new Map();

    // 각 브라우저별로 병렬 생성
    const browserPromises = Array.from(distribution.entries()).map(async ([browserId, browserSessions]) => {
      this.logger.info(`${browserId}: Creating ${browserSessions.length} sessions`);

      // 해당 브라우저의 세션들을 병렬 생성
      const sessionPromises = browserSessions.map(async (sessionId) => {
        try {
          const context = await this.createSession(sessionId, browserId);
          sessions.set(sessionId, context);
          return { sessionId, context, success: true };
        } catch (error) {
          this.logger.error(`Failed to create session ${sessionId}:`, error);
          return { sessionId, error, success: false };
        }
      });

      return Promise.allSettled(sessionPromises);
    });

    await Promise.all(browserPromises);

    const successful = sessions.size;
    const failed = sessionIds.length - successful;

    this.logger.info(`Sessions created: ${successful} successful, ${failed} failed`);
    this.logger.info(`Active browsers: ${this.browsers.size}`);

    return sessions;
  }

  /**
   * 세션 종료
   */
  async closeSession(sessionId) {
    const browserId = this.sessionToBrowser.get(sessionId);

    // 탭 모드: Page만 닫기
    if (this.useSharedContext) {
      const page = this.pages.get(sessionId);
      if (page) {
        try {
          await page.close();
          this.pages.delete(sessionId);
          this.contexts.delete(sessionId);
          this.sessionToBrowser.delete(sessionId);
          this.logger.debug(`Tab closed in ${browserId}: ${sessionId}`);
        } catch (error) {
          this.logger.error(`Error closing tab ${sessionId}:`, error);
        }
      }
      return;
    }

    // 기존 방식: Context 닫기
    const context = this.contexts.get(sessionId);
    if (!context) {
      this.logger.warn(`Session not found: ${sessionId}`);
      return;
    }

    try {
      if (config.screenshotOnFailure || config.videoOnFailure) {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');

        await context.tracing.stop({
          path: `./test-results/${dateStr}/${timeStr}-trace-${sessionId}.zip`
        });
      }

      await context.close();
      this.contexts.delete(sessionId);
      this.sessionToBrowser.delete(sessionId);
      this.logger.debug(`Session closed: ${sessionId}`);
    } catch (error) {
      this.logger.error(`Error closing session ${sessionId}:`, error);
    }
  }

  /**
   * 모든 세션 종료
   */
  async closeAllSessions() {
    this.logger.info('Closing all sessions...');

    const sessionIds = Array.from(this.contexts.keys());
    const promises = sessionIds.map(sessionId => this.closeSession(sessionId));

    await Promise.allSettled(promises);

    this.logger.info(`Closed ${sessionIds.length} sessions`);
  }

  /**
   * 특정 브라우저 종료
   */
  async closeBrowser(browserId) {
    const browser = this.browsers.get(browserId);
    if (!browser) {
      return;
    }

    this.logger.info(`Closing browser: ${browserId}...`);

    // 해당 브라우저의 공유 Context 닫기
    const sharedContext = this.sharedContexts.get(browserId);
    if (sharedContext) {
      try {
        await sharedContext.close();
        this.sharedContexts.delete(browserId);
        this.logger.debug(`Shared context closed for ${browserId}`);
      } catch (error) {
        this.logger.error(`Error closing shared context for ${browserId}:`, error);
      }
    }

    // 브라우저 종료
    await browser.close();
    this.browsers.delete(browserId);

    this.logger.info(`Browser closed: ${browserId}`);
  }

  /**
   * 모든 브라우저 종료
   */
  async closeAllBrowsers() {
    this.logger.info('Closing all browsers...');

    // 모든 세션 먼저 종료
    await this.closeAllSessions();

    // 모든 브라우저 종료
    const browserIds = Array.from(this.browsers.keys());
    const promises = browserIds.map(browserId => this.closeBrowser(browserId));

    await Promise.allSettled(promises);

    this.logger.info(`Closed ${browserIds.length} browsers`);
  }

  /**
   * 세션 상태 확인
   */
  isSessionActive(sessionId) {
    const context = this.contexts.get(sessionId);
    return context && !context.isClosed();
  }

  /**
   * 활성 세션 수 반환
   */
  getActiveSessionCount() {
    return Array.from(this.contexts.values())
      .filter(context => !context.isClosed()).length;
  }

  /**
   * 메모리 정리
   */
  async cleanup() {
    await this.closeAllBrowsers();
    this.contexts.clear();
    this.pages.clear();
    this.sessionToBrowser.clear();
  }
}

// 싱글톤 인스턴스
export const browserSessionManager = new BrowserSessionManager();
