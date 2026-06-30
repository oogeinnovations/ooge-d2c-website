import type {Product} from '~/lib/product';
import {ProductCard} from '~/components/ProductCard';

export function ProductGrid({products}: {products: Product[]}) {
  if (products.length === 0) {
    return <p className="empty">No products here yet.</p>;
  }
  return (
    <div className="grid">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
