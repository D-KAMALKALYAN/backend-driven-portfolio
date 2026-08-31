import { motion } from 'framer-motion';
import PageWrapper from '../components/PageWrapper';
import { Section, Container } from '../components/Layout';
import SectionHeader from '../components/SectionHeader';
import EmptyState from '../components/EmptyState';
import { SkeletonGrid } from '../components/SkeletonLoader';
import ErrorState from '../components/ErrorState';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { fetchExternalProfiles } from '../services/api';
import { trackEvent } from '../services/analytics';

/* ── All platform icons ── */
const ICONS = {
  github: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  ),
  linkedin: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  ),
  twitter: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
    </svg>
  ),
  leetcode: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M13.483 0a1.374 1.374 0 0 0-.961.438L7.116 6.226l-3.854 4.126a5.266 5.266 0 0 0-1.209 2.104 5.35 5.35 0 0 0-.125.513 5.527 5.527 0 0 0 .062 2.362 5.83 5.83 0 0 0 .349 1.017 5.938 5.938 0 0 0 1.271 1.818l4.277 4.193.039.038c2.248 2.165 5.852 2.133 8.063-.074l2.396-2.392c.54-.54.54-1.414.003-1.955a1.378 1.378 0 0 0-1.951-.003l-2.396 2.392a3.021 3.021 0 0 1-4.205.038l-.02-.019-4.276-4.193c-.652-.64-.972-1.469-.948-2.263a2.68 2.68 0 0 1 .066-.523 2.545 2.545 0 0 1 .619-1.164L9.13 8.114c1.058-1.134 3.204-1.27 4.43-.278l3.501 2.831c.593.48 1.461.387 1.94-.207a1.384 1.384 0 0 0-.207-1.943l-3.5-2.831c-.8-.647-1.766-1.045-2.774-1.202l2.015-2.158A1.384 1.384 0 0 0 13.483 0zm-2.866 12.815a1.38 1.38 0 0 0-1.38 1.382 1.38 1.38 0 0 0 1.38 1.382H20.79a1.38 1.38 0 0 0 1.38-1.382 1.38 1.38 0 0 0-1.38-1.382z" />
    </svg>
  ),
  hackerrank: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 0c1.285 0 9.75 4.886 10.392 6 .645 1.115.645 10.885 0 12S13.287 24 12 24C10.712 24 2.248 19.115 1.607 18 .963 16.885.963 7.115 1.607 6 2.248 4.886 10.715 0 12 0zm2.205 6.015h-1.74l-2.25 3.75-2.25-3.75H6.225v5.985h1.5V8.955l1.94 3.045h.69l1.94-3.045v3.045h1.5V6.015h-1.59zm2.25 0v.75h1.5v5.985h1.5V6.015h-3z" />
    </svg>
  ),
  geeksforgeeks: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M21.45 14.315c-.143.28-.334.532-.565.745a3.691 3.691 0 0 1-1.104.695 4.51 4.51 0 0 1-3.116-.016 3.79 3.79 0 0 1-1.106-.705 4.82 4.82 0 0 1-.571-.77h-.902a4.93 4.93 0 0 1-.571.77 3.79 3.79 0 0 1-1.106.705 4.51 4.51 0 0 1-3.116.016 3.69 3.69 0 0 1-1.104-.695 3.59 3.59 0 0 1-.565-.745A3.72 3.72 0 0 1 7.4 13H0v-2h7.4a3.72 3.72 0 0 1 .224-1.315c.143-.28.334-.532.565-.745.331-.298.72-.523 1.144-.695a4.51 4.51 0 0 1 3.116.016c.421.166.8.39 1.106.695.222.213.413.465.571.745h.902c.158-.28.349-.532.571-.745a3.79 3.79 0 0 1 1.106-.695 4.51 4.51 0 0 1 3.116-.016c.423.172.813.397 1.144.695.231.213.422.465.565.745A3.72 3.72 0 0 1 21.6 11H24v2h-2.4a3.72 3.72 0 0 1-.15 1.315zm-9.823-2.568c-.2-.4-.513-.74-.907-.99-.395-.25-.868-.375-1.42-.375-.55 0-1.025.124-1.42.375-.394.25-.703.59-.9.99S6.7 12.634 6.7 13s.08.712.28 1.252c.197.4.506.74.9.99.395.25.87.376 1.42.376.552 0 1.025-.126 1.42-.376.394-.25.707-.59.907-.99.2-.54.28-.886.28-1.252s-.08-.712-.28-1.252zm8.16 0c-.2-.4-.513-.74-.907-.99-.395-.25-.868-.375-1.42-.375-.55 0-1.025.124-1.42.375-.394.25-.703.59-.9.99S14.86 12.634 14.86 13s.08.712.28 1.252c.197.4.506.74.9.99.395.25.87.376 1.42.376.552 0 1.025-.126 1.42-.376.394-.25.707-.59.907-.99.2-.54.28-.886.28-1.252s-.08-.712-.28-1.252z" />
    </svg>
  ),
  medium: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zM20.96 12c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z" />
    </svg>
  ),
  portfolio: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  ),
};

function getIcon(platform) {
  const k = (platform || '').toLowerCase().replace(/[^a-z]/g, '');
  return ICONS[k] ?? (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  );
}

function normalizeUrl(url) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `https://${url}`;
}

/* Accent colour per platform */
const PLATFORM_COLORS = {
  github: '#e5e7eb',
  linkedin: '#0a66c2',
  twitter: '#1d9bf0',
  leetcode: '#ffa116',
  hackerrank: '#00ea64',
  geeksforgeeks: '#2f8d46',
  medium: '#000000',
  portfolio: '#6366f1',
};

function platformColor(platform) {
  const k = (platform || '').toLowerCase().replace(/[^a-z]/g, '');
  return PLATFORM_COLORS[k] ?? 'var(--accent)';
}

export default function Profiles() {
  const { data: profiles, loading, error, refetch } = useSupabaseQuery(fetchExternalProfiles);

  if (loading) return (
    <PageWrapper><Section><Container>
      <SectionHeader label="Profiles" title="External Profiles" />
      <SkeletonGrid count={6} cols={3} />
    </Container></Section></PageWrapper>
  );
  if (error) return (
    <PageWrapper><Section><Container>
      <ErrorState message={error} onRetry={refetch} />
    </Container></Section></PageWrapper>
  );

  const list = Array.isArray(profiles) ? profiles : [];

  return (
    <PageWrapper>
      <Section>
        <Container>
          <SectionHeader
            label="Profiles"
            title="External Profiles"
            description="Find me across platforms and networks."
          />

          {list.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {list.map((p, i) => {
                const href = normalizeUrl(p?.profile_url);
                const color = platformColor(p?.platform);
                return (
                  <motion.div
                    key={p?.id ?? i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    whileHover={{ y: -2 }}
                  >
                    <a
                      href={href || undefined}
                      target={href ? '_blank' : undefined}
                      rel={href ? 'noopener noreferrer' : undefined}
                      onClick={() => href && trackEvent('profile_click', { platform: p?.platform, url: href })}
                      className="group flex items-center gap-4 p-4 sm:p-5 rounded-2xl no-underline block transition-all duration-200"
                      style={{
                        backgroundColor: 'var(--bg-card)',
                        boxShadow: 'var(--shadow-card)',
                        cursor: href ? 'pointer' : 'default',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-hover)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-card)'; }}
                    >
                      {/* Coloured icon bubble */}
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
                        style={{
                          backgroundColor: `${color}18`,
                          color,
                        }}
                      >
                        {getIcon(p?.platform)}
                      </div>

                      {/* Labels */}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold capitalize truncate" style={{ color: 'var(--text-primary)' }}>
                          {p?.platform || p?.label || 'Profile'}
                        </p>
                        {p?.username && (
                          <p className="text-xs font-mono truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            @{p.username}
                          </p>
                        )}
                      </div>

                      {/* External arrow */}
                      {href && (
                        <svg
                          className="w-4 h-4 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity"
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      )}
                    </a>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon="🔗" title="No profiles linked" description="Add external profiles via Supabase." />
          )}
        </Container>
      </Section>
    </PageWrapper>
  );
}
