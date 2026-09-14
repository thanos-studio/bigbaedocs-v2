/** 모델이 지침을 어겨도 .hwp에 리터럴 \n이나 목록 기호가 남지 않도록 하는 방어선. */
export function sanitizeProse(value: string): string {
  return value
    .replace(/\\r\\n|\\n|\\r/g, '\n')
    .split('\n')
    .map((line) =>
      line
        .replace(/^\s*(?:[-*+•·▶‣–—]|\d+[.)])\s+/, '')
        .replace(/^#{1,6}\s+/, '')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/[※▶→←↑↓•·‣]/g, '')
        .replace(/[ \t]{2,}/g, ' ')
        .trim()
    )
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export const PROSE_FORMAT_RULES = [
  '실제 줄바꿈만 쓴다. 백슬래시 n 같은 문자를 그대로 쓰지 않는다.',
  '마크다운과 장식을 쓰지 않는다. 별표, 줄 앞 하이픈이나 불릿, 번호 목록 기호, 해시 제목, 백틱, 표를 모두 금지한다.',
  '·, •, ※, ▶, →, 이모지 같은 특수기호를 쓰지 않는다.',
  '문장부호는 마침표와 쉼표만 쓴다.',
] as const;

export const BANNED_PHRASES = [
  '먼저',
  '또한',
  '마지막으로',
  '이번 체험학습을 통해',
  '함양',
  '뜻깊은',
  '소중한 시간',
  '값진',
  '알찬',
] as const;

export function purposeRules(formalTone: boolean, singleSentence = false): string[] {
  const tone = formalTone ? '~합니다 체의 자연스러운 존댓말' : '~했다 체의 간결한 서술체';
  return [
    singleSentence
      ? `체험 목적을 정확히 한 문장으로 ${tone}로 쓴다. 두 문장 이상 쓰지 않는다.`
      : `체험 목적을 한두 문장으로 ${tone}로 쓴다.`,
    '무엇을 배우려는지 구체적으로 쓴다. 막연한 감상이나 미사여구를 넣지 않는다.',
  ];
}

export function planRules(formalTone: boolean): string[] {
  return [
    `활동 계획을 미래형으로 쓴다. ${formalTone ? '~할 예정입니다, ~할 계획입니다' : '~할 예정이다, ~할 계획이다'} 형태를 쓴다.`,
    '활동 내용만 쓴다. 일자와 기간은 절대 포함하지 않는다.',
    '1일차, 2일차, 첫째 날, 이틀째 같은 날짜 구분 표현을 절대 쓰지 않는다. 오전, 오후, 마지막 날도 쓰지 않는다.',
    '번호나 순서를 매기지 않고, 이어지는 산문 두세 문장으로 쓴다.',
  ];
}

export function experienceRules(formalTone: boolean): string[] {
  return [
    `다녀온 활동을 과거형으로 쓴다. ${formalTone ? '~했습니다, ~였습니다' : '~했다, ~였다'} 형태를 쓴다.`,
    '실제로 무엇을 보고 했는지 구체적으로 쓴다. 계획이나 예정을 쓰지 않는다.',
    '활동 내용만 쓴다. 일자와 기간은 절대 포함하지 않는다.',
    '1일차, 2일차, 첫째 날, 이틀째 같은 날짜 구분 표현을 절대 쓰지 않는다. 오전, 오후, 마지막 날도 쓰지 않는다.',
    '번호나 순서를 매기지 않고, 이어지는 산문 두세 문장으로 쓴다.',
  ];
}

export function reflectionRules(formalTone: boolean): string[] {
  return [
    `느낀 점을 과거형으로 쓴다. ${formalTone ? '~했습니다, ~같았습니다' : '~했다, ~같았다'} 형태를 쓴다.`,
    '체험내용에서 본 것과 연결해서 무엇을 새로 알았고 어떻게 느꼈는지 쓴다.',
    '학생이 직접 쓴 것처럼 솔직하고 담백하게 쓴다. 과장된 다짐이나 교훈으로 끝맺지 않는다.',
    '번호나 순서를 매기지 않고, 이어지는 산문 두세 문장으로 쓴다.',
  ];
}

export function antiSlopRules(): string[] {
  return [
    'AI가 쓴 것처럼 보이는 표현을 절대 쓰지 않는다.',
    `다음 표현을 금지한다: ${BANNED_PHRASES.join(', ')}.`,
    '사용자가 언급한 실제 장소와 활동에 맞춰 구체적으로 쓴다. 일반적인 교육 문구로 늘리지 않는다.',
  ];
}
