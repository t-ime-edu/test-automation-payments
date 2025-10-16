import { BasePage } from './base-page.js';
import { WaitingPage } from './waiting-page.js';

/**
 * 수강신청 목록 페이지 클래스
 */
export class CourseListPage extends BasePage {
  constructor(page, sessionId) {
    super(page, sessionId);
    this.url = `${this.baseUrl}/apply/request/list.do`;
    
    // 페이지 요소 선택자들
    this.selectors = {
      pageTitle: 'h1',
      courseTable: 'table',
      courseRows: 'tbody tr',
      applyButton: (index) => `tbody tr:nth-child(${index + 1}) a[href*="register"]`,
      courseTitle: (index) => `tbody tr:nth-child(${index + 1}) td:nth-child(2)`,
      applicationPeriod: (index) => `tbody tr:nth-child(${index + 1}) td:nth-child(3)`,
      status: (index) => `tbody tr:nth-child(${index + 1}) td:nth-child(4)`
    };
  }

  /**
   * 빠른 수강신청 목록 페이지로 이동 (최적화된 버전)
   */
  async navigate() {
    this.logger.info('Fast navigating to course list page...');

    // BasePage의 navigate 메서드 사용 (타임아웃 단축)
    await super.navigate(this.url, 30000);

    // 빠른 대기 페이지 처리
    const waitingPage = new WaitingPage(this.page, this.sessionId);

    // 대기 페이지가 있는지 즉시 확인 후 처리
    try {
      const waitingDetected = await this.page.waitForSelector('text=현재 접속자가 많아', { timeout: 1000 });
      if (waitingDetected) {
        this.logger.info('Waiting page detected, handling...');
        await waitingPage.handleWaitingIfPresent();
      }
    } catch (error) {
      // 대기 페이지가 없으면 즉시 진행
      this.logger.debug('No waiting page detected, proceeding immediately');
    }

    // URL 확인으로 페이지 로딩 검증 (빠른 검증)
    const currentUrl = this.getCurrentUrl();
    if (!currentUrl.includes('list.do')) {
      throw new Error(`Wrong page loaded: ${currentUrl}`);
    }

    this.logger.info('Successfully navigated to course list page');
  }

  /**
   * 수강신청 목록 로딩 대기
   */
  async waitForCourseList() {
    this.logger.debug('Waiting for course list to load...');
    
    // 테이블이 로드될 때까지 대기
    await this.page.waitForSelector(this.selectors.courseTable, { 
      timeout: this.config?.waitTimeout || 30000 
    });
    
    // 최소 하나의 수강신청 항목이 있는지 확인
    const courseCount = await this.page.locator(this.selectors.courseRows).count();
    if (courseCount === 0) {
      throw new Error('No courses found in the list');
    }
    
    this.logger.debug(`Found ${courseCount} courses in the list`);
    return courseCount;
  }

  /**
   * 빠른 접수중인 수강신청 항목 식별 (최적화된 버전)
   * @returns {Promise<number[]>} 접수중인 항목들의 인덱스 배열
   */
  async getAvailableCourses() {
    this.logger.debug('Fast identifying available courses...');

    // PC/모바일 테이블 확인
    try {
      await this.page.waitForSelector('table.typeA tbody tr, .tbody .row', { timeout: 5000 });
    } catch (error) {
      this.logger.warn('Course rows not found, trying to proceed anyway');
    }

    // JavaScript로 모든 과정을 한 번에 빠르게 확인
    const availableCourses = await this.page.evaluate(() => {
      // PC 테이블 시도
      let rows = document.querySelectorAll('table.typeA tbody tr');
      let isPC = rows.length > 0;

      // 모바일 테이블 시도
      if (!isPC) {
        rows = document.querySelectorAll('.tbody .row');
      }

      const courses = [];

      for (let i = 0; i < Math.min(rows.length, 5); i++) {
        try {
          const row = rows[i];
          let title = '';
          let status = '';

          if (isPC) {
            // PC 테이블 구조
            const titleLink = row.querySelector('td a.title');
            const statusCell = row.querySelector('td.state');
            title = titleLink?.textContent?.trim() || '';
            status = statusCell?.textContent?.trim() || '';
          } else {
            // 모바일 테이블 구조
            const titleLink = row.querySelector('.title-line a.title');
            const statusSpan = row.querySelector('.title-line .state');
            title = titleLink?.textContent?.trim() || '';
            status = statusSpan?.textContent?.trim() || '';
          }

          if (title) {
            // 접수중이거나 첫 번째 항목이면 추가
            if (status === '접수중' || i === 0) {
              courses.push({
                index: i,
                title: title,
                status: status,
                isPC: isPC
              });
            }
          }
        } catch (error) {
          console.log(`Error checking course ${i}:`, error);
        }
      }

      return courses;
    });

    // 결과가 없으면 첫 번째 과정을 기본으로 선택
    if (availableCourses.length === 0) {
      this.logger.warn('No available courses found, selecting first course as fallback');
      availableCourses.push({
        index: 0,
        title: 'First Course (fallback)',
        status: 'unknown',
        isPC: true
      });
    }

    this.logger.info(`Found ${availableCourses.length} available courses (fast mode)`);
    return availableCourses;
  }

  /**
   * 빠른 수강신청 "신청" 버튼 클릭 (최적화된 버전)
   * @param {number} courseIndex 수강신청 항목 인덱스
   */
  async clickApplyButton(courseIndex) {
    this.logger.info(`Fast clicking apply button for course ${courseIndex}...`);

    // 먼저 JavaScript로 즉시 신청 버튼 찾기 및 클릭 시도
    const jsClickResult = await this.page.evaluate((index) => {
      // PC 테이블 시도
      let rows = document.querySelectorAll('table.typeA tbody tr');
      let isPC = rows.length > 0;

      // 모바일 테이블 시도
      if (!isPC) {
        rows = document.querySelectorAll('.tbody .row');
      }

      if (rows.length <= index) return { success: false, error: 'Row not found', isPC };

      const targetRow = rows[index];

      // 신청 버튼 찾기
      const buttonSelectors = [
        'a#register01',
        'a.apply.btnSmallF',
        'a[id="register01"]',
        'a.apply'
      ];

      for (const selector of buttonSelectors) {
        try {
          const button = targetRow.querySelector(selector);
          if (button && button.offsetParent !== null) {
            button.click();
            return { success: true, method: selector, isPC };
          }
        } catch (error) {
          continue;
        }
      }

      return { success: false, error: 'No clickable button found', isPC };
    }, courseIndex);

    if (jsClickResult.success) {
      this.logger.info(`Successfully clicked button with method: ${jsClickResult.method} (${jsClickResult.isPC ? 'PC' : 'Mobile'})`);
    } else {
      this.logger.warn(`JavaScript click failed: ${jsClickResult.error}, trying Playwright selectors...`);

      // JavaScript 실패 시 Playwright 선택자로 빠른 시도
      const quickSelectors = jsClickResult.isPC ? [
        `table.typeA tbody tr:nth-child(${courseIndex + 1}) a#register01`,
        `table.typeA tbody tr:nth-child(${courseIndex + 1}) a.apply`
      ] : [
        `.tbody .row:nth-child(${courseIndex + 1}) a#register01`,
        `.tbody .row:nth-child(${courseIndex + 1}) a.apply`
      ];

      let buttonFound = false;
      for (const selector of quickSelectors) {
        try {
          const elements = await this.page.locator(selector);
          const count = await elements.count();

          if (count > 0) {
            await elements.first().click({ timeout: 2000 });
            this.logger.info(`Clicked button with selector: ${selector}`);
            buttonFound = true;
            break;
          }
        } catch (error) {
          continue;
        }
      }

      if (!buttonFound) {
        throw new Error(`Apply button not found for course ${courseIndex} (fast mode failed)`);
      }
    }

    // 빠른 페이지 전환 확인
    try {
      await this.page.waitForURL('**/applyRegister01.do', { timeout: 15000 });
      this.logger.info('Successfully navigated to registration page');
    } catch (error) {
      // URL 확인으로 실제 이동 여부 체크
      const currentUrl = this.getCurrentUrl();
      if (currentUrl.includes('applyRegister01')) {
        this.logger.info('Already on registration page despite timeout');
      } else {
        throw error;
      }
    }
  }


  /**
   * 특정 학원 탭 선택
   * @param {string} acadCd 학원 코드 (예: 'TE19041100')
   */
  async selectAcademyTab(acadCd) {
    this.logger.info(`Selecting academy tab: ${acadCd}`);

    try {
      // acad_cd 속성으로 탭 찾기
      const tabSelector = `a[acad_cd="${acadCd}"]`;
      await this.page.waitForSelector(tabSelector, { timeout: 5000 });
      await this.page.click(tabSelector);

      // 탭 전환 후 짧은 대기
      await this.page.waitForTimeout(500);

      this.logger.info(`Successfully selected academy tab: ${acadCd}`);
    } catch (error) {
      this.logger.error(`Failed to select academy tab ${acadCd}:`, error);
      throw new Error(`Academy tab selection failed: ${acadCd}`);
    }
  }

  /**
   * 첫 번째 접수중인 수강신청에 신청
   * @returns {Promise<Object>} 선택된 수강신청 정보
   */
  async applyToFirstAvailableCourse(code) {
    // 수강신청 탭 먼저 선택
    await this.selectAcademyTab(code);

    const availableCourses = await this.getAvailableCourses();

    if (availableCourses.length === 0) {
      throw new Error('No available courses found');
    }

    const selectedCourse = availableCourses[0];
    await this.clickApplyButton(selectedCourse.index);

    this.logger.info(`Applied to course: ${selectedCourse.title}`);
    return selectedCourse;
  }

  /**
   * 페이지 상태 검증
   * @returns {Promise<boolean>}
   */
  async validatePageState() {
    try {
      // 페이지 제목 확인
      const title = await this.getTitle();
      if (!title.includes('온라인 수강신청')) {
        return false;
      }
      
      // 수강신청 테이블 존재 확인
      const tableExists = await this.isElementPresent(this.selectors.courseTable);
      if (!tableExists) {
        return false;
      }
      
      // 최소 하나의 수강신청 항목 존재 확인
      const courseCount = await this.page.locator(this.selectors.courseRows).count();
      return courseCount > 0;
      
    } catch (error) {
      this.logger.error('Page validation failed:', error);
      return false;
    }
  }
}