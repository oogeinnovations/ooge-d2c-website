// B2B return request form. Submissions POST to `app/routes/api.b2b-return.tsx`,
// which appends them to the returns Google Sheet for the team to review.
import {useRef, useState} from 'react';
import {ItemPicker} from '~/components/ItemPicker';
import {validate, type Errors} from '~/lib/validation';
import {
  EMPTY_RETURN,
  RETURN_REASONS,
  RETURN_RULES,
  validateItems,
  type B2BReturnValues,
} from '~/lib/b2bReturn';

type FlatKey = Exclude<keyof B2BReturnValues, 'items'>;

export function B2BReturnForm() {
  const [form, setForm] = useState<B2BReturnValues>(EMPTY_RETURN);
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [returnId, setReturnId] = useState('');
  // Bulk upload (Excel/CSV): what happened, and any problems found in the file.
  const [bulkMsg, setBulkMsg] = useState('');
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const clearError = (key: string) =>
    setErrors((prev) => (prev[key] ? {...prev, [key]: ''} : prev));

  const update =
    (key: FlatKey) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((f) => ({...f, [key]: e.target.value}));
      clearError(key);
    };

  const updateItem = (
    i: number,
    key: 'name' | 'qty' | 'reason' | 'note',
    value: string,
  ) => {
    setForm((f) => ({
      ...f,
      items: f.items.map((item, idx) =>
        idx === i ? {...item, [key]: value} : item,
      ),
    }));
    clearError(`item-${i}-${key}`);
  };

  const addItem = () =>
    setForm((f) => ({
      ...f,
      items: [...f.items, {name: '', qty: '1', reason: '', note: ''}],
    }));

  const removeItem = (i: number) => {
    setForm((f) => ({...f, items: f.items.filter((_, idx) => idx !== i)}));
    // Row indexes shift after a removal, so stale item errors would land on the
    // wrong row. Drop them; submit re-validates anyway.
    setErrors((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(([k]) => !k.startsWith('item-')),
      ),
    );
  };

  const onBulkFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // so the same file can be chosen again after fixing it
    if (!file) return;
    setBulkBusy(true);
    setBulkMsg('');
    setBulkErrors([]);
    try {
      // Loaded on demand: the spreadsheet reader is only needed for this.
      const {parseReturnFile} = await import('~/lib/returnUpload');
      const {items, errors: problems} = await parseReturnFile(file);
      if (problems.length) {
        setBulkErrors(problems.slice(0, 15));
        setBulkMsg(
          `${problems.length} problem${problems.length === 1 ? '' : 's'} found in the file, so nothing was added. Fix ${problems.length === 1 ? 'it' : 'them'} and upload again.`,
        );
        return;
      }
      if (items.length === 0) {
        setBulkMsg(
          'No products with a Quantity were found. Enter a Quantity and Reason against the products you are returning.',
        );
        return;
      }
      // Keep rows already typed by hand; drop the untouched blank starter row.
      setForm((f) => ({
        ...f,
        items: [...f.items.filter((i) => i.name.trim() !== ''), ...items],
      }));
      setErrors((prev) =>
        Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith('item-'))),
      );
      setBulkMsg(`Added ${items.length} item${items.length === 1 ? '' : 's'} from the file. Check them below.`);
    } catch {
      setBulkMsg('Could not read that file. Please upload the Excel template you downloaded (.xlsx), or a .csv file.');
    } finally {
      setBulkBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = {
      ...validate(form as unknown as Record<string, string>, RETURN_RULES),
      ...validateItems(form.items),
    };
    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }
    setSending(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/b2b-return', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(form),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        returnId?: string;
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
      setReturnId(data.returnId ?? '');
    } catch {
      setSubmitError(
        'Network error — please WhatsApp us directly on +91 74838 30661.',
      );
    } finally {
      setSending(false);
    }
  };

  if (returnId) {
    return (
      <div className="corp-form corp-form--done" id="b2b-return-form">
        <h3>Return request received ✓</h3>
        <p>
          Your reference is <strong>{returnId}</strong>. We&rsquo;ll review it
          and WhatsApp <strong>{form.whatsapp}</strong> once it&rsquo;s approved,
          along with your delivery challan.
        </p>
        <button
          className="btn btn--ghost"
          onClick={() => {
            setForm(EMPTY_RETURN);
            setErrors({});
            setSubmitError('');
            setReturnId('');
          }}
        >
          Submit another return
        </button>
      </div>
    );
  }

  const field = (key: FlatKey) => (errors[key] ? 'is-invalid' : undefined);
  const err = (key: string) =>
    errors[key] ? <span className="field-error">{errors[key]}</span> : null;

  return (
    <form
      className="corp-form"
      id="b2b-return-form"
      noValidate
      onSubmit={(e) => void handleSubmit(e)}
    >
      <h3>Request a return</h3>
      <label>
        Store name
        <input
          className={field('company')}
          value={form.company}
          onChange={update('company')}
        />
        {err('company')}
      </label>
      <div className="corp-form__row">
        <label>
          Phone number
          <input
            type="tel"
            className={field('phone')}
            value={form.phone}
            onChange={update('phone')}
          />
          {err('phone')}
        </label>
        <label>
          WhatsApp number
          <input
            type="tel"
            placeholder="+91 98765 43210"
            className={field('whatsapp')}
            value={form.whatsapp}
            onChange={update('whatsapp')}
          />
          {err('whatsapp')}
        </label>
      </div>
      <div className="b2b-bulk">
        <strong>Returning many items?</strong>
        <p>
          Download the template. Our product names are already filled in. Enter
          the Quantity and choose a Reason only for the products you are
          returning, then upload it.
        </p>
        <div className="b2b-bulk__buttons">
          <a className="btn btn--ghost" href="/api/returns-template" download>
            Download template
          </a>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={bulkBusy}
            onClick={() => fileRef.current?.click()}
          >
            {bulkBusy ? 'Reading…' : 'Upload filled file'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.csv"
            hidden
            onChange={(e) => void onBulkFile(e)}
          />
        </div>
        {bulkMsg && (
          <p className={bulkErrors.length ? 'field-error' : 'b2b-bulk__ok'}>{bulkMsg}</p>
        )}
        {bulkErrors.length > 0 && (
          <ul className="b2b-bulk__errors">
            {bulkErrors.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )}
      </div>

      <fieldset className="b2b-items">
        <legend>Items to return</legend>
        {form.items.map((item, i) => (
          <div className="b2b-items__row" key={i}>
            <label>
              {i === 0 && 'Item name'}
              <ItemPicker
                label={`Item ${i + 1} name`}
                invalid={Boolean(errors[`item-${i}-name`])}
                value={item.name}
                onChange={(v) => updateItem(i, 'name', v)}
              />
              {err(`item-${i}-name`)}
            </label>
            <label className="b2b-items__qty">
              {i === 0 && 'Qty'}
              <input
                aria-label={`Item ${i + 1} quantity`}
                type="number"
                min={1}
                inputMode="numeric"
                className={errors[`item-${i}-qty`] ? 'is-invalid' : undefined}
                value={item.qty}
                onChange={(e) => updateItem(i, 'qty', e.target.value)}
              />
              {err(`item-${i}-qty`)}
            </label>
            <label className="b2b-items__reason">
              {i === 0 && 'Reason for returning this item'}
              <select
                aria-label={`Item ${i + 1} reason`}
                className={
                  errors[`item-${i}-reason`] ? 'is-invalid' : undefined
                }
                value={item.reason}
                onChange={(e) => updateItem(i, 'reason', e.target.value)}
              >
                <option value="">Select a reason</option>
                {RETURN_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              {err(`item-${i}-reason`)}
            </label>
            {item.reason === 'Other' && (
              <label className="b2b-items__reason">
                <input
                  aria-label={`Item ${i + 1} reason details`}
                  placeholder="Describe the reason"
                  className={
                    errors[`item-${i}-note`] ? 'is-invalid' : undefined
                  }
                  value={item.note}
                  onChange={(e) => updateItem(i, 'note', e.target.value)}
                />
                {err(`item-${i}-note`)}
              </label>
            )}
            {form.items.length > 1 && (
              <button
                type="button"
                className="b2b-items__remove"
                aria-label={`Remove item ${i + 1}`}
                onClick={() => removeItem(i)}
              >
                ×
              </button>
            )}
          </div>
        ))}
        {err('items')}
        <button type="button" className="btn btn--ghost" onClick={addItem}>
          + Add another item
        </button>
      </fieldset>

      <label>
        Pickup address
        <textarea
          rows={3}
          className={errors.pickupAddress ? 'is-invalid' : undefined}
          value={form.pickupAddress}
          onChange={update('pickupAddress')}
        />
        {err('pickupAddress')}
      </label>
      <label>
        Pincode
        <input
          inputMode="numeric"
          maxLength={6}
          className={field('pincode')}
          value={form.pincode}
          onChange={update('pincode')}
        />
        {err('pincode')}
      </label>

      {submitError && <p className="field-error">{submitError}</p>}
      <button
        type="submit"
        className="btn btn--primary btn--block"
        disabled={sending}
      >
        {sending ? 'Submitting…' : 'Submit return request'}
      </button>
      <p className="corp-form__note">
        Returns are accepted from authorised stockists and distributors only.
        Submitting a request doesn&rsquo;t guarantee approval — we&rsquo;ll
        confirm on WhatsApp.
      </p>
    </form>
  );
}
