import {useLoaderData, useSearchParams} from 'react-router';
import type {Route} from './+types/collections.$handle';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {mapProduct} from '~/lib/product';
import {applyShopFilters, colorsFor, priceBoundsFor} from '~/lib/shop';
import {ProductGrid} from '~/components/ProductGrid';
import {FilterSidebar} from '~/components/FilterSidebar';
import {SortBar} from '~/components/SortBar';

export const meta: Route.MetaFunction = ({data}) => {
  return [{title: `${data?.collection?.title ?? 'Collection'} | Ooge`}];
};

export async function loader(args: Route.LoaderArgs) {
  const {context, params, request} = args;
  const {handle} = params;
  const {storefront} = context;
  if (!handle) throw new Response('Collection handle is required', {status: 404});

  const {collection} = await storefront.query(COLLECTION_QUERY, {
    variables: {handle},
  });
  if (!collection) throw new Response(`Collection ${handle} not found`, {status: 404});

  redirectIfHandleIsLocalized(request, {handle, data: collection});

  const all = (collection.products?.nodes ?? []).map((n: any) => mapProduct(n));

  return {
    collection: {
      title: collection.title,
      handle: collection.handle,
      description: collection.description,
    },
    all,
  };
}

export default function Collection() {
  const {collection, all} = useLoaderData<typeof loader>();
  const [params] = useSearchParams();

  const products = applyShopFilters(all, params);
  const colors = colorsFor(all);
  const priceBounds = priceBoundsFor(all);

  return (
    <main className="container section">
      <header className="page-head">
        <h1>{collection.title}</h1>
        {collection.description && <p>{collection.description}</p>}
      </header>

      <div className="shop-layout">
        <FilterSidebar
          key={`${priceBounds.min}-${priceBounds.max}`}
          colors={colors}
          priceBounds={priceBounds}
          hideCategory
        />
        <div className="shop-main">
          <SortBar count={products.length} />
          <ProductGrid products={products} />
        </div>
      </div>
    </main>
  );
}

const COLLECTION_QUERY = `#graphql
  query OogeCollection(
    $country: CountryCode
    $language: LanguageCode
    $handle: String!
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      id
      handle
      title
      description
      products(first: 100) {
        nodes {
          id
          title
          handle
          description
          productType
          tags
          availableForSale
          featuredImage {
            url
            altText
          }
          options {
            name
            optionValues {
              name
            }
          }
          images(first: 1) {
            nodes {
              url
              altText
            }
          }
          variants(first: 1) {
            nodes {
              id
              availableForSale
              price {
                amount
                currencyCode
              }
              compareAtPrice {
                amount
                currencyCode
              }
              image {
                url
                altText
              }
            }
          }
        }
      }
    }
  }
` as const;
