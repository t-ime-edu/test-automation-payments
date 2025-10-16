#!/bin/bash
# 가장 최근 테스트 로그 확인 스크립트

echo "🔍 Finding latest test logs..."
echo ""

# 날짜별 폴더 + 테스트별 폴더를 포함해서 가장 최근 파일 찾기
LATEST_LOG=$(find reports/monitoring -name "test.log" -type f 2>/dev/null | xargs ls -t 2>/dev/null | head -1)
LATEST_STATS=$(find reports/monitoring -name "stats.json" -type f 2>/dev/null | xargs ls -t 2>/dev/null | head -1)

if [ -z "$LATEST_LOG" ]; then
    echo "❌ No test logs found in reports/monitoring/"
    echo "💡 Logs are organized by date: reports/monitoring/YYYY-MM-DD/"
    exit 1
fi

echo "📄 Latest Log: $LATEST_LOG"
echo "📊 Latest Stats: $LATEST_STATS"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 Last 30 events:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
tail -30 "$LATEST_LOG" | jq -r '[.elapsed, .eventType, .sessionId, .step // .error // ""] | @tsv' | column -t
echo ""

if [ -n "$LATEST_STATS" ] && command -v jq &> /dev/null; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📊 Final Statistics:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    jq -r '
        "Test Name:     \(.testName)",
        "Total Tests:   \(.stats.total)",
        "Completed:     \(.stats.completed) ✅",
        "Failed:        \(.stats.failed) ❌",
        "Success Rate:  \((.stats.completed / .stats.total * 100 | floor))%",
        "",
        "⏱️  Duration:",
        (if .elapsed then "  Total: \((.elapsed / 1000 | floor))s" else "" end),
        (if .sessions then "  Average: \(([.sessions[].duration] | add / length / 1000 | floor))s" else "" end),
        "",
        "🔍 Errors by Step:",
        (if .stats.errorsByStep then (.stats.errorsByStep | to_entries | map("  - \(.key): \(.value)") | join("\n")) else "  None" end)
    ' "$LATEST_STATS"
fi
