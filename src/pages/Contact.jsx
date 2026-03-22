import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import PageWrapper from '../components/PageWrapper';
import { Section, Container } from '../components/Layout';
import SectionHeader from '../components/SectionHeader';
import Button from '../components/Button';
import { submitContactMessage } from '../services/api';
import { sanitizeFormData } from '../utils/sanitize';
import { validateContactForm } from '../utils/validators';

const INIT = { name: '', email: '', subject: '', message: '' };

const CONTACT_INFO = [
  {
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    label: 'Email',
    value: 'kamalkalyan@example.com',
  },
  {
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    label: 'Location',
    value: 'Nellore, Andhra Pradesh, India',
  },
  {
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    label: 'Response Time',
    value: 'Usually within 24 hours',
  },
];

const AVAILABILITY = [
  { label: 'Freelance', available: true },
  { label: 'Full-time', available: true },
  { label: 'Consulting', available: true },
];

function inputClass(hasError) {
  return `w-full px-4 py-3 rounded-xl text-sm outline-none transition-all ${
    hasError ? 'ring-1 ring-[var(--danger)]' : ''
  }`;
}

export default function Contact() {
  const [form, setForm]     = useState(INIT);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle');
  const [submitErr, setSubmitErr] = useState('');
  const lastRef = useRef(0);

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
    setStatus('submitting'); setSubmitErr('');
    try {
      await submitContactMessage(sanitizeFormData({ ...form, subject: form.subject || 'No Subject' }));
      setStatus('success'); setForm(INIT); setErrors({});
    } catch (err) {
      setStatus('error'); setSubmitErr(err?.message || 'Failed to send. Please try again.');
    }
  }, [form]);

  const fieldStyle = {
    boxShadow: 'var(--shadow-card)',
    backgroundColor: 'var(--bg-card)',
    color: 'var(--text-primary)',
  };

  return (
    <PageWrapper>
      <Section>
        <Container>
          <SectionHeader
            label="Contact"
            title="Get in Touch"
            description="Inputs are sanitized, validated, and stored securely."
          />

          {/* Two-column layout: form | info panel */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12">

            {/* ── Left: Form (3/5) ── */}
            <div className="lg:col-span-3">
              {/* Status alerts */}
              {status === 'success' && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-xl text-sm mb-5"
                  style={{ backgroundColor: 'rgba(34,197,94,0.07)', boxShadow: '0 0 0 1px rgba(34,197,94,0.2)', color: 'var(--success)' }}
                >
                  ✓ Message sent. I&apos;ll get back to you within 24 hours.
                </motion.div>
              )}
              {status === 'error' && submitErr && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-xl text-sm mb-5"
                  style={{ backgroundColor: 'rgba(239,68,68,0.07)', boxShadow: '0 0 0 1px rgba(239,68,68,0.2)', color: 'var(--danger)' }}
                >
                  {submitErr}
                </motion.div>
              )}

              <form onSubmit={onSubmit} noValidate id="contact-form" className="space-y-4">
                {/* Name + Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="contact-name" className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
                      Name *
                    </label>
                    <input
                      id="contact-name" type="text" name="name" value={form.name}
                      onChange={onChange} maxLength={100} autoComplete="name"
                      className={inputClass(errors.name)} placeholder="Your name"
                      style={fieldStyle}
                    />
                    {errors.name && <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>{errors.name}</p>}
                  </div>
                  <div>
                    <label htmlFor="contact-email" className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
                      Email *
                    </label>
                    <input
                      id="contact-email" type="email" name="email" value={form.email}
                      onChange={onChange} maxLength={200} autoComplete="email"
                      className={inputClass(errors.email)} placeholder="you@email.com"
                      style={fieldStyle}
                    />
                    {errors.email && <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>{errors.email}</p>}
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label htmlFor="contact-subject" className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
                    Subject
                  </label>
                  <input
                    id="contact-subject" type="text" name="subject" value={form.subject}
                    onChange={onChange} maxLength={200}
                    className={inputClass(false)} placeholder="What's this about?"
                    style={fieldStyle}
                  />
                </div>

                {/* Message */}
                <div>
                  <label htmlFor="contact-message" className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
                    Message *
                  </label>
                  <textarea
                    id="contact-message" name="message" value={form.message}
                    onChange={onChange} rows={6} maxLength={2000}
                    className={`${inputClass(errors.message)} resize-y min-h-[140px]`}
                    placeholder="Describe your project, question, or opportunity..."
                    style={fieldStyle}
                  />
                  {errors.message && <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>{errors.message}</p>}
                  <p className="mt-1 text-[10px] font-mono text-right" style={{ color: 'var(--text-muted)' }}>
                    {form.message.length}/2000
                  </p>
                </div>

                {/* Submit */}
                <Button type="submit" size="lg" loading={status === 'submitting'} disabled={status === 'submitting'} id="contact-submit">
                  {status === 'submitting' ? 'Sending...' : (
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
            <div className="lg:col-span-2 space-y-6">

              {/* Contact details */}
              <div
                className="rounded-2xl p-5"
                style={{ boxShadow: 'var(--shadow-card)', backgroundColor: 'var(--bg-card)' }}
              >
                <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>
                  Contact Details
                </p>
                <div className="space-y-4">
                  {CONTACT_INFO.map((item) => (
                    <div key={item.label} className="flex items-start gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: 'var(--accent-glow)', color: 'var(--accent)' }}
                      >
                        {item.icon}
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                          {item.label}
                        </p>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {item.value}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Availability */}
              <div
                className="rounded-2xl p-5"
                style={{ boxShadow: 'var(--shadow-card)', backgroundColor: 'var(--bg-card)' }}
              >
                <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>
                  Availability
                </p>
                <div className="space-y-2.5">
                  {AVAILABILITY.map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{
                          backgroundColor: item.available ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                          color: item.available ? 'var(--success)' : 'var(--danger)',
                        }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.available ? 'var(--success)' : 'var(--danger)' }} />
                        {item.available ? 'Open' : 'Closed'}
                      </span>
                    </div>
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
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--success)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span className="text-xs font-semibold" style={{ color: 'var(--success)' }}>Security</span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  XSS prevention · Input sanitization · Rate limiting · Data encrypted at rest
                </p>
              </div>
            </div>
          </div>
        </Container>
      </Section>
    </PageWrapper>
  );
}
