// Slim promo strip at the very top — like Soundcore/Boult/JLab.
const MESSAGES = [
  '⚡ Free shipping on orders over ₹999',
  '🛡️ 1-year warranty on all products',
  '↩️ 7-day easy returns',
  '🔒 100% secure checkout',
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
