import type {MetaFunction} from 'react-router';
import {ContactForm} from '~/components/ContactForm';

export const meta: MetaFunction = () => [{title: 'Contact | Ooge'}];

export default function ContactPage() {
  return (
    <main>
      <section className="contact-top">
        <div className="container contact-top__grid">
          <div className="contact-top__text">
            <span className="contact-top__eyebrow">Get in touch</span>
            <h1>Contact us</h1>
            <p>
              Questions about an order, a product or a partnership? Leave your
              name, WhatsApp number and city and our team will get back to you
              within one business day.
            </p>
            <p>
              Prefer to talk right away? Email{' '}
              <a href="mailto:sales@ooge.in">sales@ooge.in</a> or call{' '}
              <a href="tel:+917349743401">+91 73497 43401</a>.
            </p>
          </div>
          <ContactForm />
        </div>
      </section>

      <section className="container section">
        <div className="contact-cards">
          <a className="contact-card" href="mailto:sales@ooge.in">
            <strong>Email</strong>
            <span>sales@ooge.in</span>
          </a>
          <a className="contact-card" href="tel:+917349743401">
            <strong>Phone / WhatsApp</strong>
            <span>+91 73497 43401</span>
          </a>
          <div className="contact-card">
            <strong>Hours</strong>
            <span>Mon–Sat · 10am – 7pm IST</span>
          </div>
        </div>
      </section>
    </main>
  );
}
