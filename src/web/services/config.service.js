/**
 * 설정 관리 서비스
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';

export class ConfigService {
  constructor() {
    this.logger = new Logger('ConfigService');
    this.envPath = path.join(process.cwd(), '.env');
  }

  /**
   * 현재 설정 가져오기
   */
  getConfig() {
    return {
      environment: config.environment,
      environmentName: config.environmentName,
      baseUrl: config.baseUrl,
      acadCd: config.defaultAcadCd,
      maxConcurrent: config.maxConcurrentTests,
      headless: config.headless,
      logLevel: config.logLevel
    };
  }

  /**
   * 설정 업데이트
   */
  updateConfig(newConfig) {
    try {
      let envContent = '';

      // 기존 .env 파일 읽기
      if (fs.existsSync(this.envPath)) {
        envContent = fs.readFileSync(this.envPath, 'utf8');
      }

      // 업데이트할 설정
      const updates = {
        'ENVIRONMENT': newConfig.environment,
        'HEADLESS': newConfig.headless
      };

      // 각 설정 업데이트
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined) return;

        const regex = new RegExp(`^${key}=.*$`, 'm');
        const line = `${key}=${value}`;

        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, line);
        } else {
          envContent += `\n${line}`;
        }
      });

      // .env 파일 저장
      fs.writeFileSync(this.envPath, envContent.trim());

      // config 객체 다시 로드
      config.reload();

      this.logger.info('Configuration updated and reloaded successfully');

      return {
        success: true,
        message: 'Configuration saved and applied successfully.'
      };
    } catch (error) {
      this.logger.error('Failed to update configuration:', error);
      throw new Error(`Configuration update failed: ${error.message}`);
    }
  }
}
