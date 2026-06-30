import type {Route} from './+types/collections.all';
import {useLoaderData, useSearchParams} from 'react-router';
import {mapProduct} from '~/lib/product';
import {
  applyShopFilters,
  colorsFor,
  priceBoundsFor,
  categoriesFor,
} from '~/lib/shop';
import {ProductGrid} from '~/components/ProductGrid';
import {FilterSidebar} from '~/components/FilterSidebar';
import {SortBar} from '~/components/SortBar';

export const meta: Route.MetaFunction = () => {
  return [{title: 'All products | Ooge'}];
};

export async function loader({context}: Route.LoaderArgs) {
  const {storefront} = context;
  const {products} = await storefront.query(ALL_PRODUCTS_QUERY);
  const all = (products?.nodes ?? []).map((n: any) => mapProduct(n));
  return {all};
}

export default function AllProducts() {
  const {all} = useLoaderData<typeof loader>();
  const [params] = useSearchParams();

  const q = (params.get('q') ?? '').trim();
  const products = applyShopFilters(all, params);
  const categories = categoriesFor(all);
  const colors = colorsFor(all);
  const priceBounds = priceBoundsFor(all);

  return (
    <main className="container section">
      <div className="page-head">
        <h1>{q ? `Results for “${q}”` : 'All products'}</h1>
      </div>

      <div className="shop-layout">
        <FilterSidebar
          key={`${priceBounds.min}-${priceBounds.max}`}
          categories={categories}
          colors={colors}
          priceBounds={priceBounds}
        />
        <div className="shop-main">
          <SortBar count={products.length} />
          <ProductGrid products={products} />
        </div>
      </div>
    </main>
  );
}

const ALL_PRODUCTS_QUERY = `#graphql
  query OogeAllProducts($country: CountryCode, $language: LanguageCode)
  @inContext(country: $country, language: $language) {
    products(first: 250) {
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
` as const;
