import {Link, type MetaFunction} from 'react-router';
import {CorporateForm} from '~/components/CorporateForm';

export const meta: MetaFunction = () => [{title: 'Corporate Gifting | Ooge'}];

const BENEFITS = [
  {title: 'Bulk pricing', sub: 'Volume discounts that scale with your order.'},
  {title: 'Custom branding', sub: 'Add your logo to products and packaging.'},
  {title: 'GST invoicing', sub: 'Proper tax invoices for easy reimbursement.'},
  {title: 'Dedicated manager', sub: 'One point of contact, start to finish.'},
  {title: 'Pan-India delivery', sub: 'Ship to one address or many, tracked.'},
  {title: 'Curated gift sets', sub: 'Ready-made combos or build your own.'},
];

const OCCASIONS = [
  'Employee onboarding',
  'Diwali & festive gifting',
  'Work anniversaries',
  'Client appreciation',
  'Events & conferences',
  'Sales incentives',
];

export default function CorporateGiftingPage() {
  return (
    <main className="corp">
      <section className="corp-hero">
        <div className="container corp-hero__inner">
          <span className="corp-hero__eyebrow">For business</span>
          <h1>Corporate gifting, simplified</h1>
          <p>
            Gift premium Ooge audio to your team and clients — with bulk pricing,
            custom branding and a dedicated account manager.
          </p>
          <a href="#enquire" className="btn btn--primary btn--lg">
            Request a quote
          </a>
        </div>
      </section>

      <section className="container section">
        <h2 className="section-title">Why gift with Ooge</h2>
        <div className="corp-benefits">
          {BENEFITS.map((b) => (
            <div key={b.title} className="corp-benefit">
              <strong>{b.title}</strong>
              <span>{b.sub}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="container section">
        <h2 className="section-title">Perfect for every occasion</h2>
        <div className="corp-occasions">
          {OCCASIONS.map((o) => (
            <span key={o} className="corp-chip">
              {o}
            </span>
          ))}
        </div>
      </section>

      <section className="corp-cta">
        <div className="container corp-cta__grid">
          <div className="corp-cta__text">
            <h2>Let’s build your gift</h2>
            <p>
              Tell us what you need and we’ll send a tailored quote — usually
              within one business day. Prefer to talk? Email{' '}
              <a href="mailto:sales@ooge.in">sales@ooge.in</a> or
              call <a href="tel:+919900542440">+91 99005 42440</a>.
            </p>
            <p className="corp-cta__back">
              <Link to="/collections/all">← Browse the catalog</Link>
            </p>
          </div>
          <CorporateForm />
        </div>
      </section>
    </main>
  );
}
