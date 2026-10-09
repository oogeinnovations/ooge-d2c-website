import {Link, type MetaFunction} from 'react-router';
import {WarrantyForm} from '~/components/WarrantyForm';
import {Faq} from '~/components/Faq';

export const meta: MetaFunction = () => [{title: 'Support & Warranty | Ooge'}];

const TOPICS = [
  {
    title: 'Track your order',
    sub: 'Check the status and delivery timeline of your order.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7h11v9H3z" /><path d="M14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" />
      </svg>
    ),
  },
  {
    title: 'Shipping',
    sub: 'Dispatched in 24h, delivered in 2–5 business days.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l8 4v6c0 4-3.5 7-8 8-4.5-1-8-4-8-8V7z" />
      </svg>
    ),
  },
  {
    title: 'Returns & refunds',
    sub: 'Report defects or damage — we’ll arrange a repair or replacement.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v4h4" />
      </svg>
    ),
  },
  {
    title: 'B2B returns',
    sub: 'Business customer? Request a return and we’ll send your delivery challan.',
    to: '/pages/b2b-returns',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 8l9-5 9 5v8l-9 5-9-5z" /><path d="M3 8l9 5 9-5" /><path d="M12 13v8" />
      </svg>
    ),
  },
  {
    title: 'Warranty claim',
    sub: '1-year warranty against manufacturing defects.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /><path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    title: 'Product setup',
    sub: 'Pairing guides and tips to get the most from your device.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.3 1a7 7 0 0 0-1.7-1L16.5 2h-4l-.4 2.5a7 7 0 0 0-1.7 1l-2.3-1-2 3.5L4.1 11a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.3-1a7 7 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7 7 0 0 0 1.7-1l2.3 1 2-3.5-2-1.5a7 7 0 0 0 .1-1z" />
      </svg>
    ),
  },
  {
    title: 'Talk to us',
    sub: 'Mon–Sat, 10am–7pm. We reply within one business day.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
];

const SUPPORT_FAQS = [
  {q: 'How do I claim warranty?', a: 'Register your warranty below, then reach us with your order number and a short description of the issue. We’ll arrange a repair or replacement.'},
  {q: 'What does the warranty cover?', a: 'A 1-year warranty against manufacturing defects. It does not cover physical/water damage (beyond the rated IP level) or normal wear.'},
  {q: 'How do I return an item?', a: 'Email us with your order number and a short description of the issue, and we’ll guide you through the process. The product must be unused and in its original packaging. Business customers can request a return on the B2B returns page.'},
  {q: 'When will my refund arrive?', a: 'Refunds are processed within 5–7 business days of the returned item passing inspection, to your original payment method.'},
  {q: 'Do you offer Cash on Delivery?', a: 'Yes, COD is available on most pincodes across India.'},
];

export default function SupportPage() {
  return (
    <main>
      <section className="page-hero">
        <div className="container">
          <span className="page-hero__eyebrow">We’re here to help</span>
          <h1>Support &amp; Warranty</h1>
          <p>Orders, shipping, returns and warranty — all in one place.</p>
        </div>
      </section>

      <section className="container section">
        <div className="help-grid">
          {TOPICS.map((t) => {
            const body = (
              <>
                <span className="help-card__icon" aria-hidden>
                  {t.icon}
                </span>
                <strong>{t.title}</strong>
                <span className="help-card__sub">{t.sub}</span>
              </>
            );
            return t.to ? (
              <Link key={t.title} to={t.to} className="help-card">
                {body}
              </Link>
            ) : (
              <div key={t.title} className="help-card">
                {body}
              </div>
            );
          })}
        </div>
      </section>

      <section className="support-warranty">
        <div className="container support-warranty__grid">
          <div className="support-warranty__text">
            <h2>1-year warranty, on every product</h2>
            <p>
              Every Ooge product is covered against manufacturing defects for 12
              months. Register within 30 days of purchase to activate full
              coverage and faster claims.
            </p>
            <ul className="support-list">
              <li>Covers manufacturing &amp; functional defects</li>
              <li>Free repair or replacement</li>
              <li>Hassle-free claims with your order number</li>
            </ul>
          </div>
          <WarrantyForm />
        </div>
      </section>

      <section className="container section">
        <h2 className="section-title">Contact us</h2>
        <div className="contact-cards">
          <a className="contact-card" href="mailto:sales@ooge.in">
            <strong>Email</strong>
            <span>sales@ooge.in</span>
          </a>
          <a className="contact-card" href="tel:+919900542440">
            <strong>Phone</strong>
            <span>+91 99005 42440</span>
          </a>
          <a className="contact-card" href="https://wa.me/917483830661" target="_blank" rel="noreferrer">
            <strong>WhatsApp</strong>
            <span>+91 74838 30661</span>
          </a>
          <div className="contact-card">
            <strong>Hours</strong>
            <span>Mon–Sat · 10am – 7pm IST</span>
          </div>
        </div>
      </section>

      <section className="container section">
        <h2 className="section-title">Frequently asked questions</h2>
        <Faq items={SUPPORT_FAQS} />
      </section>
    </main>
  );
}
