import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import schema from './fixtures/schema.json';

/**
 * Components must not read fields that do not exist on the row they render.
 *
 * schemaConformance.test.js validates the API layer, which catches a bad
 * table or column inside a query. It does not see what a component does with
 * the row it gets back — and that is where this defect kept reappearing:
 *
 *   Resume.jsx      profile.headline, profile.years_experience
 *   About.jsx       philosophy, approach, interests, education,
 *                   certifications, focus_area, headline, years_experience
 *   Experience.jsx  exp.title, exp.technologies, exp.achievements
 *
 * Each read `undefined`, so the value was falsy, so the section it gated
 * simply never rendered. Nothing threw and nothing logged. The only visible
 * symptom was an `aria-label="View details for undefined"` — announced to
 * screen-reader users and invisible to everyone else.
 *
 * This is a heuristic: it maps a variable naming convention to a table and
 * checks property access against that table's real columns. It cannot
 * understand arbitrary code, so legitimate non-columns go in ALLOWED.
 * Generated Supabase types replace it properly.
 */

const SRC = path.resolve(import.meta.dirname, '..');

/** Variable naming convention -> the table whose row it holds. */
const VARIABLE_TABLE = {
  profile: 'profiles',
  exp: 'experience',
  project: 'projects',
};

/**
 * Names that are legitimately not columns: the JSONB escape hatch and JS
 * built-ins that can appear on any value.
 */
const ALLOWED = new Set([
  'meta',
  'length', 'map', 'filter', 'find', 'slice', 'split', 'join', 'trim',
  'toString', 'valueOf', 'includes', 'indexOf', 'replace', 'sort', 'some',
  'every', 'reduce', 'forEach', 'concat', 'keys', 'values', 'entries',
]);

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      out.push(...walk(full));
    } else if (/\.(jsx?|tsx?)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Blank out comments and string literals before scanning.
 *
 * Without this the scan reports its own explanatory comments, and every
 * site_content key that merely looks like a field access — `'profile.name'`
 * and `'profile.role'` are keys in that table, not columns on `profiles`.
 * Content is replaced with spaces rather than removed so line numbers in the
 * failure message stay accurate.
 */
export function stripNonCode(src) {
  const blankKeepNewlines = (m) => m.replace(/[^\n]/g, ' ');
  return src
    .replace(/\/\*[\s\S]*?\*\//g, blankKeepNewlines)
    .replace(/\/\/[^\n]*/g, blankKeepNewlines)
    .replace(/'(?:[^'\\\n]|\\.)*'/g, blankKeepNewlines)
    .replace(/"(?:[^"\\\n]|\\.)*"/g, blankKeepNewlines)
    .replace(/`(?:[^`\\]|\\.)*`/g, blankKeepNewlines);
}

export function findViolations() {
  const violations = [];

  for (const file of walk(SRC)) {
    const source = stripNonCode(fs.readFileSync(file, 'utf8'));
    const rel = path.relative(SRC, file).replace(/\\/g, '/');

    for (const [variable, table] of Object.entries(VARIABLE_TABLE)) {
      const columns = schema.relations[table]?.columns;
      if (!columns) continue; // columns unknown for this relation

      const re = new RegExp(`\\b${variable}\\??\\.([a-zA-Z_][a-zA-Z0-9_]*)`, 'g');
      for (const match of source.matchAll(re)) {
        const field = match[1];
        if (ALLOWED.has(field) || columns.includes(field)) continue;
        const line = source.slice(0, match.index).split('\n').length;
        violations.push(`${rel}:${line}  ${variable}.${field} is not a column on '${table}'`);
      }
    }
  }

  return violations;
}

describe('component field references', () => {
  it('no component reads a field that does not exist on its table', () => {
    const violations = findViolations();
    expect(
      violations,
      `\n${violations.join('\n')}\n\n` +
      `Either the field name is wrong, or the value belongs in the table's JSONB 'meta' column.`,
    ).toEqual([]);
  });

  it('ignores comments and string literals', () => {
    const src = [
      "// profile.fakeone in a line comment",
      "/* profile.faketwo in a block comment */",
      "const key = 'profile.fakethree';",
      'const other = "profile.fakefour";',
      'const real = profile.title;',
    ].join('\n');

    const cleaned = stripNonCode(src);
    expect(cleaned).not.toContain('fakeone');
    expect(cleaned).not.toContain('faketwo');
    expect(cleaned).not.toContain('fakethree');
    expect(cleaned).not.toContain('fakefour');
    expect(cleaned).toContain('profile.title');
    // Line numbers must survive so failures point at the right place.
    expect(cleaned.split('\n')).toHaveLength(src.split('\n').length);
  });

  it('is actually capable of failing', () => {
    // Guards against a silent pass because the regex or fixture stopped
    // matching anything at all.
    const columns = schema.relations.profiles.columns;
    expect(columns).toBeTruthy();
    expect(columns).toContain('title');
    expect(columns).not.toContain('headline');

    const cleaned = stripNonCode('const x = profile?.headline;');
    const hits = [...cleaned.matchAll(/\bprofile\??\.([a-zA-Z_][a-zA-Z0-9_]*)/g)].map((m) => m[1]);
    expect(hits).toContain('headline');
  });
});
