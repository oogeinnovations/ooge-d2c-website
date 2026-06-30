// Holds the most recently placed order so the confirmation page can show it.
// No backend: this is the local stand-in for an order record.
import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import type {CartLine} from './cart';

export type Order = {
  id: string;
  createdAt: string;
  items: CartLine[];
  subtotal: number;
  shipping: number;
  total: number;
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    pincode: string;
  };
};

type OrderState = {
  lastOrder: Order | null;
  placeOrder: (order: Order) => void;
};

export const useOrderStore = create<OrderState>()(
  persist(
    (set) => ({
      lastOrder: null,
      placeOrder: (order) => set({lastOrder: order}),
    }),
    {name: 'last-order'},
  ),
);
