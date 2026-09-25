#!/usr/bin/env node
/**
 * Verifies the production build in dist/ can be parsed by iOS 12 Safari.
 *
 *  1. Token-level "grep": no `?.` or `??` tokens anywhere in shipped JS.
 *     (A tokenizer is used instead of a regex so strings/regexes that merely
 *     contain those characters don't cause false alarms.)
 *  2. Every shipped .js file parses with an ES2017 grammar. ES2017 is a strict
 *     subset of what Safari 11+/iOS 11+ understands, so anything newer
 *     (optional chaining, nullish coalescing, class fields, numeric
 *     separators, optional catch binding, regex lookbehind, ...) fails here.
 *  3. Inline <script> blocks in index.html are plain ES5.
 *  4. index.html does not rely on <script type="module"> to start the game.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const SHIPPED_ECMA = 2017;

const failures = [];
const fail = (msg) => failures.push(msg);

function listFiles(dir) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...listFiles(full));
        else out.push(full);
    }
    return out;
}

function snippet(src, pos) {
    return JSON.stringify(src.slice(Math.max(0, pos - 60), pos + 40));
}

function countModernTokens(src) {
    const counts = { optionalChaining: 0, nullishCoalescing: 0 };
    const firstAt = {};
    for (const token of acorn.tokenizer(src, { ecmaVersion: 'latest', sourceType: 'script' })) {
        const label = token.type.label;
        if (label === '?.') {
            counts.optionalChaining++;
            if (firstAt.optionalChaining === undefined) firstAt.optionalChaining = token.start;
        } else if (label === '??' || (label === '_=' && token.value === '??=')) {
            counts.nullishCoalescing++;
            if (firstAt.nullishCoalescing === undefined) firstAt.nullishCoalescing = token.start;
        }
    }
    return { counts, firstAt };
}

function checkJs(file) {
    const rel = path.relative(root, file);
    const src = fs.readFileSync(file, 'utf8');

    let tokens;
    try {
        tokens = countModernTokens(src);
    } catch (e) {
        fail(`${rel}: could not tokenize (${e.message})`);
        return null;
    }
    for (const [kind, n] of Object.entries(tokens.counts)) {
        if (n > 0) fail(`${rel}: contains ${n} ${kind} token(s), first near ${snippet(src, tokens.firstAt[kind])}`);
    }

    try {
        acorn.parse(src, { ecmaVersion: SHIPPED_ECMA, sourceType: 'script' });
    } catch (e) {
        fail(`${rel}: not valid ES${SHIPPED_ECMA} - ${e.message} near ${snippet(src, e.pos)}`);
    }
    return { rel, bytes: Buffer.byteLength(src), ...tokens.counts };
}

function checkHtml(file) {
    const html = fs.readFileSync(file, 'utf8');
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
    if (scripts.length === 0) fail('index.html: no <script> tags found');

    let legacyEntry = false;
    scripts.forEach((m, i) => {
        const attrs = m[1];
        const body = m[2];
        if (/type\s*=\s*["']?module/i.test(attrs)) {
            fail(`index.html: <script type="module"> found (${attrs.trim()}); iOS 12 must not depend on module scripts`);
        }
        if (/id=["']?vite-legacy-entry/.test(attrs)) legacyEntry = true;
        if (body.trim()) {
            try {
                acorn.parse(body, { ecmaVersion: 5, sourceType: 'script' });
            } catch (e) {
                fail(`index.html inline script #${i + 1}: not valid ES5 - ${e.message} near ${snippet(body, e.pos)}`);
            }
        }
    });
    if (!legacyEntry) fail('index.html: missing vite-legacy-entry script (is @vitejs/plugin-legacy configured?)');
    if (!/id=["']mk-error["']/.test(html)) fail('index.html: boot error banner (#mk-error) missing');
    return scripts.length;
}

if (!fs.existsSync(path.join(dist, 'index.html'))) {
    console.error('dist/index.html not found. Run `npm run build` first.');
    process.exit(1);
}

const scriptCount = checkHtml(path.join(dist, 'index.html'));
const jsFiles = listFiles(dist).filter((f) => f.endsWith('.js') || f.endsWith('.mjs'));
if (jsFiles.length === 0) fail('dist/: no JavaScript files found');
const results = jsFiles.map(checkJs).filter(Boolean);

console.log(`Checked index.html (${scriptCount} script tags) and ${results.length} JS file(s):`);
for (const r of results) {
    console.log(`  ${r.rel}  ${(r.bytes / 1024).toFixed(0)} KB  ?.=${r.optionalChaining}  ??=${r.nullishCoalescing}`);
}

if (failures.length) {
    console.error(`\nLEGACY CHECK FAILED (${failures.length}):`);
    failures.forEach((f) => console.error('  - ' + f));
    process.exit(1);
}
console.log(`\nOK: no ?. / ?? tokens, all shipped JS parses as ES${SHIPPED_ECMA}, inline scripts are ES5.`);
