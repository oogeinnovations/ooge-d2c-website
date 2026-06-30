const FEATURES = [
  {icon: '🚚', title: 'Free shipping', sub: 'On orders over ₹999'},
  {icon: '🛡️', title: '1-year warranty', sub: 'On every product'},
  {icon: '↩️', title: '7-day returns', sub: 'No-questions-asked'},
  {icon: '💬', title: 'Real support', sub: 'Mon–Sat, 7-day reply'},
];

export function FeatureStrip() {
  return (
    <section className="features">
      <div className="container features__grid">
        {FEATURES.map((f) => (
          <div key={f.title} className="feature">
            <span className="feature__icon" aria-hidden>
              {f.icon}
            </span>
            <div>
              <strong>{f.title}</strong>
              <span className="feature__sub">{f.sub}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
