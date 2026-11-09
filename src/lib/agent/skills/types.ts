/**
 * 에이전트 스킬: Agent Skills 표준(SKILL.md)과 같은 구조의 지침 묶음.
 * 시스템 프롬프트에는 name 과 description 만 싣고, 본문(body)은 모델이 load_skill 로 필요할 때만 불러간다.
 * 그래서 스킬을 늘려도 매 요청의 프롬프트가 커지지 않는다.
 */
export type SkillAgent = 'trip' | 'half-day';

export type AgentSkill = {
  /** load_skill 에 넘기는 식별자. 소문자와 하이픈. */
  name: string;
  /** 이 스킬을 카탈로그에 올릴 에이전트. 생략하면 모두에게 보인다. */
  agents?: readonly SkillAgent[];
  /** 언제 이 스킬을 불러야 하는지. 모델이 이 문장만 보고 고른다. */
  description: string;
  /** 마크다운 본문. */
  body: string;
};
