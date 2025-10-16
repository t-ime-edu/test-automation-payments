import dotenv from 'dotenv';

dotenv.config();

/**
 * 환경별 설정
 */
const ENVIRONMENT_CONFIG = {
  dev: {
    baseUrl: 'http://devcrweb.t-ime.com/apply/request/list.do',
    acadCd: 'TE19041100',
    name: '개발',
  },
  prod: {
    baseUrl: 'https://newcrweb.t-ime.com/apply/request/list.do',
    acadCd: 'TE20110003',
    name: '운영',
  },
};

/**
 * 테스트 설정 클래스
 */
export class TestConfig {
  constructor() {
    this.reload();
  }

  /**
   * 설정 다시 로드
   */
  reload() {
    // .env 재로드
    dotenv.config({ override: true });

    this.maxConcurrentTests = parseInt(process.env.MAX_CONCURRENT_TESTS) || 5;
    this.testDuration = parseInt(process.env.TEST_DURATION) || 300;
    this.waitTimeout = parseInt(process.env.WAIT_TIMEOUT) || 30000;
    this.headless = process.env.HEADLESS === 'true';
    this.screenshotOnFailure = process.env.SCREENSHOT_ON_FAILURE === 'true';
    this.videoOnFailure = process.env.VIDEO_ON_FAILURE === 'true';
    this.logLevel = process.env.LOG_LEVEL || 'info';
    
    // 에러 스크린샷 활성화 여부 (기본값: true)
    // 개발/디버깅: true, 대량 테스트: false (성능 최적화)
    this.enableScreenshots = process.env.ENABLE_SCREENSHOTS !== 'false';

    // 환경 설정
    this.environment = process.env.ENVIRONMENT || 'dev';

    // 환경별 설정 가져오기
    const envConfig = ENVIRONMENT_CONFIG[this.environment];
    if (!envConfig) {
      throw new Error(`Invalid ENVIRONMENT: ${this.environment}. Must be 'dev' or 'prod'`);
    }

    // 환경별 URL 및 ACAD_CD 설정
    this.baseUrl = envConfig.baseUrl;
    this.defaultAcadCd = envConfig.acadCd;
    this.environmentName = envConfig.name;

    // 테스트 데이터 설정
    this.studentNamePrefix = process.env.STUDENT_NAME_PREFIX || '테스트학생';
    this.emailPrefix = process.env.EMAIL_PREFIX || 'test';
    this.emailDomain = process.env.EMAIL_DOMAIN || 'gmail.com';
    this.phonePrefix = process.env.PHONE_PREFIX || '150';
  }

  /**
   * 설정 유효성 검사
   */
  validate() {
    const errors = [];
    
    if (this.maxConcurrentTests < 1 || this.maxConcurrentTests > 50) {
      errors.push('MAX_CONCURRENT_TESTS must be between 1 and 50');
    }
    
    if (this.testDuration < 60) {
      errors.push('TEST_DURATION must be at least 60 seconds');
    }
    
    if (this.waitTimeout < 5000) {
      errors.push('WAIT_TIMEOUT must be at least 5000ms');
    }
    
    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
    
    return true;
  }
}

export const config = new TestConfig();