import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PageWrapper from '../components/PageWrapper';
import { Section, Container } from '../components/Layout';
import SectionHeader from '../components/SectionHeader';
import Button from '../components/Button';
import { submitContactMessage } from '../services/api';
import { sanitizeFormData } from '../utils/sanitize';
import { validateContactForm } from '../utils/validators';
import { getVal, getJson } from '../utils/siteContent';
import { useSiteContent } from '../hooks/useSiteContent';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const INIT = { name: '', email: '', subject: '', message: '' };

// ─── Icons ────────────────────────────────────────────────────────────────────
const EmailIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);
const PinIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const ClockIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const ShieldIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

// ─── Animated success checkmark ───────────────────────────────────────────────
function SuccessBanner({ message }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8 }}
      className="p-5 rounded-2xl mb-6 flex items-center gap-4"
      style={{ backgroundColor: 'rgba(34,197,94,0.07)', boxShadow: '0 0 0 1px rgba(34,197,94,0.25)' }}
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.15 }}
        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: 'rgba(34,197,94,0.15)' }}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--success)' }}>
          <motion.path
            strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          />
        </svg>
      </motion.div>
      <div>
        <p className="text-sm font-semibold" style={{ color: 'var(--success)' }}>
          {message || "Message sent successfully!"}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          I'll get back to you within 24 hours.
        </p>
      </div>
    </motion.div>
  );
}

// ─── Focused input style helper ───────────────────────────────────────────────
function useFocusStyle(hasError) {
  const [focused, setFocused] = useState(false);
  const baseStyle = {
    boxShadow: hasError
      ? '0 0 0 1px var(--danger), var(--shadow-card)'
      : focused
        ? '0 0 0 2px var(--accent), var(--shadow-card)'
        : 'var(--shadow-card)',
    backgroundColor: 'var(--bg-card)',
    color: 'var(--text-primary)',
    transition: 'box-shadow 0.2s ease',
  };
  return { focused, setFocused, style: baseStyle };
}

// ─── Single input row ─────────────────────────────────────────────────────────
function Field({ id, label, required, error, children }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
        {label}{required && ' *'}
      </label>
      {children}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mt-1.5 text-xs" style={{ color: 'var(--danger)' }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Character progress bar ───────────────────────────────────────────────────
function CharBar({ count, max }) {
  const pct = Math.min((count / max) * 100, 100);
  const color = pct < 60 ? 'var(--success)' : pct < 85 ? 'var(--warning)' : 'var(--danger)';
  return (
    <div className="mt-2 flex items-center justify-between gap-3">
      <div className="flex-1 h-0.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-subtle)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.2 }}
        />
      </div>
      <span className="text-[10px] font-mono shrink-0" style={{ color: 'var(--text-muted)' }}>
        {count}/{max}
      </span>
    </div>
  );
}

// ─── Contact info item ────────────────────────────────────────────────────────
function InfoItem({ icon, label, value, href }) {
  const inner = (
    <div className="flex items-center gap-3">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: 'var(--accent-glow)', color: 'var(--accent)' }}
      >
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</p>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{value}</p>
      </div>
    </div>
  );
  if (href) return <a href={href} className="no-underline block">{inner}</a>;
  return inner;
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Contact() {
  const { content } = useSiteContent();

  const [form, setForm]       = useState(INIT);
  const [errors, setErrors]   = useState({});
  const [status, setStatus]   = useState('idle');
  const [submitErr, setErr]   = useState('');
  const lastRef = useRef(0);

  // ── DB-driven content ─────────────────────────────────────────────────────
  const title       = getVal(content, 'contact.title',       'Get in Touch');
  const description = getVal(content, 'contact.description', 'Inputs are sanitized, validated, and stored securely.');
  const successMsg  = getVal(content, 'contact.success_message', 'Message sent successfully!');
  const errorMsg    = getVal(content, 'contact.error_message',   'Something went wrong. Please try again.');
  const email       = getVal(content, 'footer.email',         '');
  const location    = getVal(content, 'hero.location',        '');

  const availJson   = getJson(content, 'contact.availability', null);
  const availability = Array.isArray(availJson?.items)
    ? availJson.items
    : [
        { label: 'Freelance', available: true },
        { label: 'Full-time', available: true },
        { label: 'Consulting', available: true },
      ];

  const socialGithub   = getVal(content, 'social.github',   '');
  const socialLinkedin = getVal(content, 'social.linkedin',  '');
  const socialLeetcode = getVal(content, 'social.leetcode',  '');

  // ── Form handlers ─────────────────────────────────────────────────────────
  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    if (errors[name]) setErrors((p) => { const n = { ...p }; delete n[name]; return n; });
  };

  const onSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (Date.now() - lastRef.current < 2000) return;
    lastRef.current = Date.now();
    const { isValid, errors: ve } = validateContactForm(form);
    if (!isValid) { setErrors(ve); return; }
    setStatus('submitting'); setErr('');
    try {
      await submitContactMessage(sanitizeFormData({ ...form, subject: form.subject || 'No Subject' }));
      setStatus('success'); setForm(INIT); setErrors({});
    } catch (err) {
      setStatus('error'); setErr(err?.message || errorMsg);
    }
  }, [form, errorMsg]);

  const nameFocus    = useFocusStyle(!!errors.name);
  const emailFocus   = useFocusStyle(!!errors.email);
  const subjectFocus = useFocusStyle(false);
  const msgFocus     = useFocusStyle(!!errors.message);

  const inputClass = 'w-full px-4 py-3 rounded-xl text-sm outline-none';

  return (
    <PageWrapper>
      <Section>
        <Container>
          <SectionHeader label="Contact" title={title} description={description} />

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12">

            {/* ── Left: Form (3/5) ── */}
            <div className="lg:col-span-3">
              <AnimatePresence>
                {status === 'success' && <SuccessBanner message={successMsg} />}
                {status === 'error' && submitErr && (
                  <motion.div
                    key="err"
                    initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="p-4 rounded-xl text-sm mb-5"
                    style={{ backgroundColor: 'rgba(239,68,68,0.07)', boxShadow: '0 0 0 1px rgba(239,68,68,0.2)', color: 'var(--danger)' }}
                  >
                    {submitErr}
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={onSubmit} noValidate id="contact-form" className="space-y-5">
                {/* Name + Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Field id="contact-name" label="Name" required error={errors.name}>
                    <input
                      id="contact-name" type="text" name="name" value={form.name}
                      onChange={onChange} maxLength={100} autoComplete="name"
                      className={inputClass} placeholder="Your name"
                      style={nameFocus.style}
                      onFocus={() => nameFocus.setFocused(true)}
                      onBlur={() => nameFocus.setFocused(false)}
                    />
                  </Field>
                  <Field id="contact-email" label="Email" required error={errors.email}>
                    <input
                      id="contact-email" type="email" name="email" value={form.email}
                      onChange={onChange} maxLength={200} autoComplete="email"
                      className={inputClass} placeholder="you@email.com"
                      style={emailFocus.style}
                      onFocus={() => emailFocus.setFocused(true)}
                      onBlur={() => emailFocus.setFocused(false)}
                    />
                  </Field>
                </div>

                {/* Subject */}
                <Field id="contact-subject" label="Subject">
                  <input
                    id="contact-subject" type="text" name="subject" value={form.subject}
                    onChange={onChange} maxLength={200}
                    className={inputClass} placeholder="What's this about?"
                    style={subjectFocus.style}
                    onFocus={() => subjectFocus.setFocused(true)}
                    onBlur={() => subjectFocus.setFocused(false)}
                  />
                </Field>

                {/* Message */}
                <Field id="contact-message" label="Message" required error={errors.message}>
                  <textarea
                    id="contact-message" name="message" value={form.message}
                    onChange={onChange} rows={6} maxLength={2000}
                    className={`${inputClass} resize-y min-h-[140px]`}
                    placeholder="Describe your project, question, or opportunity..."
                    style={msgFocus.style}
                    onFocus={() => msgFocus.setFocused(true)}
                    onBlur={() => msgFocus.setFocused(false)}
                  />
                  <CharBar count={form.message.length} max={2000} />
                </Field>

                <Button
                  type="submit" size="lg"
                  loading={status === 'submitting'}
                  disabled={status === 'submitting'}
                  id="contact-submit"
                >
                  {status === 'submitting' ? 'Sending…' : (
                    <>
                      Send Message
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </>
                  )}
                </Button>
              </form>
            </div>

            {/* ── Right: Info Panel (2/5) ── */}
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="lg:col-span-2 space-y-5"
            >
              {/* Contact details */}
              <div
                className="rounded-2xl p-5"
                style={{ boxShadow: 'var(--shadow-card)', backgroundColor: 'var(--bg-card)' }}
              >
                <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>
                  Contact Details
                </p>
                <div className="space-y-4">
                  {email && <InfoItem icon={<EmailIcon />} label="Email" value={email} href={`mailto:${email}`} />}
                  {location && <InfoItem icon={<PinIcon />} label="Location" value={location} />}
                  <InfoItem icon={<ClockIcon />} label="Response Time" value="Usually within 24 hours" />
                </div>

                {/* Social links */}
                {(socialGithub || socialLinkedin || socialLeetcode) && (
                  <div className="mt-4 pt-4 flex items-center gap-3 flex-wrap" style={{ borderTop: '1px solid var(--border)' }}>
                    {[
                      { href: socialGithub,   label: 'GitHub',   char: 'GH' },
                      { href: socialLinkedin, label: 'LinkedIn', char: 'LI' },
                      { href: socialLeetcode, label: 'LeetCode', char: 'LC' },
                    ].filter((s) => s.href).map((s) => (
                      <a
                        key={s.label}
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono no-underline transition-all"
                        style={{
                          backgroundColor: 'var(--bg-subtle)',
                          color: 'var(--text-muted)',
                          boxShadow: 'var(--shadow-card)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'var(--accent)';
                          e.currentTarget.style.boxShadow = '0 0 0 1px rgba(99,102,241,0.4)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--text-muted)';
                          e.currentTarget.style.boxShadow = 'var(--shadow-card)';
                        }}
                      >
                        {s.char}
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Availability */}
              <div
                className="rounded-2xl p-5"
                style={{ boxShadow: 'var(--shadow-card)', backgroundColor: 'var(--bg-card)' }}
              >
                <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>
                  Availability
                </p>
                <div className="space-y-3">
                  {availability.map((item) => (
                    <motion.div
                      key={item.label}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold"
                        style={{
                          backgroundColor: item.available ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                          color: item.available ? 'var(--success)' : 'var(--danger)',
                        }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full animate-pulse"
                          style={{ backgroundColor: item.available ? 'var(--success)' : 'var(--danger)' }}
                        />
                        {item.available ? 'Open' : 'Closed'}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Security notice */}
              <div
                className="rounded-2xl p-4"
                style={{
                  backgroundColor: 'rgba(34,197,94,0.04)',
                  boxShadow: '0 0 0 1px rgba(34,197,94,0.15)',
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <ShieldIcon />
                  <span className="text-xs font-semibold" style={{ color: 'var(--success)' }}>Security</span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  XSS prevention · Input sanitization · Rate limiting · Data encrypted at rest
                </p>
              </div>
            </motion.div>
          </div>
        </Container>
      </Section>
    </PageWrapper>
  );
}
