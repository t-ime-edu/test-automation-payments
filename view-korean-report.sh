#!/bin/bash

# 한글 보고서 뷰어
# 가장 최근의 한글 보고서를 찾아서 표시

# 보고서 디렉토리
REPORTS_DIR="./reports/monitoring"

# 가장 최근 한글 보고서 찾기
LATEST_REPORT=$(find "$REPORTS_DIR" -name "테스트보고서.md" -type f -print0 | xargs -0 ls -t | head -n 1)

if [ -z "$LATEST_REPORT" ]; then
    echo "❌ 한글 보고서를 찾을 수 없습니다."
    echo "테스트를 먼저 실행해주세요: node cli.js multi -c 5 -p 5"
    exit 1
fi

echo "📄 가장 최근 한글 보고서:"
echo "   $LATEST_REPORT"
echo ""

# macOS에서 마크다운 렌더링 (기본 브라우저로 열기)
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS - marked 사용 가능 시 HTML로 변환 후 열기, 아니면 텍스트 뷰어
    if command -v marked &> /dev/null; then
        HTML_FILE="${LATEST_REPORT%.md}.html"
        marked "$LATEST_REPORT" > "$HTML_FILE"
        open "$HTML_FILE"
        echo "✅ 브라우저에서 보고서를 열었습니다."
    else
        # marked가 없으면 cat으로 출력
        cat "$LATEST_REPORT"
    fi
else
    # Linux - cat으로 출력
    cat "$LATEST_REPORT"
fi
