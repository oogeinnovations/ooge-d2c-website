// Full-bleed hero banner carousel. Each slide is a fully-designed marketing
// banner (headline, CTA and background are baked INTO the image), so there is
// deliberately NO code-rendered text/button overlay here.
//
// Desktop shows the wide ~1920x700 image; phones (<=760px) show the portrait
// ~750x1000 image via <picture>. To add/swap a banner: drop the files in
// /public/banners and edit the BANNERS list below.
import {useState, useEffect, useCallback} from 'react';
import {Link} from 'react-router';

type Banner = {
  id: string;
  alt: string;
  href: string; // click target — verify these handles exist in Shopify
  desktop: string; // wide image (~1920x700)
  mobile?: string; // portrait image (~750x1000); falls back to `desktop`
};

const BANNERS: Banner[] = [
  {
    id: 'dot',
    alt: 'DOT true wireless earbuds — mighty sound, 60 hrs playtime',
    href: '/collections/earbuds',
    desktop: '/banners/dot-desktop.webp',
    mobile: '/banners/dot-mobile.webp',
  },
  {
    id: 'tune27',
    alt: 'TUNE 27 wireless neckband — 40 hrs playtime',
    href: '/collections/neckbands',
    desktop: '/banners/tune27-desktop.webp',
    mobile: '/banners/tune27-mobile.webp',
  },
  {
    id: 'charge1pro',
    alt: 'CHARGE 1 PRO — 18W superfast wall charger',
    href: '/collections/chargers',
    desktop: '/banners/charge1pro-desktop.webp',
    mobile: '/banners/charge1pro-mobile.webp',
  },
  {
    id: 'ogempire',
    alt: 'OG EMPIRE smartwatch — BT calling, 1.9" display',
    href: '/collections/smartwatches',
    desktop: '/banners/ogempire-desktop.webp',
    mobile: '/banners/ogempire-mobile.webp',
  },
];

export function HeroCarousel() {
  const slides = BANNERS;
  const [i, setI] = useState(0);
  const go = useCallback(
    (n: number) => setI((n + slides.length) % slides.length),
    [slides.length],
  );

  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(() => setI((p) => (p + 1) % slides.length), 5500);
    return () => clearInterval(t);
  }, [slides.length]);

  if (slides.length === 0) return null;

  return (
    <section className="herobanner" aria-roledescription="carousel">
      <div className="herobanner__inner">
        {slides.map((b, idx) => (
          <div
            key={b.id}
            className={`heroslide ${idx === i ? 'is-active' : ''}`}
            aria-hidden={idx !== i}
          >
            <Link className="heroslide__link" to={b.href} aria-label={b.alt}>
              <picture>
                {b.mobile && (
                  <source media="(max-width: 760px)" srcSet={b.mobile} />
                )}
                <img
                  className="heroslide__img"
                  src={b.desktop}
                  alt={b.alt}
                  width={1920}
                  height={700}
                  loading={idx === 0 ? 'eager' : 'lazy'}
                  decoding="async"
                />
              </picture>
            </Link>
          </div>
        ))}

        <div className="herobanner__dots">
          {slides.map((b, idx) => (
            <button
              key={b.id}
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
