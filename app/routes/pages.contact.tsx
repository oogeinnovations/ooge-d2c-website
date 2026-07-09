import type {MetaFunction} from 'react-router';

export const meta: MetaFunction = () => [{title: 'Contact | Ooge'}];

export default function ContactPage() {
  return (
    <main className="container prose">
      <h1>Contact us</h1>
      <p>
        Questions about an order or a product? Email{' '}
        <a href="mailto:sales@ooge.in">sales@ooge.in</a> and we will
        reply within one business day.
      </p>
    </main>
  );
}
