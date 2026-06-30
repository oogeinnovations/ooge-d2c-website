import {
  Await,
  useLoaderData,
  useRouteLoaderData,
  Link,
  type MetaFunction,
  type LoaderFunctionArgs,
} from 'react-router';
import {Suspense} from 'react';
import type {RootLoader} from '~/root';
import {HeroCarousel} from '~/components/HeroCarousel';
import {FeatureStrip} from '~/components/FeatureStrip';
import {ProductCarousel} from '~/components/ProductCarousel';
import {ProductCard} from '~/components/ProductCard';
import {mapProduct} from '~/lib/product';
import {CategoryStrip} from '~/components/CategoryStrip';
import {LifestyleTiles} from '~/components/LifestyleTiles';
import {SkeletonRow} from '~/components/SkeletonRow';
import {Fluencers} from '~/components/Fluencers';
import {Newsletter} from '~/components/Newsletter';

export const meta: MetaFunction = () => {
  return [{title: 'OOGE | Premium Mobile Accessories'}];
};

const PRODUCT_FRAGMENT = `#graphql
  fragment ProductCard on Product {
    id title handle tags description productType availableForSale
    priceRange { minVariantPrice { amount currencyCode } }
    compareAtPriceRange { minVariantPrice { amount currencyCode } }
    featuredImage { url altText }
    images(first: 1) { nodes { id url width height altText } }
    variants(first: 1) {
      nodes {
        id availableForSale
        price { amount currencyCode }
        compareAtPrice { amount currencyCode }
        image { url altText }
      }
    }
  }
` as const;

export async function loader({context}: LoaderFunctionArgs) {
  const {storefront} = context;

  // Product rows — deferred (stream in below the fold). Collections come from
  // the root loader (admin), so they aren't re-queried here.
  const newArrivals = storefront.query(NEW_ARRIVALS_QUERY);
  const bestsellers = storefront.query(BESTSELLERS_QUERY);
  const topDeals = storefront.query(TOP_DEALS_QUERY);

  return {newArrivals, bestsellers, topDeals};
}

export default function Homepage() {
  const {newArrivals, bestsellers, topDeals} = useLoaderData<typeof loader>();

  // Categories come straight from Shopify admin (collections), loaded once in
  // the root loader and shared across the header, hero, tiles and footer.
  const rootData = useRouteLoaderData<RootLoader>('root');
  const collections = rootData?.collections ?? [];

  return (
    <main>
      {/* Category strip (admin collections) */}
      <CategoryStrip collections={collections} />

      {/* Hero carousel (admin collections) */}
      <HeroCarousel collections={collections} />

      {/* Trust strip */}
      <FeatureStrip />

      {/* Newly In */}
      <section>
        <div className="container section">
          <div className="section__head">
            <div className="section__heading">
              <span className="section__eyebrow">Just dropped</span>
              <h2 className="section-title">Newly In</h2>
            </div>
            <Link to="/collections/all" className="section__link">
              View all →
            </Link>
          </div>
          <Suspense fallback={<SkeletonRow />}>
            <Await resolve={newArrivals}>
              {(data: any) => (
                <ProductCarousel>
                  {(data?.products?.nodes ?? []).map((p: any) => (
                    <ProductCard key={p.id} product={mapProduct(p)} />
                  ))}
                </ProductCarousel>
              )}
            </Await>
          </Suspense>
        </div>
      </section>

      {/* Shop by category (admin collections) */}
      <section className="container section">
        <div className="section__head">
          <div className="section__heading">
            <span className="section__eyebrow">Find your fit</span>
            <h2 className="section-title">Shop by category</h2>
          </div>
        </div>
        <LifestyleTiles collections={collections} />
      </section>

      {/* Bestsellers */}
      <section className="row-band row-band--light">
        <div className="container section">
          <div className="section__head">
            <div className="section__heading">
              <span className="section__eyebrow">Most loved</span>
              <h2 className="section-title">Bestsellers</h2>
            </div>
            <Link to="/collections/all" className="section__link">
              View all →
            </Link>
          </div>
          <Suspense fallback={<SkeletonRow />}>
            <Await resolve={bestsellers}>
              {(data: any) => (
                <ProductCarousel>
                  {(data?.products?.nodes ?? []).map((p: any) => (
                    <ProductCard key={p.id} product={mapProduct(p)} />
                  ))}
                </ProductCarousel>
              )}
            </Await>
          </Suspense>
        </div>
      </section>

      {/* Top Deals */}
      <section className="row-band row-band--dark">
        <div className="container section">
          <div className="section__head">
            <div className="section__heading">
              <span className="section__eyebrow">Limited-time deals</span>
              <h2 className="section-title">Top Deals</h2>
            </div>
            <Link to="/collections/all" className="section__link">
              View all →
            </Link>
          </div>
          <Suspense fallback={<SkeletonRow />}>
            <Await resolve={topDeals}>
              {(data: any) => (
                <ProductCarousel>
                  {(data?.products?.nodes ?? []).map((p: any) => (
                    <ProductCard key={p.id} product={mapProduct(p)} />
                  ))}
                </ProductCarousel>
              )}
            </Await>
          </Suspense>
        </div>
      </section>

      {/* UGC Reels */}
      <Fluencers />

      {/* Newsletter */}
      <Newsletter />
    </main>
  );
}

// Queries
const NEW_ARRIVALS_QUERY = `#graphql
  ${PRODUCT_FRAGMENT}
  query NewArrivals($country: CountryCode, $language: LanguageCode)
  @inContext(country: $country, language: $language) {
    products(first: 12, sortKey: CREATED_AT, reverse: true) {
      nodes { ...ProductCard }
    }
  }
` as const;

const BESTSELLERS_QUERY = `#graphql
  ${PRODUCT_FRAGMENT}
  query Bestsellers($country: CountryCode, $language: LanguageCode)
  @inContext(country: $country, language: $language) {
    products(first: 12, query: "tag:bestseller") {
      nodes { ...ProductCard }
    }
  }
` as const;

const TOP_DEALS_QUERY = `#graphql
  ${PRODUCT_FRAGMENT}
  query TopDeals($country: CountryCode, $language: LanguageCode)
  @inContext(country: $country, language: $language) {
    products(first: 12, query: "compare_at_price:>0") {
      nodes { ...ProductCard }
    }
  }
` as const;
