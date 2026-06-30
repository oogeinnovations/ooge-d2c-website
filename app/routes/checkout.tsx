import {useEffect, useState} from 'react';
import {Link, useNavigate, type MetaFunction} from 'react-router';
import {useCartStore} from '~/stores/cart';
import {useOrderStore} from '~/stores/order';
import {processCheckout} from '~/lib/checkout';
import {formatPrice} from '~/lib/format';
import {validate, type Errors, type Rule} from '~/lib/validation';

// Checkout (client demo). No backend: on submit we build an order object, stash
// it in the order store, clear the cart, and route to the confirmation page.
const SHIPPING = 4900;
const FREE_SHIPPING_THRESHOLD = 99900;

export const meta: MetaFunction = () => [{title: 'Checkout | Ooge'}];

type Form = {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  pincode: string;
};

const RULES: Record<string, Rule> = {
  name: {label: 'Full name', required: true},
  email: {label: 'Email', required: true, email: true},
  phone: {
    label: 'Phone',
    required: true,
    pattern: /^[0-9+\-\s]{7,15}$/,
    message: 'Enter a valid phone number',
  },
  address: {label: 'Address', required: true},
  city: {label: 'City', required: true},
  pincode: {
    label: 'PIN code',
    required: true,
    pattern: /^[0-9]{6}$/,
    message: 'Enter a valid 6-digit PIN code',
  },
};

export default function CheckoutPage() {
  const navigate = useNavigate();
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore((s) => s.subtotal());
  const clear = useCartStore((s) => s.clear);
  const placeOrder = useOrderStore((s) => s.placeOrder);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [form, setForm] = useState<Form>({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    pincode: '',
  });
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});

  if (!mounted) return <main className="container">Loading…</main>;

  if (items.length === 0) {
    return (
      <main className="container empty-state">
        <h1>Nothing to check out</h1>
        <Link to="/collections/all" className="btn btn--primary">
          Browse products
        </Link>
      </main>
    );
  }

  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING;
  const total = subtotal + shipping;

  const update =
    (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((f) => ({...f, [key]: e.target.value}));
      setErrors((prev) => (prev[key] ? {...prev, [key]: ''} : prev));
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate(form, RULES);
    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }
    setPlacing(true);
    setError(null);

    const order = {
      id: `OG-${Date.now().toString(36).toUpperCase()}`,
      createdAt: new Date().toISOString(),
      items,
      subtotal,
      shipping,
      total,
      customer: form,
    };

    const result = await processCheckout(order);

    if (result.status === 'failed') {
      setError(result.reason);
      setPlacing(false);
      return;
    }

    placeOrder(order);
    clear();
    navigate('/order-confirmation');
  };

  return (
    <main className="container checkout">
      <h1 className="section-title">Checkout</h1>

      <div className="checkout__grid">
        <form className="checkout__form" noValidate onSubmit={handleSubmit}>
          <h2>Shipping details</h2>
          <label>
            Full name
            <input
              className={errors.name ? 'is-invalid' : undefined}
              value={form.name}
              onChange={update('name')}
            />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </label>
          <label>
            Email
            <input
              type="email"
              className={errors.email ? 'is-invalid' : undefined}
              value={form.email}
              onChange={update('email')}
            />
            {errors.email && <span className="field-error">{errors.email}</span>}
          </label>
          <label>
            Phone
            <input
              type="tel"
              className={errors.phone ? 'is-invalid' : undefined}
              value={form.phone}
              onChange={update('phone')}
            />
            {errors.phone && <span className="field-error">{errors.phone}</span>}
          </label>
          <label>
            Address
            <input
              className={errors.address ? 'is-invalid' : undefined}
              value={form.address}
              onChange={update('address')}
            />
            {errors.address && (
              <span className="field-error">{errors.address}</span>
            )}
          </label>
          <div className="checkout__row">
            <label>
              City
              <input
                className={errors.city ? 'is-invalid' : undefined}
                value={form.city}
                onChange={update('city')}
              />
              {errors.city && <span className="field-error">{errors.city}</span>}
            </label>
            <label>
              PIN code
              <input
                inputMode="numeric"
                className={errors.pincode ? 'is-invalid' : undefined}
                value={form.pincode}
                onChange={update('pincode')}
              />
              {errors.pincode && (
                <span className="field-error">{errors.pincode}</span>
              )}
            </label>
          </div>

          <button
            type="submit"
            className="btn btn--primary btn--block"
            disabled={placing}
          >
            {placing ? 'Placing order…' : `Place order · ${formatPrice(total)}`}
          </button>
          {error && <p className="checkout__error">{error}</p>}
          <p className="checkout__note">
            Demo checkout — no payment is taken. Choose a provider later in{' '}
            <code>app/lib/checkout.ts</code>; this page won’t change.
          </p>
        </form>

        <aside className="summary">
          <h2>Order summary</h2>
          <ul className="summary__items">
            {items.map((i) => (
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
            <span>{formatPrice(subtotal)}</span>
          </div>
          <div className="summary__row">
            <span>Shipping</span>
            <span>{shipping === 0 ? 'Free' : formatPrice(shipping)}</span>
          </div>
          <div className="summary__row summary__row--total">
            <span>Total</span>
            <span>{formatPrice(total)}</span>
          </div>
        </aside>
      </div>
    </main>
  );
}
