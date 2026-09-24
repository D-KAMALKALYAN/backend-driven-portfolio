import Link from 'next/link';
import { ArrowRight, PenLine } from 'lucide-react';
import { Section, Container } from './Layout';
import { CARD, CARD_HOVER, CARD_HOVER_ACCENT } from './Card';
import Badge from './Badge';
import AskInvitationBody from './AskInvitation';
import AnalyticsTeaser from './AnalyticsTeaser';
import { getPosts, getProjects, getPostBlocks } from '../lib/content';
import { formatPostDate, readingMinutes } from '../utils/reading';
import { enterAt } from '../utils/enter';
import { SkeletonLine, SkeletonCard } from './SkeletonLoader';

/**
 * The home page as a narrative (ADR-057, blueprint Phase 5): after the
 * intro and whatever the registry puts under it, the three things a
 * visitor came to judge - selected work, the latest note, how the site
 * itself is built - and then an invitation to ask.
 *
 * Server components: the rows are read here, so the HTML carries the work
 * rather than a client fetching it. Each section hides itself when its
 * table is empty, as every registry section does.
 */
function SectionHeading({ label, title, href, cta }: { label: string; title: string; href: string; cta: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 mb-6">
      <div>
        <p className="m-0 mb-1.5 text-label font-semibold uppercase text-accent">{label}</p>
        <h2 className="m-0 text-2xl font-bold tracking-tight text-primary">{title}</h2>
      </div>
      <Link href={href} className="text-sm font-medium no-underline hover:underline text-accent shrink-0">
        {cta} <ArrowRight size={14} className="inline align-[-2px]" aria-hidden />
      </Link>
    </div>
  );
}

/** Three projects: the ones the owner marked featured, newest first, then the rest. */
export async function SelectedWork() {
  const projects = (await getProjects()).filter((p) => !p.is_deleted);
  if (projects.length === 0) return null;
  const selected = [...projects]
    .sort((a, b) => Number(b.featured) - Number(a.featured) || (b.start_date ?? '').localeCompare(a.start_date ?? ''))
    .slice(0, 3);

  return (
    <Section pad="bottom">
      <Container>
        <SectionHeading label="Selected work" title="Things built, and what they cost" href="/projects" cta="All projects" />
        <ul className="m-0 p-0 list-none grid gap-4 md:grid-cols-3">
          {selected.map((p, i) => (
            <li key={p.id} className="enter" style={enterAt(i * 70)}>
              <Link href={`/projects/${p.slug}`} className={`h-full flex flex-col gap-2 p-5 no-underline ${CARD} ${CARD_HOVER_ACCENT}`}>
                <span className="text-base font-semibold leading-snug text-primary">{p.title}</span>
                {p.tagline && <span className="text-sm leading-relaxed text-secondary">{p.tagline}</span>}
                {p.tech_stack && p.tech_stack.length > 0 && (
                  <span className="mt-auto pt-2 flex flex-wrap gap-1.5">
                    {p.tech_stack.slice(0, 3).map((t) => <Badge key={t}>{t}</Badge>)}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}

/** The most recent published note, with its reading time - the writing, not a link to a list. */
export async function LatestNote() {
  const posts = await getPosts();
  const post = posts[0];
  if (!post) return null;
  const minutes = readingMinutes(await getPostBlocks(post.id));
  // The two after it fill the column the featured note does not need, so
  // the row ends where the page does rather than two thirds across it.
  const more = posts.slice(1, 3);

  return (
    <Section pad="bottom">
      <Container>
        <SectionHeading label="Writing" title="The most recent note" href="/writing" cta="All notes" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Link
            href={`/writing/${post.slug}`}
            className={`enter block p-6 no-underline ${more.length > 0 ? 'lg:col-span-2' : ''} ${CARD} ${CARD_HOVER}`}
          >
            <p className="m-0 mb-2 text-caption font-mono text-muted">
              <PenLine size={12} className="inline align-[-2px] mr-1.5" aria-hidden />
              <time dateTime={post.published_at ?? undefined}>{formatPostDate(post.published_at)}</time>
              {' · '}{minutes} min read
            </p>
            <h3 className="m-0 mb-2 text-xl font-semibold leading-snug text-primary">{post.title}</h3>
            {post.summary && <p className="m-0 text-sm leading-relaxed text-secondary">{post.summary}</p>}
          </Link>
          {more.length > 0 && (
            <ul className="m-0 p-0 list-none flex flex-col gap-4">
              {more.map((p, i) => (
                <li key={p.id} className="enter flex-1" style={enterAt(80 + i * 70)}>
                  <Link href={`/writing/${p.slug}`} className={`flex flex-col gap-1.5 h-full p-5 no-underline ${CARD} ${CARD_HOVER}`}>
                    <span className="text-caption font-mono text-muted">
                      <time dateTime={p.published_at ?? undefined}>{formatPostDate(p.published_at)}</time>
                    </span>
                    <span className="text-sm font-semibold leading-snug text-primary">{p.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Container>
    </Section>
  );
}

/** How the site itself works - the page that is the argument for the rest. */
export function HowItWorksTeaser() {
  return (
    <Section pad="bottom">
      <Container>
        {/* The claim on the left, the numbers that make it checkable on the
            right - the evidence beside the assertion rather than under it,
            and the card fills the row (ADR-064). */}
        <div className={`enter p-6 sm:p-8 grid gap-8 lg:grid-cols-2 lg:items-center ${CARD}`}>
          <div>
            <p className="m-0 mb-1.5 text-label font-semibold uppercase text-accent">Under the hood</p>
            <h2 className="m-0 mb-3 text-2xl font-bold tracking-tight text-primary">This page is rows in a database</h2>
            <p className="m-0 mb-5 leading-relaxed text-secondary">
              Every section, every string and every feature switch on this site is a row, read on the server per
              request. The page that explains it is written the same way - and says what each decision cost.
            </p>
            <Link href="/how-it-works" className="text-sm font-semibold no-underline hover:underline text-accent">
              How this site works <ArrowRight size={14} className="inline align-[-2px]" aria-hidden />
            </Link>
          </div>
          <AnalyticsTeaser className="lg:justify-self-end" />
        </div>
      </Container>
    </Section>
  );
}

/** The last thing on the page: ask it something. The body is a client
 *  component so the whole invitation can disappear with the flag. */
export function AskInvitation() {
  return (
    <Section pad="bottom">
      <Container>
        <AskInvitationBody />
      </Container>
    </Section>
  );
}

/**
 * What a narrative section looks like before its rows arrive (ADR-057).
 * The heading is known without a query, so only the content is a shape.
 */
export function HomeSectionSkeleton({ label, cards = 1 }: { label: string; cards?: number }) {
  return (
    <Section pad="bottom">
      <Container>
        <div aria-busy="true" aria-live="polite">
          <span className="sr-only">Loading {label.toLowerCase()}…</span>
          <p className="m-0 mb-1.5 text-label font-semibold uppercase text-accent">{label}</p>
          <SkeletonLine width="18rem" height="1.75rem" className="mb-6" />
          <div className={cards > 1 ? 'grid gap-4 md:grid-cols-3' : 'max-w-3xl'}>
            {Array.from({ length: cards }, (_, i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      </Container>
    </Section>
  );
}
