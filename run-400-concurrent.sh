#!/bin/bash
# 400명 동접 테스트 자동화 스크립트
# M1 MacBook Pro 16GB 최적화

set -e  # 에러 발생 시 중단

# 설정
TOTAL=400
BATCH=50
BATCHES=$((TOTAL / BATCH))
WAIT_TIME=10  # 배치 간 대기 시간 (초)

# 성능 최적화: 스크린샷 비활성화 (대량 테스트 시 권장)
export ENABLE_SCREENSHOTS=false

# 색상 코드
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 헤더
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 400명 동접 테스트 시작"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 설정:"
echo "   • 총 테스트: ${TOTAL}명"
echo "   • 배치 크기: ${BATCH}명"
echo "   • 배치 수: ${BATCHES}개"
echo "   • 배치 간 대기: ${WAIT_TIME}초"
echo "   • 스크린샷: 비활성화 (성능 최적화)"
echo ""

# 메모리 체크
FREE_MEM=$(vm_stat | grep "Pages free" | awk '{print $3}' | sed 's/\.//')
FREE_GB=$((FREE_MEM * 4096 / 1024 / 1024 / 1024))

echo -e "${YELLOW}💾 현재 가용 메모리: ~${FREE_GB}GB${NC}"
if [ $FREE_GB -lt 2 ]; then
    echo -e "${RED}⚠️  경고: 가용 메모리가 부족합니다!${NC}"
    echo "   권장: 최소 2GB 이상"
    read -p "   계속 진행하시겠습니까? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "중단되었습니다."
        exit 1
    fi
fi

echo ""
echo -e "${GREEN}✓ 시스템 확인 완료${NC}"
echo ""

# 시작 시간
START_TIME=$(date +%s)

# 배치 실행
SUCCESS_COUNT=0
FAIL_COUNT=0

for i in $(seq 1 $BATCHES); do
    BATCH_START=$((($i - 1) * $BATCH + 1))
    BATCH_END=$(($i * $BATCH))
    PROGRESS=$((i * 100 / BATCHES))

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${BLUE}📦 Batch $i/$BATCHES${NC} (${PROGRESS}% 완료)"
    echo "   테스트: ${BATCH_START}-${BATCH_END}명"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    # 배치 실행
    if node cli.js multi -c $BATCH -p $BATCH; then
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        echo ""
        echo -e "${GREEN}✓ Batch $i 완료${NC}"
    else
        FAIL_COUNT=$((FAIL_COUNT + 1))
        echo ""
        echo -e "${RED}✗ Batch $i 실패${NC}"

        read -p "계속 진행하시겠습니까? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "테스트 중단됨"
            exit 1
        fi
    fi

    # 마지막 배치가 아니면 대기
    if [ $i -lt $BATCHES ]; then
        echo ""
        echo -e "${YELLOW}⏳ 다음 배치까지 ${WAIT_TIME}초 대기 중...${NC}"
        echo "   (브라우저 리소스 정리)"

        # 프로그레스 바
        for j in $(seq 1 $WAIT_TIME); do
            echo -n "."
            sleep 1
        done
        echo ""
        echo ""
    fi
done

# 완료
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
MINUTES=$((DURATION / 60))
SECONDS=$((DURATION % 60))

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🎉 모든 배치 완료!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 최종 결과:"
echo "   • 성공한 배치: ${SUCCESS_COUNT}/${BATCHES}"
echo "   • 실패한 배치: ${FAIL_COUNT}/${BATCHES}"
echo "   • 총 소요 시간: ${MINUTES}분 ${SECONDS}초"
echo ""
echo "📁 결과 확인:"
echo "   ./view-latest-test.sh"
echo ""
echo "📂 로그 위치:"
echo "   reports/monitoring/$(date +%Y-%m-%d)/"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
