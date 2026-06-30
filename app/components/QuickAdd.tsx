// Small "add to cart" button used on product cards (client island).
import {useState} from 'react';
import {useCartStore} from '~/stores/cart';
import {useUiStore} from '~/stores/ui';
import type {CartLine} from '~/stores/cart';

export function QuickAdd({
  product,
  inStock,
}: {
  product: Omit<CartLine, 'qty'>;
  inStock: boolean;
}) {
  const addItem = useCartStore((s) => s.addItem);
  const openCart = useUiStore((s) => s.openCart);
  const [added, setAdded] = useState(false);

  if (!inStock) {
    return <span className="card__soldout">Sold out</span>;
  }

  return (
    <button
      type="button"
      className="quick-add"
      onClick={(e) => {
        e.preventDefault(); // don't navigate the parent card link
        addItem(product, 1);
        openCart();
        setAdded(true);
        setTimeout(() => setAdded(false), 1200);
      }}
    >
      {added ? '✓ Added' : 'Add to cart'}
    </button>
  );
}
