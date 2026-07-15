// No shipping/delivery claims — fulfilment isn't integrated yet. These are
// brand/product promises that hold regardless of logistics.
const FEATURES = [
  {icon: '🛡️', title: '1-year warranty', sub: 'On every product'},
  {icon: '✅', title: 'Genuine products', sub: 'Straight from the brand'},
  {icon: '🔒', title: 'Secure checkout', sub: '100% safe payments'},
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
