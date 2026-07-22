// Contact-us enquiry form.
//
// NOTE: this form has no backend — submitting validates the fields and shows a
// confirmation, but the enquiry is not sent or stored anywhere. Wire it to a
// delivery route before relying on it for real leads.
import {useState} from 'react';
import {validate, type Errors, type Rule} from '~/lib/validation';

type Form = {
  name: string;
  phone: string;
  email: string;
  company: string;
  city: string;
};

const EMPTY: Form = {
  name: '',
  phone: '',
  email: '',
  company: '',
  city: '',
};

const RULES: Record<string, Rule> = {
  name: {label: 'Full name', required: true},
  phone: {
    label: 'WhatsApp number',
    required: true,
    pattern: /^[0-9+\-\s]{7,15}$/,
    message: 'Enter a valid phone number',
  },
  city: {label: 'City', required: true},
  email: {label: 'Email', email: true},
};

export function ContactForm() {
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [sent, setSent] = useState(false);

  const update =
    (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => {
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
      <div className="corp-form corp-form--done" id="contact-form">
        <h3>Thanks, {form.name.split(' ')[0] || 'there'}!</h3>
        <p>
          We&rsquo;ve received your details and our team will reach out on{' '}
          <strong>{form.phone}</strong> within one business day.
        </p>
        <button
          className="btn btn--ghost"
          onClick={() => {
            setForm(EMPTY);
            setErrors({});
            setSent(false);
          }}
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <form
      className="corp-form"
      id="contact-form"
      noValidate
      onSubmit={handleSubmit}
    >
      <h3>Send us a message</h3>
      <label>
        Full name
        <input
          className={errors.name ? 'is-invalid' : undefined}
          value={form.name}
          onChange={update('name')}
        />
        {errors.name && <span className="field-error">{errors.name}</span>}
      </label>
      <div className="corp-form__row">
        <label>
          WhatsApp number
          <input
            type="tel"
            placeholder="+91 98765 43210"
            className={errors.phone ? 'is-invalid' : undefined}
            value={form.phone}
            onChange={update('phone')}
          />
          {errors.phone && <span className="field-error">{errors.phone}</span>}
        </label>
        <label>
          City
          <input
            className={errors.city ? 'is-invalid' : undefined}
            value={form.city}
            onChange={update('city')}
          />
          {errors.city && <span className="field-error">{errors.city}</span>}
        </label>
      </div>
      <div className="corp-form__row">
        <label>
          Email <span className="corp-form__opt">(optional)</span>
          <input
            type="email"
            className={errors.email ? 'is-invalid' : undefined}
            value={form.email}
            onChange={update('email')}
          />
          {errors.email && <span className="field-error">{errors.email}</span>}
        </label>
        <label>
          Company / organisation{' '}
          <span className="corp-form__opt">(optional)</span>
          <input value={form.company} onChange={update('company')} />
        </label>
      </div>
      <button type="submit" className="btn btn--primary btn--block">
        Send message
      </button>
      <p className="corp-form__note">
        We typically reply within 1 business day
      </p>
    </form>
  );
}
