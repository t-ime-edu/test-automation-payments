import { BasePage } from './base-page.js';
import { WaitingPage } from './waiting-page.js';

/**
 * 기본 정보 입력 페이지 클래스
 */
export class BasicInfoPage extends BasePage {
  constructor(page, sessionId) {
    super(page, sessionId);
    
    // 페이지 요소 선택자들
    this.selectors = {
      // 기본 정보 입력 필드
      nameInput: '#nm',
      phonePrefix: '#parent_ctel_no1',
      phoneMiddle: '#parent_ctel_no2',
      phoneLast: '#parent_ctel_no3',

      // 버튼들
      cancelButton: '#previous',  // 취소 버튼 (실제 ID로 수정)
      nextButton: '#next'         // 다음단계 버튼
    };
  }

  /**
   * 빠른 페이지 로딩 대기 및 검증 (최적화된 버전)
   */
  async waitForPageLoad() {
    this.logger.debug('Fast waiting for basic info page to load...');

    // URL 확인을 먼저 (가장 빠른 확인 방법)
    const currentUrl = this.getCurrentUrl();
    if (currentUrl.includes('applyRegister01')) {
      this.logger.debug('Already on basic info page');
    } else {
      // URL 대기 (타임아웃 단축)
      await this.page.waitForURL('**/applyRegister01.do', { timeout: 15000 });
    }

    // 필수 입력 필드 중 하나만 빠르게 확인
    try {
      await this.page.waitForSelector(this.selectors.nameInput, { timeout: 5000 });
    } catch (error) {
      this.logger.warn('Name input field not immediately found, trying to proceed anyway');
    }

    this.logger.info('Basic info page loaded successfully');
  }

  /**
   * 학생 이름 입력
   * @param {string} name 학생 이름
   */
  async fillStudentName(name) {
    this.logger.debug(`Filling student name: ${name}`);
    await this.safeType(this.selectors.nameInput, name);
  }

  /**
   * 휴대폰 번호 입력
   * @param {string} phone 휴대폰 번호 (예: 010-1234-5678)
   */
  async fillPhoneNumber(phone) {
    this.logger.debug(`Filling phone number: ${phone}`);

    const phoneParts = phone.split('-');
    if (phoneParts.length !== 3) {
      throw new Error(`Invalid phone number format: ${phone}. Expected format: 010-1234-5678`);
    }

    const [prefix, middle, last] = phoneParts;

    // 휴대폰 앞자리 선택
    await this.selectOption(this.selectors.phonePrefix, prefix);

    // 중간 번호 입력
    await this.safeType(this.selectors.phoneMiddle, middle);

    // 뒷자리 번호 입력
    await this.safeType(this.selectors.phoneLast, last);
  }

  /**
   * 빠른 기본 정보 전체 입력 (최적화된 버전)
   * @param {import('../types/index.js').StudentBasicInfo} basicInfo 학생 기본 정보
   */
  async fillBasicInfo(basicInfo) {
    this.logger.info('Fast filling basic information...');

    // 최소한의 안정화 시간만 적용
    await this.page.waitForTimeout(200);

    try {
      // JavaScript로 모든 필드를 한 번에 빠르게 입력하고 이벤트 트리거
      await this.page.evaluate((info) => {
        // 이벤트 트리거 함수
        function triggerEvents(element) {
          if (element) {
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            element.dispatchEvent(new Event('blur', { bubbles: true }));
          }
        }

        // 이름 입력
        const nameInput = document.querySelector('#nm');
        if (nameInput) {
          nameInput.value = info.name;
          triggerEvents(nameInput);
        }

        // 휴대폰 번호 입력
        const phoneParts = info.phone.split('-');
        if (phoneParts.length === 3) {
          const [prefix, middle, last] = phoneParts;

          const phonePrefix = document.querySelector('#parent_ctel_no1');
          if (phonePrefix) {
            phonePrefix.value = prefix;
            triggerEvents(phonePrefix);
          }

          const phoneMiddle = document.querySelector('#parent_ctel_no2');
          if (phoneMiddle) {
            phoneMiddle.value = middle;
            triggerEvents(phoneMiddle);
          }

          const phoneLast = document.querySelector('#parent_ctel_no3');
          if (phoneLast) {
            phoneLast.value = last;
            triggerEvents(phoneLast);
          }
        }
      }, basicInfo);

      this.logger.info('Basic information filled successfully (fast mode)');

    } catch (error) {
      this.logger.warn('Fast fill failed, trying individual field method:', error);

      // JavaScript 실패 시 개별 필드 입력 (빠른 버전)
      await this.fillStudentName(basicInfo.name);
      await this.page.waitForTimeout(100);

      await this.fillPhoneNumber(basicInfo.phone);
      await this.page.waitForTimeout(100);

      this.logger.info('Basic information filled successfully (fallback mode)');
    }
  }

  /**
   * 빠른 "다음단계" 버튼 클릭 (최적화된 버전) - 강화된 버전
   */
  async clickNextButton() {
    this.logger.info('Fast clicking next button (enhanced)...');

    // 클릭 전에 모든 필드가 유효한지 재확인 및 강제 이벤트 트리거
    await this.page.evaluate(() => {
      // 모든 입력 필드에 대해 강제로 이벤트 트리거
      const inputs = document.querySelectorAll('input, select');
      inputs.forEach(input => {
        if (input.value || input.selectedIndex > 0) {
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          input.dispatchEvent(new Event('blur', { bubbles: true }));
        }
      });

      // 폼 유효성 검증 강제 실행 (있을 경우)
      const form = document.querySelector('form');
      if (form && form.checkValidity) {
        form.checkValidity();
      }
    });

    // 잠시 대기하여 유효성 검증이 완료되도록 함
    await this.page.waitForTimeout(500);

    // 다음단계 버튼 클릭 - 여러 방법으로 시도
    let clicked = false;

    // 방법 1: JavaScript로 직접 클릭 (ID 기반)
    try {
      const jsClickResult = await this.page.evaluate(() => {
        const nextButton = document.querySelector('#next');
        if (nextButton && nextButton.offsetParent !== null) {
          nextButton.click();
          return { success: true, method: 'js-direct-id' };
        }
        return { success: false };
      });

      if (jsClickResult.success) {
        this.logger.info('Clicked next button with JavaScript (ID)');
        clicked = true;
      }
    } catch (error) {
      this.logger.debug('JavaScript click failed:', error);
    }

    // 방법 2: Playwright safeClick
    if (!clicked) {
      try {
        await this.safeClick(this.selectors.nextButton);
        this.logger.info('Clicked next button with Playwright');
        clicked = true;
      } catch (error) {
        this.logger.debug('Playwright click failed:', error);
      }
    }

    if (!clicked) {
      throw new Error('Failed to click next button with all methods');
    }

    // 페이지 전환 대기 - 대기 페이지를 고려한 유연한 접근
    let navigationSuccess = false;

    // 30초 동안 여러 방법으로 확인 (대기 페이지 고려)
    const timeout = 30000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout && !navigationSuccess) {
      try {
        // 1. 대기 페이지 확인
        const waitingPage = new WaitingPage(this.page, this.sessionId);
        const isWaitingPage = await waitingPage.isWaitingPage();

        if (isWaitingPage) {
          this.logger.info('Waiting page detected after clicking next button');
          const waitingHandled = await waitingPage.handleWaitingIfPresent();

          if (!waitingHandled) {
            throw new Error('Failed to pass through waiting page');
          }

          // 대기 페이지 통과 후 다시 페이지 확인
          continue;
        }

        // 2. URL 변경 감지
        await this.page.waitForURL('**/applyRegister02.do', { timeout: 2000 });
        navigationSuccess = true;
        this.logger.info('Navigation detected via URL change');
      } catch (error) {
        // URL 직접 확인
        const currentUrl = this.getCurrentUrl();
        if (currentUrl.includes('applyRegister02')) {
          navigationSuccess = true;
          this.logger.info('Navigation confirmed via URL check');
          break;
        }

        // 페이지 요소 변화 확인
        try {
          await this.page.waitForSelector('h3:has-text("개인정보 수집 및 이용 동의")', { timeout: 1000 });
          navigationSuccess = true;
          this.logger.info('Navigation confirmed via page element');
          break;
        } catch (elementError) {
          // 계속 대기
          await this.page.waitForTimeout(1000);
        }
      }
    }

    if (!navigationSuccess) {
      throw new Error('Failed to navigate to detailed info page after clicking next button');
    }

    this.logger.info('Successfully moved to detailed info page');
  }

  /**
   * 입력된 정보 검증
   * @param {import('../types/index.js').StudentBasicInfo} expectedInfo 예상 정보
   * @returns {Promise<boolean>}
   */
  async validateInputs(expectedInfo) {
    try {
      // 이름 검증
      const nameValue = await this.page.inputValue(this.selectors.nameInput);
      if (nameValue !== expectedInfo.name) {
        this.logger.error(`Name mismatch: expected ${expectedInfo.name}, got ${nameValue}`);
        return false;
      }
      
      // 휴대폰 번호 검증
      const [, expectedMiddle, expectedLast] = expectedInfo.phone.split('-');
      const phoneMiddleValue = await this.page.inputValue(this.selectors.phoneMiddle);
      const phoneLastValue = await this.page.inputValue(this.selectors.phoneLast);
      
      if (phoneMiddleValue !== expectedMiddle || phoneLastValue !== expectedLast) {
        this.logger.error(`Phone mismatch: expected ${expectedMiddle}-${expectedLast}, got ${phoneMiddleValue}-${phoneLastValue}`);
        return false;
      }
      
      this.logger.debug('Input validation passed');
      return true;
      
    } catch (error) {
      this.logger.error('Input validation failed:', error);
      return false;
    }
  }

  /**
   * 폼 초기화
   */
  async resetForm() {
    this.logger.debug('Resetting form...');
    await this.safeClick(this.selectors.resetButton);
    
    // 폼이 초기화될 때까지 잠시 대기
    await this.page.waitForTimeout(500);
  }

  /**
   * 페이지 상태 검증
   * @returns {Promise<boolean>}
   */
  async validatePageState() {
    try {
      // URL 확인
      const currentUrl = this.getCurrentUrl();
      if (!currentUrl.includes('applyRegister01.do')) {
        return false;
      }
      
      // 필수 요소들 존재 확인
      const requiredElements = [
        this.selectors.nameInput,
        this.selectors.phoneMiddle,
        this.selectors.nextButton
      ];
      
      for (const selector of requiredElements) {
        const exists = await this.isElementPresent(selector);
        if (!exists) {
          this.logger.error(`Required element not found: ${selector}`);
          return false;
        }
      }
      
      return true;
      
    } catch (error) {
      this.logger.error('Page validation failed:', error);
      return false;
    }
  }
}