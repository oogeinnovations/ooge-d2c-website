import type {MetaFunction} from 'react-router';
import {B2BReturnForm} from '~/components/B2BReturnForm';

export const meta: MetaFunction = () => [
  {title: 'B2B Returns | Ooge'},
  {name: 'robots', content: 'noindex'},
];

export default function B2BReturnsPage() {
  return (
    <main>
      <section className="contact-top">
        <div className="container contact-top__grid">
          <div className="contact-top__text">
            <span className="contact-top__eyebrow">For business customers</span>
            <h1>B2B returns</h1>
            <p>
              Need to return items from a business order? Fill in the details
              and our team will review your request.
            </p>
            <p>
              Once approved, we arrange the pickup and send a{' '}
              <strong>delivery challan (DC)</strong> to your WhatsApp. Print it
              and place it inside the parcel with the items before handing it
              over to the pickup executive.
            </p>
            <p>
              Questions? Email <a href="mailto:sales@ooge.in">sales@ooge.in</a>{' '}
              or WhatsApp <a href="https://wa.me/917483830661">+91 74838 30661</a>.
            </p>
          </div>
          <B2BReturnForm />
        </div>
      </section>
    </main>
  );
}
