const REELS = [
  '/videos/ooge-1.mp4',
  '/videos/ooge-2.mp4',
  '/videos/ooge-3.mp4',
  '/videos/ooge-4.mp4',
];

export function Fluencers() {
  return (
    <section className="container section">
      <div className="section__head">
        <h2 className="section-title">#OogeSquad</h2>
        <span className="section__link">Tag us @ooge to get featured</span>
      </div>
      <div className="reels">
        {REELS.map((src) => (
          <video
            key={src}
            className="reel"
            src={src}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
          />
        ))}
      </div>
    </section>
  );
}
