// Maps Shopify Storefront product nodes into the flat `Product` shape the ported
// Ooge UI expects (prices in paise, a single category slug, a cart snapshot).
//
// Shopify Money amounts are in major units ("899.00"); the Ooge UI stores paise
// (integers) like the original Next.js app, so we multiply by 100.
import type {CartLine} from '~/stores/cart';

export type Product = {
  id: string;
  slug: string; // Shopify handle
  name: string; // title
  tagline: string;
  description: string;
  price: number; // paise
  mrp: number; // compare-at price, paise (falls back to price)
  image: string;
  category: string; // productType-derived slug
  inStock: boolean;
  featured: boolean;
  bestseller: boolean;
  rating: number;
  colors: string[]; // colour option values (from the Shopify "Color" option)
};

export function toPaise(amount?: string | null): number {
  if (!amount) return 0;
  return Math.round(parseFloat(amount) * 100);
}

// Turn a Shopify productType into a clean, URL-safe category slug.
export function slugifyType(type?: string | null): string {
  return (type ?? '')
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// The minimal set of fields needed by `mapProduct`. Both the homepage
// `ProductCard` fragment and the PDP query satisfy this shape.
type AnyProductNode = {
  id: string;
  title: string;
  handle: string;
  description?: string | null;
  productType?: string | null;
  tags?: string[];
  availableForSale?: boolean;
  featuredImage?: {url: string; altText?: string | null} | null;
  options?: Array<{
    name: string;
    optionValues?: Array<{name: string} | null>;
  } | null> | null;
  priceRange?: {minVariantPrice?: {amount?: string | null} | null} | null;
  compareAtPriceRange?: {minVariantPrice?: {amount?: string | null} | null} | null;
  images?: {nodes?: Array<{url: string; altText?: string | null} | null>} | null;
  variants?: {
    nodes?: Array<{
      availableForSale?: boolean;
      price?: {amount?: string | null} | null;
      compareAtPrice?: {amount?: string | null} | null;
      image?: {url: string; altText?: string | null} | null;
    } | null>;
  } | null;
};

export function mapProduct(node: AnyProductNode): Product {
  const variant = node.variants?.nodes?.[0];
  const price =
    toPaise(variant?.price?.amount) ||
    toPaise(node.priceRange?.minVariantPrice?.amount);
  const mrp =
    toPaise(variant?.compareAtPrice?.amount) ||
    toPaise(node.compareAtPriceRange?.minVariantPrice?.amount) ||
    price;

  return {
    id: node.id,
    slug: node.handle,
    name: node.title,
    tagline: node.description?.split('.')[0]?.slice(0, 80) ?? node.title,
    description: node.description ?? '',
    price,
    mrp: mrp > price ? mrp : price,
    // Resolve an image from whichever source the merchant used: product media,
    // the featured image, or the first variant's image.
    image:
      node.featuredImage?.url ??
      node.images?.nodes?.[0]?.url ??
      variant?.image?.url ??
      '',
    category: slugifyType(node.productType) || 'general',
    inStock: node.availableForSale ?? variant?.availableForSale ?? true,
    featured: node.tags?.includes('featured') ?? false,
    bestseller: node.tags?.includes('bestseller') ?? false,
    rating: 4.2,
    colors: extractColors(node),
  };
}

// Colour option values from the Shopify "Color"/"Colour" option; falls back to
// the legacy "Name — Colour" suffix if the product has no colour option.
function extractColors(node: AnyProductNode): string[] {
  const opt = node.options?.find((o) => o && /colou?r/i.test(o.name));
  const fromOption = (opt?.optionValues ?? [])
    .map((v) => v?.name)
    .filter((n): n is string => !!n);
  if (fromOption.length > 0) return fromOption;
  const fromName = productColor({name: node.title});
  return fromName ? [fromName] : [];
}

// Build a cart snapshot (the shape `useCartStore.addItem` expects) from a Product.
export function toCartSnapshot(p: Product): Omit<CartLine, 'qty'> {
  return {
    productId: p.id,
    slug: p.slug,
    name: p.name,
    price: p.price,
    mrp: p.mrp,
    image: p.image,
  };
}

// The colour suffix of a product name, e.g. "Tune 21 — White" -> "White".
export function productColor(p: Pick<Product, 'name'>): string | null {
  const parts = p.name.split('—');
  return parts.length > 1 ? parts[1].trim() : null;
}

const COLOR_HEX: Record<string, string> = {
  white: '#f3f3f3', black: '#111114', yellow: '#fcca00',
  grey: '#9b9b9b', gray: '#9b9b9b', silver: '#c8ccd0',
  blue: '#2f6fed', navy: '#1f2a44', red: '#e23b3b',
  green: '#27ae60', beige: '#e6d6b8', pink: '#ff5fa2',
  teal: '#16b5a3', purple: '#7c3aed', violet: '#8b5cf6',
  orange: '#f2711c', gold: '#d4af37', brown: '#8a5a3b',
  maroon: '#7b1e2b', cyan: '#22b8cf', magenta: '#d6409f',
  cream: '#f4ecd8', ivory: '#fffff0', charcoal: '#36393f',
  rose: '#e8909c', lavender: '#b39ddb', mint: '#98e2c6',
};

// Ordered longest-first so "rose gold" matches "gold" before "rose", and
// "space grey"/"midnight blue" resolve to their base colour word.
const COLOR_WORDS = Object.keys(COLOR_HEX).sort((a, b) => b.length - a.length);

// Deterministic fallback: turn an unknown colour name into a stable, distinct
// hue so two different unknown colours never collapse to the same swatch.
function hashHue(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) % 360;
  }
  return `hsl(${h}, 42%, 62%)`;
}

// A rainbow swatch for products sold as "Multicolor"/"Rainbow"/"Assorted".
// This is a gradient, so callers must apply it via the `background` shorthand
// (NOT `backgroundColor`, which only accepts a solid colour).
export const MULTICOLOR_SWATCH =
  'conic-gradient(from 90deg, #e23b3b, #fcca00, #27ae60, #22b8cf, #2f6fed, #7c3aed, #e23b3b)';

export function colorHex(name: string): string {
  const key = name.trim().toLowerCase();
  if (/multi|rainbow|assorted|colou?rful/.test(key)) return MULTICOLOR_SWATCH;
  if (COLOR_HEX[key]) return COLOR_HEX[key];
  // Compound name? Match a known colour word inside it (e.g. "Rose Gold").
  const word = COLOR_WORDS.find((w) => key.includes(w));
  if (word) return COLOR_HEX[word];
  return hashHue(key);
}
