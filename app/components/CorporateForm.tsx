// Bulk / corporate gifting inquiry form. No backend — shows a success state.
import {useState} from 'react';
import {validate, type Errors, type Rule} from '~/lib/validation';

type Form = {
  name: string;
  company: string;
  email: string;
  phone: string;
  product: string;
  quantity: string;
  message: string;
};

const EMPTY: Form = {
  name: '',
  company: '',
  email: '',
  phone: '',
  product: 'Mixed gift set',
  quantity: '25–50',
  message: '',
};

const RULES: Record<string, Rule> = {
  name: {label: 'Full name', required: true},
  company: {label: 'Company', required: true},
  email: {label: 'Work email', required: true, email: true},
  phone: {
    label: 'Phone',
    required: true,
    pattern: /^[0-9+\-\s]{7,15}$/,
    message: 'Enter a valid phone number',
  },
};

export function CorporateForm() {
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [sent, setSent] = useState(false);

  const update =
    (key: keyof Form) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => {
      setForm((f) => ({...f, [key]: e.target.value}));
      setErrors((prev) => (prev[key] ? {...prev, [key]: ''} : prev));
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
      <div className="corp-form corp-form--done" id="enquire">
        <h3>Thanks, {form.name.split(' ')[0] || 'there'}!</h3>
        <p>
          Your enquiry for <strong>{form.quantity}</strong> units is in. Our
          corporate team will reach out at <strong>{form.email}</strong> within
          one business day.
        </p>
        <button
          className="btn btn--ghost"
          onClick={() => {
            setForm(EMPTY);
            setErrors({});
            setSent(false);
          }}
        >
          Submit another
        </button>
      </div>
    );
  }

  return (
    <form className="corp-form" id="enquire" noValidate onSubmit={handleSubmit}>
      <h3>Request a quote</h3>
      <div className="corp-form__row">
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
          Company
          <input
            className={errors.company ? 'is-invalid' : undefined}
            value={form.company}
            onChange={update('company')}
          />
          {errors.company && (
            <span className="field-error">{errors.company}</span>
          )}
        </label>
      </div>
      <div className="corp-form__row">
        <label>
          Work email
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
      </div>
      <div className="corp-form__row">
        <label>
          Product interest
          <select value={form.product} onChange={update('product')}>
            <option>Mixed gift set</option>
            <option>Earbuds</option>
            <option>Neckbands</option>
            <option>Headphones</option>
            <option>Speakers</option>
            <option>Power Banks</option>
            <option>Cables &amp; accessories</option>
            <option>Not sure yet</option>
          </select>
        </label>
        <label>
          Quantity
          <select value={form.quantity} onChange={update('quantity')}>
            <option>25–50</option>
            <option>50–100</option>
            <option>100–250</option>
            <option>250–500</option>
            <option>500+</option>
          </select>
        </label>
      </div>
      <label>
        Message <span className="corp-form__opt">(optional)</span>
        <textarea
          rows={3}
          placeholder="Tell us about the occasion, branding, timeline…"
          value={form.message}
          onChange={update('message')}
        />
      </label>
      <button type="submit" className="btn btn--primary btn--block">
        Send enquiry
      </button>
      <p className="corp-form__note">
        Typical reply within 1 business day · GST invoice provided
      </p>
    </form>
  );
}
