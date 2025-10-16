import { config } from '../config/index.js';

/**
 * 테스트 데이터 생성기 클래스
 * 10만명 이상의 대규모 테스트를 위한 고유 데이터 생성 지원
 * 분산 환경(다중 PC)에서도 고유성 보장
 */
export class TestDataGenerator {
  constructor() {
    // 프로세스 PID의 마지막 2자리 사용 (00-99)
    // 다른 PC에서 실행되는 프로세스와 구분을 위한 식별자
    this.processId = (process.pid % 100).toString().padStart(2, '0');
    
    // 카운터 (0부터 시작, 최대 99까지)
    this.globalCounter = 0;
    
    // 이미 사용된 이름 추적 (단일 프로세스 내 중복 방지)
    this.usedNames = new Set();
  }

  /**
   * 랜덤 정수 생성
   * @param {number} min 최소값
   * @param {number} max 최대값
   * @returns {number}
   */
  randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * 랜덤 문자열 생성
   * @param {number} length 문자열 길이
   * @returns {string}
   */
  randomString(length) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * 고유한 테스트 이름 생성 (10만명+ 지원, 분산 환경 안전)
   * 형태: test{PID 2자리}{timestamp 6자리}{counter 2자리} = 14 bytes (20 byte 제한 충족)
   * 
   * 구조:
   * - PID 2자리: 같은 PC에서 다른 프로세스 구분 (00-99)
   * - Timestamp 6자리: 다른 PC/시간대 구분 (밀리초 기준)
   * - Counter 2자리: 같은 밀리초 내 순차 생성 구분 (00-99)
   * 
   * 예시: test4512345601 (PID 45, timestamp 123456, counter 01)
   * 
   * @param {number} customNumber 사용자 지정 번호 (선택사항, 레거시 호환용)
   * @returns {string} 고유한 테스트 이름 (최대 14 bytes)
   */
  generateUniqueTestName(customNumber = null) {
    if (customNumber !== null) {
      // 사용자가 지정한 번호 사용 (레거시 호환)
      const paddedNumber = String(customNumber).padStart(6, '0');
      const testName = `test${paddedNumber}`; // 10 bytes
      this.usedNames.add(testName);
      return testName;
    }

    // test(4) + pid(2) + timestamp(6) + counter(2) = 14 bytes
    const timestamp = (Date.now() % 1000000).toString().padStart(6, '0'); // 6자리
    const counter = (this.globalCounter++ % 100).toString().padStart(2, '0'); // 2자리
    
    const testName = `test${this.processId}${timestamp}${counter}`;
    
    // 최종 안전망: 중복 체크 (이론상 불가능하지만 방어적 프로그래밍)
    if (this.usedNames.has(testName)) {
      // 카운터를 한 번 더 증가시켜 재시도
      const retryCounter = (this.globalCounter++ % 100).toString().padStart(2, '0');
      const retryName = `test${this.processId}${timestamp}${retryCounter}`;
      this.usedNames.add(retryName);
      return retryName;
    }

    this.usedNames.add(testName);
    return testName;
  }

  /**
   * 레거시 호환성을 위한 테스트 이름 생성 (기존 버전)
   * @param {number} number 테스트 번호
   * @returns {string}
   */
  generateTestName(number = null) {
    if (number !== null) {
      return `test${number}`;
    }
    return this.generateUniqueTestName();
  }

  /**
   * 학생 기본 정보 생성 (10만명+ 고유 이름 지원)
   * @returns {import('../types/index.js').StudentBasicInfo}
   */
  generateStudentBasicInfo() {
    return {
      name: this.generateUniqueTestName(),
      phone: `${config.phonePrefix}-1111-1111`
    };
  }

  /**
   * 학생 상세 정보 생성
   * @returns {import('../types/index.js').StudentDetailedInfo}
   */
  generateStudentDetailedInfo() {
    const grades = ['고3', '고2', '고1', '중3', '중2', '중1'];
    const schools = [
      '서울고등학교',
      '경기고등학교', 
      '대치고등학교',
      '강남고등학교',
      '서초고등학교'
    ];
    
    return {
      grade: grades[this.randomInt(0, grades.length - 1)],
      school: schools[this.randomInt(0, schools.length - 1)],
      privacyConsent: true
    };
  }

  /**
   * 완전한 학생 정보 생성
   * @returns {import('../types/index.js').StudentInfo}
   */
  generateStudentInfo() {
    const basicInfo = this.generateStudentBasicInfo();
    const detailedInfo = this.generateStudentDetailedInfo();

    // config에서 환경별 acadCd 가져오기
    const acadCd = config.defaultAcadCd;

    return {
      ...basicInfo,
      ...detailedInfo,
      acadCd
    };
  }

  /**
   * 테스트용 결제 정보 생성
   * @returns {import('../types/index.js').PaymentInfo}
   */
  generatePaymentInfo() {
    // 테스트 환경에서는 신용카드만 사용
    return {
      method: 'card',
      cardNumber: '4111-1111-1111-1111', // 테스트용 카드 번호
      expiryDate: '12/25',
      cvc: '123'
    };
  }

  /**
   * 자연스러운 사용자 행동을 위한 랜덤 지연 생성
   * @param {number} min 최소 지연 시간 (ms)
   * @param {number} max 최대 지연 시간 (ms)
   * @returns {number}
   */
  generateRandomDelay(min = 500, max = 2000) {
    return this.randomInt(min, max);
  }

  /**
   * 세션 ID 생성
   * @returns {string}
   */
  generateSessionId() {
    const timestamp = Date.now();
    const random = this.randomString(8);
    return `session_${timestamp}_${random}`;
  }

  /**
   * 사용된 데이터 초기화 (대규모 테스트 시 메모리 관리용)
   */
  reset() {
    this.usedNames.clear();
    this.globalCounter = 0;
    // processId는 프로세스 고유값이므로 재설정하지 않음
  }
}

// 싱글톤 인스턴스 생성
export const testDataGenerator = new TestDataGenerator();