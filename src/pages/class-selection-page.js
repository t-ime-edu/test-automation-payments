import { BasePage } from './base-page.js';

/**
 * 수강반 및 결제방법 선택 페이지 클래스
 */
export class ClassSelectionPage extends BasePage {
  constructor(page, sessionId) {
    super(page, sessionId);
    
    // 페이지 요소 선택자들
    this.selectors = {
      // 수강반 선택 (실제 HTML 구조에 맞게 수정)
      classCheckboxes: '.btn_check_online_aply_class_seq'
    };
  }

  /**
   * 페이지 로딩 대기 및 검증
   */
  async waitForPageLoad() {
    this.logger.debug('Waiting for class selection page to load...');

    // 현재 URL 확인
    const currentUrl = this.getCurrentUrl();
    this.logger.debug(`Current URL: ${currentUrl}`);

    // URL이 올바른지 확인
    if (currentUrl.includes('applyRegister03.do')) {
      // 클래스 선택 페이지에 있는 경우
      this.logger.info('Already on class selection page');

      // 수강반 체크박스들이 로드될 때까지 대기
      try {
        await this.page.waitForSelector(this.selectors.classCheckboxes, { timeout: 5000 });
      } catch (error) {
        this.logger.warn('Checkboxes not immediately visible, but continuing...');
      }

    } else {
      // 다른 페이지에 있는 경우 (예: 과정 목록 페이지)
      this.logger.warn(`Not on class selection page. Current URL: ${currentUrl}`);
      this.logger.info('Attempting to find and click a course application button...');

      // 과정 목록에서 신청 버튼 찾기
      try {
        const applyButton = await this.page.locator('a:has-text("신청")').first();
        if (await applyButton.isVisible()) {
          await applyButton.click();
          this.logger.info('Clicked course application button');

          // 클래스 선택 페이지로 이동 대기
          await this.page.waitForURL('**/applyRegister03.do', { timeout: 30000 });
          this.logger.info('Successfully navigated to class selection page');
        }
      } catch (error) {
        this.logger.error('Failed to find or click application button:', error);
        throw new Error('Unable to reach class selection page');
      }
    }

    this.logger.info('Class selection page loaded successfully');
  }

  /**
   * 빠른 수강반 및 결제방법 선택 (최적화된 버전)
   * @returns {Promise<{success: boolean, fee: number, paymentMethod: string}>}
   */
  async selectClassAndPayment() {
    this.logger.info('Starting ultra-fast class and payment selection...');

    // DOM이 완전히 로드될 때까지 대기 (안정성)
    await this.page.waitForLoadState('domcontentloaded');

    // 1단계: 체크박스 먼저 선택 (결제 수단 드롭다운 활성화를 위해)
    const checkboxSelected = await this.findAndSelectCheckboxUltraFast();
    this.logger.info(`Checkbox selected: ${checkboxSelected}`);

    if (checkboxSelected) {
      // 체크박스 선택 후 UI 업데이트 대기
      await this.page.waitForTimeout(500);
    }

    const result = {
      success: checkboxSelected, // 체크박스는 필수
    };

    this.logger.info(`Ultra-fast selection completed:`, result);
    return result;
  }

  /**
   * 초고속 체크박스 선택
   * @returns {Promise<boolean>}
   */
  async findAndSelectCheckboxUltraFast() {
    try {
      // JavaScript로 즉시 라디오/체크박스 찾기 및 클릭 (스마트 선택)
      return await this.page.evaluate(() => {
        // 모든 활성화된 수강반 체크박스 가져오기
        const allCheckboxes = document.querySelectorAll('input[name="online_aply_class_seq"]:not([disabled])');

        if (allCheckboxes.length === 0) {
          return false;
        }

        // 유료 수강반 찾기
        let selectedCheckbox = null;
        for (let i = 0; i < allCheckboxes.length; i++) {
          const fee = parseInt(allCheckboxes[i].getAttribute('tlsn_amt') || '0');
          if (fee > 0) {
            selectedCheckbox = allCheckboxes[i];
            break; // 첫 번째 유료 수강반 선택
          }
        }

        // 유료 수강반이 없으면 첫 번째 선택
        if (!selectedCheckbox) {
          selectedCheckbox = allCheckboxes[0];
        }

        // label 클릭 (더 확실함)
        const checkboxId = selectedCheckbox.getAttribute('id');
        const label = document.querySelector(`label[for="${checkboxId}"]`);

        if (label) {
          label.click();
        } else {
          selectedCheckbox.checked = true;
          selectedCheckbox.click();
        }

        selectedCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
        selectedCheckbox.dispatchEvent(new Event('input', { bubbles: true }));

        return true;
      });
    } catch (error) {
      this.logger.warn('Ultra-fast checkbox/radio selection failed:', error);
      return false;
    }
  }

  /**
   * 결제하기 버튼 클릭
   */
  async clickPaymentButton() {
    this.logger.info('Clicking payment button...');

    try {
      // 여러 셀렉터로 결제 버튼 찾기
      const buttonSelectors = [
        '#btn_pay',
        'a[href*="javascript"]:has-text("결제하기")',
        'button:has-text("결제하기")',
        'a:has-text("결제하기")',
        '.btn:has-text("결제하기")'
      ];

      let clicked = false;

      for (const selector of buttonSelectors) {
        try {
          const button = await this.page.locator(selector).first();
          const count = await button.count();

          if (count > 0 && await button.isVisible({ timeout: 1000 })) {
            this.logger.info(`Found payment button with selector: ${selector}`);
            await button.click();
            this.logger.info('✓ Payment button clicked successfully');
            await this.page.waitForTimeout(1000);
            clicked = true;
            break;
          }
        } catch (selectorError) {
          this.logger.debug(`Selector ${selector} not found or not clickable`);
          continue;
        }
      }

      if (!clicked) {
        // JavaScript로 직접 결제하기 버튼 찾아서 클릭
        this.logger.info('Trying JavaScript approach to find payment button...');
        clicked = await this.page.evaluate(() => {
          // "결제하기" 텍스트를 포함하는 모든 요소 찾기
          const allElements = document.querySelectorAll('a, button');
          for (const el of allElements) {
            if (el.textContent.includes('결제하기') || el.textContent.includes('결제')) {
              el.click();
              return true;
            }
          }
          return false;
        });

        if (clicked) {
          this.logger.info('✓ Payment button clicked via JavaScript');
          await this.page.waitForTimeout(1000);
        }
      }

      if (!clicked) {
        this.logger.warn('Payment button not found with any method');
      }

      return clicked;
    } catch (error) {
      this.logger.warn('Error clicking payment button:', error);
      return false;
    }
  }
}