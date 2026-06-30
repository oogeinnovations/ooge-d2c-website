import {useState} from 'react';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Newsletter() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = email.trim();
    if (!v) return setError('Email is required');
    if (!EMAIL_RE.test(v)) return setError('Enter a valid email address');
    setError('');
    setDone(true);
  };

  return (
    <section className="newsletter">
      <div className="container newsletter__inner">
        <div>
          <h2>Get ₹100 off your first order</h2>
          <p>Join the list for drops, deals and early access.</p>
        </div>
        {done ? (
          <p className="newsletter__done">🎉 You're in! Check your inbox.</p>
        ) : (
          <div className="newsletter__capture">
            <form className="newsletter__form" noValidate onSubmit={handleSubmit}>
              <input
                type="email"
                placeholder="you@email.com"
                className={error ? 'is-invalid' : undefined}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError('');
                }}
                aria-label="Email address"
              />
              <button type="submit" className="btn btn--primary">
                Subscribe
              </button>
            </form>
            {error && <span className="field-error">{error}</span>}
          </div>
        )}
      </div>
    </section>
  );
}
