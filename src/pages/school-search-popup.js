import { BasePage } from './base-page.js';

/**
 * 학교 검색 팝업 처리 클래스
 */
export class SchoolSearchPopup extends BasePage {
  constructor(page, sessionId) {
    super(page, sessionId);
    
    // 팝업 페이지 요소 선택자들
    this.selectors = {
      // 검색 관련
      searchInput: 'input[type="text"]',
      searchButton: 'button:has-text("찾기")',
      searchInstruction: 'text=[학교이름]',
      
      // 검색 결과
      resultsList: 'ul li',
      schoolLink: (index) => `ul li:nth-child(${index + 1}) a`,
      
      // 페이지 확인
      pageTitle: 'h1:has-text("학교찾기")',
      resultsTitle: 'h2:has-text("검색결과")'
    };
  }

  /**
   * 팝업 페이지 로딩 대기
   */
  async waitForPopupLoad() {
    this.logger.debug('Waiting for school search popup to load...');
    
    // 팝업 URL 확인
    await this.page.waitForURL('**/searchSchoolPopup.do*', { 
      timeout: this.config?.waitTimeout || 30000 
    });
    
    // 페이지 제목 확인
    await this.page.waitForSelector(this.selectors.pageTitle, {
      timeout: this.config?.waitTimeout || 30000
    });
    
    // 검색 입력 필드 확인
    await this.page.waitForSelector(this.selectors.searchInput);
    
    this.logger.info('School search popup loaded successfully');
  }

  /**
   * 학교 검색 실행
   * @param {string} searchTerm 검색어 (기본값: "기타")
   */
  async searchSchool(searchTerm = '기타') {
    this.logger.debug(`Searching for school: ${searchTerm}`);
    
    // 검색어 입력
    await this.safeType(this.selectors.searchInput, searchTerm);
    await this.randomDelay(300, 800);
    
    // 검색 버튼 클릭
    await this.safeClick(this.selectors.searchButton);
    
    // 검색 결과 로딩 대기
    await this.page.waitForSelector(this.selectors.resultsTitle, {
      timeout: this.config?.waitTimeout || 30000
    });
    
    this.logger.debug('School search completed');
  }

  /**
   * 검색 결과에서 학교 목록 가져오기
   * @returns {Promise<Array>} 학교 목록
   */
  async getSearchResults() {
    this.logger.debug('Getting search results...');
    
    // 검색 결과가 로드될 때까지 대기
    await this.page.waitForSelector(this.selectors.resultsList, {
      timeout: 10000
    });
    
    const results = [];
    const resultElements = await this.page.locator(this.selectors.resultsList).all();
    
    for (let i = 0; i < resultElements.length; i++) {
      try {
        const linkElement = resultElements[i].locator('a');
        const text = await linkElement.textContent();
        
        if (text) {
          results.push({
            index: i,
            text: text.trim(),
            element: linkElement
          });
        }
      } catch (error) {
        this.logger.warn(`Error processing result ${i}:`, error);
      }
    }
    
    this.logger.debug(`Found ${results.length} school results`);
    return results;
  }

  /**
   * 첫 번째 검색 결과 선택
   * @returns {Promise<string>} 선택된 학교명
   */
  async selectFirstResult() {
    this.logger.debug('Selecting first search result...');
    
    const results = await this.getSearchResults();
    
    if (results.length === 0) {
      throw new Error('No search results found');
    }
    
    const firstResult = results[0];
    
    // 첫 번째 결과 클릭
    await firstResult.element.click();
    
    this.logger.info(`Selected school: ${firstResult.text}`);
    return firstResult.text;
  }

  /**
   * 임의의 검색 결과 선택
   * @returns {Promise<string>} 선택된 학교명
   */
  async selectRandomResult() {
    this.logger.debug('Selecting random search result...');
    
    const results = await this.getSearchResults();
    
    if (results.length === 0) {
      throw new Error('No search results found');
    }
    
    // 랜덤 인덱스 선택
    const randomIndex = Math.floor(Math.random() * results.length);
    const selectedResult = results[randomIndex];
    
    // 선택된 결과 클릭
    await selectedResult.element.click();
    
    this.logger.info(`Selected random school: ${selectedResult.text}`);
    return selectedResult.text;
  }

  /**
   * 기본 검색 결과가 이미 표시되어 있는지 확인
   * @returns {Promise<boolean>}
   */
  async hasDefaultResults() {
    try {
      // 검색 결과 제목이 있는지 확인
      const resultsTitle = await this.isElementPresent(this.selectors.resultsTitle, 2000);
      if (!resultsTitle) {
        return false;
      }
      
      // 결과 목록이 있는지 확인
      const resultsList = await this.isElementPresent(this.selectors.resultsList, 2000);
      return resultsList;
      
    } catch (error) {
      this.logger.debug('No default results found');
      return false;
    }
  }

  /**
   * 학교 검색 및 선택 (전체 프로세스)
   * @param {string} searchTerm 검색어
   * @param {boolean} selectRandom 랜덤 선택 여부
   * @returns {Promise<string>} 선택된 학교명
   */
  async searchAndSelectSchool(searchTerm = '기타', selectRandom = false) {
    this.logger.info('Starting school search and selection process...');
    
    // 팝업 로딩 대기
    await this.waitForPopupLoad();
    
    // 기본 검색 결과가 있는지 확인
    const hasDefault = await this.hasDefaultResults();
    
    let selectedSchool;
    
    if (hasDefault) {
      this.logger.debug('Default search results found, selecting from existing results');
      selectedSchool = selectRandom ? 
        await this.selectRandomResult() : 
        await this.selectFirstResult();
    } else {
      this.logger.debug('No default results, performing search');
      
      // 학교 검색 실행
      await this.searchSchool(searchTerm);
      
      // 검색 결과에서 선택
      selectedSchool = selectRandom ? 
        await this.selectRandomResult() : 
        await this.selectFirstResult();
    }
    
    this.logger.info(`School search and selection completed: ${selectedSchool}`);
    return selectedSchool;
  }

  /**
   * 팝업이 닫혔는지 확인
   * @returns {Promise<boolean>}
   */
  async isPopupClosed() {
    try {
      // 페이지가 닫혔거나 다른 URL로 이동했는지 확인
      const currentUrl = this.getCurrentUrl();
      return !currentUrl.includes('searchSchoolPopup.do');
    } catch (error) {
      // 페이지가 닫혔을 경우 오류가 발생할 수 있음
      return true;
    }
  }

  /**
   * 팝업 닫힘 대기
   * @param {number} timeout 타임아웃 (ms)
   */
  async waitForPopupClose(timeout = 10000) {
    this.logger.debug('Waiting for popup to close...');

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (await this.isPopupClosed()) {
        this.logger.debug('Popup closed successfully');
        return;
      }

      try {
        await this.page.waitForTimeout(500);
      } catch (error) {
        // 페이지가 이미 닫혔을 수 있음
        this.logger.debug('Page closed during wait, popup likely closed');
        return;
      }
    }

    throw new Error('Popup close timeout');
  }
}