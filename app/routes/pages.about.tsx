import {Link, type MetaFunction} from 'react-router';

export const meta: MetaFunction = () => [{title: 'About | Ooge'}];

const VALUES = [
  {title: 'Sound first', sub: 'Every product is tuned for clarity, depth and balance — not just loudness.'},
  {title: 'Built to last', sub: 'Durable materials and real testing, so your gear keeps up with you.'},
  {title: 'Fair pricing', sub: 'Direct-to-consumer means premium quality without the premium markup.'},
  {title: 'Real support', sub: 'A 1-year warranty and a team that actually answers.'},
];

const STATS = [
  {num: '65+', label: 'Products'},
  {num: '8', label: 'Categories'},
  {num: '4.5★', label: 'Avg. rating'},
  {num: 'Pan-India', label: 'Delivery'},
];

export default function AboutPage() {
  return (
    <main>
      <section className="page-hero">
        <div className="container">
          <span className="page-hero__eyebrow">Our story</span>
          <h1>Audio that keeps up with you</h1>
          <p>
            Ooge is a direct-to-consumer audio brand building earbuds, neckbands,
            speakers and accessories for everyday life.
          </p>
        </div>
      </section>

      <section className="container section about-story">
        <div>
          <h2 className="section-title">Why we started</h2>
          <p>
            Great audio shouldn’t cost a fortune or fall apart in a month. We cut
            out the middlemen and obsess over the details — the fit, the tuning,
            the battery, the build — so you get gear that sounds great and lasts,
            at a price that’s actually fair.
          </p>
          <p>
            From the daily commute to the gym to movie night, Ooge is made to move
            with you.
          </p>
          <Link to="/collections/all" className="btn btn--primary">
            Shop the range
          </Link>
        </div>
        <div className="about-stats">
          {STATS.map((s) => (
            <div key={s.label} className="about-stat">
              <span className="about-stat__num">{s.num}</span>
              <span className="about-stat__label">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="container section">
        <h2 className="section-title">What we stand for</h2>
        <div className="values-grid">
          {VALUES.map((v) => (
            <div key={v.title} className="value-card">
              <strong>{v.title}</strong>
              <span>{v.sub}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="about-cta">
        <div className="container about-cta__inner">
          <h2>Ready to hear the difference?</h2>
          <Link to="/collections/all" className="btn btn--dark btn--lg">
            Explore products
          </Link>
        </div>
      </section>
    </main>
  );
}
