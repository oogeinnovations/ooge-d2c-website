// Slim promo strip at the very top — like Soundcore/Boult/JLab.
// NOTE: no shipping/delivery/COD claims here — fulfilment isn't integrated yet,
// so these are brand- and product-level promises we can actually keep.
const MESSAGES = [
  '🛡️ 1-year warranty on all products',
  '✅ 100% genuine products',
  '🔒 100% secure checkout',
  '🏷️ Direct from the brand',
];

export function AnnouncementBar() {
  return (
    <div className="announce">
      <div className="announce__track">
        {/* duplicated for a seamless marquee loop */}
        {[...MESSAGES, ...MESSAGES].map((m, i) => (
          <span key={i} className="announce__item">
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}
