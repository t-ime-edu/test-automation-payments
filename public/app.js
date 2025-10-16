// 전역 상태
let selectedMode = null;
let testRunning = false;
let logInterval = null;

// 페이지 로드 시 현재 설정 가져오기
window.addEventListener('DOMContentLoaded', async () => {
    await loadCurrentConfig();
});

// 현재 설정 로드
async function loadCurrentConfig() {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();

        updateConfigDisplay(config);
        updateConfigForm(config);
    } catch (error) {
        console.error('Failed to load config:', error);
    }
}

// 설정 표시 업데이트
function updateConfigDisplay(config) {
    document.getElementById('config-environment').textContent = `${config.environmentName || '개발'} (${config.environment || 'dev'})`;
    document.getElementById('config-url').textContent = config.baseUrl || '미설정';
    document.getElementById('config-acadcd').textContent = config.acadCd || '미설정';
    document.getElementById('config-concurrent').textContent = config.maxConcurrent || '3';
    document.getElementById('config-headless').textContent = config.headless ? '예' : '아니오';
    document.getElementById('config-loglevel').textContent = config.logLevel || 'info';
}

// 설정 폼 업데이트
function updateConfigForm(config) {
    document.getElementById('environment').value = config.environment || 'dev';
    document.getElementById('headless').value = config.headless ? 'true' : 'false';
}

// 테스트 모드 선택
document.querySelectorAll('.test-mode-card').forEach(card => {
    card.addEventListener('click', function() {
        document.querySelectorAll('.test-mode-card').forEach(c => c.classList.remove('selected'));
        this.classList.add('selected');
        selectedMode = this.dataset.mode;
        showTestOptions(selectedMode);
    });
});

// 테스트 옵션 표시
function showTestOptions(mode) {
    const optionsPanel = document.getElementById('test-options');
    const countGroup = document.getElementById('count-group');
    const parallelGroup = document.getElementById('parallel-group');
    const durationGroup = document.getElementById('duration-group');

    optionsPanel.style.display = 'block';

    if (mode === 'single' || mode === 'debug') {
        countGroup.style.display = 'none';
        parallelGroup.style.display = 'none';
        durationGroup.style.display = 'none';
    } else if (mode === 'multi') {
        countGroup.style.display = 'block';
        parallelGroup.style.display = 'block';
        durationGroup.style.display = 'none';
    } else if (mode === 'load') {
        countGroup.style.display = 'none';
        parallelGroup.style.display = 'block';
        durationGroup.style.display = 'block';
    }
}

// 환경 설정 저장
document.getElementById('env-config-form').addEventListener('submit', async function(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const envConfig = Object.fromEntries(formData.entries());

    try {
        const response = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(envConfig)
        });

        const result = await response.json();

        if (response.ok) {
            alert('✅ 설정이 저장되고 적용되었습니다!');
            await loadCurrentConfig();
        } else {
            alert('❌ 설정 저장에 실패했습니다: ' + (result.message || '알 수 없는 오류'));
        }
    } catch (error) {
        alert('❌ 오류가 발생했습니다: ' + error.message);
    }
});

// 테스트 실행
document.getElementById('run-test-btn').addEventListener('click', async function() {
    if (!selectedMode) {
        alert('❌ 테스트 모드를 선택해주세요!');
        return;
    }

    const testOptions = {
        mode: selectedMode,
        count: parseInt(document.getElementById('test_count').value) || 3,
        parallel: parseInt(document.getElementById('parallel_count').value) || 2,
        duration: parseInt(document.getElementById('test_duration').value) || 5
    };

    try {
        testRunning = true;
        updateTestUI(true);

        const response = await fetch('/api/run-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testOptions)
        });

        if (response.ok) {
            startLogMonitoring();
        } else {
            alert('❌ 테스트 실행에 실패했습니다.');
            testRunning = false;
            updateTestUI(false);
        }
    } catch (error) {
        alert('❌ 오류가 발생했습니다: ' + error.message);
        testRunning = false;
        updateTestUI(false);
    }
});

// 테스트 중지
document.getElementById('stop-test-btn').addEventListener('click', async function() {
    try {
        const response = await fetch('/api/stop-test', { method: 'POST' });
        if (response.ok) {
            testRunning = false;
            updateTestUI(false);
            stopLogMonitoring();
            alert('⏹️ 테스트가 중지되었습니다.');
        }
    } catch (error) {
        alert('❌ 테스트 중지에 실패했습니다: ' + error.message);
    }
});

// UI 상태 업데이트
function updateTestUI(running) {
    const runBtn = document.getElementById('run-test-btn');
    const stopBtn = document.getElementById('stop-test-btn');
    const statusPanel = document.getElementById('status-panel');

    if (running) {
        runBtn.style.display = 'none';
        stopBtn.style.display = 'block';
        statusPanel.style.display = 'block';
    } else {
        runBtn.style.display = 'block';
        stopBtn.style.display = 'none';
    }
}

// 로그 모니터링 시작
function startLogMonitoring() {
    logInterval = setInterval(async () => {
        try {
            const response = await fetch('/api/status');
            const status = await response.json();

            updateStatusDisplay(status);

            if (!status.isRunning && testRunning) {
                testRunning = false;
                updateTestUI(false);
                stopLogMonitoring();
                alert('✅ 테스트가 완료되었습니다!');
            }
        } catch (error) {
            console.error('상태 업데이트 실패:', error);
        }
    }, 2000);
}

// 로그 모니터링 중지
function stopLogMonitoring() {
    if (logInterval) {
        clearInterval(logInterval);
        logInterval = null;
    }
}

// 상태 표시 업데이트
function updateStatusDisplay(status) {
    const logsContainer = document.getElementById('status-logs');
    const progressFill = document.getElementById('progress-fill');

    // 진행률 업데이트
    let progress = 0;
    if (status.currentTest && status.totalTests) {
        progress = (status.results.length / status.totalTests) * 100;
    }
    progressFill.style.width = Math.min(progress, 100) + '%';

    // 로그 업데이트 (최근 10개만)
    const recentLogs = status.logs.slice(-10);
    logsContainer.innerHTML = recentLogs.map(log =>
        '<div class="log-entry">' + new Date(log.timestamp).toLocaleTimeString() + ' - ' + log.message + '</div>'
    ).join('');

    // 자동 스크롤
    logsContainer.scrollTop = logsContainer.scrollHeight;
}

// 보고서 관련 기능
document.getElementById('view-latest-report-btn').addEventListener('click', function() {
    window.open('/api/reports/latest', '_blank');
});

document.getElementById('download-txt-report-btn').addEventListener('click', async function() {
    try {
        const response = await fetch('/api/reports/download/txt');
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'test-report-' + new Date().toISOString().slice(0, 19).replace(/:/g, '-') + '.txt';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } else {
            alert('TXT 보고서를 찾을 수 없습니다. 먼저 테스트를 실행해주세요.');
        }
    } catch (error) {
        alert('TXT 보고서 다운로드에 실패했습니다: ' + error.message);
    }
});

document.getElementById('list-reports-btn').addEventListener('click', async function() {
    try {
        const response = await fetch('/api/reports/list');
        const reports = await response.json();

        const reportsContainer = document.getElementById('reports-container');
        const reportsList = document.getElementById('reports-list');

        if (reports.length === 0) {
            reportsContainer.innerHTML = '<p>아직 생성된 보고서가 없습니다.</p>';
        } else {
            reportsContainer.innerHTML = reports.map(report =>
                '<div style="background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 8px;">' +
                '<strong>보고서 ID:</strong> ' + report.filename.replace('.json', '') + '<br>' +
                '<strong>생성일시:</strong> ' + new Date(report.createdAt).toLocaleString('ko-KR') + '<br>' +
                '<a href="/api/reports/' + report.filename.replace('.json', '.html') + '" target="_blank" class="btn btn-primary" style="margin-top: 10px;">📄 보기</a>' +
                '</div>'
            ).join('');
        }

        reportsList.style.display = 'block';
    } catch (error) {
        alert('보고서 목록을 가져오는데 실패했습니다: ' + error.message);
    }
});
