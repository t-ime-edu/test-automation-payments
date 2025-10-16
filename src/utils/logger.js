import { config } from '../config/index.js';

/**
 * 로거 클래스
 */
export class Logger {
  constructor(name = 'Logger') {
    this.name = name;
    this.logLevel = this.getLogLevel(config.logLevel);
  }

  /**
   * 로그 레벨을 숫자로 변환
   * @param {string} level 
   * @returns {number}
   */
  getLogLevel(level) {
    const levels = {
      'debug': 0,
      'info': 1,
      'warn': 2,
      'error': 3
    };
    return levels[level] || 1;
  }

  /**
   * 타임스탬프 생성
   * @returns {string}
   */
  getTimestamp() {
    return new Date().toISOString();
  }

  /**
   * 로그 메시지 포맷팅
   * @param {string} level 
   * @param {string} message 
   * @param {...any} args 
   * @returns {string}
   */
  formatMessage(level, message, ...args) {
    const timestamp = this.getTimestamp();
    const formattedArgs = args.length > 0 ? ' ' + args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ') : '';
    
    return `[${timestamp}] [${level.toUpperCase()}] [${this.name}] ${message}${formattedArgs}`;
  }

  /**
   * 디버그 로그
   * @param {string} message 
   * @param {...any} args 
   */
  debug(message, ...args) {
    if (this.logLevel <= 0) {
      console.log(this.formatMessage('debug', message, ...args));
    }
  }

  /**
   * 정보 로그
   * @param {string} message 
   * @param {...any} args 
   */
  info(message, ...args) {
    if (this.logLevel <= 1) {
      console.log(this.formatMessage('info', message, ...args));
    }
  }

  /**
   * 경고 로그
   * @param {string} message 
   * @param {...any} args 
   */
  warn(message, ...args) {
    if (this.logLevel <= 2) {
      console.warn(this.formatMessage('warn', message, ...args));
    }
  }

  /**
   * 오류 로그
   * @param {string} message 
   * @param {...any} args 
   */
  error(message, ...args) {
    if (this.logLevel <= 3) {
      console.error(this.formatMessage('error', message, ...args));
    }
  }
}