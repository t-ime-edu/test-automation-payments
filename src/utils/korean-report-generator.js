import fs from 'fs';
import path from 'path';
import { Logger } from './logger.js';

/**
 * 한글 보고서 생성기
 * 테스트 결과를 읽기 쉬운 한글 보고서로 생성
 */
export class KoreanReportGenerator {
  constructor() {
    this.logger = new Logger('KoreanReportGenerator');
  }

  /**
   * stats.json 파일로부터 한글 보고서 생성
   */
  generateReport(statsFilePath) {
    try {
      // stats.json 읽기
      const statsData = JSON.parse(fs.readFileSync(statsFilePath, 'utf-8'));

      // 보고서 디렉토리 (stats.json과 같은 위치)
      const reportDir = path.dirname(statsFilePath);
      const reportPath = path.join(reportDir, '테스트보고서.md');

      // 보고서 생성
      const report = this.createReportContent(statsData);

      // 파일 저장
      fs.writeFileSync(reportPath, report, 'utf-8');

      this.logger.info(`✅ 한글 보고서 생성 완료: ${reportPath}`);
      return reportPath;

    } catch (error) {
      this.logger.error('보고서 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 보고서 내용 생성
   */
  createReportContent(statsData) {
    const { testName, startTime, currentTime, elapsed, stats, sessions } = statsData;

    // 시간 계산
    const startDate = new Date(startTime);
    const endDate = new Date(currentTime);
    const durationSec = Math.round(elapsed / 1000);
    const durationMin = Math.floor(durationSec / 60);
    const durationRemainSec = durationSec % 60;

    // 성공률 계산
    const successRate = stats.total > 0
      ? ((stats.completed / stats.total) * 100).toFixed(2)
      : 0;

    // 보고서 작성
    let report = '';

    // 1. 헤더
    report += '# 🎓 온라인 수강신청 자동화 테스트 보고서\n\n';
    report += `## 📋 테스트 개요\n\n`;
    report += `| 항목 | 내용 |\n`;
    report += `|------|------|\n`;
    report += `| **테스트명** | ${testName} |\n`;
    report += `| **시작 시간** | ${this.formatDateTime(startDate)} |\n`;
    report += `| **종료 시간** | ${this.formatDateTime(endDate)} |\n`;
    report += `| **소요 시간** | ${durationMin}분 ${durationRemainSec}초 (${durationSec}초) |\n`;
    report += `| **총 테스트 수** | ${stats.total}건 |\n\n`;

    // 2. 전체 결과 요약
    report += `## 📊 전체 결과 요약\n\n`;
    report += `| 항목 | 건수 | 비율 |\n`;
    report += `|------|------|------|\n`;
    report += `| ✅ **성공** | **${stats.completed}건** | **${successRate}%** |\n`;
    report += `| ❌ **실패** | ${stats.failed}건 | ${(100 - successRate).toFixed(2)}% |\n`;
    report += `| 📊 **전체** | ${stats.total}건 | 100% |\n\n`;

    // 성공률에 따른 평가
    if (successRate >= 95) {
      report += `### 🎉 평가: 우수\n`;
      report += `성공률이 95% 이상으로 매우 안정적입니다.\n\n`;
    } else if (successRate >= 80) {
      report += `### ✅ 평가: 양호\n`;
      report += `성공률이 80% 이상으로 양호합니다.\n\n`;
    } else if (successRate >= 50) {
      report += `### ⚠️ 평가: 주의 필요\n`;
      report += `성공률이 80% 미만입니다. 실패 원인을 확인해주세요.\n\n`;
    } else {
      report += `### 🚨 평가: 개선 필요\n`;
      report += `성공률이 50% 미만입니다. 시스템 점검이 필요합니다.\n\n`;
    }

    // 3. 대기 페이지 통계
    if (stats.waitingPageEncounters > 0) {
      report += `## ⏳ 대기 페이지 통계\n\n`;
      report += `| 항목 | 값 |\n`;
      report += `|------|----|\n`;
      report += `| 대기 페이지 발생 횟수 | ${stats.waitingPageEncounters}회 |\n`;
      report += `| 평균 대기 시간 | ${Math.round(stats.avgWaitTime)}초 |\n`;
      report += `| 최대 대기 중인 사용자 | ${this.getMaxWaitingUsers(sessions)}명 |\n\n`;
    }

    // 4. 실패 원인 분석
    if (stats.failed > 0) {
      report += `## 🚨 실패 원인 분석\n\n`;

      // 4-1. 단계별 실패 분석
      if (Object.keys(stats.errorsByStep).length > 0) {
        report += `### 📍 단계별 실패 현황\n\n`;
        report += `| 단계 | 실패 건수 | 비율 |\n`;
        report += `|------|----------|------|\n`;

        const sortedStepErrors = Object.entries(stats.errorsByStep)
          .sort(([, a], [, b]) => b - a);

        sortedStepErrors.forEach(([step, count]) => {
          const percentage = ((count / stats.failed) * 100).toFixed(1);
          const stepName = this.translateStepName(step);
          report += `| ${stepName} | ${count}건 | ${percentage}% |\n`;
        });
        report += `\n`;
      }

      // 4-2. 에러 유형별 분석
      if (Object.keys(stats.errorsByType).length > 0) {
        report += `### 🔍 에러 유형별 분석\n\n`;
        report += `| 에러 유형 | 발생 건수 | 비율 |\n`;
        report += `|----------|----------|------|\n`;

        const sortedTypeErrors = Object.entries(stats.errorsByType)
          .sort(([, a], [, b]) => b - a);

        sortedTypeErrors.forEach(([type, count]) => {
          const percentage = ((count / stats.failed) * 100).toFixed(1);
          const typeName = this.translateErrorType(type);
          report += `| ${typeName} | ${count}건 | ${percentage}% |\n`;
        });
        report += `\n`;
      }

      // 4-3. 주요 실패 사례
      report += `### 📝 주요 실패 사례\n\n`;
      const failedSessions = sessions.filter(s => s.status === 'failed');

      if (failedSessions.length > 0) {
        // 최대 10개만 표시
        const samplesToShow = Math.min(10, failedSessions.length);
        report += `실패한 세션 중 ${samplesToShow}개 표시 (전체 ${failedSessions.length}개):\n\n`;

        failedSessions.slice(0, samplesToShow).forEach((session, index) => {
          report += `#### ${index + 1}. ${session.sessionId}\n`;
          report += `- **소요 시간**: ${this.formatDuration(session.duration)}\n`;
          report += `- **마지막 단계**: ${this.translateStepName(session.currentStep)}\n`;

          if (session.errors && session.errors.length > 0) {
            report += `- **에러 내역**:\n`;
            session.errors.forEach(err => {
              report += `  - [${this.translateStepName(err.step)}] ${err.message}\n`;
            });
          }
          report += `\n`;
        });
      }
    }

    // 5. 성공 사례 분석
    if (stats.completed > 0) {
      report += `## ✅ 성공 사례 분석\n\n`;
      const successSessions = sessions.filter(s => s.status === 'completed');

      if (successSessions.length > 0) {
        const durations = successSessions
          .filter(s => s.duration > 0)
          .map(s => s.duration);

        if (durations.length > 0) {
          const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
          const minDuration = Math.min(...durations);
          const maxDuration = Math.max(...durations);

          report += `### ⏱️ 처리 시간 통계\n\n`;
          report += `| 항목 | 시간 |\n`;
          report += `|------|------|\n`;
          report += `| 평균 처리 시간 | ${this.formatDuration(avgDuration)} |\n`;
          report += `| 최소 처리 시간 | ${this.formatDuration(minDuration)} |\n`;
          report += `| 최대 처리 시간 | ${this.formatDuration(maxDuration)} |\n\n`;
        }

        // 대기 페이지를 경험한 세션
        const sessionsWithWait = successSessions.filter(s => s.waitingEncountered);
        if (sessionsWithWait.length > 0) {
          report += `### 대기 페이지 경험 세션\n\n`;
          report += `- 전체 성공 세션 중 ${sessionsWithWait.length}건이 대기 페이지를 경험했습니다.\n`;
          report += `- 대기 페이지를 경험해도 ${((sessionsWithWait.length / stats.completed) * 100).toFixed(1)}%의 세션이 성공적으로 완료되었습니다.\n\n`;
        }
      }
    }

    // 6. 시스템 성능 평가
    report += `## 🎯 시스템 성능 평가\n\n`;

    // 동시 처리 능력
    const maxConcurrent = this.getMaxConcurrent(sessions);
    report += `### 동시 처리 능력\n\n`;
    report += `- **최대 동시 실행**: ${maxConcurrent}개 세션\n`;
    report += `- **평균 동시 실행**: ${this.getAvgConcurrent(sessions)}개 세션\n\n`;

    // 처리량
    if (durationSec > 0) {
      const throughput = (stats.total / durationSec * 60).toFixed(2);
      report += `### 처리량\n\n`;
      report += `- **분당 처리량**: ${throughput}건/분\n`;
      report += `- **초당 처리량**: ${(stats.total / durationSec).toFixed(2)}건/초\n\n`;
    }

    // 7. 권장사항
    report += `## 💡 권장사항\n\n`;

    if (successRate >= 95) {
      report += `- ✅ 시스템이 안정적으로 작동하고 있습니다.\n`;
      report += `- 현재 설정을 유지하며 정기적인 모니터링을 권장합니다.\n`;
    } else if (successRate >= 80) {
      report += `- ⚠️ 소수의 실패 케이스가 발생하고 있습니다.\n`;
      report += `- 실패 원인을 분석하여 개선을 권장합니다.\n`;
    } else {
      report += `- 🚨 다수의 실패가 발생하고 있습니다.\n`;
      report += `- 주요 실패 원인:\n`;

      // 가장 많은 에러 유형 분석
      if (Object.keys(stats.errorsByType).length > 0) {
        const topError = Object.entries(stats.errorsByType)
          .sort(([, a], [, b]) => b - a)[0];
        report += `  - ${this.translateErrorType(topError[0])}: ${topError[1]}건\n`;
        report += this.getSuggestionForErrorType(topError[0]);
      }
    }

    // 메모리 최적화 권장사항
    if (stats.total >= 20) {
      report += `\n### 성능 최적화\n\n`;
      report += `- 현재 ${stats.total}개의 동시 테스트를 실행했습니다.\n`;
      if (successRate < 50) {
        report += `- 동시 실행 수를 줄이는 것을 권장합니다. (권장: 10-20개)\n`;
      } else {
        report += `- 현재 동시 실행 수가 적절합니다.\n`;
      }
    }

    // 8. 푸터
    report += `\n---\n\n`;
    report += `**보고서 생성 시간**: ${this.formatDateTime(new Date())}\n`;
    report += `**원본 데이터**: ${path.basename(path.dirname(statsData.testName))}/stats.json\n`;

    return report;
  }

  /**
   * 날짜/시간 포맷팅
   */
  formatDateTime(date) {
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }

  /**
   * 시간 포맷팅 (밀리초 -> 초/분)
   */
  formatDuration(ms) {
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) {
      return `${seconds}초`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainSeconds = seconds % 60;
    return `${minutes}분 ${remainSeconds}초`;
  }

  /**
   * 단계명 한글 번역
   */
  translateStepName(step) {
    const translations = {
      'init': '초기화',
      'step1-course': '1단계: 과정 선택',
      'step2-basic': '2단계: 기본정보 입력',
      'step3-detailed': '3단계: 상세정보 입력',
      'step4-class': '4단계: 수업 선택',
      'step5-payment': '5단계: 결제'
    };
    return translations[step] || step;
  }

  /**
   * 에러 유형 한글 번역
   */
  translateErrorType(type) {
    const translations = {
      'Timeout': '⏱️ 시간 초과',
      'WaitingPage': '⏳ 대기 페이지',
      'Network': '🌐 네트워크',
      'UIElement': '🔍 UI 요소',
      'Navigation': '🧭 페이지 이동',
      'Click': '🖱️ 클릭',
      'Other': '❓ 기타',
      'Unknown': '❓ 알 수 없음'
    };
    return translations[type] || type;
  }

  /**
   * 에러 유형별 권장사항
   */
  getSuggestionForErrorType(type) {
    const suggestions = {
      'Timeout': '  - 대기 시간(timeout) 증가 또는 시스템 리소스 확인이 필요합니다.\n',
      'WaitingPage': '  - 대기 페이지 처리 로직을 확인하거나 테스트 시간대를 조정하세요.\n',
      'Network': '  - 네트워크 연결 상태 및 서버 상태를 확인하세요.\n',
      'UIElement': '  - 웹페이지 UI가 변경되었을 수 있습니다. 셀렉터를 확인하세요.\n',
      'Navigation': '  - 페이지 로딩 시간이 길거나 URL이 변경되었을 수 있습니다.\n',
      'Click': '  - 버튼이나 링크의 위치/속성이 변경되었을 수 있습니다.\n',
      'Other': '  - 로그를 확인하여 구체적인 원인을 파악하세요.\n'
    };
    return suggestions[type] || '';
  }

  /**
   * 최대 동시 대기 사용자 수 계산
   */
  getMaxWaitingUsers(sessions) {
    let maxWaiting = 0;
    sessions.forEach(session => {
      if (session.queuePosition && session.queuePosition > maxWaiting) {
        maxWaiting = session.queuePosition;
      }
    });
    return maxWaiting;
  }

  /**
   * 최대 동시 실행 세션 수 계산
   */
  getMaxConcurrent(sessions) {
    // 시간대별로 실행 중인 세션 수를 계산
    const timeline = [];

    sessions.forEach(session => {
      if (session.actualStartTime && session.endTime) {
        timeline.push({ time: session.actualStartTime, delta: 1 });
        timeline.push({ time: session.endTime, delta: -1 });
      }
    });

    timeline.sort((a, b) => a.time - b.time);

    let current = 0;
    let max = 0;

    timeline.forEach(event => {
      current += event.delta;
      if (current > max) max = current;
    });

    return max;
  }

  /**
   * 평균 동시 실행 세션 수 계산
   */
  getAvgConcurrent(sessions) {
    const runningSessions = sessions.filter(s => s.actualStartTime && s.endTime);
    if (runningSessions.length === 0) return 0;

    // 간단히 전체 세션 수를 전체 시간으로 나눔
    const totalDuration = runningSessions.reduce((sum, s) => sum + (s.endTime - s.actualStartTime), 0);
    const avgDuration = totalDuration / runningSessions.length;

    if (avgDuration === 0) return 0;

    // 전체 테스트 시간 동안 평균적으로 몇 개가 동시 실행되었는지
    return Math.round((totalDuration / avgDuration) / runningSessions.length * 10) / 10;
  }
}
