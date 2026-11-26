// Terms the distributor must accept before raising a B2B return.
// NOTE: the [__ months], [__ days], [__ hours] and [Bengaluru] values are still
// placeholders from the draft wording; fill them in before relying on this text.
export const TERMS: {title: string; points: {n: string; text: string}[]}[] = [
  {
    title: '1. Scope',
    points: [{n: '', text: 'These terms apply to OOGE products bought by you through OOGE’s authorised CNF or super stockist.'}],
  },
  {
    title: '2. Warranty coverage',
    points: [
      {n: '2.1', text: 'OOGE replaces products found defective due to manufacturing faults within [__ months] of the original sale.'},
      {n: '2.2', text: 'Physical damage, liquid damage, tampering, misuse, missing parts or packaging, and normal wear are not covered.'},
    ],
  },
  {
    title: '3. Raising a return',
    points: [
      {n: '3.1', text: 'Returns must be raised through the OOGE app with product names and quantities.'},
      {n: '3.2', text: 'OOGE arranges pickup only for returns approved in the app.'},
      {n: '3.3', text: 'Goods are picked up against a delivery challan.'},
    ],
  },
  {
    title: '4. Inspection',
    points: [
      {n: '4.1', text: 'OOGE inspects every unit received. OOGE’s inspection result is final.'},
      {n: '4.2', text: 'Units found defective and covered are replaced as per clause 5.'},
      {n: '4.3', text: 'Units found good or saleable are not replaced. OOGE may, at its discretion, settle them by credit note through the CNF against the original invoice.'},
      {n: '4.4', text: 'Units not covered under clause 2.2 may be returned to you, or disposed of with your consent.'},
    ],
  },
  {
    title: '5. Replacement',
    points: [
      {n: '5.1', text: 'Replacements are provided free of cost. No consideration is charged.'},
      {n: '5.2', text: 'If the same model is unavailable, OOGE may replace it with an equivalent model of similar value. You agree to accept the equivalent model.'},
      {n: '5.3', text: 'Replacements are sent on a delivery challan. Prices aren’t shown on your copy.'},
      {n: '5.4', text: 'Replacements are made for the warranty only. They are not a sale, and you may not claim input tax credit on them.'},
    ],
  },
  {
    title: '6. Acknowledgement',
    points: [
      {n: '6.1', text: 'You must sign or stamp and return the delivery challan, or confirm receipt in the app, within [__ days] of delivery.'},
      {n: '6.2', text: 'Any shortage or damage in transit must be reported within [__ hours] of delivery, or the shipment is deemed received in full.'},
    ],
  },
  {
    title: '7. Ownership',
    points: [{n: '', text: 'Defective units returned to OOGE become OOGE’s property once replaced or credited.'}],
  },
  {
    title: '8. General',
    points: [
      {n: '8.1', text: 'OOGE may update these terms. Continued use of the returns process after an update means you accept the updated terms.'},
      {n: '8.2', text: 'These terms are governed by the laws of India, and courts at [Bengaluru] have exclusive jurisdiction.'},
    ],
  },
];

/** The full terms, shown on their own page. */
export function B2BReturnTermsText() {
  return (
    <>
      <p>
        By accepting these terms, the distributor (&ldquo;you&rdquo;) agrees to
        the following for all returns sent to OOGE Innovations (&ldquo;OOGE&rdquo;).
      </p>
      {TERMS.map((s) => (
        <section key={s.title}>
          <h2>{s.title}</h2>
          {s.points.map((p) => (
            <p key={p.n || p.text}>
              {p.n && <strong>{p.n} </strong>}
              {p.text}
            </p>
          ))}
        </section>
      ))}
    </>
  );
}

/** The checkbox on the form, with a link to the full terms (opens in a new tab). */
export function B2BReturnTerms({
  checked,
  onChange,
  error,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
}) {
  return (
    <div className="b2b-terms">
      <label className="b2b-terms__check">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span>
          I have read and agree to the{' '}
          <a href="/pages/b2b-return-terms" target="_blank" rel="noopener noreferrer">
            return terms and conditions
          </a>
          .
        </span>
      </label>
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  );
}
