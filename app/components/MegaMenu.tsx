import {Link} from 'react-router';

export type MegaCollection = {
  id: string;
  title: string;
  handle: string;
  image?: {url: string; altText?: string | null} | null;
};

// Full-width Categories dropdown — opens on hover/focus. Clean white card grid
// (distinct from the homepage circular strip and the old pastel pads).
export function MegaMenu({collections}: {collections: MegaCollection[]}) {
  return (
    <div className="has-mega">
      <Link to="/collections/all" className="has-mega__trigger">
        Categories{' '}
        <span className="caret" aria-hidden>
          ▾
        </span>
      </Link>

      <div className="mega" role="menu">
        <div className="mega__inner container">
          <div className="mega__head">
            <span className="mega__eyebrow">Shop by category</span>
            <Link to="/collections/all" className="mega__all">
              View all →
            </Link>
          </div>

          <div className="mega-grid">
            {collections.map((c) => (
              <Link
                key={c.id}
                to={`/collections/${c.handle}`}
                className="mega-card"
                role="menuitem"
              >
                <span className="mega-card__media">
                  {c.image ? (
                    <img
                      src={c.image.url}
                      alt={c.title}
                      className="mega-card__img"
                      loading="lazy"
                    />
                  ) : (
                    <span className="mega-card__emoji" aria-hidden>
                      🎧
                    </span>
                  )}
                </span>
                <span className="mega-card__name">{c.title}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
