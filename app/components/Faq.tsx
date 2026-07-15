// Simple FAQ accordion for the PDP / support page.
import {useState} from 'react';

const DEFAULT_FAQS = [
  {
    q: 'What warranty do I get?',
    a: 'Every product comes with a 1-year manufacturer warranty against defects. Register on the support page to activate it.',
  },
  {
    q: 'How long does delivery take?',
    a: 'Orders are dispatched in 24 hours and delivered in 2–5 business days.',
  },
  {
    q: 'Is Cash on Delivery available?',
    a: 'COD is available on most pincodes. Enter your PIN code above to confirm serviceability.',
  },
];

export function Faq({items = DEFAULT_FAQS}: {items?: {q: string; a: string}[]}) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="faq">
      {items.map((f, i) => (
        <div key={i} className={`faq__item ${open === i ? 'is-open' : ''}`}>
          <button
            className="faq__q"
            onClick={() => setOpen(open === i ? null : i)}
          >
            {f.q}
            <span className="faq__chev" aria-hidden>
              ⌄
            </span>
          </button>
          {open === i && <p className="faq__a">{f.a}</p>}
        </div>
      ))}
    </div>
  );
}
