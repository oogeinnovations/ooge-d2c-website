import type {MetaFunction} from 'react-router';
import {B2BReturnTermsText} from '~/components/B2BReturnTerms';

export const meta: MetaFunction = () => [
  {title: 'B2B Return Terms | Ooge'},
  {name: 'robots', content: 'noindex'},
];

export default function B2BReturnTermsPage() {
  return (
    <main>
      <section className="contact-top">
        <div className="container b2b-terms-page">
          <h1>B2B return terms and conditions</h1>
          <B2BReturnTermsText />
        </div>
      </section>
    </main>
  );
}
