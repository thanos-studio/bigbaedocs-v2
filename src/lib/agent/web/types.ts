export type WebProvider = 'exa' | 'firecrawl' | 'direct';

/** 어떤 제공자가 왜 실패했는지. 모델과 화면이 "무엇으로 대체했는지" 알 수 있게 결과에 같이 싣는다. */
export type WebAttempt = { provider: WebProvider; error: string };

export type ReadOptions = {
  url: string;
  /** 페이지당 최대 글자 수. */
  maxCharacters?: number;
  /** 이 질문에 맞는 부분 위주로 뽑는다(Exa API 키가 있을 때 highlights 로 반영). */
  query?: string;
  /**
   * 콘텐츠 신선도(Exa maxAgeHours 와 같은 의미).
   * 생략 = 캐시가 있으면 쓰고 없으면 가져옴, 양수 = 그 시간보다 오래된 캐시는 버림,
   * 0 = 항상 새로 가져옴, -1 = 캐시만.
   */
  maxAgeHours?: number;
  /** 시작 페이지에서 따라갈 하위 페이지 수(0~10). */
  subpages?: number;
  /** 하위 페이지를 고를 때 우선할 키워드(URL에 들어 있으면 가산점). */
  subpageTarget?: string[];
  /** 페이지에서 돌려받을 이미지 URL 수(0~20). */
  images?: number;
};

export type WebSubpage = { url: string; title: string | null; text: string };

export type WebPage = {
  url: string;
  title: string | null;
  text: string;
  provider: WebProvider;
  publishedDate?: string | null;
  image?: string | null;
  favicon?: string | null;
  images?: string[];
  /** 본문이 최신인지: live = 방금 가져옴, cached = 캐시, unknown = 제공자가 알려주지 않음. */
  freshness: 'live' | 'cached' | 'unknown';
  truncated: boolean;
  subpages?: WebSubpage[];
  /** 하위 페이지 크롤에 쓰는 링크. 모델에게는 내보내지 않는다. */
  links?: string[];
};

export type ReadResult = WebPage & { notes: string[]; attempts: WebAttempt[] };

export type SearchOptions = {
  query: string;
  /** 이번 검색의 목적. 어떤 문서가 먼저 와야 하고 어떤 사실을 뽑을지 적는다(Exa 권장). */
  objective: string;
  numResults?: number;
  type?: 'auto' | 'lite';
  category?: 'company' | 'publication' | 'news' | 'pdf' | 'github' | 'personal site' | 'people' | 'financial report';
  includeDomains?: string[];
  excludeDomains?: string[];
  /** ISO 8601 날짜(YYYY-MM-DD). 발행일 기준 하드 필터. */
  startPublishedDate?: string;
  endPublishedDate?: string;
  /** 두 글자 국가 코드. 예: KR */
  country?: string;
  /** 결과 페이지 본문 신선도. 발행일 필터가 아니다. */
  maxAgeHours?: number;
  /** 지정하면 하이라이트 대신 페이지 본문을 이만큼 가져온다. */
  textMaxCharacters?: number;
  subpages?: number;
  subpageTarget?: string[];
};

export type SearchHit = {
  title: string | null;
  url: string;
  publishedDate: string | null;
  snippets: string[];
  image?: string | null;
  favicon?: string | null;
  subpages?: WebSubpage[];
};

export type SearchResult = {
  query: string;
  provider: WebProvider;
  results: SearchHit[];
  notes: string[];
  attempts: WebAttempt[];
};

export type ParsedDocument = {
  name: string;
  text: string;
  provider: 'firecrawl';
  truncated: boolean;
  pages?: number;
};

export type ParseOptions = {
  maxCharacters?: number;
  /** PDF 에서 읽을 최대 쪽수. */
  maxPages?: number;
  /** 개인정보(이름, 연락처 등)를 가린 채로 받는다. */
  redactPII?: boolean;
};
