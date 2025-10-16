# 🧪 테스트 결과 확인 가이드

## 📂 로그 파일 구조

```
reports/
├── monitoring/                              # 멀티 테스트 로그
│   ├── multi-test-4-1760516604230.log      # 타임라인 이벤트 (JSON Lines)
│   └── multi-test-4-stats-1760516604230.json # 최종 통계 요약
│
├── report_1759297749509.html               # 단일 테스트 HTML 리포트
├── report_1759297749509.json               # 단일 테스트 JSON 데이터
└── latest.html                             # 최근 리포트 (심볼릭 링크)

screenshots/                                 # 스크린샷 저장
└── screenshot-test-1-*.png
```

---

## 🚀 테스트 실행 방법

### 1️⃣ **CLI 직접 실행** (콘솔 출력)

```bash
# 단일 테스트
node cli.js single

# 멀티 테스트 (4개를 2개씩 동시 실행)
node cli.js multi -c 4 -p 2

# 멀티 테스트 (6개를 3개씩 동시 실행)
node cli.js multi -c 6 -p 3
```

**특징:**
- ✅ 실시간 콘솔 출력
- ✅ 5초마다 진행 상황 업데이트
- ✅ 색상으로 상태 표시
- ✅ 즉시 에러 확인 가능

**콘솔 출력 예시:**
```
================================================================================
📊 CONCURRENT TEST STATUS (55s elapsed)
================================================================================
Total: 4 | Running: 2 | Completed: 2 | Failed: 0
Success Rate: 100.0% | Waiting: 0 users
================================================================================
```

---

### 2️⃣ **Web GUI 사용** (권장!)

```bash
# Web GUI 시작
node web-gui.js

# 브라우저에서 접속
# → http://localhost:3000
```

**특징:**
- ✅ 브라우저에서 모든 설정 가능
- ✅ 실시간 테스트 모니터링
- ✅ 그래프와 차트로 시각화
- ✅ 환경변수 설정 GUI
- ✅ 테스트 보고서 자동 생성

---

### 3️⃣ **백그라운드 실행 + 로그 모니터링**

```bash
# 백그라운드로 실행하고 로그 파일로 저장
node cli.js multi -c 4 -p 2 > test-output.log 2>&1 &

# 실시간 로그 확인
tail -f test-output.log

# 또는 로그 파일 직접 모니터링
tail -f reports/monitoring/multi-test-*.log | tail -1
```

---

## 📊 로그 파일 형식

### `.log` 파일 (JSON Lines 형식)

타임라인 이벤트를 시간순으로 기록:

```json
{"timestamp":"2025-10-15T08:23:24.230Z","elapsed":0,"eventType":"SESSION_STARTED","sessionId":"test-1"}
{"timestamp":"2025-10-15T08:23:26.086Z","elapsed":2,"eventType":"STEP_UPDATE","sessionId":"test-1","step":"step1-course"}
{"timestamp":"2025-10-15T08:24:18.422Z","elapsed":54,"eventType":"SESSION_COMPLETED","sessionId":"test-1","duration":54191}
```

**이벤트 타입:**
- `SESSION_REGISTERED` - 세션 등록
- `SESSION_STARTED` - 세션 시작
- `STEP_UPDATE` - 단계 진행 업데이트
- `SESSION_COMPLETED` - 세션 완료
- `SESSION_FAILED` - 세션 실패
- `ERROR` - 에러 발생

---

### `.json` 파일 (최종 통계)

전체 테스트 실행 결과 요약:

```json
{
  "testName": "multi-test-4",
  "startTime": 1760516604230,
  "elapsed": 98228,
  "stats": {
    "total": 4,
    "completed": 3,
    "failed": 1,
    "stepStats": {...},
    "errorsByStep": {...}
  },
  "sessions": [
    {
      "sessionId": "test-1",
      "status": "completed",
      "duration": 54191,
      "result": {...}
    }
  ]
}
```

---

## 🔍 로그 확인 명령어

### 기본 명령어

```bash
# 1. 가장 최근 로그 파일 찾기
ls -lt reports/monitoring/*.log | head -1

# 2. 최근 로그 내용 확인 (마지막 50줄)
ls -lt reports/monitoring/*.log | head -1 | awk '{print $NF}' | xargs tail -50

# 3. 최종 통계 확인 (JSON 예쁘게 출력)
ls -lt reports/monitoring/*-stats-*.json | head -1 | awk '{print $NF}' | xargs cat | jq '.'

# 4. 에러만 필터링
grep ERROR reports/monitoring/*.log | tail -20

# 5. 특정 세션 추적
grep "test-1" reports/monitoring/multi-test-4-1760516604230.log

# 6. 성공한 세션만 보기
grep SESSION_COMPLETED reports/monitoring/*.log | tail -20
```

---

### 헬퍼 스크립트 사용 ⭐

```bash
# 가장 최근 테스트 결과 확인 (권장!)
./view-latest-test.sh
```

**출력 예시:**
```
🔍 Finding latest test logs...

📄 Latest Log: reports/monitoring/multi-test-4_2025-10-15_17-28-52.log
📊 Latest Stats: reports/monitoring/multi-test-4_2025-10-15_17-28-52.json

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 Last 30 events:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
0   SESSION_STARTED     test-1
2   STEP_UPDATE         test-1  step1-course
...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Final Statistics:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Test Name:     multi-test-4
Total Tests:   4
Completed:     3 ✅
Failed:        1 ❌
Success Rate:  75%

⏱️  Duration:
  Total: 98s
  Average: 50s

🔍 Errors by Step:
  - step3-detailed: 1
```

---

## 🎯 추천 워크플로우

### 개발 중 테스트

```bash
# 1. Web GUI로 빠르게 테스트
node web-gui.js
# → 브라우저에서 설정하고 실행
# → 실시간으로 진행 상황 확인

# 2. 완료 후 결과 확인
./view-latest-test.sh
```

---

### CI/CD 자동화

```bash
# 1. 백그라운드로 테스트 실행
node cli.js multi -c 10 -p 3 > test-output.log 2>&1

# 2. 결과 확인 및 파싱
cat reports/monitoring/*-stats-*.json | tail -1 | jq '.stats.failed'

# 3. 실패 시 종료 코드 반환
if [ $(cat reports/monitoring/*-stats-*.json | tail -1 | jq '.stats.failed') -gt 0 ]; then
  exit 1
fi
```

---

### 디버깅

```bash
# 1. 특정 테스트 실행하고 로그 저장
node cli.js multi -c 2 -p 1 > debug.log 2>&1

# 2. 에러 확인
grep ERROR debug.log

# 3. 스크린샷 확인
ls -lt screenshots/ | head -5
open screenshots/error-*.png

# 4. 상세 로그 분석
./view-latest-test.sh
```

---

## 📈 로그 분석 팁

### 1. 성능 분석

```bash
# 각 단계별 평균 시간 확인
cat reports/monitoring/*-stats-*.json | tail -1 | \
  jq '.sessions[] | .result.stepTimes' | \
  jq -s 'add | to_entries | map({step: .key, avgTime: (.value / 1000)})'
```

### 2. 에러 패턴 분석

```bash
# 어떤 단계에서 에러가 가장 많은지 확인
cat reports/monitoring/*-stats-*.json | tail -1 | \
  jq '.stats.errorsByStep'
```

### 3. 동시성 효과 측정

```bash
# 순차 실행 vs 동시 실행 시간 비교
# 순차: -p 1
# 동시: -p 3
```

---

## 🛠️ 고급 사용법

### 실시간 모니터링 대시보드

```bash
# watch로 5초마다 자동 갱신
watch -n 5 ./view-latest-test.sh
```

### 로그 필터링

```bash
# 특정 세션만 추출
jq 'select(.sessionId == "test-1")' reports/monitoring/multi-test-*.log

# 에러만 추출
jq 'select(.eventType == "ERROR")' reports/monitoring/multi-test-*.log

# 특정 단계만 추출
jq 'select(.step == "step3-detailed")' reports/monitoring/multi-test-*.log
```

### 통계 비교

```bash
# 여러 테스트 성공률 비교
for file in reports/monitoring/*-stats-*.json; do
  echo "$(basename $file): $(jq '.stats.completed / .stats.total * 100' $file)%"
done
```

---

## ⚠️ 문제 해결

### 로그 파일이 없을 때

```bash
# reports/monitoring 디렉토리 확인
ls -la reports/monitoring/

# 최근 실행한 테스트가 있는지 확인
ls -lt reports/monitoring/*.log | head -5
```

### 통계 파일 파싱 에러

```bash
# JSON 유효성 검사
cat reports/monitoring/*-stats-*.json | tail -1 | jq '.'

# 문제가 있으면 raw 출력으로 확인
cat reports/monitoring/*-stats-*.json | tail -1
```

### 스크린샷 없을 때

```bash
# 스크린샷 디렉토리 확인
ls -la screenshots/

# 에러 발생 시에만 스크린샷이 저장됨
grep ERROR reports/monitoring/*.log
```

---

## 📌 요약

### 빠른 확인

```bash
./view-latest-test.sh
```

### 상세 분석

```bash
# 로그 파일
cat reports/monitoring/multi-test-*.log | tail -1 | jq '.'

# 통계 파일
cat reports/monitoring/*-stats-*.json | tail -1 | jq '.'
```

### 실시간 모니터링

```bash
# Web GUI (권장)
node web-gui.js

# 또는 tail
tail -f reports/monitoring/multi-test-*.log | tail -1
```

---

## 🎓 더 알아보기

- 멀티탭 동시성: [REFACTORING.md](./REFACTORING.md)
- 파일 분석: [FILE_ANALYSIS.md](./FILE_ANALYSIS.md)
- README: [README.md](./README.md)
