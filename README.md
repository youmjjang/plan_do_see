# 큐티스트릿도 다이어리

동물의 숲 상점가 꾸미기를 위한 Plan → Do → See 앱입니다.

- React / Vinext, Cloudflare Workers, 서버 D1 데이터베이스
- 로그인 없이 읽기·쓰기, 공개 안내 표시
- 최초 계획·수정 이력, 할 일 CRUD·검색·필터·정렬
- 별도 실행 기록, 원자적 완료 처리와 데이터베이스 중복 제약
- 서울 날짜 기준 집계와 근거 기록, 다음 계획으로 회고 전달
- 전체 자료 JSON 내보내기, 공개 소스 화면

## 실행

Node.js 22.13 이상과 npm을 사용합니다. `npm run install:ci`로 잠금 파일의 의존성을 설치합니다. `npm run build` 뒤 아래 명령으로 로컬 데이터베이스에 마이그레이션을 적용하고 `npm run dev`를 실행합니다.

```
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_same_multiple_man.sql
```

운영 환경은 Sites의 논리적 `DB` 바인딩을 사용합니다. 브라우저에 DB 비밀키를 전달하지 않습니다. `.env`, `.wrangler`, 작업 파일은 Git에 넣지 않습니다.

## 검증

- `node tests/api.mjs http://localhost:5173`: 로컬 전용 API 검증. QA 계획과 기록을 생성하므로 운영 URL에서 실행하지 마세요.
- `node --experimental-strip-types tests/stats.mjs`: 집계 계산 검증.
- `node scripts/export-source.mjs`: 공개할 소스 JSON 생성. 이 작업 후 빌드합니다.

스키마는 `contracts/pds-schema-v2.json`, 제출 문구 초안은 `SUBMISSION.md`에 있습니다. 앱 초기 자료는 사용자가 정한 계획 1개와 할 일 6개입니다. 실제 실행 기록은 사용자가 직접 작성해야 합니다.
