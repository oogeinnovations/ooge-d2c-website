import {useRef} from 'react';

export function ProductCarousel({children}: {children: React.ReactNode}) {
  const ref = useRef<HTMLDivElement>(null);

  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({left: dir * el.clientWidth * 0.85, behavior: 'smooth'});
  };

  return (
    <div className="carousel">
      <button
        type="button"
        className="carousel__nav carousel__nav--prev"
        onClick={() => scroll(-1)}
        aria-label="Scroll left"
      >
        ‹
      </button>
      <div className="carousel__track" ref={ref}>
        {children}
      </div>
      <button
        type="button"
        className="carousel__nav carousel__nav--next"
        onClick={() => scroll(1)}
        aria-label="Scroll right"
      >
        ›
      </button>
    </div>
  );
}
