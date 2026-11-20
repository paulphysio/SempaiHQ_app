/*
 * Web only (loaded from index.js before the app).
 * The app is designed for phones. On wide screens (laptops, tablets in
 * landscape) it is shown as a centred phone-width column with a soft backdrop,
 * so every screen looks exactly as designed instead of stretched.
 */
import { Dimensions } from 'react-native';

export const WEB_APP_MAX_WIDTH = 520;

// Screens size themselves from Dimensions / useWindowDimensions: report the
// column width, not the whole browser width.
const realGet = Dimensions.get.bind(Dimensions);
Dimensions.get = (dim) => {
  const d = realGet(dim);
  if (!d || d.width <= WEB_APP_MAX_WIDTH) return d;
  return { ...d, width: WEB_APP_MAX_WIDTH };
};

if (typeof document !== 'undefined') {
  const css = `
    html, body { height: 100%; margin: 0; background: #07070d; }
    body { overscroll-behavior-y: none; }
    /* Off-screen parts (the closed side menu waits past the right edge) must
       not widen the page: otherwise phones can zoom out, see them, and
       pop-ups get centred on the wider page instead of the screen. */
    html, body { overflow-x: hidden; max-width: 100vw; }
    #root { overflow: hidden; position: relative; }
    @media (min-width: ${WEB_APP_MAX_WIDTH + 1}px) {
      body {
        background:
          radial-gradient(1200px 600px at 50% -10%, rgba(255,106,0,0.18), transparent 60%),
          radial-gradient(900px 500px at 50% 110%, rgba(140,60,255,0.12), transparent 60%),
          #07070d;
      }
      #root {
        max-width: ${WEB_APP_MAX_WIDTH}px;
        margin: 0 auto;
        position: relative;
        box-shadow: 0 0 0 1px rgba(255,255,255,0.06), 0 30px 80px rgba(0,0,0,0.55);
        overflow: hidden;
      }
      /* Pop-ups (React Native Modal → a full-window layer on the web) live in
         the same centred column as the app, so they line up exactly as on a
         phone instead of drifting across the wide screen. */
      [aria-modal="true"] {
        left: 50% !important;
        right: auto !important;
        width: ${WEB_APP_MAX_WIDTH}px !important;
        margin-left: -${WEB_APP_MAX_WIDTH / 2}px !important;
      }
    }
  `;
  const style = document.createElement('style');
  style.setAttribute('data-sempai', 'web-layout');
  style.textContent = css;
  document.head.appendChild(style);
}
