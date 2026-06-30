import {Link} from 'react-router';
import type {MegaCollection} from '~/components/MegaMenu';

// "Shop by category" tiles — driven entirely by Shopify collections (admin).
// Each tile shows the collection image floating on a tinted pad. Tints + blurbs
// are generic presentation cycled by index (not category data).
const TINTS = ['#dcebff', '#ffe6d6', '#eae2ff', '#ddf3e4'];
const BLURBS = [
  'Fan favourites',
  'Everyday essentials',
  'Built to last',
  'Top picks',
];

export function LifestyleTiles({
  collections = [],
}: {
  collections?: MegaCollection[];
}) {
  const tiles = collections.slice(0, 4);

  return (
    <div className="lifestyle">
      {tiles.map((c, i) => (
        <Link
          key={c.id}
          to={`/collections/${c.handle}`}
          className="lifestyle__tile"
          style={{'--tile-tint': TINTS[i % TINTS.length]} as React.CSSProperties}
        >
          <span className="lifestyle__media" aria-hidden>
            {c.image?.url && (
              <img
                src={c.image.url}
                alt=""
                width={150}
                height={150}
                className="lifestyle__img"
              />
            )}
          </span>
          <span className="lifestyle__text">
            <span className="lifestyle__label">{c.title}</span>
            <span className="lifestyle__blurb">{BLURBS[i % BLURBS.length]}</span>
            <span className="lifestyle__cta">Shop →</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
