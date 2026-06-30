// PDP gallery: vertical thumbnail strip on the left + large main image.
// Hover/click a thumbnail to change the main view.
import {useState} from 'react';

export function ProductGallery({
  images,
  name,
}: {
  images: string[];
  name: string;
}) {
  const [active, setActive] = useState(0);
  const views = images.length ? images : [''];

  return (
    <div className="pdp-gallery">
      {views.length > 1 && (
        <div className="pdp-thumbs">
          {views.map((src, i) => (
            <button
              key={src + i}
              type="button"
              className={`pdp-thumb ${i === active ? 'is-active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => setActive(i)}
              aria-label={`View ${i + 1}`}
            >
              <img src={src} alt="" width={72} height={72} className="pdp-thumb__img" />
            </button>
          ))}
        </div>
      )}

      <div className="pdp-gallery__main">
        <img
          src={views[active]}
          alt={name}
          width={620}
          height={620}
          className="pdp-gallery__img"
        />
      </div>
    </div>
  );
}
