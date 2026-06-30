// Client-side refinement for the shop / collection listings. Mirrors the
// filtering + sorting the original Next.js /products page did server-side, but
// runs off the already-loaded product list and the URL search params so filter
// changes feel instant.
import {colorHex, type Product} from '~/lib/product';

export function applyShopFilters(
  all: Product[],
  params: URLSearchParams,
): Product[] {
  const q = (params.get('q') ?? '').trim().toLowerCase();
  const cats = (params.get('cat') ?? '').split(',').filter(Boolean);
  const colors = (params.get('color') ?? '')
    .split(',')
    .filter(Boolean)
    .map((c) => c.toLowerCase());
  const price = params.get('price') ?? '';
  const inStock = params.get('instock') === '1';
  const sort = params.get('sort') ?? '';

  let out = all;
  if (q)
    out = out.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.tagline.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q),
    );
  if (cats.length) out = out.filter((p) => cats.includes(p.category));
  if (colors.length)
    out = out.filter((p) =>
      p.colors.some((c) => colors.includes(c.toLowerCase())),
    );
  if (price) {
    const [min, max] = price.split('-');
    const mn = Number(min) || 0;
    const mx = max ? Number(max) : Infinity;
    out = out.filter((p) => p.price >= mn && p.price <= mx);
  }
  if (inStock) out = out.filter((p) => p.inStock);

  if (sort === 'price-asc') out = [...out].sort((a, b) => a.price - b.price);
  else if (sort === 'price-desc')
    out = [...out].sort((a, b) => b.price - a.price);
  else if (sort === 'rating') out = [...out].sort((a, b) => b.rating - a.rating);
  else if (sort === 'discount')
    out = [...out].sort(
      (a, b) => (b.mrp - b.price) / b.mrp - (a.mrp - a.price) / a.mrp,
    );

  return out;
}

export function colorsFor(products: Product[]): {name: string; hex: string}[] {
  const seen = new Map<string, {name: string; hex: string}>();
  for (const p of products) {
    for (const c of p.colors) {
      const key = c.toLowerCase();
      if (!seen.has(key)) seen.set(key, {name: c, hex: colorHex(c)});
    }
  }
  return [...seen.values()];
}

export function priceBoundsFor(products: Product[]): {min: number; max: number} {
  if (products.length === 0) return {min: 0, max: 10000};
  const prices = products.map((p) => p.price);
  return {
    min: Math.floor(Math.min(...prices) / 100),
    max: Math.ceil(Math.max(...prices) / 100),
  };
}

export function deslug(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Distinct category options (slug + display name) derived from a product list.
export function categoriesFor(
  products: Product[],
): {slug: string; name: string}[] {
  const slugs = [...new Set(products.map((p) => p.category))].filter(Boolean);
  return slugs.sort().map((slug) => ({slug, name: deslug(slug)}));
}
