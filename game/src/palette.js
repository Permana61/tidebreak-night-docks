// The look plan, in one place. Night docks: cold moonlit navy against warm
// crane amber, Tidebreaker cyan against Dockwatch safety orange. The same
// names are the CSS custom properties in index.html.
export const PALETTE = {
  canvas: '#0d1620',
  surface: '#16222f',
  hairline: '#2b3d4f',
  ink: '#e9f2f7',
  muted: '#8ba2b2',
  accent: '#ffb02e',
  teal: '#27c8e8',
  ember: '#ff6b35',
};

export function shade(name) {
  return PALETTE[name];
}
