// Product names for the B2B returns form (the item search and the Excel
// template). The whole catalogue is fetched and searched here rather than asking
// Shopify to search: Shopify's search is loose and returns its first few matches
// in its own order, so on a store with dozens of "Charge ..." products, "Charge 8"
// never made the short list however it was typed.
import type {Storefront} from '@shopify/hydrogen';

const QUERY = `
  query ReturnProductTitles($first: Int!, $after: String) {
    products(first: $first, after: $after, sortKey: TITLE) {
      nodes {
        title
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

type Page = {
  products: {
    nodes: {title: string}[];
    pageInfo: {hasNextPage: boolean; endCursor: string | null};
  };
};

// Far above any real catalogue; a guard against paging forever if Shopify's
// cursor ever misbehaves.
const MAX_PAGES = 40;
// A new product shows up in the search within this long.
const MEMO_MS = 5 * 60 * 1000;

let memo: {at: number; titles: string[]} | undefined;

/** Every product title in the store (memoised for a few minutes per worker). */
export async function fetchAllProductTitles(
  storefront: Pick<Storefront, 'query' | 'CacheNone'>,
): Promise<string[]> {
  if (memo && Date.now() - memo.at < MEMO_MS) return memo.titles;

  const titles: string[] = [];
  let after: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = (await storefront.query(QUERY, {
      variables: {first: 250, after},
      cache: storefront.CacheNone(),
    })) as Page;
    titles.push(...res.products.nodes.map((n) => n.title));
    if (!res.products.pageInfo.hasNextPage) break;
    after = res.products.pageInfo.endCursor;
  }
  memo = {at: Date.now(), titles};
  return titles;
}

const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Titles matching what was typed, best first. A title matches when it contains
 * every word typed (any order, any case), or when it contains the typed letters
 * with spaces and punctuation ignored ("charge8" finds "Charge 8").
 * Ranked: starts with what was typed, then starts with it ignoring spacing, then
 * starts with the first word, then the rest; each group in natural order, so
 * "Charge 7, Charge 8, Charge 9, Charge 10".
 */
export function suggestTitles(titles: string[], term: string, max = 20): string[] {
  const q = term.trim().toLowerCase();
  if (q.length < 2) return [];
  const words = q.split(/\s+/);
  const cq = compact(q);

  const hits: {title: string; rank: number}[] = [];
  for (const title of titles) {
    const lower = title.toLowerCase();
    const ct = compact(title);
    const matches = words.every((w) => lower.includes(w)) || (cq.length >= 2 && ct.includes(cq));
    if (!matches) continue;
    const rank = lower.startsWith(q) ? 0 : ct.startsWith(cq) ? 1 : lower.startsWith(words[0]) ? 2 : 3;
    hits.push({title, rank});
  }
  hits.sort(
    (a, b) =>
      a.rank - b.rank ||
      a.title.localeCompare(b.title, undefined, {numeric: true, sensitivity: 'base'}),
  );
  return hits.slice(0, max).map((h) => h.title);
}
