#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..');
const REPO = process.env.KINGLET_RELEASE_REPO ?? 'kinglet-lang/bootstrap';
const args = process.argv.slice(2);
const valueAfter = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};
const tag = valueAfter('--tag');
const check = args.includes('--check');

if (!tag || !/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tag)) {
  console.error('usage: pnpm sync:release --tag v0.1.0 [--check]');
  process.exit(2);
}

const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'kinglet-site-release-sync',
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
};

async function fetchText(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.text();
}

async function fetchJson(url) {
  return JSON.parse(await fetchText(url));
}

const release = await fetchJson(`https://api.github.com/repos/${REPO}/releases/tags/${tag}`);
if (release.draft) throw new Error(`${tag} is still a draft release`);
if (release.tag_name !== tag) throw new Error(`release tag mismatch: ${release.tag_name} != ${tag}`);
if (!release.published_at) throw new Error(`${tag} has no published_at timestamp`);

const sourceUrl = `https://github.com/${REPO}/blob/${tag}/docs/changelog/${tag}.md`;
const rawSourceUrl = `https://raw.githubusercontent.com/${REPO}/${tag}/docs/changelog/${tag}.md`;
const source = (await fetchText(rawSourceUrl)).replace(/\r\n/g, '\n');
const expectedTitle = `Kinglet ${tag}`;
const firstLine = source.split('\n', 1)[0];
if (firstLine !== `# ${expectedTitle}`) {
  throw new Error(`release-note title mismatch: expected "# ${expectedTitle}", got "${firstLine}"`);
}
const body = source.replace(/^# .+\n+/, '').trimEnd();
const firstParagraph = body.split(/\n\s*\n/, 1)[0].replace(/\s*\n\s*/g, ' ').trim();
const description = firstParagraph;
const sourceSha256 = createHash('sha256').update(source).digest('hex');

const assetByName = new Map(release.assets.map((asset) => [asset.name, asset]));
const sumsAsset = assetByName.get('SHA256SUMS');
if (!sumsAsset) throw new Error(`${tag} does not publish SHA256SUMS`);
const sumsText = await fetchText(sumsAsset.browser_download_url, { headers: { Accept: 'application/octet-stream' } });
const sums = new Map();
for (const line of sumsText.trim().split('\n')) {
  const match = line.match(/^([0-9a-f]{64})\s+\*?(.+)$/i);
  if (!match) throw new Error(`invalid SHA256SUMS line: ${line}`);
  sums.set(match[2], match[1].toLowerCase());
}

const platformDefs = {
  'windows-x64': { file: 'kinglet-windows-x64.tar.gz', note: 'Windows 10+' },
  'macos-arm64': { file: 'kinglet-macos-arm64.tar.gz', note: 'Apple Silicon' },
  'linux-x64': { file: 'kinglet-linux-x64.tar.gz', note: 'glibc 2.31+' },
};
const assets = {};
for (const [platform, definition] of Object.entries(platformDefs)) {
  const asset = assetByName.get(definition.file);
  const sha256 = sums.get(definition.file);
  if (!asset) throw new Error(`${tag} is missing ${definition.file}`);
  if (!sha256) throw new Error(`SHA256SUMS is missing ${definition.file}`);
  assets[platform] = {
    file: definition.file,
    size: `${(asset.size / 1_000_000).toFixed(1)} MB`,
    sha256,
    note: definition.note,
  };
}

const releasesPath = path.join(ROOT, 'src/data/releases.json');
const releaseData = JSON.parse(await readFile(releasesPath, 'utf8'));
const record = {
  version: tag.slice(1),
  tag,
  date: release.published_at.slice(0, 10),
  githubReleaseUrl: release.html_url,
  releaseNotesUrl: `/releases/${tag}/`,
  assets,
};
const withoutCurrent = releaseData.releases.filter((entry) => entry.tag !== tag);
releaseData.releases = [record, ...withoutCurrent]
  .sort((a, b) => b.date.localeCompare(a.date) || b.version.localeCompare(a.version));
if (!release.prerelease) releaseData.current = tag;
const expectedJson = `${JSON.stringify(releaseData, null, 2)}\n`;

const notePath = path.join(ROOT, 'src/content/releases/en', `${tag}.md`);
const expectedNote = `---\nversion: ${JSON.stringify(tag.slice(1))}\ntag: ${JSON.stringify(tag)}\ntitle: ${JSON.stringify(expectedTitle)}\ndescription: ${JSON.stringify(description)}\npubDate: ${JSON.stringify(release.published_at.slice(0, 10))}\nlocale: en\nchannel: ${release.prerelease ? 'prerelease' : 'stable'}\ngithubReleaseUrl: ${JSON.stringify(release.html_url)}\nsourceUrl: ${JSON.stringify(sourceUrl)}\nsourceSha256: ${JSON.stringify(sourceSha256)}\n---\n\n<!-- Generated from ${REPO}@${tag}. Do not edit this English body manually. -->\n\n${body}\n`;

if (check) {
  const failures = [];
  const currentJson = await readFile(releasesPath, 'utf8');
  if (currentJson !== expectedJson) failures.push('src/data/releases.json is stale');
  let currentNote = '';
  try { currentNote = await readFile(notePath, 'utf8'); } catch {}
  if (currentNote !== expectedNote) failures.push(path.relative(ROOT, notePath) + ' is stale or missing');
  if (failures.length) {
    for (const failure of failures) console.error(`error: ${failure}`);
    process.exit(1);
  }
  console.log(`${tag}: release metadata and English note are in sync`);
  process.exit(0);
}

await mkdir(path.dirname(notePath), { recursive: true });
await writeFile(releasesPath, expectedJson);
await writeFile(notePath, expectedNote);
console.log(`synced ${tag}`);
console.log(`  ${path.relative(ROOT, releasesPath)}`);
console.log(`  ${path.relative(ROOT, notePath)}`);
