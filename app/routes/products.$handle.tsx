import {useState} from 'react';
import {Link, useLoaderData} from 'react-router';
import type {Route} from './+types/products.$handle';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {
  mapProduct,
  productColor,
  colorHex,
  toPaise,
  type Product,
} from '~/lib/product';
import {formatPrice, discountPct} from '~/lib/format';
import {ProductGallery} from '~/components/ProductGallery';
import {PdpActions} from '~/components/PdpActions';
import {DeliveryCheck} from '~/components/DeliveryCheck';
import {ProductStory} from '~/components/ProductStory';
import {Faq} from '~/components/Faq';
import {ProductCarousel} from '~/components/ProductCarousel';
import {ProductCard} from '~/components/ProductCard';

export const meta: Route.MetaFunction = ({data}) => {
  return [
    {title: `${data?.product?.name ?? 'Product'} | Ooge`},
    {rel: 'canonical', href: `/products/${data?.product?.slug ?? ''}`},
  ];
};

// Placeholder marketing highlights per category — replace with real specs.
const HIGHLIGHTS: Record<string, string[]> = {
  earbuds: ['Active Noise Cancellation', 'Up to 30h playback', 'Bluetooth 5.3', 'IPX5 splash-proof'],
  neckbands: ['Up to 24h playback', '10-min fast charge', 'Magnetic earbuds', 'Splash resistant'],
  earphones: ['Deep-bass drivers', 'In-line mic & controls', 'Tangle-free cable', 'Lightweight fit'],
  headphones: ['40mm dynamic drivers', 'Up to 50h playback', 'Plush memory-foam cushions', 'Foldable design'],
  speakers: ['Punchy 360° sound', 'Up to 24h playback', 'IPX7 waterproof', 'TWS pairing'],
  powerbanks: ['Fast charging', 'High capacity', 'Charge 2 devices', 'Compact & travel-ready'],
  cables: ['Fast charging', 'Braided & durable', 'Tangle-free', 'Universal fit'],
  connectors: ['Plug & play', 'Durable build', 'Universal compatibility', 'Pocket-sized'],
};

const REVIEWS = [
  {name: 'Aditya R.', stars: 5, text: 'Sound quality is fantastic for the price. Battery easily lasts me two days.'},
  {name: 'Sneha K.', stars: 4, text: 'Comfortable fit and the bass is solid. Delivery was quick too.'},
];

export async function loader(args: Route.LoaderArgs) {
  const {context, params, request} = args;
  const {handle} = params;
  const {storefront} = context;
  if (!handle) throw new Error('Expected product handle to be defined');

  const {product: node} = await storefront.query(PRODUCT_QUERY, {
    variables: {handle},
  });
  if (!node?.id) throw new Response(null, {status: 404});

  redirectIfHandleIsLocalized(request, {handle, data: node});

  const product = mapProduct(node as any);
  const productImages: string[] = (node.images?.nodes ?? [])
    .map((n: any) => n?.url)
    .filter(Boolean);

  // Colour variants come from this product's Shopify variants — the colour is
  // the "Color"/"Colour" selected option on each variant. Single-variant
  // products simply have no colour, so no swatches show.
  const pdpVariants = (node.variants?.nodes ?? []).map((v: any) => ({
    id: v.id as string,
    color:
      (v.selectedOptions ?? []).find((o: any) => /colou?r/i.test(o?.name ?? ''))
        ?.value ?? null,
    image: v.image?.url ?? '',
    price: toPaise(v.price?.amount),
    mrp: toPaise(v.compareAtPrice?.amount) || toPaise(v.price?.amount),
    available: v.availableForSale ?? true,
    title: (v.title as string) ?? '',
  }));

  // Other products in the same category → "You may also like".
  let siblings: Product[] = [];
  if (node.productType) {
    const {products} = await storefront.query(SIBLINGS_QUERY, {
      variables: {query: `product_type:${JSON.stringify(node.productType)}`},
    });
    siblings = (products?.nodes ?? []).map((n: any) => mapProduct(n));
  }

  // ---- Admin-managed enrichment via product metafields (custom.*) ----------
  // Each falls back to a sensible default so the PDP works before a merchant
  // populates the metafield. Enable Storefront access on the definitions in
  // Shopify admin (Settings → Custom data → Products).
  const ratingVal = parseFloat(node.rating?.value ?? '');
  const rating = !Number.isNaN(ratingVal) ? ratingVal : product.rating;

  const ratingCountVal = parseInt(node.ratingCount?.value ?? '', 10);
  const ratingCount = !Number.isNaN(ratingCountVal)
    ? ratingCountVal
    : Math.round(rating * 53);

  const highlights =
    parseStringList(node.highlights?.value) ??
    HIGHLIGHTS[product.category] ??
    [];

  const reviews = parseReviews(node.reviews?.value) ?? REVIEWS;

  const specMeta = {
    warranty: node.warranty?.value || '1 year manufacturer warranty',
    countryOfOrigin: node.countryOfOrigin?.value || 'India',
    marketedBy: node.marketedBy?.value || 'Ooge Innovations',
  };

  return {
    product,
    productImages,
    pdpVariants,
    siblings,
    rating,
    ratingCount,
    highlights,
    reviews,
    specMeta,
  };
}

// Parse a Shopify `list.single_line_text_field` metafield (a JSON array string)
// into a string[]. Returns null if absent/invalid so callers can fall back.
function parseStringList(value?: string | null): string[] | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
      return parsed;
    }
  } catch {
    // not JSON — ignore
  }
  return null;
}

type Review = {name: string; stars: number; text: string};

// Parse a `json` metafield holding an array of {name, stars, text}. Returns null
// if absent/invalid so callers can fall back to the sample reviews.
function parseReviews(value?: string | null): Review[] | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (
      Array.isArray(parsed) &&
      parsed.every(
        (r: any) =>
          r &&
          typeof r.name === 'string' &&
          typeof r.text === 'string' &&
          typeof r.stars === 'number',
      )
    ) {
      return parsed as Review[];
    }
  } catch {
    // not JSON — ignore
  }
  return null;
}

export default function ProductPage() {
  const {
    product,
    productImages,
    pdpVariants,
    siblings,
    rating,
    ratingCount,
    highlights,
    reviews,
    specMeta,
  } = useLoaderData<typeof loader>();

  const categorySlug = product.category;
  const categoryName = deslug(categorySlug);
  const baseName = product.name.split('—')[0].trim();

  // Colour swatches come from this product's Shopify "Color" variants.
  const colorVariants = pdpVariants.filter((v) => v.color);
  const hasColors = colorVariants.length > 1;

  const [selectedColor, setSelectedColor] = useState<string | null>(
    colorVariants.find((v) => v.available)?.color ??
      colorVariants[0]?.color ??
      null,
  );
  const selectedVariant =
    colorVariants.find((v) => v.color === selectedColor) ?? pdpVariants[0];

  // Display values follow the selected variant, falling back to the product.
  const colorName = selectedVariant?.color ?? productColor(product);
  const price = selectedVariant?.price || product.price;
  const variantMrp = selectedVariant?.mrp || product.mrp;
  const mrp = variantMrp > price ? variantMrp : price;
  const off = discountPct(price, mrp);
  const inStock = selectedVariant ? selectedVariant.available : product.inStock;
  const displayImage = selectedVariant?.image || product.image;

  const galleryImages = [
    displayImage,
    ...productImages,
    ...colorVariants.map((v) => v.image),
  ].filter((src, i, arr) => !!src && arr.indexOf(src) === i);

  const related = siblings
    .filter((p) => p.slug !== product.slug)
    .slice(0, 8);

  const featureLine =
    highlights.length > 0
      ? `${highlights.join(', ')}${colorName ? ` · ${colorName}` : ''}`
      : product.tagline;

  const extraOffer = off > 0 ? Math.max(0, price - 10000) : 0; // ₹100 coupon
  const ordered = Math.max(2, Math.round(rating * 6));
  const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);
  const roundRating = Math.round(rating);

  // Cart line reflects the selected variant (its id, colour, price, image).
  const cartSnapshot = {
    productId: selectedVariant?.id ?? product.id,
    slug: product.slug,
    name: colorName ? `${baseName} — ${colorName}` : product.name,
    price,
    mrp,
    image: displayImage,
  };

  const specs: [string, string][] = [
    ['Brand', 'Ooge'],
    ['Model', baseName],
    ...(colorName ? ([['Colour', colorName]] as [string, string][]) : []),
    ['Category', categoryName],
    ['Warranty', specMeta.warranty],
    ['Country of Origin', specMeta.countryOfOrigin],
    ['Marketed by', specMeta.marketedBy],
  ];

  return (
    <main className="container section pdp">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        {' / '}
        <Link to={`/collections/${categorySlug}`}>{categoryName}</Link>
        {' / '}
        <span>{product.name}</span>
      </nav>

      <div className="pdp-top">
        <ProductGallery
          key={selectedColor ?? 'default'}
          images={galleryImages}
          name={product.name}
        />

        <div className="pdp-info">
          <div className="pdp-head">
            <h1 className="pdp-title">{product.name}</h1>
            <span className="pdp-rate">
              <span className="pdp-stars">{stars(roundRating)}</span>
              <span className="pdp-rate__count">({ratingCount})</span>
            </span>
          </div>

          <p className="pdp-feature-line">{featureLine}</p>

          {extraOffer > 0 && (
            <p className="pdp-offer">
              {formatPrice(extraOffer)} <span>with extra offer</span>
            </p>
          )}
          <div className="pdp-price">
            <span className="pdp-price__now">{formatPrice(price)}</span>
            {off > 0 && (
              <span className="pdp-price__mrp">{formatPrice(mrp)}</span>
            )}
            <span className="pdp-price__tax">(Inclusive taxes)</span>
            {off > 0 && <span className="pdp-price__off">{off}% off</span>}
          </div>

          <div className="pdp-badges">
            <span className="pdp-ship-badge">🚚 Express Shipping</span>
          </div>

          <p className="pdp-social">
            📈 {ordered}k people ordered this in the last 30 days
          </p>

          {hasColors && (
            <div className="pdp-colors">
              <span className="pdp-colors__label">
                Colour: <strong>{colorName}</strong>
              </span>
              <div className="pdp-colors__row">
                {colorVariants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedColor(v.color)}
                    className={`pdp-color ${v.color === selectedColor ? 'is-active' : ''}`}
                    style={
                      v.image ? undefined : {backgroundColor: colorHex(v.color ?? '')}
                    }
                    title={v.color ?? ''}
                    aria-label={v.color ?? ''}
                    aria-pressed={v.color === selectedColor}
                  >
                    {v.image && (
                      <img
                        src={v.image}
                        alt={v.color ?? ''}
                        width={60}
                        height={60}
                        className="pdp-color__img"
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <PdpActions inStock={inStock} product={cartSnapshot} />

          <DeliveryCheck />

          <ul className="pdp-trust">
            <li>🛡️ 1-yr warranty</li>
            <li>↩️ 7-day returns</li>
            <li>🚚 Free over ₹999</li>
            <li>🔒 Secure checkout</li>
          </ul>
        </div>
      </div>

      {highlights.length > 0 && (
        <section className="pdp-section">
          <h2 className="section-title">Key features</h2>
          <div className="pdp-highlights">
            {highlights.map((h) => (
              <div key={h} className="pdp-highlight">
                {h}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="pdp-section">
        <h2 className="section-title">In the spotlight</h2>
        <ProductStory product={product} highlights={highlights} />
      </section>

      <section className="pdp-section pdp-2col">
        <div>
          <h2 className="section-title">About this product</h2>
          <p className="pdp-desc">{product.description}</p>
        </div>
        <div>
          <h2 className="section-title">Specifications</h2>
          <table className="pdp-specs">
            <tbody>
              {specs.map(([k, v]) => (
                <tr key={k}>
                  <th>{k}</th>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="pdp-section">
        <h2 className="section-title">Customer reviews</h2>
        <div className="pdp-reviews">
          <div className="pdp-reviews__summary">
            <span className="pdp-reviews__score">{rating.toFixed(1)}</span>
            <span className="pdp-stars">{stars(roundRating)}</span>
            <span className="pdp-reviews__count">{ratingCount} ratings</span>
          </div>
          <div className="pdp-reviews__list">
            {reviews.map((r) => (
              <div key={r.name} className="pdp-review">
                <div className="pdp-review__head">
                  <strong>{r.name}</strong>
                  <span className="pdp-stars">{stars(r.stars)}</span>
                </div>
                <p>{r.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pdp-section">
        <h2 className="section-title">FAQs</h2>
        <Faq />
      </section>

      {related.length > 0 && (
        <section className="pdp-section">
          <h2 className="section-title">You may also like</h2>
          <ProductCarousel>
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </ProductCarousel>
        </section>
      )}
    </main>
  );
}

// Turn a category slug back into a display name, e.g. "power-banks" -> "Power Banks".
function deslug(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const PRODUCT_QUERY = `#graphql
  query OogeProduct(
    $country: CountryCode
    $language: LanguageCode
    $handle: String!
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      id
      title
      handle
      description
      productType
      tags
      vendor
      availableForSale
      rating: metafield(namespace: "custom", key: "rating") { value }
      ratingCount: metafield(namespace: "custom", key: "rating_count") { value }
      highlights: metafield(namespace: "custom", key: "highlights") { value }
      reviews: metafield(namespace: "custom", key: "reviews") { value }
      warranty: metafield(namespace: "custom", key: "warranty") { value }
      countryOfOrigin: metafield(namespace: "custom", key: "country_of_origin") { value }
      marketedBy: metafield(namespace: "custom", key: "marketed_by") { value }
      featuredImage {
        url
        altText
      }
      images(first: 10) {
        nodes {
          url
          altText
        }
      }
      variants(first: 10) {
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
          selectedOptions {
            name
            value
          }
          image {
            url
            altText
          }
        }
      }
    }
  }
` as const;

const SIBLINGS_QUERY = `#graphql
  query OogeSiblings(
    $country: CountryCode
    $language: LanguageCode
    $query: String!
  ) @inContext(country: $country, language: $language) {
    products(first: 100, query: $query) {
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
