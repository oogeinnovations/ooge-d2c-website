// Tiny UI store for transient interface state (cart drawer + mobile menu).
import {create} from 'zustand';

type UiState = {
  cartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  menuOpen: boolean;
  openMenu: () => void;
  closeMenu: () => void;
  filtersOpen: boolean;
  openFilters: () => void;
  closeFilters: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  cartOpen: false,
  openCart: () => set({cartOpen: true, menuOpen: false, filtersOpen: false}),
  closeCart: () => set({cartOpen: false}),
  menuOpen: false,
  openMenu: () => set({menuOpen: true, cartOpen: false, filtersOpen: false}),
  closeMenu: () => set({menuOpen: false}),
  filtersOpen: false,
  openFilters: () => set({filtersOpen: true, cartOpen: false, menuOpen: false}),
  closeFilters: () => set({filtersOpen: false}),
}));
