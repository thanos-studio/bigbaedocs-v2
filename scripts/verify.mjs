#!/usr/bin/env node
/*
 * graphite verify - static checks for the mistakes that survive tsc and eslint.
 *
 *   node scripts/verify.mjs            # scan ./src
 *   node scripts/verify.mjs app lib    # scan specific roots
 *
 * Exits non-zero on any error, so it works as a pre-commit gate. The point is
 * that "I checked the hover states" becomes a command with an exit code instead
 * of a claim - every rule here corresponds to a bug that shipped at least once.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const ROOTS = process.argv.slice(2).length ? process.argv.slice(2) : ['src'];
const CODE = new Set(['.tsx', '.ts', '.jsx', '.js']);
const SKIP_DIR = new Set(['node_modules', '.next', '.git', 'dist', 'build', 'coverage', 'out']);

const FZ = new Set([34, 24, 21, 15, 14, 13, 12]);
const RADIUS = new Set([6, 8, 12, 16, 999, 0]);

const errors = [];
const warnings = [];

const add = (list, file, line, rule, msg, hint) =>
  list.push({ file, line, rule, msg, hint });

/* Strip comments and string bodies so we do not lint prose or CSS-in-docs.
 * Keeps offsets stable by substituting same-length runs of spaces. */
const blank = (s) => ' '.repeat(s.length);
function stripNoise(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + blank(m.slice(p.length)));
}

function lineOf(src, index) {
  return src.slice(0, index).split('\n').length;
}

/*
 * End of a JSX opening tag. Counting brace depth is required: `onClick={() =>
 * fn()}` contains a `>` that is not the tag end, and reading it as one leaves
 * attribute text inside what you think is the element body.
 */
function tagEnd(src, start) {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth <= 0) return i;
  }
  return -1;
}

function walk(dir, exts, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (SKIP_DIR.has(name)) continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, exts, out);
    else if (exts.has(extname(name))) out.push(full);
  }
  return out;
}

/* ------------------------------------------------------------------ rules -- */

function checkFile(file, raw) {
  const src = stripNoise(raw);
  const rel = relative(process.cwd(), file);

  /*
   * graphite's own files are exempt from the colour rules: theme.ts holds the
   * RAW hex map by design, and components/ is where the g-* classes are applied.
   * Matched on filename rather than directory, since projects place these
   * wherever they like (src/lib/graphite, src/design, app/ui, ...).
   */
  const base = rel.split(/[\\/]/).pop() ?? '';
  const isTheme = base === 'theme.ts';
  const isGraphiteComponent =
    /[\\/]components[\\/]/.test(rel) &&
    /^(?:Button|Chip|Card|Option|Tabs|index)\.tsx?$/.test(base);
  const isOwnSource = isTheme || isGraphiteComponent || base === 'use-leaving.ts';

  /* Hardcoded colour. The single biggest cause of a drifting palette: one grey
   * from Tailwind slate, one from Mantine, and the UI looks assembled. */
  if (!isOwnSource) {
    for (const m of src.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
      add(errors, rel, lineOf(src, m.index), 'no-raw-hex', `hardcoded colour ${m[0]}`,
        'import the token from graphite/theme, or RAW.* if a CSS variable cannot resolve');
    }
    for (const m of src.matchAll(/\b(?:rgb|rgba|hsl|hsla)\(/g)) {
      add(errors, rel, lineOf(src, m.index), 'no-raw-colour', `raw ${m[0]}`,
        'use a token; ON_INK_SUB already covers translucent white on ink');
    }
  }

  /* Off-scale type. 17/19/11px are the sizes that crept in last time. */
  for (const m of src.matchAll(/fontSize:\s*(\d+)\b/g)) {
    const n = Number(m[1]);
    if (!FZ.has(n))
      add(errors, rel, lineOf(src, m.index), 'type-scale', `fontSize: ${n} is off-scale`,
        `use FZ.* (${[...FZ].join('/')}) - round to the nearest step rather than adding one`);
  }
  for (const m of src.matchAll(/borderRadius:\s*(\d+)\b/g)) {
    const n = Number(m[1]);
    if (!RADIUS.has(n))
      add(warnings, rel, lineOf(src, m.index), 'radius-scale', `borderRadius: ${n} is off-scale`,
        'use R.* - 8 for rectangles, R.pill for chips, R.panel/R.card for containers');
  }

  /* Inline background on a g-* element. Outranks the class :hover rule, so the
   * element silently stops responding. Cost us two real bugs. */
  for (const m of src.matchAll(/className\s*=\s*(?:"([^"]*)"|\{`([^`]*)`)/g)) {
    const cls = m[1] ?? m[2] ?? '';
    if (!/\bg-(?:chip|btn|option|card-link|tab)\b|\bg-(?:chip|btn|option|card|tab)[a-z-]*/.test(cls))
      continue;
    /* Look at the enclosing JSX tag, not the whole file. */
    const open = src.lastIndexOf('<', m.index);
    const close = tagEnd(src, open);
    const tag = src.slice(open, close < 0 ? m.index : close);
    if (/\bbackgroundColor\s*:/.test(tag) || /\bbackground\s*:/.test(tag))
      add(errors, rel, lineOf(src, m.index), 'inline-bg-kills-hover',
        `inline background on .${cls.trim().split(/\s+/)[0]}`,
        'let the class own background; inline styles outrank :hover and disable it');
  }

  /* Entrance animation pinned with fill-mode both - freezes opacity/transform
   * forever and makes every exit transition invisible. In TSX the value is
   * almost always a quoted string, so quotes must stay inside the match. */
  for (const m of src.matchAll(/animation(?:Name)?\s*:\s*['"`][^'"`\n]*\bboth\b/g)) {
    add(errors, rel, lineOf(src, m.index), 'fill-mode-both',
      'animation uses fill-mode `both`',
      'use `backwards` - `both` pins the end state and outranks exit transitions');
  }

  /* Animated state folded into key. Remounts instead of transitioning, so the
   * exit animation never plays. */
  for (const m of src.matchAll(/key=\{`[^`]*\$\{[^}]*\b(?:open|opened|leaving|visible|active|show|expanded|selected)\b/gi)) {
    add(errors, rel, lineOf(src, m.index), 'state-in-key',
      'animated state inside key',
      'keys must be stable entity ids; a changing key destroys the exit animation');
  }

  /* Native title tooltip - unstyled, and roughly a second late. */
  for (const m of src.matchAll(/<[a-zA-Z][^>]*?\stitle=(?:"|\{)/g)) {
    if (/<(?:title|head|html|svg|path)\b/i.test(m[0])) continue;
    add(warnings, rel, lineOf(src, m.index), 'no-native-title', 'native title= tooltip',
      'use Mantine Tooltip with TOOLTIP_PROPS');
  }

  /* Icon-only control with no accessible name. The Button component makes this
   * impossible, so a hit here means hand-rolled markup.
   *
   * Scanned per opening tag rather than with one <button>...</button> regex:
   * a greedy pair match starting at an earlier button swallows the ones after
   * it, and those are exactly the cases worth catching. */
  for (const open of src.matchAll(/<button\b/g)) {
    const headEnd = tagEnd(src, open.index);
    if (headEnd < 0) continue;
    const head = src.slice(open.index, headEnd + 1);
    if (/aria-label|aria-labelledby/.test(head)) continue;

    const bodyEnd = src.indexOf('</button>', headEnd);
    if (bodyEnd < 0) continue;
    const body = src.slice(headEnd + 1, bodyEnd);
    /* Nested buttons would make this body span two controls; skip rather than
     * guess which one lacks a label. */
    if (/<button\b/.test(body)) continue;

    const text = body.replace(/<[^>]*>/g, '').replace(/\{[^}]*\}/g, '').trim();
    const hasText = /[A-Za-z0-9\u3131-\uD79D]/.test(text);
    const hasGlyph = /<(?:svg|Icon[A-Z]\w*)\b/.test(body);
    if (!hasText && hasGlyph)
      add(errors, rel, lineOf(src, open.index), 'icon-button-needs-label',
        'icon-only button without aria-label',
        'use <Button iconOnly aria-label="..."> - the component requires it at compile time');
  }

  /* Reintroducing the deleted presets, or the global hover rule they needed. */
  if (!isOwnSource) {
    for (const m of src.matchAll(/\b(BTN_SOLID|BTN_OUTLINE|BTN_GHOST|BTN_DANGER|BTN_DISABLED|BTN_SM|BTN_ICON|CHIP_ADD|CHIP_ACTION)\b/g)) {
      add(errors, rel, lineOf(src, m.index), 'removed-preset', `${m[0]} no longer exists`,
        'use the component: <Button variant="..."> / <Chip> / <ChipAdd> / <ChipAction>');
    }
  }
}

/*
 * graphite's own stylesheets legitimately declare backgrounds and set the
 * global border-style reset, so only the rules that are always wrong apply.
 */
const GRAPHITE_CSS = new Set([
  'index.css', 'tokens.css', 'base.css', 'motion.css', 'button.css', 'chip.css',
  'tab.css', 'surface.css', 'scroll.css', 'markdown.css', 'route.css', 'utility.css',
]);

function checkCss(file, raw) {
  const rel = relative(process.cwd(), file);
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, blank);
  const base = rel.split(/[\\/]/).pop() ?? '';

  for (const m of src.matchAll(/animation:[^;]*\bboth\b/g)) {
    /* View-transition pseudo-elements legitimately need both. */
    const ctx = src.slice(Math.max(0, m.index - 200), m.index);
    if (/::view-transition/.test(ctx)) continue;
    add(errors, rel, lineOf(src, m.index), 'fill-mode-both',
      'animation uses fill-mode `both`',
      'use `backwards`; `both` pins the end state and kills exit transitions');
  }

  if (/^\s*button\s*:hover/m.test(src))
    add(errors, rel, lineOf(src, src.search(/^\s*button\s*:hover/m)), 'global-button-hover',
      'global button:hover rule',
      'it bleeds into every button and then needs !important to undo - opt in per class');

  /*
   * Interaction tints, measured rather than eyeballed. Perceived brightness is
   * ~0.2126R + 0.7152G + 0.0722B, and a step under ~12/255 from the page does
   * not register - #ffe3e3 looks clearly pink yet measured 8.8 and users
   * reported the button felt dead. Press must also be darker than hover, which
   * an earlier build got backwards by reusing a lighter token.
   */
  if (base === 'tokens.css') {
    const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const parse = (v) => {
      const hex = v.match(/#([0-9a-fA-F]{6})/);
      if (hex) {
        const n = parseInt(hex[1], 16);
        return { rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], alpha: 1 };
      }
      const rgba = v.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+))?/);
      if (rgba)
        return {
          rgb: [+rgba[1], +rgba[2], +rgba[3]],
          alpha: rgba[4] === undefined ? 1 : +rgba[4],
        };
      return null;
    };
    const vars = new Map();
    for (const m of src.matchAll(/(--g-[\w-]+)\s*:\s*([^;]+);/g)) vars.set(m[1], m[2].trim());

    const pageRaw = parse(vars.get('--g-page') ?? '#f0f2f5');
    const page = pageRaw ? pageRaw.rgb : [240, 242, 245];
    const surfaceRaw = parse(vars.get('--g-surface') ?? '#ffffff');
    const white = surfaceRaw ? surfaceRaw.rgb : [255, 255, 255];
    /* Composite alpha over the given surface - that is what the eye receives. */
    const flat = (v, over) => {
      const p = parse(v);
      if (!p) return null;
      return p.rgb.map((c, i) => c * p.alpha + over[i] * (1 - p.alpha));
    };

    /*
     * Each pair is measured against the surface it actually sits on. Opaque
     * greys are used on white cards and chips; alpha tints sit on the page
     * background. Measuring both against the page produced a false positive on
     * --g-hover, which renders at 19.4 in situ.
     */
    const pairs = [
      ['--g-ink-tint', '--g-ink-tint-strong', 'transparent controls', page],
      ['--g-hover', '--g-active', 'opaque surfaces', white],
      ['--g-danger-hover', '--g-danger-active', 'destructive controls', page],
    ];
    for (const [hoverVar, pressVar, label, against] of pairs) {
      const h = vars.has(hoverVar) ? flat(vars.get(hoverVar), against) : null;
      const p = vars.has(pressVar) ? flat(vars.get(pressVar), against) : null;
      if (!h || !p) continue;
      const dHover = Math.abs(lum(against) - lum(h));
      if (dHover < 12)
        add(errors, rel, lineOf(src, src.indexOf(hoverVar)), 'hover-too-subtle',
          `${hoverVar} is only ${dHover.toFixed(1)}/255 from its surface (${label})`,
          'needs >= 12 to be perceived; high-chroma tints measure far lower than they look');
      if (lum(p) >= lum(h))
        add(errors, rel, lineOf(src, src.indexOf(pressVar)), 'press-not-darker',
          `${pressVar} is not darker than ${hoverVar} (${label})`,
          'press must go darker than hover, or the feedback reads as inverted');
    }
  }
}

/* ------------------------------------------------------------------- run -- */

const code = ROOTS.flatMap((r) => walk(r, CODE));
const css = ROOTS.flatMap((r) => walk(r, new Set(['.css'])));

if (code.length + css.length === 0) {
  console.error(`graphite verify: nothing to check under ${ROOTS.join(', ')}`);
  process.exit(2);
}

for (const f of code) checkFile(f, readFileSync(f, 'utf8'));
for (const f of css) checkCss(f, readFileSync(f, 'utf8'));

const fmt = (list, label) => {
  if (!list.length) return;
  console.log(`\n${label} (${list.length})\n`);
  const byRule = new Map();
  for (const e of list) {
    if (!byRule.has(e.rule)) byRule.set(e.rule, []);
    byRule.get(e.rule).push(e);
  }
  for (const [rule, items] of byRule) {
    console.log(`  ${rule}`);
    console.log(`    ${items[0].hint}`);
    for (const it of items.slice(0, 12)) console.log(`    ${it.file}:${it.line}  ${it.msg}`);
    if (items.length > 12) console.log(`    ... and ${items.length - 12} more`);
    console.log('');
  }
};

console.log(`graphite verify - ${code.length + css.length} files under ${ROOTS.join(', ')}`);
fmt(errors, 'ERRORS');
fmt(warnings, 'WARNINGS');

if (errors.length === 0 && warnings.length === 0) console.log('\nclean\n');
else console.log(`${errors.length} error(s), ${warnings.length} warning(s)\n`);

process.exit(errors.length ? 1 : 0);
