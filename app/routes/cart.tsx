import {useEffect, useState} from 'react';
import {Link, type MetaFunction} from 'react-router';
import {useCartStore} from '~/stores/cart';
import {formatPrice} from '~/lib/format';

// Client-rendered demo cart page (visual clone of the Next.js app). Reads from
// the client-side zustand cart, not Shopify's server cart.
const SHIPPING = 4900; // ₹49 flat; free over ₹999
const FREE_SHIPPING_THRESHOLD = 99900;

export const meta: MetaFunction = () => [{title: 'Your cart | Ooge'}];

export default function CartPage() {
  const items = useCartStore((s) => s.items);
  const setQty = useCartStore((s) => s.setQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const subtotal = useCartStore((s) => s.subtotal());

  // Cart lives in localStorage → render after mount to avoid hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <main className="container">Loading cart…</main>;

  if (items.length === 0) {
    return (
      <main className="container empty-state">
        <h1>Your cart is empty</h1>
        <Link to="/collections/all" className="btn btn--primary">
          Start shopping
        </Link>
      </main>
    );
  }

  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING;

  return (
    <main className="container cart">
      <h1 className="section-title">Your cart</h1>

      <ul className="cart__list">
        {items.map((item) => (
          <li key={item.productId} className="cart-line">
            {item.image ? (
              <img className="cart-line__img" src={item.image} alt={item.name} />
            ) : (
              <span className="cart-line__img cart-line__img--empty" aria-hidden />
            )}
            <div className="cart-line__info">
              <Link to={`/products/${item.slug}`}>{item.name}</Link>
              <span className="cart-line__price">{formatPrice(item.price)}</span>
            </div>
            <div className="qty">
              <button
                onClick={() => setQty(item.productId, item.qty - 1)}
                aria-label="Decrease"
              >
                −
              </button>
              <span>{item.qty}</span>
              <button
                onClick={() => setQty(item.productId, item.qty + 1)}
                aria-label="Increase"
              >
                +
              </button>
            </div>
            <span className="cart-line__total">
              {formatPrice(item.price * item.qty)}
            </span>
            <button
              className="cart-line__remove"
              onClick={() => removeItem(item.productId)}
              aria-label="Remove"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <div className="summary">
        <div className="summary__row">
          <span>Subtotal</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        <div className="summary__row">
          <span>Shipping</span>
          <span>{shipping === 0 ? 'Free' : formatPrice(shipping)}</span>
        </div>
        <div className="summary__row summary__row--total">
          <span>Total</span>
          <span>{formatPrice(subtotal + shipping)}</span>
        </div>
        <Link to="/checkout" className="btn btn--primary btn--block">
          Proceed to checkout
        </Link>
      </div>
    </main>
  );
}
