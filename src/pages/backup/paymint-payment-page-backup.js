import { BasePage } from './base-page.js';

/**
 * 페이민트(SPEEID) 결제 페이지 자동화 클래스
 * 개발 환경 결제 시스템 테스트용
 * URL: http://stg.paymint.co.kr:11030/dsCQJTdSF
 */
export class PaymintPaymentPage extends BasePage {
  constructor(page, sessionId) {
    super(page, sessionId);

    this.selectors = {
      // 기본 정보 확인용 텍스트
      pageTitle: 'text=SPEEID',
      amountHighlight: '.billing-text .price span',
      productName: '.bill_list_table td span',

      // 결제 수단 영역
      paymentMethodCard: 'text=신용/체크카드',
      cardButtons: '.card_section',

      // 수기 입력 전환
      openManualInput: 'text=앱카드가 없으신가요?',
      manualDropdowns: '.bill-select-pop-bt',

      // 드롭다운 모달
      cardSelectModal: '.bill-select-pop.card-select',
      installmentSelectModal: '.bill-select-pop, .bill-select-pop.card-month',

      // 서명 및 결제 버튼
      signatureCanvas: '.card_signature canvas, canvas',
      paymentButton: 'button:has-text("카드번호 입력 후 결제하기")',

      // 카드 정보 입력 필드
      cardNumber1: '#cardNum1',
      cardNumber2: '#cardNum2',
      cardValidityMonth: '#card_validity_data .number-box.sm-w1:first-child .placeholder',
      cardValidityYear: '#card_validity_data .number-box.sm-w1:last-child .placeholder',
      birthDate: '.userBirthDate .number',
      cardPassword: '.cardPassword .number',
      finalPaymentButton: '.bt-wrap button.btn_nor',

      // Alert 및 에러
      alertText: 'text=결제',
      errorMessage: 'text=오류'
    };

    // 결제 설정
    this.paymentConfig = {
      defaultCard: '신한카드',
      defaultInstallment: '일시불',
      useCardInput: true,
      drawSignature: true,
      
    };
  }

  /**
   * 페이지 로딩 대기
   */
  async waitForPageLoad() {
    this.logger.info('Waiting for Paymint payment page to load...');

    try {
      // 기본 페이지 요소들 확인
      await this.page.waitForSelector(this.selectors.pageTitle, { timeout: 10000 });
      await this.page.waitForSelector(this.selectors.paymentMethodCard, { timeout: 5000 });

      this.logger.info('Paymint payment page loaded successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to load Paymint payment page:', error);
      return false;
    }
  }

  /**
   * 결제 정보 확인
   */
  async getPaymentInfo() {
    try {
      const amountElement = await this.page.textContent(this.selectors.amountHighlight);
      const productElement = await this.page.textContent(this.selectors.productName);

      const amountText = (amountElement || '90,000').trim();
      const productText = (productElement || 'dev [인턴] 노출퀘이널').trim();

      const paymentInfo = {
        amount: amountText.includes('원') ? amountText : `${amountText}원`,
        productName: productText,
        currency: '원',
        platform: 'SPEEID (Paymint)'
      };

      this.logger.info('Payment Info:', paymentInfo);
      return paymentInfo;
    } catch (error) {
      this.logger.error('Error getting payment info:', error);
      return {
        amount: '90,000원',
        productName: 'dev [인턴] 노출퀘이널',
        currency: '원',
        platform: 'SPEEID (Paymint)'
      };
    }
  }

  /**
   * 초기 카드 선택 (카드사 아이콘에서)
   * @param {string} cardName 카드사 이름
   */
  async selectInitialCard(cardName = '신한카드') {
    this.logger.info(`Selecting initial card: ${cardName}`);

    try {
      const cardButton = this.page.locator(this.selectors.cardButtons).filter({ hasText: cardName }).first();
      await cardButton.waitFor({ state: 'visible', timeout: 5000 });
      await cardButton.click();
      await this.page.waitForTimeout(500);

      this.logger.info(`Selected initial card: ${cardName}`);
      return true;
    } catch (error) {
      this.logger.warn(`Failed to select ${cardName}, trying first available card`);

      try {
        await this.page.locator('.card_section').first().click();
        await this.page.waitForTimeout(1000);
        return true;
      } catch (fallbackError) {
        this.logger.error('Failed to select any initial card:', fallbackError);
        return false;
      }
    }
  }

  /**
   * "앱카드가 없으신가요?" 클릭하여 카드 입력 폼 열기
   */
  async openCardInputForm() {
    this.logger.info('Opening card input form via "앱카드가 없으신가요?" button...');

    try {
      const appCardButton = this.page.locator(this.selectors.openManualInput).first();
      const triggerCount = await appCardButton.count();

      if (triggerCount === 0) {
        this.logger.warn('Manual card input trigger not found');
      } else {
        await appCardButton.click();
        this.logger.info('Manual card input button clicked');
      }

      const dropdowns = this.page.locator(this.selectors.manualDropdowns);
      await dropdowns.first().waitFor({ state: 'visible', timeout: 5000 });
      await dropdowns.nth(1).waitFor({ state: 'visible', timeout: 5000 });

      this.logger.info('Card input form is visible');
      return true;
    } catch (error) {
      this.logger.error('Failed to open card input form:', error);
      return false;
    }
  }

  /**
   * 카드사 선택 (드롭다운에서)
   * @param {string} cardName 카드사 이름
   */
  async selectCardFromDropdown(cardName = '신한카드') {
    this.logger.info(`Selecting card from dropdown: ${cardName}`);

    try {
      const dropdown = this.page.locator(this.selectors.manualDropdowns).first();
      await dropdown.waitFor({ state: 'visible', timeout: 5000 });
      await dropdown.click();

      const modal = this.page.locator(this.selectors.cardSelectModal).first();
      await modal.waitFor({ state: 'visible', timeout: 5000 });

      const option = modal.locator('li div', { hasText: cardName }).first();
      await option.waitFor({ state: 'visible', timeout: 3000 });
      await option.click();

      await modal.waitFor({ state: 'hidden', timeout: 5000 });
      this.logger.info(`Successfully selected card: ${cardName}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to select card ${cardName}:`, error);
      return false;
    }
  }

  /**
   * 할부 선택
   * @param {string} installment 할부 개월수
   */
  async selectInstallment(installment = '일시불') {
    this.logger.info(`Selecting installment: ${installment}`);

    try {
      const dropdown = this.page.locator(this.selectors.manualDropdowns).nth(1);
      await dropdown.waitFor({ state: 'visible', timeout: 5000 });
      await dropdown.click();

      const modal = this.page.locator(this.selectors.installmentSelectModal)
        .filter({ hasText: '할부를 선택해 주세요' })
        .first();
      await modal.waitFor({ state: 'visible', timeout: 5000 });

      const option = modal.locator('li div', { hasText: installment }).first();
      await option.waitFor({ state: 'visible', timeout: 3000 });
      await option.click();

      await modal.waitFor({ state: 'hidden', timeout: 5000 });
      this.logger.info(`Selected installment: ${installment}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to select installment ${installment}:`, error);
      return false;
    }
  }

  /**
   * 서명 그리기
   */
  async drawSignature() {
    this.logger.info('Drawing signature on canvas...');

    try {
      const canvas = this.page.locator(this.selectors.signatureCanvas).first();
      await canvas.waitFor({ state: 'visible', timeout: 5000 });

      const box = await canvas.boundingBox();
      if (!box) {
        this.logger.warn('Canvas bounding box not available');
        return false;
      }

      const startX = box.x + box.width * 0.2;
      const startY = box.y + box.height * 0.6;

      await this.page.mouse.move(startX, startY);
      await this.page.mouse.down();
      await this.page.mouse.move(startX + box.width * 0.3, startY - box.height * 0.4);
      await this.page.mouse.move(startX + box.width * 0.6, startY);
      await this.page.mouse.move(startX + box.width * 0.8, startY - box.height * 0.3);
      await this.page.mouse.up();

      this.logger.info('Signature drawn successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to draw signature:', error);
      return false;
    }
  }

  /**
   * Alert 창 처리 설정
   */
  async setupAlertHandling() {
    this.logger.info('Setting up alert handling...');

    try {
      this.page.on('dialog', async dialog => {
        this.logger.info(`Alert detected: "${dialog.message()}"`);
        this.logger.info('Auto-accepting alert...');
        await dialog.accept();
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to setup alert handling:', error);
      return false;
    }
  }

  /**
   * 결제 버튼 클릭 (카드번호 입력 후 결제하기)
   */
  async clickPaymentButton() {
    this.logger.info('Clicking "카드번호 입력 후 결제하기" button...');

    try {
      // Alert 처리 설정
      await this.setupAlertHandling();

      const button = this.page.locator(this.selectors.paymentButton).last();
      await button.waitFor({ state: 'visible', timeout: 5000 });

      const buttonHandle = await button.elementHandle();
      if (!buttonHandle) {
        throw new Error('Payment button handle not available');
      }

      const maxAttempts = 10;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const isDisabled = await buttonHandle.evaluate(el => el.disabled || el.classList.contains('disabled'));
        if (!isDisabled) {
          break;
        }
        if (attempt === maxAttempts - 1) {
          throw new Error('Payment button remained disabled');
        }
        await this.page.waitForTimeout(500);
      }

      await buttonHandle.click();

      await this.page.waitForTimeout(2000);

      this.logger.info('"카드번호 입력 후 결제하기" button clicked successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to click payment button:', error);
      return false;
    }
  }

  /**
   * 카드번호 입력 (처음 8자리만)
   * @param {string} cardNumber 16자리 카드번호
   */
  async fillCardNumber(cardNumber) {
    this.logger.info('Filling card number...');

    try {
      // 카드번호를 4자리씩 분리
      const part1 = cardNumber.substring(0, 4);
      const part2 = cardNumber.substring(4, 8);

      // 첫 번째 입력 필드
      const input1 = this.page.locator(this.selectors.cardNumber1);
      await input1.waitFor({ state: 'visible', timeout: 5000 });
      await input1.click();
      await input1.fill(part1);
      await this.page.waitForTimeout(300);

      // 두 번째 입력 필드
      const input2 = this.page.locator(this.selectors.cardNumber2);
      await input2.waitFor({ state: 'visible', timeout: 5000 });
      await input2.click();
      await input2.fill(part2);
      await this.page.waitForTimeout(300);

      this.logger.info('Card number filled successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to fill card number:', error);
      return false;
    }
  }

  /**
   * 유효기간 입력
   * @param {string} month 월 (MM)
   * @param {string} year 년 (YY)
   */
  async fillCardValidity(month, year) {
    this.logger.info(`Filling card validity: ${month}/${year}`);

    try {
      // 월 입력 필드 클릭
      const monthField = this.page.locator(this.selectors.cardValidityMonth);
      await monthField.waitFor({ state: 'visible', timeout: 5000 });
      await monthField.click();
      await this.page.waitForTimeout(500);

      // 키패드로 월 입력 (숫자 하나씩)
      for (const digit of month) {
        await this.page.keyboard.press(digit);
        await this.page.waitForTimeout(200);
      }

      // 년 입력 필드 클릭
      const yearField = this.page.locator(this.selectors.cardValidityYear);
      await yearField.click();
      await this.page.waitForTimeout(500);

      // 키패드로 년 입력
      for (const digit of year) {
        await this.page.keyboard.press(digit);
        await this.page.waitForTimeout(200);
      }

      this.logger.info('Card validity filled successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to fill card validity:', error);
      return false;
    }
  }

  /**
   * 생년월일 입력
   * @param {string} birthDate 생년월일 6자리 (YYMMDD)
   */
  async fillBirthDate(birthDate) {
    this.logger.info('Filling birth date...');

    try {
      const birthField = this.page.locator(this.selectors.birthDate);
      await birthField.waitFor({ state: 'visible', timeout: 5000 });
      await birthField.click();
      await this.page.waitForTimeout(500);

      // 키패드로 생년월일 입력
      for (const digit of birthDate) {
        await this.page.keyboard.press(digit);
        await this.page.waitForTimeout(200);
      }

      this.logger.info('Birth date filled successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to fill birth date:', error);
      return false;
    }
  }

  /**
   * 카드 비밀번호 앞 2자리 입력
   * @param {string} password 비밀번호 앞 2자리
   */
  async fillCardPassword(password) {
    this.logger.info('Filling card password...');

    try {
      const passwordField = this.page.locator(this.selectors.cardPassword);
      await passwordField.waitFor({ state: 'visible', timeout: 5000 });
      await passwordField.click();
      await this.page.waitForTimeout(500);

      // 키패드로 비밀번호 입력
      for (const digit of password) {
        await this.page.keyboard.press(digit);
        await this.page.waitForTimeout(200);
      }

      this.logger.info('Card password filled successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to fill card password:', error);
      return false;
    }
  }

  /**
   * 최종 결제하기 버튼 클릭
   */
  async clickFinalPaymentButton() {
    this.logger.info('Clicking final payment button...');

    try {
      const button = this.page.locator(this.selectors.finalPaymentButton);
      await button.waitFor({ state: 'visible', timeout: 5000 });

      // 버튼 활성화 대기
      const maxAttempts = 10;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const isDisabled = await button.evaluate(el => el.disabled || el.classList.contains('disabled'));
        if (!isDisabled) {
          break;
        }
        if (attempt === maxAttempts - 1) {
          this.logger.warn('Payment button still disabled, attempting click anyway');
        }
        await this.page.waitForTimeout(500);
      }

      await button.click();
      await this.page.waitForTimeout(2000);

      this.logger.info('Final payment button clicked successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to click final payment button:', error);
      return false;
    }
  }

  /**
   * 전체 결제 프로세스 실행
   * @param {Object} options 결제 옵션
   */
  async executeFullPayment(options = {}) {
    const startTime = Date.now();
    const {
      cardName = this.paymentConfig.defaultCard,
      installment = this.paymentConfig.defaultInstallment,
      useCardInput = this.paymentConfig.useCardInput,
      drawSignature = this.paymentConfig.drawSignature
    } = options;

    this.logger.info('Starting complete Paymint payment process...');
    this.logger.info(`Payment options: Card=${cardName}, Installment=${installment}, CardInput=${useCardInput}`);

    const result = {
      success: false,
      paymentInfo: null,
      selectedCard: cardName,
      selectedInstallment: installment,
      totalTime: 0,
      steps: [],
      errors: []
    };

    try {
      // 1. 페이지 로딩 대기
      result.steps.push('페이지 로딩 대기');
      const loaded = await this.waitForPageLoad();
      if (!loaded) {
        throw new Error('Payment page failed to load');
      }

      // 2. 결제 정보 확인
      result.steps.push('결제 정보 확인');
      result.paymentInfo = await this.getPaymentInfo();

      if (useCardInput) {
        // 카드 입력 방식 사용

        // 3. 카드 입력 폼 열기
        result.steps.push('카드 입력 폼 열기');
        const formOpened = await this.openCardInputForm();
        if (!formOpened) {
          throw new Error('Failed to open card input form');
        }

        // 4. 카드사 선택
        result.steps.push(`카드사 선택: ${cardName}`);
        const cardSelected = await this.selectCardFromDropdown(cardName);
        if (!cardSelected) {
          throw new Error(`Failed to select card: ${cardName}`);
        }

        // 5. 할부 선택
        result.steps.push(`할부 선택: ${installment}`);
        const installmentSelected = await this.selectInstallment(installment);
        if (!installmentSelected) {
          throw new Error(`Failed to select installment: ${installment}`);
        }

        // 6. 서명 그리기
        if (drawSignature) {
          result.steps.push('서명 그리기');
          this.logger.info('서명 그리기 시작');
          const signatureDone = await this.drawSignature();
          if (!signatureDone) {
            this.logger.error('서명 그리기 실패');
            throw new Error('Failed to draw signature');
          }
        }

        // 7. 카드번호 입력 후 결제하기 버튼 클릭
        result.steps.push('카드번호 입력 후 결제하기 버튼 클릭');
        this.logger.info('카드번호 입력 후 결제하기 버튼 클릭 시작');
        const paymentClicked = await this.clickPaymentButton();
        if (!paymentClicked) {
          this.logger.error('카드번호 입력 후 결제하기 버튼 클릭 실패');
          throw new Error('Failed to click payment button');
        }

        // 8. 카드번호 입력
        result.steps.push('카드번호 입력');
        const cardNumberFilled = await this.fillCardNumber(options.cardNumber || '1234567812345678');
        if (!cardNumberFilled) {
          throw new Error('Failed to fill card number');
        }

        // 9. 유효기간 입력
        result.steps.push('유효기간 입력');
        const validityFilled = await this.fillCardValidity(
          options.validityMonth || '12',
          options.validityYear || '25'
        );
        if (!validityFilled) {
          throw new Error('Failed to fill card validity');
        }

        // 10. 생년월일 6자리
        result.steps.push('생년월일 입력');
        const birthDateFilled = await this.fillBirthDate(options.birthDate || '900101');
        if (!birthDateFilled) {
          throw new Error('Failed to fill birth date');
        }

        // 11. 비밀번호 앞 2자리 입력
        result.steps.push('비밀번호 입력');
        const passwordFilled = await this.fillCardPassword(options.cardPassword || '12');
        if (!passwordFilled) {
          throw new Error('Failed to fill card password');
        }

        // 12. 결제하기 버튼 클릭
        result.steps.push('최종 결제하기 버튼 클릭');
        const finalPaymentClicked = await this.clickFinalPaymentButton();
        if (!finalPaymentClicked) {
          throw new Error('Failed to click final payment button');
        }
        
      } else {
        // 기본 카드 선택 방식
        result.steps.push(`초기 카드 선택: ${cardName}`);
        await this.selectInitialCard(cardName);
      }

      result.totalTime = Date.now() - startTime;
      result.success = true;

      this.logger.info('Paymint payment process completed successfully');
      this.logger.info(`Total execution time: ${result.totalTime}ms`);

    } catch (error) {
      result.totalTime = Date.now() - startTime;
      result.errors.push(error.message);
      this.logger.error('Paymint payment process failed:', error);
    }

    return result;
  }

  /**
   * 결제 페이지 상태 검증
   */
  async validatePaymentPage() {
    try {
      const currentUrl = this.getCurrentUrl();

      // URL 확인
      if (!currentUrl.includes('paymint.co.kr')) {
        this.logger.error('Not on Paymint payment page');
        return false;
      }

      // 필수 요소 확인
      const requiredElements = [
        'text=SPEEID',
        'text=90,000',
        'text=신용/체크카드'
      ];

      for (const selector of requiredElements) {
        const exists = await this.page.isVisible(selector);
        if (!exists) {
          this.logger.error(`Required element not found: ${selector}`);
          return false;
        }
      }

      this.logger.info('Payment page validation passed');
      return true;
    } catch (error) {
      this.logger.error('Payment page validation failed:', error);
      return false;
    }
  }

  /**
   * 결제 과정 스크린샷 캡처
   */
  async capturePaymentScreenshots() {
    const screenshots = [];

    try {
      // 초기 페이지
      const initialScreenshot = await this.takeScreenshot('paymint-initial');
      screenshots.push(initialScreenshot);

      // 카드 입력 폼 (있다면)
      if (await this.page.isVisible('text=카드를 선택해 주세요')) {
        const formScreenshot = await this.takeScreenshot('paymint-card-form');
        screenshots.push(formScreenshot);
      }

      return screenshots;
    } catch (error) {
      this.logger.error('Failed to capture screenshots:', error);
      return screenshots;
    }
  }
}
