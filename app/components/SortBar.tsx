// Horizontal "Sort by" pills (Nasher Miles style) + result count.
import {useSearchParams} from 'react-router';

const SORTS = [
  {value: '', label: 'Featured'},
  {value: 'price-asc', label: 'Price: Low to High'},
  {value: 'price-desc', label: 'Price: High to Low'},
  {value: 'rating', label: 'Top Rated'},
  {value: 'discount', label: 'Discount'},
];

export function SortBar({count}: {count: number}) {
  const [params, setSearchParams] = useSearchParams();
  const current = params.get('sort') ?? '';

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
