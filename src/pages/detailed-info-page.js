import { BasePage } from './base-page.js';
import { SchoolSearchPopup } from './school-search-popup.js';
import { WaitingPage } from './waiting-page.js';

/**
 * 상세 개인정보 입력 페이지 클래스
 */
export class DetailedInfoPage extends BasePage {
  constructor(page, sessionId) {
    super(page, sessionId);
    
    // 페이지 요소 선택자들 (실제 HTML 구조에 맞게 수정)
    this.selectors = {
      // 학년 선택
      gradeSelect: '#grd_cd',

      // 학교 검색 관련
      schoolInput: '#sch_nm',
      schoolSearchButton: '#btnSearchSchool',

      // 개인정보 동의
      privacyCheckbox: '#privacy',

      // 버튼들
      nextButton: '#next'
    };
  }

  /**
   * 빠른 페이지 로딩 대기 및 검증 (최적화된 버전)
   */
  async waitForPageLoad() {
    this.logger.debug('Fast waiting for detailed info page to load...');

    // URL 확인을 먼저 (가장 빠른 확인 방법)
    const currentUrl = this.getCurrentUrl();
    if (currentUrl.includes('applyRegister02')) {
      this.logger.debug('Already on detailed info page');
    } else {
      // URL 대기 (타임아웃 단축)
      await this.page.waitForURL('**/applyRegister02.do', { timeout: 15000 });
    }

    // 필수 입력 필드 중 하나만 빠르게 확인
    try {
      await this.page.waitForSelector(this.selectors.privacyCheckbox, { timeout: 5000 });
    } catch (error) {
      this.logger.warn('Privacy checkbox not immediately found, trying to proceed anyway');
    }

    this.logger.info('Detailed info page loaded successfully');
  }

  /**
   * 학년 선택
   * @param {string} grade 학년 (예: "고3", "고2", "고1")
   */
  async selectGrade(grade) {
    this.logger.debug(`Selecting grade: ${grade}`);
    await this.selectOption(this.selectors.gradeSelect, grade);
    await this.randomDelay(300, 800);
  }

  /**
   * 빠른 학교 검색 및 선택 (최적화된 버전)
   * @param {string} searchTerm 검색어 (기본값: "기타")
   * @returns {Promise<string>} 선택된 학교명
   */
  async searchAndSelectSchool(searchTerm = '기타') {
    this.logger.info('Starting school search process...');

    // 팝업 이벤트 리스너를 먼저 설정 (버튼 클릭 전에!)
    const popupPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.page.context().off('page', pageHandler);
        reject(new Error('Popup wait timeout'));
      }, 10000);

      const pageHandler = (popup) => {
        // 이 페이지에서 열린 팝업인지 확인 (opener 체크)
        popup.opener().then(opener => {
          if (opener === this.page) {
            clearTimeout(timeout);
            this.page.context().off('page', pageHandler);
            resolve(popup);
          }
        }).catch(() => {
          // opener가 없거나 에러 발생 시 무시
        });
      };

      this.page.context().on('page', pageHandler);
    });

    // 학교 찾기 버튼 클릭
    await this.safeClick(this.selectors.schoolSearchButton);

    // 팝업 대기
    const popup = await popupPromise;

    // 팝업 페이지에서 학교 검색 및 선택 (빠른 모드)
    const schoolSearchPopup = new SchoolSearchPopup(popup, this.sessionId);

    // 빠른 학교 선택: 첫 번째 검색 결과 바로 선택
    const selectedSchool = await schoolSearchPopup.searchAndSelectSchool(searchTerm, true);

    // 팝업 대기 시간 단축
    try {
      await schoolSearchPopup.waitForPopupClose(5000); // 5초로 단축
    } catch (error) {
      this.logger.debug('Popup close timeout (fast mode), continuing...');
    }

    // 메인 페이지에서 학교명 업데이트 대기 (최소화)
    await this.page.waitForTimeout(500);

    const schoolInputValue = await this.page.inputValue(this.selectors.schoolInput);
    this.logger.info(`School selected and updated: ${schoolInputValue}`);

    return selectedSchool;
  }

  /**
   * 보호자 성함 입력
   * @param {string} parentName 보호자 성함
   */
  async fillParentName(parentName) {
    this.logger.debug(`Filling parent name: ${parentName}`);
    await this.safeType(this.selectors.parentNameInput, parentName);
    await this.randomDelay(300, 800);
  }

  /**
   * 보호자 휴대폰 번호 입력
   * @param {string} parentPhone 보호자 휴대폰 번호 (예: 010-1234-5678)
   */
  async fillParentPhone(parentPhone) {
    this.logger.debug(`Filling parent phone: ${parentPhone}`);
    
    const phoneParts = parentPhone.split('-');
    if (phoneParts.length !== 3) {
      throw new Error(`Invalid parent phone format: ${parentPhone}. Expected format: 010-1234-5678`);
    }
    
    const [prefix, middle, last] = phoneParts;
    
    // 휴대폰 앞자리 선택
    await this.selectOption(this.selectors.parentPhonePrefix, prefix);
    await this.randomDelay(200, 500);
    
    // 중간 번호 입력
    await this.safeType(this.selectors.parentPhoneMiddle, middle);
    await this.randomDelay(200, 500);
    
    // 뒷자리 번호 입력
    await this.safeType(this.selectors.parentPhoneLast, last);
    await this.randomDelay(300, 800);
  }

  /**
   * 개인정보 수집 동의 체크
   */
  async checkPrivacyConsent() {
    this.logger.debug('Checking privacy consent...');
    
    // 체크박스가 보이지 않을 수 있으므로 JavaScript로 직접 체크
    await this.page.evaluate(() => {
      const checkbox = document.getElementById('privacy');
      if (checkbox) {
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    
    // 체크 상태 확인
    const isChecked = await this.page.isChecked(this.selectors.privacyCheckbox);
    if (!isChecked) {
      throw new Error('Failed to check privacy consent checkbox');
    }
    
    this.logger.debug('Privacy consent checked successfully');
    await this.randomDelay(300, 800);
  }

  /**
   * 빠른 상세 개인정보 전체 입력 (최적화된 버전)
   * @param {import('../types/index.js').StudentDetailedInfo} detailedInfo 학생 상세 정보
   * @returns {Promise<string>} 선택된 학교명
   */
  async fillDetailedInfo(detailedInfo) {
    this.logger.info('Fast filling detailed information...');

    // 최소한의 안정화 시간만 적용
    await this.page.waitForTimeout(200);

    // 1. 학년 선택
    try {
      await this.page.selectOption(this.selectors.gradeSelect, '12'); // 고3 선택
      this.logger.info('Grade selected: 고3');
    } catch (error) {
      this.logger.warn('Failed to select grade:', error);
    }

    await this.page.waitForTimeout(300);

    // 2. 학교 검색 버튼이 있는지 확인
    const schoolButtonExists = await this.page.locator(this.selectors.schoolSearchButton).count();
    if (schoolButtonExists > 0) {
      try {
        this.logger.info('School search button found, searching for school...');
        await this.searchAndSelectSchool('기타');
        this.logger.info('School selected successfully');
      } catch (error) {
        this.logger.warn('School selection failed, continuing without school:', error);
        // 학교 선택 실패해도 계속 진행
      }
    } else {
      this.logger.debug('School search button not found, skipping school selection');
    }

    // 3. 개인정보 동의 체크
    try {
      await this.page.evaluate(() => {
        const checkbox = document.getElementById('privacy');
        if (checkbox) {
          checkbox.checked = true;
          checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      this.logger.info('Privacy consent checked successfully');
    } catch (error) {
      this.logger.warn('Failed to check privacy consent:', error);
    }

    await this.page.waitForTimeout(300);

    this.logger.info('Detailed information filled successfully (fast mode)');
    return 'school-selected';
  }

  /**
   * 개인정보 수집 및 이용 동의
   */
  async agreeToPrivacyPolicy() {
    this.logger.info('Agreeing to privacy policy...');

    try {
      await this.page.evaluate(() => {
        const checkbox = document.getElementById('privacy');
        if (checkbox && !checkbox.checked) {
          checkbox.checked = true;
          checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      this.logger.info('Privacy policy agreed successfully');
    } catch (error) {
      this.logger.warn('Failed to agree to privacy policy:', error);
    }

    await this.page.waitForTimeout(300);
  }

  /**
   * 빠른 "다음단계" 버튼 클릭 (최적화된 버전)
   */
  async clickNextButton() {
    this.logger.info('Fast clicking next button...');

    await this.safeClick(this.selectors.nextButton);

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
        await this.page.waitForURL('**/applyRegister03.do', { timeout: 2000 });
        navigationSuccess = true;
        this.logger.info('Navigation detected via URL change');
      } catch (error) {
        // URL 직접 확인
        const currentUrl = this.getCurrentUrl();
        if (currentUrl.includes('applyRegister03')) {
          navigationSuccess = true;
          this.logger.info('Navigation confirmed via URL check');
          break;
        }

        // 계속 대기
        await this.page.waitForTimeout(1000);
      }
    }

    if (!navigationSuccess) {
      throw new Error('Failed to navigate to class selection page after clicking next button');
    }

    this.logger.info('Successfully moved to class selection page');
  }

  /**
   * 입력된 정보 검증
   * @param {import('../types/index.js').StudentDetailedInfo} expectedInfo 예상 정보
   * @returns {Promise<boolean>}
   */
  async validateInputs(expectedInfo) {
    try {
      // 학년 검증
      const gradeValue = await this.page.inputValue(this.selectors.gradeSelect);
      if (gradeValue !== expectedInfo.grade) {
        this.logger.error(`Grade mismatch: expected ${expectedInfo.grade}, got ${gradeValue}`);
        return false;
      }
      
      // 보호자 성함 검증
      const parentNameValue = await this.page.inputValue(this.selectors.parentNameInput);
      if (parentNameValue !== expectedInfo.parentName) {
        this.logger.error(`Parent name mismatch: expected ${expectedInfo.parentName}, got ${parentNameValue}`);
        return false;
      }
      
      // 보호자 휴대폰 번호 검증
      const [, expectedMiddle, expectedLast] = expectedInfo.parentPhone.split('-');
      const parentPhoneMiddleValue = await this.page.inputValue(this.selectors.parentPhoneMiddle);
      const parentPhoneLastValue = await this.page.inputValue(this.selectors.parentPhoneLast);
      
      if (parentPhoneMiddleValue !== expectedMiddle || parentPhoneLastValue !== expectedLast) {
        this.logger.error(`Parent phone mismatch: expected ${expectedMiddle}-${expectedLast}, got ${parentPhoneMiddleValue}-${parentPhoneLastValue}`);
        return false;
      }
      
      // 개인정보 동의 검증
      const privacyChecked = await this.page.isChecked(this.selectors.privacyCheckbox);
      if (privacyChecked !== expectedInfo.privacyConsent) {
        this.logger.error(`Privacy consent mismatch: expected ${expectedInfo.privacyConsent}, got ${privacyChecked}`);
        return false;
      }
      
      this.logger.debug('Detailed info validation passed');
      return true;
      
    } catch (error) {
      this.logger.error('Detailed info validation failed:', error);
      return false;
    }
  }

  /**
   * 페이지 상태 검증
   * @returns {Promise<boolean>}
   */
  async validatePageState() {
    try {
      // URL 확인
      const currentUrl = this.getCurrentUrl();
      if (!currentUrl.includes('applyRegister02.do')) {
        return false;
      }
      
      // 필수 요소들 존재 확인
      const requiredElements = [
        this.selectors.gradeSelect,
        this.selectors.schoolSearchButton,
        this.selectors.parentNameInput,
        this.selectors.privacyCheckbox,
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