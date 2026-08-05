import {Suspense, useEffect, useState} from 'react';
import {Await, Link} from 'react-router';
import {MegaMenu, type MegaCollection} from '~/components/MegaMenu';
import {SearchBar} from '~/components/SearchBar';
import {useCartStore} from '~/stores/cart';
import {useUiStore} from '~/stores/ui';

// Set to true once the storefront is hosted (HTTPS) and the production
// Customer Account API callback URL is registered — then the account icon shows.
const SHOW_ACCOUNT = false;

// Boult-style header: logo + tagline, centered nav, big search pill, account + bag.
// Hovering "Categories" opens a full-width dropdown of category tiles.
export function Header({
  collections,
  isLoggedIn,
}: {
  collections: MegaCollection[];
  isLoggedIn?: Promise<boolean>;
}) {
  return (
    <header className="site-header">
      <div className="container site-header__bar">
        <MenuToggle />
        <Link to="/" className="site-header__logo" aria-label="Ooge home">
          <img
            src="/brand/ooge-innovations-lockup.svg"
            alt="Ooge Innovations Private Limited"
            width={150}
            height={47}
            className="header-lockup"
          />
          <span className="brand-tag">
            <span className="brand-tag__hl">Premium</span>
            <span className="brand-tag__txt">
              Audio Brand
              <br />
              in India
            </span>
          </span>
        </Link>

        <nav className="site-nav" aria-label="Main">
          <MegaMenu collections={collections} />
          <Link to="/pages/support">Support &amp; Warranty</Link>
          <Link to="/collections/all">Bestsellers</Link>
          <Link to="/pages/corporate-gifting">Corporate Gifting</Link>
          <Link to="/pages/about">More</Link>
        </nav>

        <div className="site-header__actions">
          <SearchBar />
          {/* Account icon — hidden until hosted: Customer Account OAuth needs
              HTTPS, so login 400s on localhost. Flip SHOW_ACCOUNT to true after
              deploying (and registering the prod /account/authorize callback). */}
          {SHOW_ACCOUNT && (
            <Suspense fallback={<AccountLink label="Account" />}>
              <Await
                resolve={isLoggedIn}
                errorElement={<AccountLink label="Sign in" />}
              >
                {(loggedIn) => (
                  <AccountLink label={loggedIn ? 'Account' : 'Sign in'} />
                )}
              </Await>
            </Suspense>
          )}
          <CartBadge />
        </div>
      </div>
    </header>
  );
}

// Hamburger — opens the slide-out mobile menu. Hidden on desktop via CSS
// (the full .site-nav shows instead above 1080px).
function MenuToggle() {
  const openMenu = useUiStore((s) => s.openMenu);
  return (
    <button
      type="button"
      className="menu-toggle"
      aria-label="Open menu"
      onClick={openMenu}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden
      >
        <path d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  );
}

// Account icon → Shopify customer account (redirects to login when signed out).
function AccountLink({label}: {label: string}) {
  return (
    <Link to="/account" className="icon-btn" aria-label={label} title={label}>
      <svg
        width="23"
        height="23"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
      </svg>
    </Link>
  );
}

// Cart icon — opens the slide-out drawer and shows a live count.
function CartBadge() {
  const count = useCartStore((s) => s.totalItems());
  const openCart = useUiStore((s) => s.openCart);

  // Avoid hydration mismatch: localStorage isn't available on the server, so
  // render the count only after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <button
      type="button"
      className="cart-badge"
      aria-label="Open cart"
      onClick={openCart}
    >
      <svg
        width="23"
        height="23"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {/* Shopping cart (wide basket + wheels) — the old tapered-bag glyph read
            as a trash bin. */}
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
      {mounted && count > 0 && <span className="cart-badge__count">{count}</span>}
    </button>
  );
}
