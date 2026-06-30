// Premium dark hero banner — slides built from Shopify collections (admin).
// Each slide spotlights a collection's image; the headline/sub-copy are generic
// brand lines (not category data) paired with the admin-driven category.
import {useState, useEffect, useCallback} from 'react';
import {Link} from 'react-router';
import type {MegaCollection} from '~/components/MegaMenu';

const HEADLINES = [
  {title: 'Sound that moves with you', sub: 'Premium audio engineered for deep bass and all-day comfort.'},
  {title: 'Power that never quits', sub: 'Fast, reliable gear to keep every device alive on the go.'},
  {title: 'Gear that keeps up', sub: 'Built for the commute, the gym and everything in between.'},
];

export function HeroCarousel({
  collections = [],
}: {
  collections?: MegaCollection[];
}) {
  const slides = collections.slice(0, 3);
  const [i, setI] = useState(0);
  const go = useCallback(
    (n: number) => setI((n + Math.max(slides.length, 1)) % Math.max(slides.length, 1)),
    [slides.length],
  );

  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(() => setI((p) => (p + 1) % slides.length), 5500);
    return () => clearInterval(t);
  }, [slides.length]);

  if (slides.length === 0) return null;

  return (
    <section className="herobanner">
      <div className="container herobanner__inner">
        {slides.map((c, idx) => {
          const copy = HEADLINES[idx % HEADLINES.length];
          return (
            <div
              key={c.id}
              className={`heroslide ${idx === i ? 'is-active' : ''}`}
              aria-hidden={idx !== i}
            >
              <div className="heroslide__copy">
                <span className="heroslide__eyebrow">{c.title}</span>
                <h1 className="heroslide__title">{copy.title}</h1>
                <p className="heroslide__sub">{copy.sub}</p>
                <div className="heroslide__cta">
                  <Link
                    to={`/collections/${c.handle}`}
                    className="btn btn--primary btn--lg"
                  >
                    Shop {c.title}
                  </Link>
                  <Link to="/collections/all" className="btn btn--outline btn--lg">
                    Shop all
                  </Link>
                </div>
                <div className="heroslide__proof">
                  <span className="stars">★★★★★</span>
                  <span>Rated 4.7 by 12,000+ customers</span>
                </div>
              </div>

              <div className="heroslide__art">
                <span className="heroslide__glow" aria-hidden />
                {c.image?.url && (
                  <img
                    src={c.image.url}
                    alt={c.title}
                    className="heroslide__img"
                    loading={idx === 0 ? 'eager' : 'lazy'}
                  />
                )}
              </div>
            </div>
          );
        })}

        <div className="herobanner__dots">
          {slides.map((c, idx) => (
            <button
              key={c.id}
              className={`dot ${idx === i ? 'is-active' : ''}`}
              onClick={() => go(idx)}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
