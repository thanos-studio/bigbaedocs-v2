<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# UI 규칙

기본 원칙: 상태가 바뀌는 곳은 전부 애니메이션을 넣는다. 갑자기 나타나거나 사라지면 안 된다.

- 등장/퇴장: 모달·팝오버·칩·메시지 등 마운트/언마운트되는 요소는 진입과 **퇴장 모두** 트랜지션을 준다. `opened` 값을 `key`에 넣으면 exit 애니메이션이 죽으므로 금지.
- 클릭 가능한 요소: hover에 배경색 변화, active에 더 진한 색. `opacity`만 바꾸는 것으로는 부족하다(투명 배경 버튼에서 안 보임).
- hover 색은 페이지 배경(`#f0f2f5`)과 구분되는 값을 쓴다. `#f1f3f5`는 배경과 거의 같아 변화가 안 보인다.
- 힌트는 브라우저 기본 `title` 대신 Mantine `Tooltip`(`TOOLTIP_PROPS`)을 쓴다.
- 단계/화면 전환도 페이드 업으로 이어지게 한다.
- 여백은 넉넉하게. 요소가 컨테이너나 카드 경계에 붙지 않게 한다.
- 색은 메인 페이지의 절제된 무채색 팔레트를 따른다. 강조는 `#212529` 채움을 쓰고, 초록은 완료 상태에만.
- 스타일 토큰은 `src/lib/theme.ts`에서 가져온다. hex를 새로 박지 않는다.
- 인라인 `style`이 CSS 클래스를 이기므로, 상태별 색은 클래스에 두고 인라인에서 같은 속성을 중복 지정하지 않는다.


# HWPX 문서 (rhwp)

- `@rhwp/core`에는 PDF export가 없다. PDF는 `renderPageSvg()` 결과를 새 창에 그려 브라우저 인쇄로 저장한다.
- 뷰어용 wasm은 `scripts/copy-wasm.mjs`가 `public/rhwp_bg.wasm`으로 복사한다(dev/build/postinstall에 연결됨). 이 파일은 gitignore.
- 렌더 전에 `globalThis.measureTextWidth`를 등록해야 한다. 안 하면 줄바꿈이 조용히 깨진다.
- 서버(Node)에서도 `HwpDocument`와 `renderPageSvg`가 동작한다. wasm 바이트를 직접 읽어 `init`에 넘겨야 한다.
- 내보낸 SVG는 자기 `width`/`height`를 들고 있어 부모 크기를 무시한다. `.hwpx-page > svg { width: 100% }`로 맞춘다.
- `.fade-up` 같은 애니메이션 클래스의 `transform`이 인라인 `scale()`을 덮어쓴다. 크기 맞춤은 `transform` 대신 `aspect-ratio`를 쓴다.
- 국내 여행은 동행 보호자 칸(`{17}`~`{19}`)을 비운다. 해외일 때만 채운다.
