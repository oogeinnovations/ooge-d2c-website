// Client-side cart (CSR). We store a *snapshot* of each product (name, price,
// image) at add-time so the cart and checkout render with no server call.
// Persisted to localStorage so it survives reloads and navigations.
//
// NOTE: This is a visual clone of the original Next.js demo cart. It does NOT
// use Shopify's server cart — no real checkout/payment happens.
import {create} from 'zustand';
import {persist} from 'zustand/middleware';

export type CartLine = {
  productId: string;
  slug: string;
  name: string;
  price: number; // paise, snapshot at time of add
  mrp: number; // compare-at price (for savings/strikethrough), paise
  image: string;
  qty: number;
};

type CartState = {
  items: CartLine[];
  addItem: (line: Omit<CartLine, 'qty'>, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
  // selectors
  totalItems: () => number;
  subtotal: () => number;
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (line, qty = 1) =>
        set((state) => {
          const existing = state.items.find(
            (i) => i.productId === line.productId,
          );
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.productId === line.productId ? {...i, qty: i.qty + qty} : i,
              ),
            };
          }
          return {items: [...state.items, {...line, qty}]};
        }),

      setQty: (productId, qty) =>
        set((state) => ({
          items: state.items
            .map((i) => (i.productId === productId ? {...i, qty} : i))
            .filter((i) => i.qty > 0),
        })),

      removeItem: (productId) =>
        set((state) => ({
          items: state.items.filter((i) => i.productId !== productId),
        })),

      clear: () => set({items: []}),

      totalItems: () => get().items.reduce((n, i) => n + i.qty, 0),
      subtotal: () => get().items.reduce((sum, i) => sum + i.price * i.qty, 0),
    }),
    {name: 'cart'},
  ),
);
