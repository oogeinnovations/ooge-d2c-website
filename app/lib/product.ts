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
  grey: '#9b9b9b', gray: '#9b9b9b', blue: '#2f6fed',
  red: '#e23b3b', green: '#27ae60', beige: '#e6d6b8',
  navy: '#1f2a44', pink: '#ff5fa2', teal: '#16b5a3',
};

export function colorHex(name: string): string {
  return COLOR_HEX[name.toLowerCase()] ?? '#cfcfcf';
}
