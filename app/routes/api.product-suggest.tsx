// GET /api/product-suggest?q=… — type-ahead for the B2B returns item picker and
// the sheet's alternate-product box.
//
// Searches the whole catalogue (see app/lib/products.ts) and returns up to MAX
// product names, best match first. It never errors the page: on any failure the
// picker just shows no suggestions and the customer can still type the name by hand.
import {data} from 'react-router';
import type {Route} from './+types/api.product-suggest';
import {fetchAllProductTitles, suggestTitles} from '~/lib/products';

const MAX = 20;

export async function loader({request, context}: Route.LoaderArgs) {
  const term = (new URL(request.url).searchParams.get('q') ?? '')
    .trim()
    .slice(0, 60);
  const headers = {'Cache-Control': 'public, max-age=60'};

  if (term.length < 2) return data({items: [] as string[]}, {headers});

  try {
    const titles = await fetchAllProductTitles(context.storefront);
    return data({items: suggestTitles(titles, term, MAX)}, {headers});
  } catch (error) {
    console.error('[product-suggest]', error);
    return data({items: [] as string[]});
  }
}
