import type { PlaceRegion, PlaceSuggestion } from './types';

const DOMESTIC: PlaceSuggestion[] = [
  { name: '국립중앙박물관', category: '박물관·미술관', address: '서울 용산구 서빙고로 137' },
  { name: '국립민속박물관', category: '박물관·미술관', address: '서울 종로구 삼청로 37' },
  { name: '국립현대미술관 서울', category: '박물관·미술관', address: '서울 종로구 삼청로 30' },
  { name: '국립한글박물관', category: '박물관·미술관', address: '서울 용산구 서빙고로 139' },
  { name: '국립과천과학관', category: '과학관', address: '경기 과천시 상하벌로 110' },
  { name: '국립중앙과학관', category: '과학관', address: '대전 유성구 대덕대로 481' },
  { name: '서울시립과학관', category: '과학관', address: '서울 노원구 한글비석로 160' },
  { name: '경주 불국사', category: '역사 유적지', address: '경북 경주시 불국로 385' },
  { name: '수원화성', category: '역사 유적지', address: '경기 수원시 팔달구 정조로 910' },
  { name: '경복궁', category: '역사 유적지', address: '서울 종로구 사직로 161' },
  { name: '창덕궁', category: '역사 유적지', address: '서울 종로구 율곡로 99' },
  { name: '독립기념관', category: '역사 유적지', address: '충남 천안시 동남구 남부대로 1' },
  { name: '한국민속촌', category: '체험 농장', address: '경기 용인시 기흥구 민속촌로 90' },
  { name: '설악산국립공원', category: '국립공원·자연', address: '강원 속초시 설악산로 833' },
  { name: '한라산국립공원', category: '국립공원·자연', address: '제주 제주시 1100로 2070-61' },
  { name: '지리산국립공원', category: '국립공원·자연', address: '전남 구례군 토지면 내동로 268' },
  { name: '순천만국가정원', category: '국립공원·자연', address: '전남 순천시 국가정원1호길 47' },
  { name: '제주 성산일출봉', category: '국립공원·자연', address: '제주 서귀포시 성산읍 일출로 284-12' },
  { name: '국회의사당', category: '공공기관', address: '서울 영등포구 의사당대로 1' },
  { name: '서울시청', category: '공공기관', address: '서울 중구 세종대로 110' },
  { name: '대한민국역사박물관', category: '박물관·미술관', address: '서울 종로구 세종대로 198' },
  { name: '삼성 이노베이션 뮤지엄', category: '기업·직업 체험', address: '경기 수원시 영통구 삼성로 129' },
  { name: '키자니아 서울', category: '기업·직업 체험', address: '서울 송파구 양재대로 71' },
  { name: '현대자동차 울산공장', category: '기업·직업 체험', address: '울산 북구 염포로 700' },
];

const OVERSEAS: PlaceSuggestion[] = [
  { name: '일본 도쿄', category: '해외', address: '일본 도쿄도' },
  { name: '일본 오사카', category: '해외', address: '일본 오사카부' },
  { name: '일본 교토', category: '해외', address: '일본 교토부' },
  { name: '베트남 다낭', category: '해외', address: '베트남 다낭' },
  { name: '베트남 하노이', category: '해외', address: '베트남 하노이' },
  { name: '싱가포르', category: '해외', address: '싱가포르' },
  { name: '대만 타이베이', category: '해외', address: '대만 타이베이' },
  { name: '태국 방콕', category: '해외', address: '태국 방콕' },
  { name: '미국 뉴욕', category: '해외', address: '미국 뉴욕주' },
  { name: '미국 로스앤젤레스', category: '해외', address: '미국 캘리포니아주' },
  { name: '미국 워싱턴 D.C.', category: '해외', address: '미국 워싱턴 D.C.' },
  { name: '영국 런던', category: '해외', address: '영국 런던' },
  { name: '프랑스 파리', category: '해외', address: '프랑스 파리' },
  { name: '독일 베를린', category: '해외', address: '독일 베를린' },
  { name: '이탈리아 로마', category: '해외', address: '이탈리아 로마' },
  { name: '스페인 바르셀로나', category: '해외', address: '스페인 카탈루냐' },
  { name: '호주 시드니', category: '해외', address: '호주 뉴사우스웨일스주' },
  { name: '캐나다 밴쿠버', category: '해외', address: '캐나다 브리티시컬럼비아주' },
  { name: '중국 베이징', category: '해외', address: '중국 베이징' },
  { name: '아랍에미리트 두바이', category: '해외', address: '아랍에미리트 두바이' },
];

export function searchPlaces(
  region: PlaceRegion,
  query: string,
  limit = 6
): PlaceSuggestion[] {
  const pool = region === 'domestic' ? DOMESTIC : OVERSEAS;
  const trimmed = query.trim();
  if (trimmed === '') return pool.slice(0, limit);

  const normalized = trimmed.replaceAll(' ', '').toLowerCase();
  const matches = (value: string) =>
    value.replaceAll(' ', '').toLowerCase().includes(normalized);

  return pool
    .filter((place) => matches(place.name) || matches(place.category) || matches(place.address))
    .slice(0, limit);
}
