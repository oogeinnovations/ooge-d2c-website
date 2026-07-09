import {useCallback, useEffect, useRef, useState} from 'react';
import {Link} from 'react-router';

export type MegaCollection = {
  id: string;
  title: string;
  handle: string;
  image?: {url: string; altText?: string | null} | null;
};

// Full-width Categories dropdown. Open state is controlled in JS (not pure CSS
// :hover) so it reliably CLOSES when the pointer leaves — a plain :hover/:focus-
// within menu can stay stuck open after a click leaves focus inside the panel.
// Opens on hover/focus; closes on mouse-leave, Escape, or picking a category.
export function MegaMenu({collections}: {collections: MegaCollection[]}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  // Small delay so moving the pointer across the gap between the trigger and the
  // panel doesn't flicker the menu shut.
  const scheduleClose = useCallback(() => {
    clearTimer();
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  }, []);

  const openNow = useCallback(() => {
    clearTimer();
    setOpen(true);
  }, []);

  const closeNow = useCallback(() => {
    clearTimer();
    setOpen(false);
  }, []);

  useEffect(() => clearTimer, []);

  return (
    <div
      className={`has-mega ${open ? 'is-open' : ''}`}
      onMouseEnter={openNow}
      onMouseLeave={scheduleClose}
      onFocus={openNow}
      onBlur={(e) => {
        // Only close if focus left the whole menu (not moved to an inner item).
        if (!e.currentTarget.contains(e.relatedTarget as Node)) closeNow();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') closeNow();
      }}
    >
      <Link
        to="/collections/all"
        className="has-mega__trigger"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={closeNow}
      >
        Categories{' '}
        <span className="caret" aria-hidden>
          ▾
        </span>
      </Link>

      <div className="mega" role="menu">
        <div className="mega__inner container">
          <div className="mega__head">
            <span className="mega__eyebrow">Shop by category</span>
            <Link to="/collections/all" className="mega__all" onClick={closeNow}>
              View all →
            </Link>
          </div>

          <div className="mega-grid">
            {collections.map((c) => (
              <Link
                key={c.id}
                to={`/collections/${c.handle}`}
                className="mega-card"
                role="menuitem"
                onClick={closeNow}
              >
                <span className="mega-card__media">
                  {c.image ? (
                    <img
                      src={c.image.url}
                      alt={c.title}
                      className="mega-card__img"
                      loading="lazy"
                    />
                  ) : (
                    <span className="mega-card__emoji" aria-hidden>
                      🎧
                    </span>
                  )}
                </span>
                <span className="mega-card__name">{c.title}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
