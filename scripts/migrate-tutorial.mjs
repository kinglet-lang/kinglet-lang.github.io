#!/usr/bin/env node
// Migrate Obsidian tutorial notes into Astro content collection entries.

import fs from 'node:fs';
import path from 'node:path';

const SRC_DIR = '/home/sentomk/Documents/kinglet/tutorial';
const DST_DIR = '/home/sentomk/Code/kinglet-lang/kinglet-lang.github.io/src/content/docs/zh';

fs.mkdirSync(DST_DIR, { recursive: true });

const sectionOf = (id) => {
  const n = parseInt(id.split('-')[0], 10);
  if (n <= 2) return 'start';
  if (n <= 5) return 'types';
  if (n <= 9) return 'semantics';
  return 'system';
};

const files = fs.readdirSync(SRC_DIR)
  .filter(f => f.endsWith('.md') && /^\d/.test(f))
  .sort();

const chapters = new Set(files.map(f => f.replace(/\.md$/, '')));

const rewriteWikilinks = (body) => body.replace(/\[\[([^\]]+)\]\]/g, (_, inner) => {
  const [rawTarget, rawLabel] = inner.split('|');
  const label = (rawLabel ?? rawTarget).trim();
  const target = rawTarget.trim();
  const chapterMatch = target.match(/^([0-9]{2}-[a-z-]+)(#.*)?$/i);
  if (chapterMatch) {
    const [, slug, anchor = ''] = chapterMatch;
    if (chapters.has(slug)) return `[${label}](/zh/docs/${slug}${anchor})`;
  }
  return label;
});

const stripFrontmatter = (raw) => {
  if (!raw.startsWith('---')) return { fm: {}, body: raw };
  const end = raw.indexOf('\n---', 3);
  if (end === -1) return { fm: {}, body: raw };
  const fmBlock = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).replace(/^\n+/, '');
  const fm = {};
  for (const line of fmBlock.split('\n')) {
    const m = line.match(/^([A-Za-z_-]+):\s*"?(.*?)"?\s*$/);
    if (m && !line.startsWith('  ')) fm[m[1]] = m[2];
  }
  return { fm, body };
};

const stripLeadingH1 = (body) => {
  const lines = body.split('\n');
  const idx = lines.findIndex(l => l.trim() !== '');
  if (idx >= 0 && /^#\s+/.test(lines[idx])) {
    lines.splice(idx, 1);
    while (lines.length && lines[0].trim() === '') lines.shift();
  }
  return lines.join('\n');
};

// Escape lone {/} outside fenced code so MDX doesn't parse them as JSX expressions.
const escapeBracesOutsideCode = (body) => {
  const parts = body.split(/(```[\s\S]*?```)/g);
  return parts.map((part, i) => {
    if (i % 2 === 1) return part;
    return part.replace(/[{}]/g, (ch) => (ch === '{' ? '\\{' : '\\}'));
  }).join('');
};

let order = 10;
for (const f of files) {
  const id = f.replace(/\.md$/, '');
  const raw = fs.readFileSync(path.join(SRC_DIR, f), 'utf8');
  const { fm, body } = stripFrontmatter(raw);
  const bodyNoH1 = stripLeadingH1(body);
  const rewritten = rewriteWikilinks(bodyNoH1);
  const safeBody = escapeBracesOutsideCode(rewritten);
  const title = fm.title ?? id;
  const section = sectionOf(id);
  const front = [
    '---',
    `title: "${title.replace(/"/g, '\\"')}"`,
    `order: ${order}`,
    `section: "${section}"`,
    'locale: "zh"',
    '---',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(DST_DIR, `${id}.mdx`), front + safeBody);
  order += 10;
}

console.log(`Migrated ${files.length} chapters to ${DST_DIR}`);
