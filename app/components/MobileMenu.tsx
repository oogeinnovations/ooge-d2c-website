// Slide-out mobile navigation (left drawer). Mirrors the CartDrawer pattern:
// overlay + panel, Escape to close, body-scroll lock. Holds the search pill, the
// primary nav links, and the full category list — everything the desktop header
// nav offers, since that nav is hidden below 1080px.
import {useEffect} from 'react';
import {Link} from 'react-router';
import type {MegaCollection} from '~/components/MegaMenu';
import {SearchBar} from '~/components/SearchBar';
import {useUiStore} from '~/stores/ui';

const NAV_LINKS = [
  {to: '/pages/support', label: 'Support & Warranty'},
  {to: '/collections/all', label: 'Bestsellers'},
  {to: '/pages/corporate-gifting', label: 'Corporate Gifting'},
  {to: '/pages/b2b-returns', label: 'B2B Returns'},
  {to: '/pages/about', label: 'More'},
];

export function MobileMenu({collections}: {collections: MegaCollection[]}) {
  const open = useUiStore((s) => s.menuOpen);
  const close = useUiStore((s) => s.closeMenu);

  // close on Escape; lock body scroll while open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    if (open) document.addEventListener('keydown', onKey);
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, close]);

  return (
    <>
      <div
        className={`menu-overlay ${open ? 'is-open' : ''}`}
        onClick={close}
        aria-hidden={!open}
      />
      <aside
        className={`mobile-menu ${open ? 'is-open' : ''}`}
        role="dialog"
        aria-label="Menu"
        aria-hidden={!open}
      >
        <header className="mobile-menu__head">
          <span className="mobile-menu__title">Menu</span>
          <button
            className="mobile-menu__close"
            onClick={close}
            aria-label="Close menu"
          >
            ✕
          </button>
        </header>

        <div className="mobile-menu__body">
          <div className="mobile-menu__search">
            <SearchBar onSubmitted={close} />
          </div>

          <nav className="mobile-nav" aria-label="Mobile">
            {NAV_LINKS.map((l) => (
              <Link key={l.to} to={l.to} onClick={close}>
                {l.label}
              </Link>
            ))}
          </nav>

          {collections.length > 0 && (
            <div className="mobile-menu__cats">
              <div className="mobile-menu__cats-head">
                <span>Shop by category</span>
                <Link to="/collections/all" onClick={close}>
                  View all →
                </Link>
              </div>
              <ul className="mobile-cats">
                {collections.map((c) => (
                  <li key={c.id}>
                    <Link
                      to={`/collections/${c.handle}`}
                      className="mobile-cat"
                      onClick={close}
                    >
                      <span className="mobile-cat__media">
                        {c.image ? (
                          <img
                            src={c.image.url}
                            alt={c.title}
                            className="mobile-cat__img"
                            loading="lazy"
                          />
                        ) : (
                          <span className="mobile-cat__emoji" aria-hidden>
                            🎧
                          </span>
                        )}
                      </span>
                      <span className="mobile-cat__name">{c.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
