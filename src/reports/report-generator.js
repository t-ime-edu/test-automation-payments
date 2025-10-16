import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 전문적인 테스트 보고서 생성기
 */
export class ReportGenerator {
  constructor() {
    this.reportDir = path.join(process.cwd(), 'reports');
    this.ensureReportDirectory();
  }

  /**
   * 보고서 디렉토리 생성
   */
  ensureReportDirectory() {
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }
  }

  /**
   * 종합 테스트 보고서 생성
   * @param {Array} testResults 테스트 결과 배열
   * @param {Object} testConfig 테스트 설정
   * @returns {Object} 보고서 정보
   */
  generateComprehensiveReport(testResults, testConfig = {}) {
    const timestamp = new Date();
    const reportId = `report_${timestamp.getTime()}`;

    // 통계 계산
    const stats = this.calculateStatistics(testResults);

    // 성능 메트릭 분석
    const performance = this.analyzePerformance(testResults);

    // 오류 분석
    const errorAnalysis = this.analyzeErrors(testResults);

    // HTML 보고서 생성
    const htmlReport = this.generateHTMLReport({
      reportId,
      timestamp,
      testConfig,
      stats,
      performance,
      errorAnalysis,
      testResults
    });

    // JSON 데이터 보고서 생성
    const jsonReport = this.generateJSONReport({
      reportId,
      timestamp,
      testConfig,
      stats,
      performance,
      errorAnalysis,
      testResults
    });

    // 파일 저장
    const htmlPath = path.join(this.reportDir, `${reportId}.html`);
    const jsonPath = path.join(this.reportDir, `${reportId}.json`);

    fs.writeFileSync(htmlPath, htmlReport);
    fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2));

    // 최신 보고서를 latest.html로도 저장
    const latestPath = path.join(this.reportDir, 'latest.html');
    fs.writeFileSync(latestPath, htmlReport);

    return {
      reportId,
      htmlPath,
      jsonPath,
      timestamp,
      stats
    };
  }

  /**
   * 통계 계산
   * @param {Array} testResults 테스트 결과
   * @returns {Object} 통계 정보
   */
  calculateStatistics(testResults) {
    const total = testResults.length;
    const successful = testResults.filter(r => r.success).length;
    const failed = total - successful;
    const successRate = total > 0 ? ((successful / total) * 100).toFixed(2) : 0;

    const totalTime = testResults.reduce((sum, r) => sum + (r.totalTime || 0), 0);
    const avgTime = total > 0 ? Math.round(totalTime / total) : 0;
    const maxTime = testResults.reduce((max, r) => Math.max(max, r.totalTime || 0), 0);
    const minTime = testResults.reduce((min, r) => Math.min(min, r.totalTime || Infinity), Infinity);

    // 단계별 평균 시간 계산
    const stepTimes = {};
    testResults.forEach(result => {
      if (result.stepTimes) {
        Object.entries(result.stepTimes).forEach(([step, time]) => {
          if (!stepTimes[step]) stepTimes[step] = [];
          stepTimes[step].push(time);
        });
      }
    });

    const avgStepTimes = {};
    Object.entries(stepTimes).forEach(([step, times]) => {
      avgStepTimes[step] = Math.round(times.reduce((sum, time) => sum + time, 0) / times.length);
    });

    return {
      total,
      successful,
      failed,
      successRate,
      avgTime,
      maxTime,
      minTime: minTime === Infinity ? 0 : minTime,
      avgStepTimes,
      totalDuration: totalTime
    };
  }

  /**
   * 성능 메트릭 분석
   * @param {Array} testResults 테스트 결과
   * @returns {Object} 성능 분석
   */
  analyzePerformance(testResults) {
    const times = testResults.map(r => r.totalTime || 0).filter(t => t > 0);
    times.sort((a, b) => a - b);

    const p50 = this.calculatePercentile(times, 50);
    const p90 = this.calculatePercentile(times, 90);
    const p95 = this.calculatePercentile(times, 95);
    const p99 = this.calculatePercentile(times, 99);

    // 성능 등급 판정
    let performanceGrade = 'A';
    if (p95 > 60000) performanceGrade = 'C'; // 60초 초과
    else if (p95 > 30000) performanceGrade = 'B'; // 30초 초과

    return {
      p50,
      p90,
      p95,
      p99,
      performanceGrade,
      recommendation: this.getPerformanceRecommendation(p95)
    };
  }

  /**
   * 백분위수 계산
   * @param {Array} sortedArray 정렬된 배열
   * @param {number} percentile 백분위 (0-100)
   * @returns {number} 백분위수 값
   */
  calculatePercentile(sortedArray, percentile) {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return Math.round(sortedArray[Math.max(0, index)]);
  }

  /**
   * 성능 개선 권고사항 생성
   * @param {number} p95 95퍼센타일 응답시간
   * @returns {string} 권고사항
   */
  getPerformanceRecommendation(p95) {
    if (p95 > 60000) return '시스템 성능 개선이 시급히 필요합니다. 서버 리소스 증설을 검토하세요.';
    if (p95 > 30000) return '성능 최적화가 필요합니다. 데이터베이스 쿼리 및 네트워크 응답 시간을 점검하세요.';
    return '우수한 성능을 보이고 있습니다. 현재 수준을 유지하세요.';
  }

  /**
   * 오류 분석
   * @param {Array} testResults 테스트 결과
   * @returns {Object} 오류 분석
   */
  analyzeErrors(testResults) {
    const failedTests = testResults.filter(r => !r.success);
    const errorsByStep = {};
    const errorsByType = {};

    failedTests.forEach(test => {
      if (test.errors && test.errors.length > 0) {
        test.errors.forEach(error => {
          const step = error.step || 'unknown';
          const type = this.categorizeError(error.message);

          errorsByStep[step] = (errorsByStep[step] || 0) + 1;
          errorsByType[type] = (errorsByType[type] || 0) + 1;
        });
      }
    });

    return {
      totalErrors: failedTests.length,
      errorsByStep,
      errorsByType,
      topErrors: this.getTopErrors(errorsByType, 5)
    };
  }

  /**
   * 오류 유형 분류
   * @param {string} errorMessage 오류 메시지
   * @returns {string} 오류 유형
   */
  categorizeError(errorMessage) {
    if (!errorMessage) return '알 수 없는 오류';

    const msg = errorMessage.toLowerCase();

    if (msg.includes('timeout')) return '타임아웃';
    if (msg.includes('network') || msg.includes('connection')) return '네트워크 오류';
    if (msg.includes('element') || msg.includes('selector')) return 'UI 요소 오류';
    if (msg.includes('navigation')) return '페이지 이동 오류';
    if (msg.includes('click')) return '클릭 오류';

    return '기타 오류';
  }

  /**
   * 상위 오류 목록 생성
   * @param {Object} errorsByType 유형별 오류
   * @param {number} limit 개수 제한
   * @returns {Array} 상위 오류 목록
   */
  getTopErrors(errorsByType, limit = 5) {
    return Object.entries(errorsByType)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([type, count]) => ({ type, count }));
  }

  /**
   * HTML 보고서 생성
   * @param {Object} reportData 보고서 데이터
   * @returns {string} HTML 보고서
   */
  generateHTMLReport(reportData) {
    const { reportId, timestamp, testConfig, stats, performance, errorAnalysis, testResults } = reportData;

    return `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>온라인 수강신청 자동화 테스트 보고서</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f7fa;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
        }

        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }

        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
        }

        .header .subtitle {
            font-size: 1.2rem;
            opacity: 0.9;
        }

        .executive-summary {
            background: #e3f2fd;
            border-left: 5px solid #2196f3;
            padding: 30px;
            margin: 30px;
            border-radius: 8px;
        }

        .executive-summary h2 {
            color: #1976d2;
            margin-bottom: 15px;
            font-size: 1.5rem;
        }

        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }

        .summary-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
        }

        .summary-card .value {
            font-size: 2rem;
            font-weight: bold;
            color: #1976d2;
            margin-bottom: 5px;
        }

        .summary-card .label {
            font-size: 0.9rem;
            color: #666;
        }

        .content {
            padding: 0 30px 30px;
        }

        .section {
            margin: 40px 0;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
            overflow: hidden;
        }

        .section-header {
            background: #f8f9fa;
            padding: 20px;
            border-bottom: 1px solid #dee2e6;
        }

        .section-header h3 {
            color: #495057;
            font-size: 1.3rem;
        }

        .section-content {
            padding: 20px;
        }

        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
        }

        .metric-item {
            text-align: center;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 6px;
        }

        .metric-value {
            font-size: 1.5rem;
            font-weight: bold;
            color: #28a745;
        }

        .metric-label {
            font-size: 0.9rem;
            color: #6c757d;
            margin-top: 5px;
        }

        .performance-grade {
            display: inline-block;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: bold;
            font-size: 1.1rem;
        }

        .grade-A { background: #d4edda; color: #155724; }
        .grade-B { background: #fff3cd; color: #856404; }
        .grade-C { background: #f8d7da; color: #721c24; }

        .error-list {
            list-style: none;
        }

        .error-item {
            background: #f8f9fa;
            padding: 10px 15px;
            margin-bottom: 10px;
            border-radius: 6px;
            border-left: 4px solid #dc3545;
        }

        .error-type {
            font-weight: bold;
            color: #dc3545;
        }

        .error-count {
            float: right;
            background: #dc3545;
            color: white;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 0.8rem;
        }

        .test-details {
            margin-top: 30px;
        }

        .test-row {
            display: grid;
            grid-template-columns: 100px 1fr 100px 120px 80px;
            gap: 15px;
            padding: 12px;
            border-bottom: 1px solid #dee2e6;
            align-items: center;
        }

        .test-row:nth-child(even) {
            background: #f8f9fa;
        }

        .test-header {
            font-weight: bold;
            background: #e9ecef !important;
        }

        .status-success {
            color: #28a745;
            font-weight: bold;
        }

        .status-failed {
            color: #dc3545;
            font-weight: bold;
        }

        .recommendation {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            padding: 15px;
            border-radius: 6px;
            margin-top: 15px;
        }

        .recommendation-title {
            font-weight: bold;
            color: #856404;
            margin-bottom: 8px;
        }

        .footer {
            background: #343a40;
            color: white;
            padding: 20px;
            text-align: center;
            font-size: 0.9rem;
        }

        @media print {
            body { background: white; }
            .container { box-shadow: none; }
            .section { break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎓 온라인 수강신청 자동화 테스트 보고서</h1>
            <div class="subtitle">
                보고서 ID: ${reportId}<br>
                생성일시: ${timestamp.toLocaleString('ko-KR')}
            </div>
        </div>

        <div class="executive-summary">
            <h2>📋 경영진 요약 (Executive Summary)</h2>
            <p>온라인 수강신청 시스템에 대한 자동화 테스트를 실시하여 시스템의 안정성과 성능을 평가하였습니다.</p>

            <div class="summary-grid">
                <div class="summary-card">
                    <div class="value">${stats.total}</div>
                    <div class="label">총 테스트 수</div>
                </div>
                <div class="summary-card">
                    <div class="value" style="color: ${stats.successRate >= 95 ? '#28a745' : stats.successRate >= 85 ? '#ffc107' : '#dc3545'}">${stats.successRate}%</div>
                    <div class="label">성공률</div>
                </div>
                <div class="summary-card">
                    <div class="value">${Math.round(stats.avgTime / 1000)}초</div>
                    <div class="label">평균 처리시간</div>
                </div>
                <div class="summary-card">
                    <div class="value performance-grade grade-${performance.performanceGrade}">${performance.performanceGrade}</div>
                    <div class="label">성능 등급</div>
                </div>
            </div>
        </div>

        <div class="content">
            <!-- 테스트 결과 개요 -->
            <div class="section">
                <div class="section-header">
                    <h3>📊 테스트 결과 개요</h3>
                </div>
                <div class="section-content">
                    <div class="metrics-grid">
                        <div class="metric-item">
                            <div class="metric-value">${stats.successful}</div>
                            <div class="metric-label">성공</div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-value" style="color: #dc3545">${stats.failed}</div>
                            <div class="metric-label">실패</div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-value">${Math.round(stats.totalDuration / 60000)}분</div>
                            <div class="metric-label">총 소요시간</div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-value">${Math.round(stats.maxTime / 1000)}초</div>
                            <div class="metric-label">최대 처리시간</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 성능 분석 -->
            <div class="section">
                <div class="section-header">
                    <h3>⚡ 성능 분석</h3>
                </div>
                <div class="section-content">
                    <div class="metrics-grid">
                        <div class="metric-item">
                            <div class="metric-value">${Math.round(performance.p50 / 1000)}초</div>
                            <div class="metric-label">P50 (중간값)</div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-value">${Math.round(performance.p90 / 1000)}초</div>
                            <div class="metric-label">P90</div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-value">${Math.round(performance.p95 / 1000)}초</div>
                            <div class="metric-label">P95</div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-value">${Math.round(performance.p99 / 1000)}초</div>
                            <div class="metric-label">P99</div>
                        </div>
                    </div>

                    <div class="recommendation">
                        <div class="recommendation-title">💡 성능 개선 권고사항</div>
                        <div>${performance.recommendation}</div>
                    </div>
                </div>
            </div>

            <!-- 단계별 성능 -->
            <div class="section">
                <div class="section-header">
                    <h3>🔄 단계별 평균 처리시간</h3>
                </div>
                <div class="section-content">
                    <div class="metrics-grid">
                        ${Object.entries(stats.avgStepTimes).map(([step, time]) => `
                            <div class="metric-item">
                                <div class="metric-value">${Math.round(time / 1000)}초</div>
                                <div class="metric-label">${this.getStepDisplayName(step)}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>

            ${errorAnalysis.totalErrors > 0 ? `
            <!-- 오류 분석 -->
            <div class="section">
                <div class="section-header">
                    <h3>🚨 오류 분석</h3>
                </div>
                <div class="section-content">
                    <p><strong>총 ${errorAnalysis.totalErrors}개의 오류가 발생했습니다.</strong></p>

                    <h4 style="margin: 20px 0 10px 0;">주요 오류 유형</h4>
                    <ul class="error-list">
                        ${errorAnalysis.topErrors.map(error => `
                            <li class="error-item">
                                <span class="error-type">${error.type}</span>
                                <span class="error-count">${error.count}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            </div>
            ` : ''}

            <!-- 상세 테스트 결과 -->
            <div class="section">
                <div class="section-header">
                    <h3>📝 상세 테스트 결과</h3>
                </div>
                <div class="section-content">
                    <div class="test-details">
                        <div class="test-row test-header">
                            <div>테스트</div>
                            <div>세션 ID</div>
                            <div>상태</div>
                            <div>처리시간</div>
                            <div>수강료</div>
                        </div>
                        ${testResults.slice(0, 20).map((test, index) => `
                            <div class="test-row">
                                <div>#${index + 1}</div>
                                <div style="font-family: monospace; font-size: 0.8rem;">${test.sessionId || 'N/A'}</div>
                                <div class="${test.success ? 'status-success' : 'status-failed'}">
                                    ${test.success ? '✅ 성공' : '❌ 실패'}
                                </div>
                                <div>${Math.round((test.totalTime || 0) / 1000)}초</div>
                                <div>${test.classSelection ? (test.classSelection.fee || 0).toLocaleString() + '원' : 'N/A'}</div>
                            </div>
                        `).join('')}
                        ${testResults.length > 20 ? `
                            <div class="test-row">
                                <div colspan="5" style="text-align: center; color: #666;">
                                    ... 그 외 ${testResults.length - 20}개 테스트 결과 생략
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>

        <div class="footer">
            자동화 테스트 시스템 v1.0 | 생성일시: ${timestamp.toLocaleString('ko-KR')}
        </div>
    </div>
</body>
</html>
    `;
  }

  /**
   * JSON 데이터 보고서 생성
   * @param {Object} reportData 보고서 데이터
   * @returns {Object} JSON 보고서
   */
  generateJSONReport(reportData) {
    return {
      reportMetadata: {
        reportId: reportData.reportId,
        generatedAt: reportData.timestamp,
        version: '1.0'
      },
      executiveSummary: {
        totalTests: reportData.stats.total,
        successRate: parseFloat(reportData.stats.successRate),
        averageTime: reportData.stats.avgTime,
        performanceGrade: reportData.performance.performanceGrade
      },
      statistics: reportData.stats,
      performance: reportData.performance,
      errorAnalysis: reportData.errorAnalysis,
      testConfiguration: reportData.testConfig,
      rawResults: reportData.testResults
    };
  }

  /**
   * 단계 표시명 변환
   * @param {string} step 단계 키
   * @returns {string} 표시명
   */
  getStepDisplayName(step) {
    const displayNames = {
      'browser-setup': '브라우저 초기화',
      'course-selection': '수강신청 목록',
      'basic-info-input': '기본정보 입력',
      'detailed-info-input': '상세정보 입력',
      'class-payment-selection': '수강반 선택',
      'cleanup': '정리 작업'
    };

    return displayNames[step] || step;
  }

  /**
   * TXT 보고서 생성
   * @param {Array} testResults 테스트 결과 배열
   * @param {Object} testConfig 테스트 설정
   * @returns {Object} TXT 보고서 정보
   */
  generateTxtReport(testResults, testConfig = {}) {
    const stats = this.calculateStatistics(testResults);
    const performance = this.analyzePerformance(testResults);
    const errorAnalysis = this.analyzeErrors(testResults);

    const reportId = `report-${Date.now()}`;
    const txtPath = path.join(this.reportDir, `${reportId}.txt`);

    // TXT 보고서 내용 생성
    const txtContent = this.generateTxtContent(stats, performance, errorAnalysis, testConfig);

    // TXT 파일 저장
    fs.writeFileSync(txtPath, txtContent, 'utf8');

    // 최신 TXT 보고서 심볼릭 링크 업데이트
    const latestTxtPath = path.join(this.reportDir, 'latest.txt');
    if (fs.existsSync(latestTxtPath)) {
      fs.unlinkSync(latestTxtPath);
    }
    fs.copyFileSync(txtPath, latestTxtPath);

    return {
      reportId,
      txtPath,
      timestamp: new Date().toISOString(),
      stats
    };
  }

  /**
   * TXT 보고서 내용 생성
   * @param {Object} stats 통계 정보
   * @param {Object} performance 성능 정보
   * @param {Object} errorAnalysis 오류 분석
   * @param {Object} testConfig 테스트 설정
   * @returns {string} TXT 내용
   */
  generateTxtContent(stats, performance, errorAnalysis, testConfig) {
    const divider = '=' .repeat(80);
    const subDivider = '-' .repeat(60);
    const timestamp = new Date().toLocaleString('ko-KR');

    let content = '';

    // 헤더
    content += `${divider}\n`;
    content += `            온라인 수강신청 자동화 테스트 보고서\n`;
    content += `                    ${timestamp}\n`;
    content += `${divider}\n\n`;

    // 임원 요약 (Executive Summary)
    content += `📋 임원 요약 (Executive Summary)\n`;
    content += `${subDivider}\n`;
    content += `• 총 테스트 수: ${stats.totalTests}건\n`;
    content += `• 성공률: ${stats.successRate}% (${stats.successCount}/${stats.totalTests})\n`;
    content += `• 평균 수강신청 완료 시간: ${(stats.avgTotalTime / 1000).toFixed(1)}초\n`;

    // 성과 등급
    const grade = stats.successRate >= 95 ? 'A+' :
                  stats.successRate >= 90 ? 'A' :
                  stats.successRate >= 80 ? 'B' :
                  stats.successRate >= 70 ? 'C' : 'D';
    const gradeComment = grade === 'A+' ? '탁월' :
                         grade === 'A' ? '우수' :
                         grade === 'B' ? '양호' :
                         grade === 'C' ? '개선 필요' : '즉시 대응 필요';

    content += `• 종합 성과 등급: ${grade} (${gradeComment})\n\n`;

    // 테스트 구성
    if (testConfig.testCount || testConfig.concurrency) {
      content += `⚙️ 테스트 구성\n`;
      content += `${subDivider}\n`;
      if (testConfig.testCount) content += `• 테스트 개수: ${testConfig.testCount}개\n`;
      if (testConfig.concurrency) content += `• 동시 실행: ${testConfig.concurrency}개\n`;
      if (testConfig.duration) content += `• 테스트 지속시간: ${testConfig.duration}분\n`;
      content += `• 테스트 유형: ${testConfig.testType || '표준 테스트'}\n\n`;
    }

    // 상세 결과
    content += `📊 상세 테스트 결과\n`;
    content += `${subDivider}\n`;
    content += `성공한 테스트:   ${stats.successCount}건\n`;
    content += `실패한 테스트:   ${stats.failureCount}건\n`;
    content += `전체 성공률:     ${stats.successRate}%\n`;
    content += `평균 실행 시간:  ${stats.avgTotalTime}ms\n`;
    content += `최단 실행 시간:  ${stats.minTime}ms\n`;
    content += `최장 실행 시간:  ${stats.maxTime}ms\n\n`;

    // 성능 분석 (백분위수)
    if (performance.percentiles) {
      content += `⚡ 성능 분석 (응답시간 백분위수)\n`;
      content += `${subDivider}\n`;
      content += `50% (중간값):    ${performance.percentiles.p50}ms\n`;
      content += `90% (상위 10%):  ${performance.percentiles.p90}ms\n`;
      content += `95% (상위 5%):   ${performance.percentiles.p95}ms\n`;
      content += `99% (상위 1%):   ${performance.percentiles.p99}ms\n\n`;
    }

    // 단계별 성능
    if (performance.stepTimes && Object.keys(performance.stepTimes).length > 0) {
      content += `📈 단계별 평균 성능\n`;
      content += `${subDivider}\n`;
      Object.entries(performance.stepTimes).forEach(([step, time]) => {
        const stepName = this.getStepDisplayName(step);
        content += `${stepName.padEnd(20)}: ${time}ms\n`;
      });
      content += '\n';
    }

    // 오류 분석
    if (errorAnalysis.totalErrors > 0) {
      content += `❌ 오류 분석\n`;
      content += `${subDivider}\n`;
      content += `총 오류 수: ${errorAnalysis.totalErrors}건\n\n`;

      if (errorAnalysis.errorsByStep && Object.keys(errorAnalysis.errorsByStep).length > 0) {
        content += `단계별 오류 발생 현황:\n`;
        Object.entries(errorAnalysis.errorsByStep).forEach(([step, count]) => {
          const stepName = this.getStepDisplayName(step);
          content += `• ${stepName}: ${count}건\n`;
        });
        content += '\n';
      }

      if (errorAnalysis.commonErrors && errorAnalysis.commonErrors.length > 0) {
        content += `주요 오류 메시지 (상위 5개):\n`;
        errorAnalysis.commonErrors.slice(0, 5).forEach((error, index) => {
          content += `${index + 1}. ${error.message} (${error.count}회)\n`;
        });
        content += '\n';
      }
    } else {
      content += `✅ 오류 분석: 오류 없음\n\n`;
    }

    // 권장사항
    content += `💡 권장사항\n`;
    content += `${subDivider}\n`;
    if (stats.successRate >= 95) {
      content += `• 우수한 성과입니다. 현재 설정을 유지하세요.\n`;
    } else if (stats.successRate >= 80) {
      content += `• 성능이 양호합니다. 소폭 개선을 검토해보세요.\n`;
    } else {
      content += `• 성공률 개선이 필요합니다. 시스템 점검을 권장합니다.\n`;
    }

    if (stats.avgTotalTime > 30000) {
      content += `• 평균 처리 시간이 30초를 초과합니다. 성능 최적화를 고려하세요.\n`;
    }

    if (errorAnalysis.totalErrors > stats.totalTests * 0.1) {
      content += `• 오류율이 10%를 초과합니다. 시스템 안정성 점검이 필요합니다.\n`;
    }

    content += '\n';

    // 푸터
    content += `${divider}\n`;
    content += `보고서 생성: ${timestamp}\n`;
    content += `자동화 테스트 시스템 v1.0\n`;
    content += `${divider}\n`;

    return content;
  }

  /**
   * 종합 보고서 생성 (HTML + JSON + TXT)
   * @param {Array} testResults 테스트 결과 배열
   * @param {Object} testConfig 테스트 설정
   * @returns {Object} 보고서 정보
   */
  generateComprehensiveReport(testResults, testConfig = {}) {
    const stats = this.calculateStatistics(testResults);
    const performance = this.analyzePerformance(testResults);
    const errorAnalysis = this.analyzeErrors(testResults);

    const reportId = `report-${Date.now()}`;
    const htmlPath = path.join(this.reportDir, `${reportId}.html`);
    const jsonPath = path.join(this.reportDir, `${reportId}.json`);
    const txtPath = path.join(this.reportDir, `${reportId}.txt`);

    // HTML 보고서 생성
    const htmlContent = this.generateHtmlContent(stats, performance, errorAnalysis, testConfig);
    fs.writeFileSync(htmlPath, htmlContent, 'utf8');

    // JSON 데이터 저장
    const jsonData = {
      reportId,
      timestamp: new Date().toISOString(),
      testConfig,
      statistics: stats,
      performance,
      errorAnalysis,
      testResults: testResults.map(r => ({
        sessionId: r.sessionId,
        success: r.success,
        totalTime: r.totalTime,
        stepTimes: r.stepTimes,
        errors: r.errors?.map(e => ({ step: e.step, message: e.message })) || []
      }))
    };
    fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));

    // TXT 보고서 생성
    const txtContent = this.generateTxtContent(stats, performance, errorAnalysis, testConfig);
    fs.writeFileSync(txtPath, txtContent, 'utf8');

    // 최신 보고서들 업데이트
    const latestHtmlPath = path.join(this.reportDir, 'latest.html');
    const latestJsonPath = path.join(this.reportDir, 'latest.json');
    const latestTxtPath = path.join(this.reportDir, 'latest.txt');

    [latestHtmlPath, latestJsonPath, latestTxtPath].forEach(path => {
      if (fs.existsSync(path)) fs.unlinkSync(path);
    });

    fs.copyFileSync(htmlPath, latestHtmlPath);
    fs.copyFileSync(jsonPath, latestJsonPath);
    fs.copyFileSync(txtPath, latestTxtPath);

    return {
      reportId,
      htmlPath,
      jsonPath,
      txtPath,
      timestamp: new Date().toISOString(),
      stats
    };
  }

  /**
   * 최근 보고서 목록 조회
   * @param {number} limit 개수 제한
   * @returns {Array} 보고서 목록
   */
  getRecentReports(limit = 10) {
    if (!fs.existsSync(this.reportDir)) {
      return [];
    }

    const files = fs.readdirSync(this.reportDir)
      .filter(file => file.endsWith('.json') && file !== 'latest.json')
      .map(file => {
        const filePath = path.join(this.reportDir, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          path: filePath,
          createdAt: stats.mtime
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);

    return files;
  }
}