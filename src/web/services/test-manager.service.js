/**
 * 테스트 관리 서비스
 * Web GUI에서 테스트 실행을 관리
 */

import { exec } from 'child_process';
import { Logger } from '../../utils/logger.js';

export class TestManagerService {
  constructor() {
    this.logger = new Logger('TestManager');
    this.currentProcess = null;
    this.status = {
      isRunning: false,
      currentTest: null,
      results: [],
      logs: []
    };
  }

  /**
   * 테스트 실행
   */
  async runTest(options) {
    if (this.status.isRunning) {
      throw new Error('Test is already running');
    }

    const { mode, count = 4, parallel = 2, duration = 5 } = options;

    this.status.isRunning = true;
    this.status.currentTest = { mode, count, parallel, duration };
    this.status.results = [];
    this.status.logs = [];

    // 명령어 생성
    const command = this._buildCommand(mode, count, parallel, duration);

    this._addLog(`Starting test: ${command}`);

    return new Promise((resolve, reject) => {
      this.currentProcess = exec(command, {
        cwd: process.cwd(),
        maxBuffer: 1024 * 1024 * 10 // 10MB
      });

      this.currentProcess.stdout.on('data', (data) => {
        this._addLog(data.toString().trim());
      });

      this.currentProcess.stderr.on('data', (data) => {
        this._addLog(`ERROR: ${data.toString().trim()}`);
      });

      this.currentProcess.on('close', (code) => {
        this.status.isRunning = false;
        this._addLog(`Test completed (exit code: ${code})`);

        if (code === 0) {
          resolve({ success: true, code });
        } else {
          resolve({ success: false, code });
        }
      });

      this.currentProcess.on('error', (error) => {
        this.status.isRunning = false;
        this._addLog(`ERROR: ${error.message}`);
        reject(error);
      });
    });
  }

  /**
   * 테스트 중지
   */
  stopTest() {
    if (!this.currentProcess) {
      throw new Error('No test is running');
    }

    this.currentProcess.kill('SIGTERM');
    this.status.isRunning = false;
    this._addLog('Test stopped by user');

    return { success: true, message: 'Test stopped' };
  }

  /**
   * 현재 상태 가져오기
   */
  getStatus() {
    return {
      ...this.status,
      totalTests: this.status.currentTest?.count || 1
    };
  }

  /**
   * 명령어 생성 (내부 헬퍼)
   */
  _buildCommand(mode, count, parallel, duration) {
    switch (mode) {
      case 'single':
      case 'debug':
        return 'node cli.js single';

      case 'multi':
        return `node cli.js multi -c ${count} -p ${parallel}`;

      case 'load':
        return `node cli.js load -d ${duration} -p ${parallel}`;

      default:
        throw new Error(`Invalid test mode: ${mode}`);
    }
  }

  /**
   * 로그 추가 (내부 헬퍼)
   */
  _addLog(message) {
    this.status.logs.push({
      timestamp: new Date(),
      message: message
    });

    // 최대 100개 로그만 유지
    if (this.status.logs.length > 100) {
      this.status.logs.shift();
    }
  }
}
