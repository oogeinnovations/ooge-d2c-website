import {useCallback, useEffect, useRef, useState} from 'react';
import {NavLink} from 'react-router';
import type {MegaCollection} from '~/components/MegaMenu';

// Premium, swipeable single-row of circular category thumbnails with desktop
// scroll arrows, edge fades, and active-state highlighting.
export function CategoryStrip({collections}: {collections: MegaCollection[]}) {
  const ref = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [update, collections]);

  const scrollBy = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({left: dir * el.clientWidth * 0.8, behavior: 'smooth'});
  };

  return (
    <nav className="cat-strip" aria-label="Categories">
      <div
        className="container catscroll-wrap"
        data-at-start={atStart}
        data-at-end={atEnd}
      >
        <button
          type="button"
          className="catscroll-arrow catscroll-arrow--prev"
          data-hidden={atStart}
          onClick={() => scrollBy(-1)}
          aria-label="Scroll categories left"
          tabIndex={atStart ? -1 : 0}
        >
          ‹
        </button>

        <div className="catscroll" ref={ref} onScroll={update}>
          {collections.map((c) => (
            <NavLink
              key={c.id}
              to={`/collections/${c.handle}`}
              className={({isActive}) =>
                `catscroll__item${isActive ? ' is-active' : ''}`
              }
            >
              <span className="catscroll__media">
                {c.image ? (
                  <img
                    src={c.image.url}
                    alt={c.title}
                    width={96}
                    height={96}
                    className="catscroll__img"
                    loading="lazy"
                  />
                ) : (
                  <span className="catscroll__emoji" aria-hidden>
                    🎧
                  </span>
                )}
              </span>
              <span className="catscroll__name">{c.title}</span>
            </NavLink>
          ))}
        </div>

        <button
          type="button"
          className="catscroll-arrow catscroll-arrow--next"
          data-hidden={atEnd}
          onClick={() => scrollBy(1)}
          aria-label="Scroll categories right"
          tabIndex={atEnd ? -1 : 0}
        >
          ›
        </button>
      </div>
    </nav>
  );
}
