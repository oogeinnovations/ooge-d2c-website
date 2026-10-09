# Contact form: lead storage + WhatsApp acknowledgement

What happens when a visitor submits the contact form on `/pages/contact`:

1. `app/components/ContactForm.tsx` validates the fields and POSTs JSON to
   `/api/contact`.
2. `app/routes/api.contact.tsx` re-validates server-side, then:
   - sends the visitor a WhatsApp template message with the catalogue PDF
     attached (`app/lib/whatsapp.ts`, via AiSensy), and
   - appends the lead to a Google Sheet (`app/lib/leads.ts`, via an Apps Script
     web app), recording whether the WhatsApp step succeeded.

No email is sent. Enquiry mail is the corporate gifting form's job (Web3Forms);
contact submissions are deliberately kept out of that inbox.

Both steps degrade quietly: if the sheet or AiSensy is misconfigured or down,
the visitor still sees a success message and the failure is written to the
Oxygen logs with a `[contact]` prefix. Check those logs first when something
looks wrong.

## Setup

### 1. Lead storage (Google Sheet)

Follow the instructions in the header comment of
[`scripts/contact-lead-sheet.gs`](../../scripts/contact-lead-sheet.gs). It ends
with two env vars: `CONTACT_SHEET_WEBHOOK_URL` and `CONTACT_SHEET_TOKEN`.

### 2. The catalogue PDF

WhatsApp fetches the document from a public URL, so the PDF has to be reachable
over HTTPS without auth. Simplest option is to serve it from this repo:

```
public/catalogue/ooge-catalogue.pdf
```

which publishes at `https://<your-domain>/catalogue/ooge-catalogue.pdf`. Set
that as `CONTACT_CATALOGUE_PDF_URL`.

Limits worth knowing: WhatsApp caps documents at 100 MB, and the URL must be a
direct link to the file — a Google Drive "share" link will not work, because it
returns an HTML preview page rather than the PDF bytes.

### 3. WhatsApp template and campaign (AiSensy)

You need an **approved** template with a **document header**. Create it in the
AiSensy dashboard, wait for Meta to approve it, then create an **API Campaign**
from it and set the campaign to **Live**. Set `AISENSY_CONTACT_CAMPAIGN_NAME` to
the campaign's exact name, and `AISENSY_API_KEY` to your key (Manage → API Key).

A template that suits this flow, with one body variable for the first name:

> Hi {{1}}, thanks for reaching out to Ooge! Here's our latest product
> catalogue. Our team will get back to you within one business day.

If you change the number of body variables, update `templateParams` in
`app/lib/whatsapp.ts` to match — Meta rejects the send if the counts differ.

Two rules that catch people out:

- You can only message a user first via an approved template. Free-form text is
  allowed only inside the 24-hour window after the user messages you.
- The recipient must have opted in. The form's copy tells the visitor we'll
  WhatsApp them the catalogue, which is what makes submitting the form the
  opt-in — keep that wording if you edit the form.

### 4. Environment variables

All keys are listed with comments in [`.env.example`](../../.env.example). Copy
them into `.env` for local dev, and add them to the Oxygen environment for
production (Shopify admin → Hydrogen → your storefront → Environments, or
`npx shopify hydrogen env push`).

Leaving `AISENSY_CONTACT_CAMPAIGN_NAME` or `CONTACT_CATALOGUE_PDF_URL` blank disables
the WhatsApp step cleanly: leads are still stored, and the confirmation message
drops its mention of the catalogue.

## Testing

With `npm run dev`, submit the form using a real WhatsApp number you control.
Then check, in order:

- the sheet has a new row, and its **WhatsApp ack** column reads `sent`
- the message with the PDF arrives
- the dev server console has no `[contact]` errors

If the ack column shows `failed: ...`, the detail there is AiSensy's own error
response — a Live campaign name that doesn't match exactly is the usual cause.
