// PDP buy actions: quantity stepper + Add to cart + Buy now.
import {useState} from 'react';
import {useNavigate} from 'react-router';
import {useCartStore, type CartLine} from '~/stores/cart';
import {useUiStore} from '~/stores/ui';

export function PdpActions({
  product,
  inStock,
}: {
  product: Omit<CartLine, 'qty'>;
  inStock: boolean;
}) {
  const addItem = useCartStore((s) => s.addItem);
  const openCart = useUiStore((s) => s.openCart);
  const navigate = useNavigate();
  const [qty, setQty] = useState(1);

  if (!inStock) {
    return (
      <button
        type="button"
        className="btn btn--disabled btn--lg btn--block"
        disabled
      >
        Out of stock
      </button>
    );
  }

  return (
    <div className="pdp-actions">
      <div className="pdp-qty">
        <span>Qty</span>
        <div className="qty">
          <button
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            aria-label="Decrease"
          >
            −
          </button>
          <span>{qty}</span>
          <button onClick={() => setQty((q) => q + 1)} aria-label="Increase">
            +
          </button>
        </div>
      </div>
      <div className="pdp-buttons">
        <button
          type="button"
          className="btn btn--ghost btn--lg"
          onClick={() => {
            addItem(product, qty);
            openCart();
          }}
        >
          Add to cart
        </button>
        <button
          type="button"
          className="btn btn--primary btn--lg"
          onClick={() => {
            addItem(product, qty);
            navigate('/checkout');
          }}
        >
          Buy now
        </button>
      </div>
    </div>
  );
}
