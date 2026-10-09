// Contact-us enquiry form.
//
// Submissions POST to `app/routes/api.contact.tsx`, which stores the lead in a
// Google Sheet and sends the visitor a WhatsApp acknowledgement with the
// catalogue PDF attached. This form intentionally sends no email — enquiry mail
// belongs to the corporate gifting form.
import {useState} from 'react';
import {validate, type Errors} from '~/lib/validation';
import {
  CONTACT_RULES as RULES,
  EMPTY_CONTACT as EMPTY,
  type ContactFormValues as Form,
} from '~/lib/contact';

export function ContactForm() {
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState('');
  // Whether the catalogue actually went out on WhatsApp. The enquiry is still a
  // success without it, so the confirmation copy adapts instead of erroring.
  const [catalogueSent, setCatalogueSent] = useState(false);

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
    setSending(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(form),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        catalogueSent?: boolean;
        error?: string;
        fieldErrors?: Errors;
      } | null;

      if (!res.ok || !data?.ok) {
        if (data?.fieldErrors) setErrors(data.fieldErrors);
        setSubmitError(
          data?.error ??
            'Something went wrong. Please WhatsApp us on +91 74838 30661.',
        );
        return;
      }

      setCatalogueSent(Boolean(data.catalogueSent));
      setSent(true);
    } catch {
      setSubmitError(
        'Network error — please WhatsApp us directly on +91 74838 30661.',
      );
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="corp-form corp-form--done" id="contact-form">
        <h3>Thanks, {form.name.split(' ')[0] || 'there'}!</h3>
        {catalogueSent ? (
          <p>
            We&rsquo;ve sent our catalogue to <strong>{form.phone}</strong> on
            WhatsApp. Our team will follow up within one business day.
          </p>
        ) : (
          <p>
            We&rsquo;ve received your details and our team will reach out on{' '}
            <strong>{form.phone}</strong> within one business day.
          </p>
        )}
        <button
          className="btn btn--ghost"
          onClick={() => {
            setForm(EMPTY);
            setErrors({});
            setSubmitError('');
            setCatalogueSent(false);
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
      onSubmit={(e) => void handleSubmit(e)}
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
      {submitError && <p className="field-error">{submitError}</p>}
      <button
        type="submit"
        className="btn btn--primary btn--block"
        disabled={sending}
      >
        {sending ? 'Sending…' : 'Send message'}
      </button>
      <p className="corp-form__note">
        We&rsquo;ll WhatsApp you our catalogue and reply within 1 business day
      </p>
    </form>
  );
}
