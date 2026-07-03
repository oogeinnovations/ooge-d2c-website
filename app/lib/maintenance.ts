// Full-site maintenance mode.
//
// When the `MAINTENANCE_MODE` env var is "true" or "1", server.ts short-circuits
// EVERY request with the branded 503 page below — no code redeploy needed to put
// the store up or down, just flip the env var (and restart / redeploy env).
//
// The page is fully self-contained (inline CSS, no external assets) so it renders
// even while the app/CDN is being worked on. 503 + Retry-After tells search
// engines the outage is temporary, so rankings aren't hurt.

export function isMaintenanceMode(env: Env): boolean {
  const value = env.MAINTENANCE_MODE;
  return value === 'true' || value === '1';
}

export function maintenanceResponse(): Response {
  return new Response(MAINTENANCE_HTML, {
    status: 503,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Retry-After': '3600',
      'Cache-Control': 'no-store',
    },
  });
}

const MAINTENANCE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>We'll be right back · Ooge</title>
    <style>
      :root {
        --brand: #fcca00;
        --brand-2: #ffd633;
        --ink: #0a0a0e;
      }
      * { box-sizing: border-box; }
      html, body { margin: 0; height: 100%; }
      body {
        min-height: 100%;
        display: grid;
        place-items: center;
        padding: 32px 20px;
        background:
          radial-gradient(90% 90% at 78% 8%, #23252f 0%, #14151b 46%, var(--ink) 100%);
        color: #f4f5f7;
        font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI',
          Roboto, sans-serif;
        line-height: 1.6;
        -webkit-font-smoothing: antialiased;
        text-rendering: optimizeLegibility;
      }
      .wrap { width: 100%; max-width: 560px; text-align: center; }
      .brand {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 12px;
        margin-bottom: 40px;
      }
      .brand__mark {
        display: grid;
        place-items: center;
        width: 46px;
        height: 46px;
        border-radius: 12px;
        background: linear-gradient(135deg, var(--brand), var(--brand-2));
        color: var(--ink);
        font-weight: 900;
        font-size: 0.82rem;
        letter-spacing: 0.02em;
        box-shadow: 0 8px 24px rgba(252, 202, 0, 0.32);
      }
      .brand__tag { text-align: left; line-height: 1.15; }
      .brand__tag b { font-size: 1.2rem; font-weight: 800; color: #fff; }
      .brand__tag span {
        display: block;
        font-size: 0.58rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #9a9ca6;
      }
      .pulse {
        display: grid;
        place-items: center;
        width: 74px;
        height: 74px;
        margin: 0 auto 26px;
        border-radius: 999px;
        background: rgba(252, 202, 0, 0.12);
        color: var(--brand);
        font-size: 2rem;
        animation: pulse 2.2s ease-in-out infinite;
      }
      @keyframes pulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(252, 202, 0, 0.28); }
        50% { box-shadow: 0 0 0 16px rgba(252, 202, 0, 0); }
      }
      h1 {
        margin: 0 0 14px;
        font-family: 'Space Grotesk', ui-sans-serif, system-ui, sans-serif;
        font-size: clamp(1.7rem, 7vw, 3rem);
        font-weight: 800;
        letter-spacing: -0.03em;
        color: #fff;
      }
      p { margin: 0 auto; max-width: 440px; color: #adb0bd; font-size: 1.05rem; }
      .foot {
        margin-top: 44px;
        font-size: 0.82rem;
        color: #6b6e78;
        overflow-wrap: anywhere;
      }
      .foot a { color: var(--brand); text-decoration: none; }
      @media (prefers-reduced-motion: reduce) {
        .pulse { animation: none; }
      }
    </style>
  </head>
  <body>
    <main class="wrap">
      <span class="brand">
        <span class="brand__mark">OOGE</span>
        <span class="brand__tag">
          <b>Premium</b>
          <span>Audio Brand in India</span>
        </span>
      </span>

      <div class="pulse" aria-hidden="true">&#9881;</div>
      <h1>We&rsquo;ll be right back</h1>
      <p>
        Our store is getting a quick upgrade to bring you a better experience.
        We&rsquo;ll be back online shortly &mdash; thanks for your patience.
      </p>

      <p class="foot">
        &copy; Ooge Innovations &middot; Need help? Email
        <a href="mailto:OogeInnovations@gmail.com">OogeInnovations@gmail.com</a>
      </p>
    </main>
  </body>
</html>`;
