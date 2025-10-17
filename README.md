# 🎓 온라인 수강신청 자동화 테스트

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Playwright](https://img.shields.io/badge/Playwright-1.40+-blue.svg)](https://playwright.dev/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

브라우저 자동화를 통한 온라인 수강신청 시스템 부하 테스트 도구입니다. 실제 사용자 행동을 시뮬레이션하여 수강신청 전 과정을 자동화하고, 대규모 동시 테스트와 성능 모니터링을 지원합니다.

## 주요 특징

### 최적화
- **빠른 입력**: JavaScript 직접 실행으로 폼 입력 속도 5배 향상
- **스마트 대기**: 불필요한 대기 시간 최소화

### 완전 자동화 플로우
- **수강 목록**: 접수 가능한 과정 자동 감지 및 선택
- **정보 입력**: 개인정보 및 상세정보 자동 생성/입력
- **학교 검색**: 학교 검색 팝업 자동 처리
- **결제 처리**: Paymint 결제 시스템 

### 모니터링 및 분석
- **실시간 성능**: 각 단계별 소요시간 측정 및 기록
- **자동 스크린샷**: 각 단계 및 오류 시점 자동 캡처
- **상세 로깅**: 모든 동작과 결과를 구조화된 형태로 기록

##  시작하기

### 1. 필수 설치

```bash
# 의존성 설치
npm install

# Playwright 브라우저 설치
npm run install-browsers

# 환경 설정
cp .env.example .env
```

### 2. 실행 방법

- 윈도우는 관리자 권한으로 브라우저를 실행 하고 http://localhost:3000 접속
    - 파일을 수정하는 기능이 존재 하기 때문

#### Web GUI 사용 (권장)

```bash
# Web GUI 시작
npm run gui

# 브라우저에서 열기
open http://localhost:3000
```

Web GUI를 사용하면 브라우저에서 다음을 할 수 있습니다:
- 설정 관리
- 테스트 실행
- 실시간 모니터링
- 보고서 확인

#### CLI 사용

```bash
# 단일 테스트
node cli.js
npm run test:single

# 멀티 테스트 (4개를 2개씩 동시 실행)
node cli.js multi -c 4 -p 2
npm run test:multi -- -c 4 -p 2

# 부하 테스트 (10분 동안 2개씩 동시 실행)
node cli.js load -d 10 -p 2
npm run test:load -- -d 10 -p 2

# 디버그 모드 (브라우저 표시)
node cli.js single
npm run test:debug

# 도움말
node cli.js --help
```

### 3. 결과 확인

#### 📄 테스트 결과 확인

**테스트 결과 파일:**
- **통계 데이터**: `./reports/monitoring/[날짜]/[테스트명]/stats.json`
- **상세 로그**: `./reports/monitoring/[날짜]/[테스트명]/test.log`
- **스크린샷**: `./screenshots/` 폴더에 저장
- **Trace 파일**: `./test-results/[날짜]/` 폴더에 저장

**보고서 내용:**
-  전체 성공/실패 현황 및 성공률
-  단계별/에러 유형별 실패 분석
-  처리 시간 통계 (평균/최소/최대)
-  주요 실패 사례 상세 내역
-  시스템 성능 평가 및 권장사항


## 자동화 프로세스

### 1단계: 수강 과정 선택

- 수강신청 목록 페이지 접속
- 접수 중인 과정 자동 탐지
- 첫 번째 이용 가능한 과정 신청

### 2단계: 기본정보 입력

- 학생명: 랜덤 생성 (예: test{random_number})
- 전화번호: 150-1111-1111 형식으로 자동 생성

### 3단계: 상세정보 입력

- 학년: 고3/고2/고1 중 무작위 선택
- 학교: 팝업에서 자동 검색 및 선택
- 보호자 정보: 자동 생성 및 입력
- 개인정보 동의: 자동 체크

### 4단계: 수강반 및 결제 선택

- 이용 가능한 수강반 자동 선택
- Paymint 결제 시스템 처리
- 수강신청 완료 (실제 결제는 진행하지 않음)

## 고급 설정

### 멀티 테스트 옵션

```bash
-c, --count <개수>        테스트 개수 (기본값: 3)
-p, --parallel <개수>     동시 실행 개수 (기본값: 2, 최대: 50)
-d, --duration <분>       부하테스트 시간(분) (기본값: 5)
```

### 환경 변수

`.env` 파일을 생성하여 다음 설정을 커스터마이징할 수 있습니다:

```env
# 테스트 설정
MAX_CONCURRENT_TESTS=5
TEST_DURATION=300
WAIT_TIMEOUT=30000

# 테스트 데이터 (더미 데이터 사용)
STUDENT_NAME_PREFIX=테스트학생
EMAIL_PREFIX=test
EMAIL_DOMAIN=gmail.com
PHONE_PREFIX=150

# 시스템 설정
HEADLESS=true
SCREENSHOT_ON_FAILURE=true
VIDEO_ON_FAILURE=true

# 로그 레벨 (debug, info, warn, error)
LOG_LEVEL=info

# 환경 설정 (dev 또는 prod)
# dev: 개발 환경 (http://devcrweb.t-ime.com)
# prod: 운영 환경 (https://newcrweb.t-ime.com)
ENVIRONMENT=prod

# 스크린샷 여부
ENABLE_SCREENSHOTS=false

# AI 설정 (선택사항)
OPENAI_API_KEY=""
OPENAI_BASE_URL=""
OPENAI_MODEL=""
```

## 주의사항

- **실제 결제 안함**: 결제 확인 단계까지만 진행하며 실제 결제는 실행하지 않습니다
- **테스트 데이터**: 모든 개인정보는 자동 생성된 가상 데이터입니다
- **대기시간**: 서버 상황에 따라 대기시간이 발생할 수 있습니다
- **동시실행 제한**: 서버 부하를 고려하여 적절한 동시 실행 개수를 설정하세요
- **메모리 관리**: 대규모 테스트 시 Node.js 메모리 제한을 고려하세요

## 문제 해결

### 자주 발생하는 문제

```bash
# 브라우저 설치 문제
npx playwright install

# 환경 확인
node check-env.js

# Node.js 메모리 증가 (대규모 테스트 시)
node --max-old-space-size=8192 src/test-runner.js multi -c 10
```

### 디버깅

```bash
# 디버그 모드 (브라우저 화면 표시)
node run-test.js debug

# 또는 NPM 스크립트
npm run test:debug

# Playwright Inspector 사용
PWDEBUG=1 node src/test-runner.js single
```

### 로그 레벨

로그는 다음 레벨로 구분됩니다:

- `INFO`: 일반 진행 상황 (기본)
- `DEBUG`: 상세 동작 정보
- `WARN`: 경고 메시지 (계속 진행)
- `ERROR`: 오류 메시지 (테스트 중단)

환경 변수 `LOG_LEVEL`을 설정하여 로그 레벨을 조정할 수 있습니다.


## 기술 스택

- **Node.js**: v18 이상
- **Playwright**: v1.40 이상
- **JavaScript**: ES Module 방식
- **Express**: 웹 GUI

## 라이선스

MIT License

## 기여

버그 리포트, 기능 제안, Pull Request는 언제나 환영합니다.

## 지원

문제가 발생하거나 개선 사항이 있으면 GitHub Issues를 통해 알려주세요.
