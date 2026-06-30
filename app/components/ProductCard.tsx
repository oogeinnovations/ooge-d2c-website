import {Link} from 'react-router';
import type {Product} from '~/lib/product';
import {toCartSnapshot} from '~/lib/product';
import {formatPrice, discountPct} from '~/lib/format';
import {QuickAdd} from '~/components/QuickAdd';

// Card in the style of JBL / Boult: product photo with discount badge,
// title + tagline, price with struck MRP, rating, and a quick-add button.
export function ProductCard({product}: {product: Product}) {
  const off = discountPct(product.price, product.mrp);

  return (
    <Link to={`/products/${product.slug}`} className="card">
      <div className="card__media">
        {off > 0 && <span className="card__discount">-{off}%</span>}
        {product.bestseller && <span className="card__tag">Bestseller</span>}
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            width={330}
            height={400}
            className="card__img"
            loading="lazy"
          />
        ) : (
          <div className="card__img card__img--placeholder" aria-hidden>
            <span>{product.name}</span>
          </div>
        )}
      </div>

      <div className="card__body">
        <h3 className="card__title">{product.name}</h3>
        <p className="card__tagline">{product.tagline}</p>

        <div className="card__pricing">
          <span className="card__price">{formatPrice(product.price)}</span>
          {off > 0 && <span className="card__mrp">{formatPrice(product.mrp)}</span>}
        </div>

        <div className="card__foot">
          <span className="card__rating">★ {product.rating.toFixed(1)}</span>
          <QuickAdd inStock={product.inStock} product={toCartSnapshot(product)} />
        </div>
      </div>
    </Link>
  );
}
