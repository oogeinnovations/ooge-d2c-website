// GET /api/product-suggest?q=… — type-ahead for the B2B returns item picker.
//
// Returns up to MAX product names from the Storefront API, e.g. "Wavepods 1".
// Variants (colours etc.) are deliberately left out. It never errors the page: on any failure the picker
// just shows no suggestions and the customer can still type the name by hand.
import {data} from 'react-router';
import type {Route} from './+types/api.product-suggest';

const MAX = 10;

const QUERY = `
  query ReturnItemSuggest($term: String!, $first: Int!) {
    products(first: $first, query: $term) {
      nodes {
        title
      }
    }
  }
`;

type Result = {
  products: {nodes: {title: string}[]};
};

export async function loader({request, context}: Route.LoaderArgs) {
  const term = (new URL(request.url).searchParams.get('q') ?? '')
    .trim()
    .slice(0, 60);
  const headers = {'Cache-Control': 'public, max-age=60'};

  if (term.length < 2) return data({items: [] as string[]}, {headers});

  try {
    const res = (await context.storefront.query(QUERY, {
      variables: {term, first: MAX},
    })) as Result;

    const labels = (res.products?.nodes ?? []).map((p) => p.title);
    return data({items: labels}, {headers});
  } catch (error) {
    console.error('[product-suggest]', error);
    return data({items: [] as string[]});
  }
}
