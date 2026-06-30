// Warranty registration form. No backend — shows a success state.
import {useState} from 'react';
import {validate, type Errors, type Rule} from '~/lib/validation';

type Form = {
  name: string;
  email: string;
  order: string;
  product: string;
  purchased: string;
};
const EMPTY: Form = {name: '', email: '', order: '', product: '', purchased: ''};

const RULES: Record<string, Rule> = {
  name: {label: 'Full name', required: true},
  email: {label: 'Email', required: true, email: true},
  order: {label: 'Order / invoice no.', required: true},
  product: {label: 'Product', required: true},
};

export function WarrantyForm() {
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [sent, setSent] = useState(false);

  const update =
    (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((f) => ({...f, [k]: e.target.value}));
      setErrors((prev) => (prev[k] ? {...prev, [k]: ''} : prev));
    };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate(form, RULES);
    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <div className="support-form support-form--done">
        <h3>Warranty registered ✓</h3>
        <p>
          Order <strong>{form.order}</strong> is registered for a 1-year
          warranty. A confirmation has been sent to <strong>{form.email}</strong>.
        </p>
        <button
          className="btn btn--ghost"
          onClick={() => {
            setForm(EMPTY);
            setErrors({});
            setSent(false);
          }}
        >
          Register another
        </button>
      </div>
    );
  }

  return (
    <form className="support-form" noValidate onSubmit={handleSubmit}>
      <h3>Register your warranty</h3>
      <div className="support-form__row">
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
      </div>
      <div className="support-form__row">
        <label>
          Order / invoice no.
          <input
            className={errors.order ? 'is-invalid' : undefined}
            value={form.order}
            onChange={update('order')}
          />
          {errors.order && <span className="field-error">{errors.order}</span>}
        </label>
        <label>
          Purchase date
          <input type="date" value={form.purchased} onChange={update('purchased')} />
        </label>
      </div>
      <label>
        Product
        <input
          placeholder="e.g. Wavepods 1"
          className={errors.product ? 'is-invalid' : undefined}
          value={form.product}
          onChange={update('product')}
        />
        {errors.product && <span className="field-error">{errors.product}</span>}
      </label>
      <button type="submit" className="btn btn--primary btn--block">
        Register warranty
      </button>
      <p className="support-form__note">
        Activate within 30 days of purchase for full coverage.
      </p>
    </form>
  );
}
