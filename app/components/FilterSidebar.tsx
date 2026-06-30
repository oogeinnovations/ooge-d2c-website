// Shop filters (Nasher Miles style): borderless collapsible sections with a
// dual-thumb price slider + inputs, Category, and Colour swatches. All state is
// mirrored to the URL query so results filter and stay shareable.
import {useState} from 'react';
import {useSearchParams} from 'react-router';

type Category = {slug: string; name: string};

export function FilterSidebar({
  categories = [],
  colors = [],
  priceBounds = {min: 0, max: 10000},
  hideCategory = false,
}: {
  categories?: Category[];
  colors?: {name: string; hex: string}[];
  priceBounds?: {min: number; max: number}; // in ₹
  hideCategory?: boolean;
}) {
  const [params, setSearchParams] = useSearchParams();

  const [closed, setClosed] = useState<Set<string>>(new Set());
  const toggleSection = (k: string) =>
    setClosed((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const setParam = (key: string, value: string) => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (value) p.set(key, value);
        else p.delete(key);
        return p;
      },
      {preventScrollReset: true},
    );
  };

  // ---- price (slider + inputs, in ₹) ----
  const {min: bMin, max: bMax} = priceBounds;
  const priceParam = params.get('price') ?? '';
  const [pMinP, pMaxP] = priceParam.split('-');
  const [low, setLow] = useState(pMinP ? Math.round(Number(pMinP) / 100) : bMin);
  const [high, setHigh] = useState(
    pMaxP ? Math.round(Number(pMaxP) / 100) : bMax,
  );

  const applyPrice = (lo = low, hi = high) => {
    const atFull = lo <= bMin && hi >= bMax;
    setParam('price', atFull ? '' : `${lo * 100}-${hi * 100}`);
  };
  const onLow = (v: number) => setLow(Math.min(v, high - 1));
  const onHigh = (v: number) => setHigh(Math.max(v, low + 1));
  // guard against a zero-width range (all products same price) and clamp 0–100
  const span = Math.max(1, bMax - bMin);
  const pct = (v: number) =>
    Math.min(100, Math.max(0, ((v - bMin) / span) * 100));

  // Reset everything: the URL params AND the local slider state, so the price
  // thumbs/inputs visually return to the full range too.
  const clearAll = () => {
    setLow(bMin);
    setHigh(bMax);
    setSearchParams(new URLSearchParams(), {preventScrollReset: true});
  };

  // ---- category ----
  const selectedCats = (params.get('cat') ?? '').split(',').filter(Boolean);
  const toggleCat = (slug: string) => {
    const set = new Set(selectedCats);
    if (set.has(slug)) set.delete(slug);
    else set.add(slug);
    setParam('cat', [...set].join(','));
  };

  // ---- colour ----
  const selectedColors = (params.get('color') ?? '').split(',').filter(Boolean);
  const toggleColor = (name: string) => {
    const set = new Set(selectedColors);
    if (set.has(name)) set.delete(name);
    else set.add(name);
    setParam('color', [...set].join(','));
  };

  const hasFilters =
    !!priceParam ||
    (!hideCategory && selectedCats.length > 0) ||
    selectedColors.length > 0 ||
    params.get('instock') === '1';

  const Chevron = ({k}: {k: string}) => (
    <span
      className={`fgroup__chevron ${closed.has(k) ? '' : 'is-open'}`}
      aria-hidden
    >
      ⌄
    </span>
  );

  return (
    <aside className="filters">
      <div className="filters__header">
        <h3 className="filters__title">Filters</h3>
        <button
          type="button"
          className="filters__clear"
          onClick={clearAll}
          disabled={!hasFilters}
        >
          Clear all
        </button>
      </div>

      <div className="fgroup">
        <button className="fgroup__head" onClick={() => toggleSection('price')}>
          <span>Price</span>
          <Chevron k="price" />
        </button>
        {!closed.has('price') && (
          <div className="fgroup__body">
            <div className="price-slider">
              <div className="price-slider__track">
                <div
                  className="price-slider__fill"
                  style={{left: `${pct(low)}%`, right: `${100 - pct(high)}%`}}
                />
              </div>
              <input
                className="price-slider__input"
                type="range"
                min={bMin}
                max={bMax}
                value={low}
                onChange={(e) => onLow(Number(e.target.value))}
                onMouseUp={() => applyPrice()}
                onTouchEnd={() => applyPrice()}
                aria-label="Minimum price"
              />
              <input
                className="price-slider__input"
                type="range"
                min={bMin}
                max={bMax}
                value={high}
                onChange={(e) => onHigh(Number(e.target.value))}
                onMouseUp={() => applyPrice()}
                onTouchEnd={() => applyPrice()}
                aria-label="Maximum price"
              />
            </div>

            <p className="price-apply">
              Apply Price ₹{low.toLocaleString('en-IN')} – ₹
              {high.toLocaleString('en-IN')}
            </p>

            <div className="price-range">
              <input
                type="number"
                min={bMin}
                placeholder="₹ Min"
                value={low}
                onChange={(e) => setLow(Number(e.target.value) || bMin)}
                aria-label="Minimum price"
              />
              <span>–</span>
              <input
                type="number"
                max={bMax}
                placeholder="₹ Max"
                value={high}
                onChange={(e) => setHigh(Number(e.target.value) || bMax)}
                aria-label="Maximum price"
              />
              <button className="price-range__apply" onClick={() => applyPrice()}>
                Go
              </button>
            </div>
          </div>
        )}
      </div>

      {!hideCategory && categories.length > 0 && (
        <div className="fgroup">
          <button className="fgroup__head" onClick={() => toggleSection('cat')}>
            <span>Category</span>
            <Chevron k="cat" />
          </button>
          {!closed.has('cat') && (
            <div className="fgroup__body">
              {categories.map((c) => (
                <label key={c.slug} className="filter-check">
                  <input
                    type="checkbox"
                    checked={selectedCats.includes(c.slug)}
                    onChange={() => toggleCat(c.slug)}
                  />
                  {c.name}
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {colors.length > 0 && (
        <div className="fgroup">
          <button className="fgroup__head" onClick={() => toggleSection('color')}>
            <span>Colour</span>
            <Chevron k="color" />
          </button>
          {!closed.has('color') && (
            <div className="fgroup__body">
              <div className="swatches">
                {colors.map((c) => (
                  <button
                    key={c.name}
                    className={`swatch ${selectedColors.includes(c.name) ? 'is-active' : ''}`}
                    style={{backgroundColor: c.hex}}
                    onClick={() => toggleColor(c.name)}
                    aria-label={c.name}
                    title={c.name}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="fgroup">
        <label className="filter-check filter-check--lg">
          <input
            type="checkbox"
            checked={params.get('instock') === '1'}
            onChange={() =>
              setParam('instock', params.get('instock') === '1' ? '' : '1')
            }
          />
          In stock only
        </label>
      </div>
    </aside>
  );
}
