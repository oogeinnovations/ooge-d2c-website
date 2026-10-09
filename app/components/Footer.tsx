import {Link} from 'react-router';
import type {MegaCollection} from '~/components/MegaMenu';

const SOCIALS = [
  {
    label: 'Instagram',
    href: '#',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: 'Facebook',
    href: '#',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M13.5 21v-7h2.3l.4-2.9h-2.7V9.2c0-.8.2-1.4 1.4-1.4h1.5V5.2c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.2H8.2V14h2.3v7z" />
      </svg>
    ),
  },
  {
    label: 'X',
    href: '#',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.5 3h3l-6.6 7.5L21.8 21h-6l-4.7-6.1L5.7 21H2.6l7-8L2.3 3h6.1l4.3 5.6zm-1 16h1.6L7.6 4.7H5.8z" />
      </svg>
    ),
  },
  {
    label: 'YouTube',
    href: '#',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.5 8.2a3 3 0 0 0-2.1-2.1C18.5 5.6 12 5.6 12 5.6s-6.5 0-8.4.5A3 3 0 0 0 1.5 8.2 31 31 0 0 0 1 12a31 31 0 0 0 .5 3.8 3 3 0 0 0 2.1 2.1c1.9.5 8.4.5 8.4.5s6.5 0 8.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 23 12a31 31 0 0 0-.5-3.8zM10 15V9l5.2 3z" />
      </svg>
    ),
  },
  {
    label: 'LinkedIn',
    href: '#',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M4.98 3.5A2.5 2.5 0 1 1 5 8.5a2.5 2.5 0 0 1 0-5zM3.2 9h3.6v12H3.2zM9.3 9h3.5v1.6h.1c.5-.9 1.7-1.9 3.6-1.9 3.8 0 4.5 2.5 4.5 5.8V21h-3.6v-5.1c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7V21H9.3z" />
      </svg>
    ),
  },
];

export function Footer({collections = []}: {collections?: MegaCollection[]}) {
  return (
    <footer className="site-footer">
      <div className="container site-footer__top">
        <div className="site-footer__brand">
          <img src="/ooge-logo.png" alt="Ooge" width={36} height={36} className="logo" />
          <p>
            Shop cables, chargers, speakers, earbuds, smartwatches, mics, projectors,
            lights and holders — quality electronics shipped direct to your door.
          </p>
          <div className="foot-social">
            {SOCIALS.map((s) => (
              <a key={s.label} href={s.href} aria-label={s.label}>
                {s.icon}
              </a>
            ))}
          </div>
        </div>

        <div className="site-footer__col">
          <h4>Shop</h4>
          {collections.slice(0, 6).map((c) => (
            <Link key={c.id} to={`/collections/${c.handle}`}>
              {c.title}
            </Link>
          ))}
          <Link to="/collections/all">All products</Link>
        </div>

        <div className="site-footer__col">
          <h4>Company</h4>
          <Link to="/pages/about">About us</Link>
          <Link to="/pages/contact">Contact</Link>
          <Link to="/pages/corporate-gifting">Corporate gifting</Link>
          <Link to="/pages/about">Careers</Link>
        </div>

        <div className="site-footer__col">
          <h4>Help</h4>
          <Link to="/pages/support">Help center</Link>
          <Link to="/pages/support">Track order</Link>
          <Link to="/policies/shipping-policy">Shipping &amp; returns</Link>
          <Link to="/pages/b2b-returns">B2B returns</Link>
          <Link to="/pages/support">Warranty</Link>
        </div>
      </div>

      <div className="site-footer__bottom">
        <div className="container site-footer__bottombar">
          <div className="site-footer__legal">
            <span>© {new Date().getFullYear()} Ooge Innovations. All rights reserved.</span>
            <nav className="site-footer__policies" aria-label="Legal">
              <Link to="/policies/privacy-policy">Privacy</Link>
              <Link to="/policies/terms-of-service">Terms</Link>
              <Link to="/policies/refund-policy">Refund Policy</Link>
            </nav>
          </div>
          <div className="site-footer__pay" aria-label="Payment methods">
            <span className="pay-chip" title="Visa">
              <svg viewBox="0 0 48 16" height="15"><text x="24" y="13" textAnchor="middle" fontFamily="Arial" fontSize="13" fontWeight="800" fontStyle="italic" fill="#1434CB">VISA</text></svg>
            </span>
            <span className="pay-chip" title="Mastercard">
              <svg viewBox="0 0 48 30" height="20"><circle cx="20" cy="15" r="9" fill="#EB001B"/><circle cx="28" cy="15" r="9" fill="#F79E1B"/><path d="M24 8.2a9 9 0 0 0 0 13.6 9 9 0 0 0 0-13.6z" fill="#FF5F00"/></svg>
            </span>
            <span className="pay-chip" title="RuPay">
              <svg viewBox="0 0 52 16" height="15"><text x="1" y="13" fontFamily="Arial" fontSize="13" fontWeight="800" fill="#1A4F8B">Ru</text><text x="20" y="13" fontFamily="Arial" fontSize="13" fontWeight="800" fill="#E07A28">Pay</text></svg>
            </span>
            <span className="pay-chip" title="UPI">
              <svg viewBox="0 0 54 18" height="15"><text x="1" y="14" fontFamily="Arial" fontSize="13" fontWeight="800" fill="#2B2B2B">UPI</text></svg>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}