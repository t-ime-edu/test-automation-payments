# 🚀 성능 및 동접 테스트 가이드

## 💻 시스템 요구사항

### M1 MacBook Pro 16GB 기준

| 동시 실행 수 | 메모리 사용 | 권장 여부 | 예상 시간 (400명) |
|-------------|------------|----------|------------------|
| 10개        | ~400MB     | ✅ 안전   | ~40분            |
| 20개        | ~800MB     | ✅ 안전   | ~20분            |
| 30개        | ~1.2GB     | ✅ 안전   | ~13분            |
| 40개        | ~1.6GB     | ✅ 안전   | ~10분            |
| **50개**    | **~2GB**   | **⭐ 추천** | **~8분**       |
| 60개        | ~2.4GB     | ⚠️ 주의   | ~7분             |
| 80개        | ~3.2GB     | ⚠️ 주의   | ~5분             |
| 100개       | ~4GB       | ❌ 위험   | ~4분             |

**권장 설정: 50개 동시 실행** (안전 + 빠름)

---

## 🎯 400명 동접 테스트 실행 방법

### 방법 1: 단일 배치 (단순)

```bash
# 400명을 50개씩 배치로 자동 실행
node cli.js multi -c 400 -p 50

# 예상 결과:
# - 8개 배치로 자동 분할
# - 각 배치당 ~1분
# - 총 소요 시간: ~8-10분
# - 메모리 사용: ~2GB (안전)
```

**장점:**
- ✅ 명령어 하나로 완료
- ✅ 자동 배치 관리
- ✅ 진행 상황 실시간 표시

**단점:**
- ⚠️ 중간에 중단 불가
- ⚠️ 에러 발생 시 전체 중단

---

### 방법 2: 수동 배치 (안전) ⭐

```bash
# 배치 1: 1-50
node cli.js multi -c 50 -p 50

# 대기 (브라우저 리소스 정리)
sleep 10

# 배치 2: 51-100
node cli.js multi -c 50 -p 50

# ... 반복
```

**장점:**
- ✅ 각 배치 결과 확인 가능
- ✅ 에러 발생 시 해당 배치만 재실행
- ✅ 메모리 완전 정리 가능

**단점:**
- ⚠️ 수동 실행 필요
- ⚠️ 시간 소요 (대기 시간 포함)

---

### 방법 3: 자동화 스크립트 (최적) 🎯

배치 자동화 스크립트를 만들어 사용:

```bash
#!/bin/bash
# run-400-concurrent.sh

TOTAL=400
BATCH=50
BATCHES=$((TOTAL / BATCH))

echo "🚀 Starting 400 concurrent tests"
echo "📦 Batch size: $BATCH"
echo "🔢 Total batches: $BATCHES"
echo ""

for i in $(seq 1 $BATCHES); do
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📦 Batch $i/$BATCHES ($(($i * $BATCH))/$TOTAL tests)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  node cli.js multi -c $BATCH -p $BATCH

  if [ $i -lt $BATCHES ]; then
    echo ""
    echo "⏳ Waiting 10 seconds before next batch..."
    sleep 10
  fi
done

echo ""
echo "✅ All batches completed!"
echo "📊 Check results: ./view-latest-test.sh"
```

**사용법:**
```bash
chmod +x run-400-concurrent.sh
./run-400-concurrent.sh
```

---

## 📊 메모리 사용량 실시간 모니터링

### 방법 1: 터미널에서 모니터링

```bash
# 메모리 사용량 실시간 확인
watch -n 2 'ps aux | grep -E "(chrome|node)" | grep -v grep | awk "{sum+=\$4} END {print sum}%"'

# 상세 정보
watch -n 2 'ps aux | grep -E "(chrome|node)" | grep -v grep'
```

### 방법 2: Activity Monitor

```bash
# Activity Monitor 실행
open -a "Activity Monitor"

# 필터: "chrome" 또는 "node"
```

---

## ⚙️ 성능 최적화 팁

### 1. 불필요한 앱 종료
```bash
# Chrome 창 모두 닫기
killall "Google Chrome"

# 불필요한 앱 종료
# → Slack, Docker, VS Code 등
```

### 2. 시스템 설정 최적화
- 디스플레이: 해상도 낮추기 (선택사항)
- 백그라운드 앱: 최소화
- 알림: 끄기 (방해 금지 모드)

### 3. 테스트 중 모니터링
```bash
# 실시간 메모리 확인
while true; do
  echo "$(date): $(vm_stat | grep 'Pages free' | awk '{print $3}') free pages"
  sleep 5
done
```

---

## 🚨 주의사항

### 메모리 부족 징후
- 💡 시스템 느려짐
- 💡 브라우저 크래시
- 💡 "Out of memory" 에러

**대응 방법:**
```bash
# 1. 즉시 중단
Ctrl + C

# 2. 브라우저 프로세스 강제 종료
pkill -9 chrome

# 3. 배치 크기 줄이기
node cli.js multi -c 400 -p 30  # 50 → 30으로 감소
```

### 안정성을 위한 권장사항
1. **첫 실행은 작은 배치로 테스트**
   ```bash
   node cli.js multi -c 10 -p 10  # 10개로 테스트
   ```

2. **점진적으로 증가**
   ```bash
   node cli.js multi -c 20 -p 20  # 문제없으면 20개
   node cli.js multi -c 50 -p 50  # 최종 50개
   ```

3. **메모리 여유 확인**
   ```bash
   # 가용 메모리가 4GB 이상일 때만 진행
   vm_stat | grep "Pages free"
   ```

---

## 📈 예상 성능 (M1 MacBook Pro 16GB)

### 시나리오별 예상 시간

| 총 테스트 | 동시 실행 | 배치 수 | 예상 시간 | 안전성 |
|----------|----------|---------|----------|--------|
| 400명    | 10개     | 40배치  | ~40분    | ✅✅✅  |
| 400명    | 20개     | 20배치  | ~20분    | ✅✅✅  |
| 400명    | 30개     | 14배치  | ~14분    | ✅✅    |
| 400명    | 40개     | 10배치  | ~10분    | ✅✅    |
| **400명** | **50개** | **8배치** | **~8분** | **✅⭐** |
| 400명    | 60개     | 7배치   | ~7분     | ⚠️     |
| 400명    | 80개     | 5배치   | ~5분     | ⚠️❌   |

**권장: 50개 동시 실행** (안전성 + 속도 균형)

---

## 🎯 실전 예제

### 예제 1: 빠른 테스트 (소규모)
```bash
# 100명 테스트 (2분)
node cli.js multi -c 100 -p 50
```

### 예제 2: 중간 규모 테스트
```bash
# 200명 테스트 (4분)
node cli.js multi -c 200 -p 50
```

### 예제 3: 대규모 테스트 (400명) ⭐
```bash
# 400명 테스트 (8분) - 자동 배치
node cli.js multi -c 400 -p 50

# 또는 자동화 스크립트
./run-400-concurrent.sh
```

### 예제 4: 초대규모 테스트 (1000명)
```bash
# 1000명 테스트 (~20분) - 작은 배치로 안전하게
node cli.js multi -c 1000 -p 40
```

---

## 💡 FAQ

### Q: 400명을 한번에 실행할 수 없나요?
**A:** 기술적으로 가능하지만 비추천
- 메모리: 400 × 40MB = 16GB (전체 RAM)
- 시스템 불안정
- 크래시 위험 높음

### Q: 가장 빠른 방법은?
**A:** 80-100개 동시 실행 (위험 감수)
- 메모리: ~3-4GB
- 시간: ~4-5분
- ⚠️ 시스템 부하 높음

### Q: 가장 안전한 방법은?
**A:** 20-30개 동시 실행
- 메모리: ~1GB
- 시간: ~13-20분
- ✅ 매우 안정적

### Q: 추천 설정은?
**A:** **50개 동시 실행** ⭐
- 메모리: ~2GB (안전)
- 시간: ~8분 (빠름)
- 안정성 + 속도 균형

---

## 🔧 트러블슈팅

### 문제 1: "Out of memory" 에러
```bash
# 해결: 배치 크기 줄이기
node cli.js multi -c 400 -p 30  # 50 → 30
```

### 문제 2: 브라우저 크래시
```bash
# 해결: 프로세스 정리 후 재시작
pkill -9 chrome
sleep 5
node cli.js multi -c 400 -p 40
```

### 문제 3: 시스템 느려짐
```bash
# 해결: 더 작은 배치로 실행
node cli.js multi -c 400 -p 20
```

---

## 📚 참고 자료

- [TESTING_SUMMARY.md](./TESTING_SUMMARY.md) - 테스트 결과 확인
- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - 상세 가이드
- [REFACTORING.md](./REFACTORING.md) - 멀티탭 최적화
