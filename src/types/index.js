/**
 * 학생 기본 정보 타입
 * @typedef {Object} StudentBasicInfo
 * @property {string} name - 학생 이름
 * @property {string} phone - 휴대폰 번호
 */

/**
 * 학생 상세 정보 타입
 * @typedef {Object} StudentDetailedInfo
 * @property {string} grade - 학년
 * @property {string} school - 학교명
 * @property {string} parentName - 보호자 성함
 * @property {string} parentPhone - 보호자 휴대폰
 * @property {boolean} privacyConsent - 개인정보 수집 동의
 */

/**
 * 완전한 학생 정보 타입
 * @typedef {Object} StudentInfo
 * @property {string} name - 학생 이름
 * @property {string} phone - 휴대폰 번호
 * @property {string} grade - 학년
 * @property {string} school - 학교명
 * @property {string} parentName - 보호자 성함
 * @property {string} parentPhone - 보호자 휴대폰
 * @property {boolean} privacyConsent - 개인정보 수집 동의
 */

/**
 * 수강반 선택 정보 타입
 * @typedef {Object} ClassSelection
 * @property {string} classId - 수강반 ID
 * @property {string} className - 수강반 이름
 * @property {number} fee - 수강료
 */

/**
 * 결제 정보 타입
 * @typedef {Object} PaymentInfo
 * @property {'card'|'bank'|'virtual'} method - 결제 방법
 * @property {string} [cardNumber] - 카드 번호 (카드 결제 시)
 * @property {string} [expiryDate] - 만료일 (카드 결제 시)
 * @property {string} [cvc] - CVC (카드 결제 시)
 * @property {string} [bankAccount] - 계좌번호 (계좌 결제 시)
 */

/**
 * 테스트 오류 타입
 * @typedef {Object} TestError
 * @property {string} step - 오류 발생 단계
 * @property {string} message - 오류 메시지
 * @property {string} [screenshot] - 스크린샷 경로
 * @property {Date} timestamp - 오류 발생 시간
 */

/**
 * 단일 테스트 결과 타입
 * @typedef {Object} TestResult
 * @property {string} sessionId - 세션 ID
 * @property {boolean} success - 성공 여부
 * @property {number} totalTime - 총 소요 시간 (ms)
 * @property {Object.<string, number>} stepTimes - 단계별 소요 시간
 * @property {TestError[]} errors - 발생한 오류들
 * @property {string[]} screenshots - 스크린샷 경로들
 * @property {StudentInfo} studentInfo - 사용된 학생 정보
 * @property {ClassSelection} [classSelection] - 선택된 수강반
 * @property {Date} startTime - 테스트 시작 시간
 * @property {Date} [endTime] - 테스트 종료 시간
 */

/**
 * 부하 테스트 결과 타입
 * @typedef {Object} LoadTestResult
 * @property {number} totalSessions - 총 세션 수
 * @property {number} successfulSessions - 성공한 세션 수
 * @property {number} failedSessions - 실패한 세션 수
 * @property {number} averageTime - 평균 소요 시간 (ms)
 * @property {number} maxTime - 최대 소요 시간 (ms)
 * @property {number} minTime - 최소 소요 시간 (ms)
 * @property {number} throughput - 처리량 (sessions/second)
 * @property {number} errorRate - 오류율 (%)
 * @property {TestResult[]} detailedResults - 상세 결과들
 * @property {Date} startTime - 테스트 시작 시간
 * @property {Date} endTime - 테스트 종료 시간
 */

/**
 * 성능 메트릭 타입
 * @typedef {Object} PerformanceMetrics
 * @property {Object.<string, number>} stepTimes - 단계별 평균 시간
 * @property {Object.<string, number>} stepCounts - 단계별 실행 횟수
 * @property {number} totalRequests - 총 요청 수
 * @property {number} failedRequests - 실패한 요청 수
 * @property {number} averageResponseTime - 평균 응답 시간
 * @property {number} maxResponseTime - 최대 응답 시간
 * @property {number} minResponseTime - 최소 응답 시간
 */

// 타입 검증 함수들
export const TypeValidators = {
  /**
   * StudentInfo 타입 검증
   * @param {any} obj 
   * @returns {boolean}
   */
  isStudentInfo(obj) {
    return obj && 
           typeof obj.name === 'string' &&
           typeof obj.phone === 'string' &&
           typeof obj.grade === 'string' &&
           typeof obj.school === 'string' &&
           typeof obj.parentName === 'string' &&
           typeof obj.parentPhone === 'string' &&
           typeof obj.privacyConsent === 'boolean';
  },

  /**
   * TestResult 타입 검증
   * @param {any} obj 
   * @returns {boolean}
   */
  isTestResult(obj) {
    return obj &&
           typeof obj.sessionId === 'string' &&
           typeof obj.success === 'boolean' &&
           typeof obj.totalTime === 'number' &&
           typeof obj.stepTimes === 'object' &&
           Array.isArray(obj.errors) &&
           Array.isArray(obj.screenshots);
  }
};