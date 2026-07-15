// Pincode delivery check (demo — no real serviceability lookup).
import {useState} from 'react';

export function DeliveryCheck() {
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState<{ok: boolean; text: string} | null>(null);

  return (
    <div className="delivery">
      <span className="delivery__label">Check delivery &amp; offers</span>
      <form
        className="delivery__row"
        onSubmit={(e) => {
          e.preventDefault();
          const ok = /^[0-9]{6}$/.test(pin);
          setMsg(
            ok
              ? {
                  ok: true,
                  text: `Delivers to ${pin} in 2–5 business days`,
                }
              : {ok: false, text: 'Please enter a valid 6-digit PIN code'},
          );
        }}
      >
        <input
          inputMode="numeric"
          maxLength={6}
          placeholder="Enter PIN code"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          aria-label="PIN code"
        />
        <button type="submit" className="btn btn--ghost">
          Check
        </button>
      </form>
      {msg && (
        <p className={`delivery__msg ${msg.ok ? 'is-ok' : 'is-err'}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
