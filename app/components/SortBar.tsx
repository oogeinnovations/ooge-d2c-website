// Horizontal "Sort by" pills (Nasher Miles style) + result count.
// On mobile a "Filters" button opens the filter sidebar as a slide-out drawer
// (the sidebar is hidden inline below 820px — see FilterSidebar / ooge.css).
import {useSearchParams} from 'react-router';
import {useUiStore} from '~/stores/ui';

const SORTS = [
  {value: '', label: 'Featured'},
  {value: 'price-asc', label: 'Price: Low to High'},
  {value: 'price-desc', label: 'Price: High to Low'},
  {value: 'rating', label: 'Top Rated'},
  {value: 'discount', label: 'Discount'},
];

// Count how many filters are active, to badge the mobile Filters button.
function activeFilterCount(params: URLSearchParams) {
  let n = 0;
  if (params.get('price')) n += 1;
  if (params.get('instock') === '1') n += 1;
  n += (params.get('cat') ?? '').split(',').filter(Boolean).length;
  n += (params.get('color') ?? '').split(',').filter(Boolean).length;
  return n;
}

export function SortBar({count}: {count: number}) {
  const [params, setSearchParams] = useSearchParams();
  const current = params.get('sort') ?? '';
  const openFilters = useUiStore((s) => s.openFilters);
  const activeFilters = activeFilterCount(params);

  const setSort = (value: string) => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (value) p.set('sort', value);
        else p.delete('sort');
        return p;
      },
      {preventScrollReset: true},
    );
  };

  return (
    <div className="sortbar">
      <button
        type="button"
        className="filters-toggle"
        onClick={openFilters}
        aria-label="Open filters"
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden
        >
          <path d="M3 5h18M6 12h12M10 19h4" />
        </svg>
        Filters
        {activeFilters > 0 && (
          <span className="filters-toggle__count">{activeFilters}</span>
        )}
      </button>
      <span className="sortbar__count">{count} products</span>
      <div className="sortbar__pills">
        <span className="sortbar__label">Sort by</span>
        {SORTS.map((s) => (
          <button
            key={s.value}
            className={`sort-pill ${current === s.value ? 'is-active' : ''}`}
            onClick={() => setSort(s.value)}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
