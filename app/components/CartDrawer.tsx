// Slide-out cart drawer (Boult-style): free-shipping progress, line items with
// qty steppers, savings banner, totals, and checkout. Opens from the cart icon
// or after adding a product. Backed by the client-side zustand cart (demo).
import {useEffect, useState} from 'react';
import {Link} from 'react-router';
import {useCartStore} from '~/stores/cart';
import {useUiStore} from '~/stores/ui';
import {formatPrice, discountPct} from '~/lib/format';

const FREE_SHIP = 99900; // ₹999 free-shipping threshold (paise)

export function CartDrawer() {
  const open = useUiStore((s) => s.cartOpen);
  const close = useUiStore((s) => s.closeCart);

  const items = useCartStore((s) => s.items);
  const setQty = useCartStore((s) => s.setQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const subtotal = useCartStore((s) => s.subtotal());

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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

  const count = items.reduce((n, i) => n + i.qty, 0);
  const savings = items.reduce(
    (s, i) => s + Math.max(0, i.mrp - i.price) * i.qty,
    0,
  );
  const remaining = Math.max(0, FREE_SHIP - subtotal);
  const shipPct = Math.min(100, Math.round((subtotal / FREE_SHIP) * 100));

  return (
    <>
      <div
        className={`cart-overlay ${open ? 'is-open' : ''}`}
        onClick={close}
        aria-hidden={!open}
      />
      <aside
        className={`cart-drawer ${open ? 'is-open' : ''}`}
        role="dialog"
        aria-label="Shopping cart"
        aria-hidden={!open}
      >
        <header className="cart-drawer__head">
          <span className="cart-drawer__title">
            Your Cart {mounted && `(${count} item${count === 1 ? '' : 's'})`}
          </span>
          <button
            className="cart-drawer__close"
            onClick={close}
            aria-label="Close cart"
          >
            ✕
          </button>
        </header>

        {!mounted ? (
          <div className="cart-drawer__body">Loading…</div>
        ) : items.length === 0 ? (
          <div className="cart-drawer__body cart-drawer__empty">
            <p>Your cart is empty.</p>
            <Link to="/collections/all" className="btn btn--primary" onClick={close}>
              Start shopping
            </Link>
          </div>
        ) : (
          <>
            <div className="cart-drawer__body">
              <div className="ship-bar">
                {remaining > 0 ? (
                  <span>
                    You’re <strong>{formatPrice(remaining)}</strong> away from{' '}
                    <strong>free shipping</strong>
                  </span>
                ) : (
                  <span>
                    🎉 You’ve unlocked <strong>free shipping</strong>!
                  </span>
                )}
                <div className="ship-bar__track">
                  <div className="ship-bar__fill" style={{width: `${shipPct}%`}} />
                </div>
              </div>

              <ul className="dlines">
                {items.map((i) => {
                  const off = discountPct(i.price, i.mrp);
                  return (
                    <li key={i.productId} className="dline">
                      {i.image ? (
                        <img className="dline__img" src={i.image} alt={i.name} />
                      ) : (
                        <span className="dline__img dline__img--empty" aria-hidden />
                      )}
                      <div className="dline__info">
                        <Link
                          to={`/products/${i.slug}`}
                          className="dline__name"
                          onClick={close}
                        >
                          {i.name}
                        </Link>
                        <div className="dline__pricing">
                          <span className="dline__price">{formatPrice(i.price)}</span>
                          {off > 0 && (
                            <span className="dline__mrp">{formatPrice(i.mrp)}</span>
                          )}
                          {off > 0 && <span className="dline__off">{off}% OFF</span>}
                        </div>
                        <div className="qty">
                          <button
                            onClick={() => setQty(i.productId, i.qty - 1)}
                            aria-label="Decrease"
                          >
                            −
                          </button>
                          <span>{i.qty}</span>
                          <button
                            onClick={() => setQty(i.productId, i.qty + 1)}
                            aria-label="Increase"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <button
                        className="dline__remove"
                        onClick={() => removeItem(i.productId)}
                        aria-label="Remove"
                      >
                        🗑
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <footer className="cart-drawer__foot">
              {savings > 0 && (
                <div className="cart-savings">
                  You saved {formatPrice(savings)} 🎉
                </div>
              )}
              <div className="summary__row summary__row--total">
                <span>Total</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <Link
                to="/checkout"
                className="btn btn--primary btn--block"
                onClick={close}
              >
                Checkout · {formatPrice(subtotal)}
              </Link>
              <p className="cart-drawer__note">Inclusive of all taxes</p>
            </footer>
          </>
        )}
      </aside>
    </>
  );
}
