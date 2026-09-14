import type { Plugin } from 'unified';
import type { Root, Text } from 'mdast';
import { visit } from 'unist-util-visit';

/**
 * CommonMark는 닫는 `**` 앞이 구두점이고 뒤에 바로 문자가 오면 강조를 닫지 않는다.
 * 그래서 `**스누피(Snoopy)**가`처럼 LLM이 흔히 쓰는 문장이 별표째로 노출된다.
 * (영문도 동일: `**Snoopy(dog)**is`)
 * 파싱이 끝난 뒤 남은 `**...**`를 strong으로 바꿔 이 경우만 되살린다.
 */
const PAIRED_STARS = /\*\*(?=\S)([\s\S]*?\S)\*\*/g;

export const remarkLooseBold: Plugin<[], Root> = () => (tree) => {
  visit(tree, 'text', (node: Text, index, parent) => {
    if (!parent || index === undefined) return;
    if (!node.value.includes('**')) return;

    const children: (Text | { type: 'strong'; children: Text[] })[] = [];
    let cursor = 0;

    for (const match of node.value.matchAll(PAIRED_STARS)) {
      const start = match.index;
      if (start === undefined) continue;

      if (start > cursor) {
        children.push({ type: 'text', value: node.value.slice(cursor, start) });
      }
      children.push({ type: 'strong', children: [{ type: 'text', value: match[1] }] });
      cursor = start + match[0].length;
    }

    if (children.length === 0) return;
    if (cursor < node.value.length) {
      children.push({ type: 'text', value: node.value.slice(cursor) });
    }

    parent.children.splice(index, 1, ...children);
    return index + children.length;
  });
};
