# 🎯 테스트 결과 확인 - 최종 정리

## ✅ 완료된 개선사항

### 1. **날짜별 폴더 구조** ⭐⭐⭐
```
reports/monitoring/
├── 2025-10-15/              # 오늘 날짜
│   ├── multi-test-2_17-31-21.log
│   ├── multi-test-2_17-31-21.json
│   ├── multi-test-4_10-05-30.log
│   └── multi-test-4_10-05-30.json
├── 2025-10-14/              # 어제
│   └── ...
└── 2025-10-13/              # 그저께
    └── ...
```

**장점:**
- ✅ 날짜별로 자동 정리
- ✅ 오래된 로그 찾기 쉬움
- ✅ 폴더 단위로 정리/삭제 가능
- ✅ 파일명이 간단해짐 (날짜 중복 제거)

### 2. **사람이 읽기 쉬운 파일명**
- **이전**: `multi-test-4-1760516604230.log` ❌
- **개선**: `multi-test-4_17-31-21.log` ✅

### 3. **헬퍼 스크립트 자동 탐색**
```bash
./view-latest-test.sh
# → 모든 날짜 폴더를 자동으로 검색
# → 가장 최근 로그 자동 표시
```

---

## 🚀 빠른 시작 가이드

### 1️⃣ 테스트 실행

```bash
# CLI 직접 실행 (추천)
node cli.js multi -c 4 -p 2

# Web GUI (가장 쉬움)
node web-gui.js
# → http://localhost:3000
```

### 2️⃣ 결과 확인

```bash
# 가장 최근 테스트 결과 보기
./view-latest-test.sh
```

**출력 예시:**
```
🔍 Finding latest test logs...

📄 Latest Log: reports/monitoring/2025-10-15/multi-test-2_17-31-21.log
📊 Latest Stats: reports/monitoring/2025-10-15/multi-test-2_17-31-21.json

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Final Statistics:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Test Name:     multi-test-4
Total Tests:   4
Completed:     4 ✅
Failed:        0 ❌
Success Rate:  100%

⏱️  Duration:
  Total: 56s
  Average: 14s
```

### 3️⃣ 특정 날짜 로그 찾기

```bash
# 오늘 날짜 로그
ls reports/monitoring/2025-10-15/

# 특정 시간대 로그
ls reports/monitoring/2025-10-15/*17-*.log  # 17시대

# 최근 3일 로그
ls -lt reports/monitoring/*/
```

---

## 📁 폴더 구조 상세

```
reports/
├── monitoring/
│   ├── 2025-10-15/                    # 날짜별 폴더
│   │   ├── multi-test-2_17-31-21.log # 이벤트 타임라인
│   │   └── multi-test-2_17-31-21.json# 최종 통계
│   ├── 2025-10-14/
│   └── ...
│
├── report_*.html                      # 단일 테스트 HTML
├── report_*.json                      # 단일 테스트 JSON
└── latest.html                        # 최근 리포트

screenshots/
└── screenshot-test-*.png              # 에러 스크린샷
```

---

## 🔍 자주 사용하는 명령어

### 로그 확인
```bash
# 최신 로그
./view-latest-test.sh

# 오늘 모든 로그
ls -lt reports/monitoring/$(date +%Y-%m-%d)/

# 에러만 찾기
grep ERROR reports/monitoring/2025-10-15/*.log

# 특정 세션 추적
grep "test-1" reports/monitoring/2025-10-15/*.log
```

### 통계 분석
```bash
# JSON 예쁘게 출력
cat reports/monitoring/2025-10-15/multi-test-4_17-31-21.json | jq '.'

# 성공률 계산
cat reports/monitoring/2025-10-15/*.json | jq '.stats.completed / .stats.total * 100'

# 실패 세션 찾기
cat reports/monitoring/2025-10-15/*.json | jq '.sessions[] | select(.status == "failed")'
```

### 폴더 정리
```bash
# 7일 이전 로그 삭제
find reports/monitoring -type d -mtime +7 -exec rm -rf {} \;

# 특정 날짜 로그만 삭제
rm -rf reports/monitoring/2025-10-01/

# 용량 확인
du -sh reports/monitoring/*/
```

---

## 🎯 실전 워크플로우

### 개발 중
```bash
# 1. 테스트 실행
node cli.js multi -c 4 -p 2

# 2. 콘솔에서 실시간 확인
# (5초마다 진행 상황 표시)

# 3. 완료 후 상세 결과
./view-latest-test.sh
```

### 디버깅
```bash
# 1. 실패한 테스트 찾기
grep "FAILED" reports/monitoring/$(date +%Y-%m-%d)/*.log

# 2. 에러 상세 확인
cat reports/monitoring/$(date +%Y-%m-%d)/*.json | \
  jq '.sessions[] | select(.status == "failed")'

# 3. 스크린샷 확인
ls -lt screenshots/error-*.png | head -5
open screenshots/error-*.png
```

### CI/CD
```bash
# 백그라운드 실행 + 결과 체크
node cli.js multi -c 10 -p 3

# 실패 확인
FAILED=$(cat reports/monitoring/$(date +%Y-%m-%d)/*.json | tail -1 | jq '.stats.failed')
if [ "$FAILED" -gt 0 ]; then
  echo "❌ $FAILED tests failed"
  exit 1
fi
```

---

## 📊 로그 파일 형식

### `.log` 파일 (JSON Lines)
```json
{"timestamp":"...","elapsed":0,"eventType":"SESSION_STARTED","sessionId":"test-1"}
{"timestamp":"...","elapsed":2,"eventType":"STEP_UPDATE","sessionId":"test-1","step":"step1-course"}
{"timestamp":"...","elapsed":54,"eventType":"SESSION_COMPLETED","sessionId":"test-1"}
```

### `.json` 파일 (최종 통계)
```json
{
  "testName": "multi-test-4",
  "startTime": 1760517086000,
  "elapsed": 56000,
  "stats": {
    "total": 4,
    "completed": 4,
    "failed": 0
  },
  "sessions": [...]
}
```

---

## 🎓 더 알아보기

- **상세 가이드**: [TESTING_GUIDE.md](./TESTING_GUIDE.md)
- **멀티탭 동시성**: [REFACTORING.md](./REFACTORING.md)
- **프로젝트 개요**: [README.md](./README.md)

---

## 💡 팁

### 빠른 확인
```bash
./view-latest-test.sh
```

### 실시간 모니터링
```bash
watch -n 5 ./view-latest-test.sh
```

### 날짜별 통계
```bash
for date in reports/monitoring/*/; do
  echo "$(basename $date): $(ls $date/*.json | wc -l) tests"
done
```

### 오래된 로그 자동 정리 (cron)
```bash
# 매일 새벽 3시에 30일 이전 로그 삭제
0 3 * * * find /path/to/reports/monitoring -type d -mtime +30 -exec rm -rf {} \;
```
