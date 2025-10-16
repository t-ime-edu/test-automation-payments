/**
 * 플로우 매니저
 * 전체 테스트 플로우를 단계별로 관리
 */

import { Logger } from '../utils/logger.js';
import { PerformanceMonitor } from '../utils/performance.js';
import { CourseListPage } from '../pages/course-list-page.js';
import { BasicInfoPage } from '../pages/basic-info-page.js';
import { DetailedInfoPage } from '../pages/detailed-info-page.js';
import { ClassSelectionPage } from '../pages/class-selection-page.js';
import { PaymintPaymentPage } from '../pages/paymint-payment-page.js';
import { WaitingPage } from '../pages/waiting-page.js';
import { config } from '../config/index.js';

export class FlowManager {
  constructor(page, sessionId, monitor = null) {
    this.page = page;
    this.sessionId = sessionId;
    this.monitor = monitor; // ConcurrentMonitor
    this.logger = new Logger(`FlowManager-${sessionId}`);
    this.performanceMonitor = new PerformanceMonitor(sessionId);

    // 페이지 인스턴스 저장용
    this.classSelectionPage = null; // 추가

    // 에러 스크린샷 활성화 여부 (config에서 관리)
    // 개발/디버깅: true (기본값), 대량 테스트: false (성능 최적화)
    this.enableScreenshots = config.enableScreenshots;

    this.result = {
      success: false,
      stepTimes: {},
      errors: [],
      screenshots: [],
      classSelection: null
    };
  }

  /**
   * 유량제어를 적용한 작업 실행
   */
  async _executeWithRateLimit(actionName, actionFn) {
    if (this.monitor && typeof this.monitor.waitForRateLimit === 'function') {
      await this.monitor.waitForRateLimit();
    }
    this.logger.info(`[Rate Limited] Executing: ${actionName}`);
    return await actionFn();
  }

  /**
   * 대기 페이지 처리
   */
  async _handleWaitingPageIfPresent() {
    const waitingPage = new WaitingPage(this.page, this.sessionId);
    const handled = await waitingPage.handleWaitingIfPresent();

    if (!handled) {
      throw new Error('Failed to pass through waiting page');
    }
  }

  /**
   * 전체 플로우 실행
   */
  async executeFullFlow(studentInfo) {
    this.logger.info('Executing full registration flow...');

    try {
      // Step 1: 수강신청 목록에서 코스 선택
      await this._step1_SelectCourse(studentInfo);

      // Step 2: 기본 정보 입력
      await this._step2_FillBasicInfo(studentInfo);

      // Step 3: 상세 정보 입력
      await this._step3_FillDetailedInfo(studentInfo);

      // Step 4: 수강반 및 결제 방법 선택
      await this._step4_SelectClassAndPayment();

      // Step 5: Paymint 결제 처리
      await this._step5_ProcessPayment();

      this.result.success = true;
      this.logger.info('✓ Full flow completed successfully');

    } catch (error) {
      this.logger.error('Flow execution failed:', error);
      this.result.success = false;
      this.result.errors.push({
        step: 'flow-execution',
        message: error.message,
        timestamp: new Date()
      });
    }

    return this.result;
  }

  /**
   * Step 1: 코스 선택
   */
  async _step1_SelectCourse(studentInfo) {
    this.logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.logger.info('📝 Step 1: Selecting course');
    this.logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 모니터에 단계 업데이트
    if (this.monitor) {
      this.monitor.updateSessionStep(this.sessionId, 'step1-course');
    }

    this.performanceMonitor.startTimer('course-selection');

    try {
      const courseListPage = new CourseListPage(this.page, this.sessionId);

      this.logger.info('Navigating to course list page...');
      await this._executeWithRateLimit('navigate-to-course-list', () => courseListPage.navigate());

      // 대기 페이지 확인
      await this._handleWaitingPageIfPresent();

      if (!studentInfo.acadCd) {
        throw new Error('AcadCd is required');
      }

      this.logger.info(`Target academy code: ${studentInfo.acadCd}`);
      const selectedCourse = await this._executeWithRateLimit('apply-to-course',
        () => courseListPage.applyToFirstAvailableCourse(studentInfo.acadCd));

      // 대기 페이지 확인
      await this._handleWaitingPageIfPresent();

      this.logger.info(`✓ Course selected: ${selectedCourse.title} (Status: ${selectedCourse.status})`);
      this.result.courseInfo = selectedCourse;

      const elapsedTime = this.performanceMonitor.endTimer('course-selection');
      this.result.stepTimes['course-selection'] = elapsedTime;
      this.logger.info(`⏱️  Step 1 completed in ${Math.round(elapsedTime/1000)}s`);

    } catch (error) {
      const elapsedTime = this.performanceMonitor.endTimer('course-selection');
      this.logger.error(`✗ Step 1 FAILED after ${Math.round(elapsedTime/1000)}s`);
      this.logger.error(`Error details: ${error.message}`);

      // 모니터에 에러 기록
      if (this.monitor) {
        this.monitor.recordError(this.sessionId, 'step1-course', error);
      }

      // 에러 스크린샷 캡처 (환경변수로 제어)
      if (this.enableScreenshots) {
        try {
          await this.page.screenshot({ path: `public/screenshots/error-step1-${this.sessionId}.png` });
          this.logger.info('Error screenshot saved');
        } catch (screenshotError) {
          this.logger.warn('Failed to capture error screenshot');
        }
      }

      throw new Error(`Course selection failed: ${error.message}`);
    }
  }

  /**
   * Step 2: 기본 정보 입력
   */
  async _step2_FillBasicInfo(studentInfo) {
    this.logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.logger.info('📝 Step 2: Filling basic info');
    this.logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (this.monitor) this.monitor.updateSessionStep(this.sessionId, 'step2-basic');
    this.performanceMonitor.startTimer('basic-info');

    try {
      const basicInfoPage = new BasicInfoPage(this.page, this.sessionId);

      this.logger.info('Waiting for basic info page to load...');
      await basicInfoPage.waitForPageLoad();

      // 대기 페이지 확인
      await this._handleWaitingPageIfPresent();

      this.logger.info(`Filling info: ${studentInfo.name} (${studentInfo.phone})`);
      await this._executeWithRateLimit('fill-basic-info', () => basicInfoPage.fillBasicInfo(studentInfo));
      await this._executeWithRateLimit('click-next-button-step2', () => basicInfoPage.clickNextButton());

      const elapsedTime = this.performanceMonitor.endTimer('basic-info');
      this.result.stepTimes['basic-info'] = elapsedTime;
      this.logger.info(`✓ Basic info filled successfully`);
      this.logger.info(`⏱️  Step 2 completed in ${Math.round(elapsedTime/1000)}s`);

    } catch (error) {
      const elapsedTime = this.performanceMonitor.endTimer('basic-info');
      this.logger.error(`✗ Step 2 FAILED after ${Math.round(elapsedTime/1000)}s`);
      this.logger.error(`Error details: ${error.message}`);

      if (this.monitor) this.monitor.recordError(this.sessionId, 'step2-basic', error);

      if (this.enableScreenshots) {
        try {
          await this.page.screenshot({ path: `public/screenshots/error-step2-${this.sessionId}.png` });
          this.logger.info('Error screenshot saved');
        } catch (screenshotError) {
          this.logger.warn('Failed to capture error screenshot');
        }
      }

      throw new Error(`Basic info failed: ${error.message}`);
    }
  }

  /**
   * Step 3: 상세 정보 입력
   */
  async _step3_FillDetailedInfo(studentInfo) {
    this.logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.logger.info('📝 Step 3: Filling detailed info');
    this.logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (this.monitor) this.monitor.updateSessionStep(this.sessionId, 'step3-detailed');
    this.performanceMonitor.startTimer('detailed-info');

    try {
      const detailedInfoPage = new DetailedInfoPage(this.page, this.sessionId);

      this.logger.info('Waiting for detailed info page to load...');
      await detailedInfoPage.waitForPageLoad();

      // 대기 페이지 확인
      await this._handleWaitingPageIfPresent();

      this.logger.info(`Filling detailed info: School=${studentInfo.schoolName}, Grade=${studentInfo.grade}`);
      await this._executeWithRateLimit('fill-detailed-info', () => detailedInfoPage.fillDetailedInfo(studentInfo));
      await this._executeWithRateLimit('agree-privacy-policy', () => detailedInfoPage.agreeToPrivacyPolicy());
      await this._executeWithRateLimit('click-next-button-step3', () => detailedInfoPage.clickNextButton());

      const elapsedTime = this.performanceMonitor.endTimer('detailed-info');
      this.result.stepTimes['detailed-info'] = elapsedTime;
      this.logger.info(`✓ Detailed info filled successfully`);
      this.logger.info(`⏱️  Step 3 completed in ${Math.round(elapsedTime/1000)}s`);

    } catch (error) {
      const elapsedTime = this.performanceMonitor.endTimer('detailed-info');
      this.logger.error(`✗ Step 3 FAILED after ${Math.round(elapsedTime/1000)}s`);
      this.logger.error(`Error details: ${error.message}`);

      if (this.monitor) this.monitor.recordError(this.sessionId, 'step3-detailed', error);

      if (this.enableScreenshots) {
        try {
          await this.page.screenshot({ path: `public/screenshots/error-step3-${this.sessionId}.png` });
          this.logger.info('Error screenshot saved');
        } catch (screenshotError) {
          this.logger.warn('Failed to capture error screenshot');
        }
      }

      throw new Error(`Detailed info failed: ${error.message}`);
    }
  }

  /**
   * Step 4: 수강반 선택
   */
  async _step4_SelectClassAndPayment() {
    this.logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.logger.info('📝 Step 4: Selecting class and payment');
    this.logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (this.monitor) this.monitor.updateSessionStep(this.sessionId, 'step4-class');
    this.performanceMonitor.startTimer('class');

    try {
      // 인스턴스를 멤버 변수로 저장
      this.classSelectionPage = new ClassSelectionPage(this.page, this.sessionId);

      this.logger.info('Waiting for class selection page to load...');
      await this.classSelectionPage.waitForPageLoad();

      // 대기 페이지 확인
      await this._handleWaitingPageIfPresent();

      this.logger.info('Selecting class and payment method...');
      const classInfo = await this._executeWithRateLimit('select-class-and-payment',
        () => this.classSelectionPage.selectClassAndPayment());
      this.result.classSelection = classInfo;

      // 대기 페이지 확인
      await this._handleWaitingPageIfPresent();

      const elapsedTime = this.performanceMonitor.endTimer('class');
      this.result.stepTimes['class'] = elapsedTime;
      this.logger.info(`✓ Class selected: ${classInfo.className || 'N/A'}`);
      this.logger.info(`💰 Fee: ${(classInfo.fee || 0).toLocaleString()}원`);
      this.logger.info(`⏱️  Step 4 completed in ${Math.round(elapsedTime/1000)}s`);

    } catch (error) {
      const elapsedTime = this.performanceMonitor.endTimer('class');
      this.logger.error(`✗ Step 4 FAILED after ${Math.round(elapsedTime/1000)}s`);
      this.logger.error(`Error details: ${error.message}`);

      if (this.monitor) this.monitor.recordError(this.sessionId, 'step4-class', error);

      if (this.enableScreenshots) {
        try {
          await this.page.screenshot({ path: `public/screenshots/error-step4-${this.sessionId}.png` });
          this.logger.info('Error screenshot saved');
        } catch (screenshotError) {
          this.logger.warn('Failed to capture error screenshot');
        }
      }

      throw new Error(`Class/payment selection failed: ${error.message}`);
    }
  }

  /**
   * Step 5: Paymint 결제 처리
   */
  async _step5_ProcessPayment() {
    this.logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.logger.info('💳 Step 5: Processing payment');
    this.logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (this.monitor) this.monitor.updateSessionStep(this.sessionId, 'step5-payment');
    this.performanceMonitor.startTimer('payment');

    try {
      // Step 4에서 생성한 인스턴스 재사용
      if (!this.classSelectionPage) {
        throw new Error('ClassSelectionPage not initialized. Step 4 must run first.');
      }

      // 팝업 리스너 설정 (opener 체크로 현재 탭의 팝업만 받음)
      this.logger.info('Setting up payment popup listener...');
      const popupPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.page.context().off('page', pageHandler);
          reject(new Error('Payment popup wait timeout'));
        }, 15000);

        const pageHandler = (popup) => {
          // Check if popup belongs to THIS page
          popup.opener().then(opener => {
            if (opener === this.page) {
              clearTimeout(timeout);
              this.page.context().off('page', pageHandler);
              this.logger.info('✓ Payment popup detected (matched by opener)');
              resolve(popup);
            }
          }).catch(() => {
            // Ignore errors from checking opener
          });
        };

        this.page.context().on('page', pageHandler);
      });

      // 결제 버튼 클릭
      this.logger.info('Clicking payment button...');
      await this._executeWithRateLimit('click-payment-button',
        () => this.classSelectionPage.clickPaymentButton());

      // 대기 페이지 확인
      await this._handleWaitingPageIfPresent();

      // 팝업 대기
      let paymentPage = null;
      try {
        paymentPage = await popupPromise;
        this.logger.info('✓ Payment popup confirmed');
      } catch {
        this.logger.warn('No popup detected, using current page');
        paymentPage = this.page;
      }

      // 팝업이 감지된 경우 처리
      if (paymentPage !== this.page) {
        const popupUrl = paymentPage.url();
        this.logger.info(`Payment popup URL: ${popupUrl}`);

        // paymint 결제 페이지 확인
        if (popupUrl.includes('paymint.co.kr')) {
          this.logger.info('Paymint payment page detected, waiting for completion...');

          // "결제 완료" 텍스트가 나타날 때까지 대기 (최대 60초)
          try {
            await paymentPage.waitForSelector('text=결제 완료', { timeout: 60000 });
            this.logger.info('✓ Payment completed successfully');
          } catch (waitError) {
            this.logger.warn('Payment completion text not found within timeout');

            // URL이 /complete/로 변경되었는지 확인
            const currentUrl = paymentPage.url();
            if (currentUrl.includes('/complete/')) {
              this.logger.info('✓ Payment URL changed to complete page');
            } else {
              // 결제 완료를 확인할 수 없으면 에러 throw
              await paymentPage.close().catch(() => {});
              throw new Error(`Payment completion failed - still on: ${currentUrl}`);
            }
          }

          // 팝업 닫기
          await this.page.waitForTimeout(2000);
          await paymentPage.close();
          this.logger.info('Payment popup closed');
          await this.page.waitForTimeout(2000);
        } else {
          this.logger.warn(`Unexpected popup URL: ${popupUrl}`);
          // 예상치 못한 팝업도 닫기
          await this.page.waitForTimeout(3000);
          await paymentPage.close();
          this.logger.info('Unexpected popup closed');
        }
      }

      const elapsedTime = this.performanceMonitor.endTimer('payment');
      this.result.stepTimes['payment'] = elapsedTime;
      this.logger.info(`⏱️  Step 5 completed in ${Math.round(elapsedTime/1000)}s`);

    } catch (error) {
      const elapsedTime = this.performanceMonitor.endTimer('payment');
      this.logger.error(`✗ Step 5 FAILED after ${Math.round(elapsedTime/1000)}s`);
      this.logger.error(`Error details: ${error.message}`);

      if (this.monitor) this.monitor.recordError(this.sessionId, 'step5-payment', error);

      if (this.enableScreenshots) {
        try {
          await this.page.screenshot({ path: `public/screenshots/error-step5-${this.sessionId}.png` });
          this.logger.info('Error screenshot saved');
        } catch (screenshotError) {
          this.logger.warn('Failed to capture error screenshot');
        }
      }

      throw new Error(`Payment processing failed: ${error.message}`);
    }
  }
}
