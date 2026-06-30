import type {Product} from '~/lib/product';

// Long-form PDP content (Boult-style): alternating feature banners and a video
// block. Banners reuse the product image — swap for real lifestyle/feature
// shots and a video URL when you have them.
const SUBS = [
  'Engineered for everyday life — comfortable, durable and ready when you are.',
  'Premium materials and tuning, so every track sounds the way it should.',
  'Built to keep up with your day, from the commute to the gym and back.',
];

export function ProductStory({
  product,
  highlights,
}: {
  product: Product;
  highlights: string[];
}) {
  const banners = highlights.slice(0, 3);

  return (
    <div className="story">
      {/* feature banners */}
      {banners.map((h, i) => (
        <div key={h} className={`story-banner ${i % 2 ? 'is-flipped' : ''}`}>
          <div className="story-banner__media">
            <img
              src={product.image}
              alt={product.name}
              width={420}
              height={420}
              className="story-banner__img"
            />
          </div>
          <div className="story-banner__text">
            <span className="story-banner__eyebrow">Feature {i + 1}</span>
            <h3>{h}</h3>
            <p>{SUBS[i % SUBS.length]}</p>
          </div>
        </div>
      ))}

      {/* video block (placeholder — add a real source) */}
      <div className="story-video">
        <img
          src={product.image}
          alt={product.name}
          width={520}
          height={300}
          className="story-video__poster"
        />
        <span className="story-video__play" aria-hidden>
          ▶
        </span>
        <span className="story-video__caption">Product walkthrough</span>
      </div>
    </div>
  );
}
