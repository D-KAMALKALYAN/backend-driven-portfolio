import Link from 'next/link';
import SectionBlock from './SectionBlock';
import { asObject, asObjectArray, asString, asStringArray } from '../../utils/json';
import { enterAt } from '../../utils/enter';
import type { BlockLike } from '../../types/rows';
import type { ExplainSourceRef } from '../Explainable';

/** The row a block came from, for "Explain this"; absent when the block cannot be explained. */
export interface BlockProps {
  section: BlockLike;
  source?: ExplainSourceRef | null;
}

/**
 * Content-only section types. Unlike `now` or `timeline`, these fetch
 * nothing: everything they render is in the registry row's `config`. They
 * are what makes a page like /how-it-works a set of rows rather than a
 * component per paragraph, and the same four types are what a writing
 * section needs later.
 *
 * config shapes (jsonb, narrowed at read time - utils/json.ts):
 *   prose    { paragraphs: string[], bullets?: string[], link?: { href, label } }
 *   diagram  { ascii: string, caption?: string }
 *   steps    { steps: [{ title, body }] }
 *   table    { columns: string[], rows: string[][] }
 *   code     { snippet: string, language?: string, caption?: string }
 *   qa       { questions: string[] }            - the questions this page invites (QaBlock)
 *
 * Inline emphasis: `code` spans are rendered as <code>. Nothing else - no
 * HTML, no markdown engine. Text is text.
 */

/** Render `backticked` spans as <code>; everything else stays text. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('`') && part.endsWith('`') && part.length > 2 ? (
          <code
            key={i}
            className="px-1 py-0.5 rounded text-[0.85em] font-mono bg-subtle text-primary"
          >
            {part.slice(1, -1)}
          </code>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export function ProseBlock({ section, source = null }: BlockProps) {
  const c = asObject(section.config) ?? {};
  const paragraphs = asStringArray(c['paragraphs']);
  const bullets = asStringArray(c['bullets']);
  const link = asObject(c['link']);
  const href = asString(link?.['href']);
  const label = asString(link?.['label']);
  if (paragraphs.length === 0 && bullets.length === 0) return null;

  return (
    <SectionBlock heading={section.heading ?? ''} description={section.description} explain={source}>
      {/* flex gap, not space-y: Tailwind v4's space utilities are zero-specificity
          and lose to the m-0 on each paragraph. */}
      <div className="max-w-3xl flex flex-col gap-4">
        {paragraphs.map((p, i) => (
          <p key={i} className="enter text-base leading-relaxed m-0" style={{ ...enterAt(i * 60), color: 'var(--text-secondary)' }}>
            <Inline text={p} />
          </p>
        ))}
        {bullets.length > 0 && (
          <ul className="flex flex-col gap-2 pl-5 m-0 list-disc text-secondary">
            {bullets.map((b, i) => (
              <li key={i} className="enter text-base leading-relaxed" style={enterAt(200 + i * 50)}>
                <Inline text={b} />
              </li>
            ))}
          </ul>
        )}
        {href && label && (
          href.startsWith('/') ? (
            <Link href={href} className="inline-block text-sm font-semibold no-underline hover:underline text-accent">{label}</Link>
          ) : (
            <a href={href} target="_blank" rel="noopener noreferrer" className="inline-block text-sm font-semibold no-underline hover:underline text-accent">{label} ↗</a>
          )
        )}
      </div>
    </SectionBlock>
  );
}

export function DiagramBlock({ section, source = null }: BlockProps) {
  const c = asObject(section.config) ?? {};
  const ascii = asString(c['ascii']);
  const caption = asString(c['caption']);
  if (!ascii) return null;

  return (
    <SectionBlock heading={section.heading ?? ''} description={section.description} explain={source}>
      <figure className="m-0">
        {/* Monospace, not an image: readable in both themes, zoomable, and
            the text is in the HTML for anyone who cannot see it. */}
        <pre
          className="enter overflow-x-auto text-caption sm:text-xs leading-snug p-5 rounded-2xl font-mono m-0 bg-card text-primary shadow-card"
          aria-label={caption || section.heading || 'diagram'}
        >
          {ascii}
        </pre>
        {caption && (
          <figcaption className="mt-3 text-sm text-muted">{caption}</figcaption>
        )}
      </figure>
    </SectionBlock>
  );
}

export function StepsBlock({ section, source = null }: BlockProps) {
  const c = asObject(section.config) ?? {};
  const steps = asObjectArray(c['steps'])
    .map((s) => ({ title: asString(s['title']), body: asString(s['body']) }))
    .filter((s) => s.title);
  if (steps.length === 0) return null;

  return (
    <SectionBlock heading={section.heading ?? ''} description={section.description} explain={source}>
      <ol className="list-none m-0 p-0 grid grid-cols-1 md:grid-cols-2 gap-4">
        {steps.map((s, i) => (
          <li
            key={i}
            className="enter flex gap-4 p-5 rounded-2xl"
            style={{ ...enterAt(i * 70), backgroundColor: 'var(--bg-card)', boxShadow: 'var(--shadow-card)' }}
          >
            <span
              className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold font-mono bg-accent-glow text-accent"
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold m-0 mb-1 text-primary">{s.title}</p>
              {s.body && (
                <p className="text-sm leading-relaxed m-0 text-secondary"><Inline text={s.body} /></p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </SectionBlock>
  );
}

export function TableBlock({ section, source = null }: BlockProps) {
  const c = asObject(section.config) ?? {};
  const columns = asStringArray(c['columns']);
  const rows = (Array.isArray(c['rows']) ? c['rows'] : []).map((r) => asStringArray(r)).filter((r) => r.length > 0);
  if (columns.length === 0 || rows.length === 0) return null;

  return (
    <SectionBlock heading={section.heading ?? ''} description={section.description} explain={source}>
      <div className="overflow-x-auto rounded-2xl shadow-card bg-card">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  scope="col"
                  className="text-left text-caption font-semibold uppercase tracking-widest px-4 py-3 text-muted border-b border-line"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="enter" style={enterAt(i * 50)}>
                {r.map((cell, j) => (
                  <td
                    key={j}
                    className="px-4 py-3 align-top leading-relaxed"
                    style={{
                      color: j === 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontWeight: j === 0 ? 600 : 400,
                      borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : undefined,
                    }}
                  >
                    <Inline text={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionBlock>
  );
}

export function CodeBlock({ section, source = null }: BlockProps) {
  const c = asObject(section.config) ?? {};
  const snippet = asString(c['snippet']);
  const language = asString(c['language']);
  const caption = asString(c['caption']);
  if (!snippet) return null;

  return (
    <SectionBlock heading={section.heading ?? ''} description={section.description} explain={source}>
      <figure className="m-0">
        <pre
          className="enter overflow-x-auto text-xs leading-relaxed p-5 rounded-2xl font-mono m-0 bg-card text-primary shadow-card"
          data-language={language || undefined}
        >
          <code>{snippet}</code>
        </pre>
        {caption && <figcaption className="mt-3 text-sm text-muted">{caption}</figcaption>}
      </figure>
    </SectionBlock>
  );
}
