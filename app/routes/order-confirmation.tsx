import {useEffect, useState} from 'react';
import {Link, type MetaFunction} from 'react-router';
import {useOrderStore} from '~/stores/order';
import {formatPrice} from '~/lib/format';

// Order confirmation (client demo). Reads the last order from the order store.
export const meta: MetaFunction = () => [{title: 'Order confirmed | Ooge'}];

export default function OrderConfirmationPage() {
  const order = useOrderStore((s) => s.lastOrder);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <main className="container">Loading…</main>;

  if (!order) {
    return (
      <main className="container empty-state">
        <h1>No recent order</h1>
        <Link to="/collections/all" className="btn btn--primary">
          Continue shopping
        </Link>
      </main>
    );
  }

  return (
    <main className="container confirmation">
      <div className="confirmation__hero">
        <span className="confirmation__check" aria-hidden>
          ✓
        </span>
        <h1>Thank you, {order.customer.name.split(' ')[0]}!</h1>
        <p>
          Your order <strong>{order.id}</strong> is confirmed. A receipt has been
          sent to {order.customer.email}.
        </p>
      </div>

      <section className="summary">
        <h2>Order details</h2>
        <ul className="summary__items">
          {order.items.map((i) => (
            <li key={i.productId}>
              <span className="summary__item">
                {i.image ? (
                  <img className="summary__thumb" src={i.image} alt="" />
                ) : (
                  <span className="summary__thumb summary__thumb--empty" aria-hidden />
                )}
                {i.name} × {i.qty}
              </span>
              <span>{formatPrice(i.price * i.qty)}</span>
            </li>
          ))}
        </ul>
        <div className="summary__row">
          <span>Subtotal</span>
          <span>{formatPrice(order.subtotal)}</span>
        </div>
        <div className="summary__row">
          <span>Shipping</span>
          <span>{order.shipping === 0 ? 'Free' : formatPrice(order.shipping)}</span>
        </div>
        <div className="summary__row summary__row--total">
          <span>Total paid</span>
          <span>{formatPrice(order.total)}</span>
        </div>
      </section>

      <p className="confirmation__ship">
        Shipping to: {order.customer.address}, {order.customer.city} —{' '}
        {order.customer.pincode}
      </p>

      <Link to="/collections/all" className="btn btn--primary">
        Continue shopping
      </Link>
    </main>
  );
}
