import 'server-only';

import { halfDayPlanning } from './half-day-planning';
import { linkToApplication } from './link-to-application';
import type { AgentSkill, SkillAgent } from './types';
import { webFallbacks } from './web-fallbacks';
import { webReading } from './web-reading';
import { webSearch } from './web-search';

export type { AgentSkill, SkillAgent } from './types';

/**
 * 새 스킬은 이 목록에 파일 하나와 한 줄만 더하면 된다.
 * 본문을 런타임에 디스크에서 읽지 않고 모듈로 묶는 이유: 배포 이미지에 .md 파일이 따라가는지 신경 쓰지 않으려고.
 */
const SKILLS: readonly AgentSkill[] = [linkToApplication, halfDayPlanning, webReading, webSearch, webFallbacks];

export const SKILL_NAMES = SKILLS.map((skill) => skill.name) as [string, ...string[]];

export function getSkill(name: string): AgentSkill | undefined {
  return SKILLS.find((skill) => skill.name === name);
}

/** 시스템 프롬프트에 싣는 카탈로그: 이름과 설명만. 본문은 load_skill 이 돌려준다. 에이전트에 맞는 스킬만 보여준다. */
export function buildSkillCatalog(agent: SkillAgent = 'trip'): string {
  return [
    'Skills are short how-to guides. Their bodies are not loaded until you call load_skill with the exact name. Load a skill when its description matches the task, once per conversation, before you use the tools it explains.',
    ...SKILLS.filter((skill) => skill.agents === undefined || skill.agents.includes(agent)).map(
      (skill) => `- ${skill.name}: ${skill.description}`
    ),
  ].join('\n');
}
