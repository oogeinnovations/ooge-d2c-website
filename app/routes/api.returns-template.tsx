// GET /api/returns-template — the bulk-return Excel template, with every store
// product name already filled in (the customer adds Quantity and a Reason).
import type {Route} from './+types/api.returns-template';
import {buildReturnTemplate} from '~/lib/returnTemplate';

const QUERY = `
  query ReturnTemplateProducts($first: Int!, $after: String) {
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

export async function loader({context}: Route.LoaderArgs) {
  try {
    const titles: string[] = [];
    let after: string | null = null;
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = (await context.storefront.query(QUERY, {
        variables: {first: 250, after},
        // The product list barely changes; don't hit Shopify on every download.
        cache: context.storefront.CacheLong(),
      })) as Page;
      titles.push(...res.products.nodes.map((n) => n.title));
      if (!res.products.pageInfo.hasNextPage) break;
      after = res.products.pageInfo.endCursor;
    }

    const file = buildReturnTemplate(titles);
    // A plain ArrayBuffer is what Response accepts as a body.
    const body = file.buffer.slice(
      file.byteOffset,
      file.byteOffset + file.byteLength,
    ) as ArrayBuffer;
    return new Response(body, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="Ooge-return-template.xlsx"',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (error) {
    console.error('[returns-template]', error);
    return new Response(
      'Could not build the template right now. Please try again, or add your items one by one on the form.',
      {status: 502},
    );
  }
}
