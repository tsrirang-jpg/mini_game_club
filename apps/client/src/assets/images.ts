// Version the filename when replacing an asset, so the browser can cache it.
export const brandImage = {
  src: '/images/brand/wong-sian-yinyang-04-v1.png', width: 192, height: 192,
} as const;

export const menuImages = {
  undercover: { src: '/images/menu/undercover-trio-v1.jpg', width: 1000, height: 666 },
} as const;

export const entryImages = {
  undercover: menuImages.undercover,
  liar: { src: '/images/entry/liar-hero-v1.jpg', width: 1000, height: 667 },
  whoami: { src: '/images/entry/whoami-hero-v1.webp', width: 1680, height: 936 },
  poker: { src: '/images/entry/poker-hero-v1.webp', width: 1535, height: 658 },
  spyfall: { src: '/images/entry/spyfall-hero-v1.webp', width: 1527, height: 680 },
  oldmaid: { src: '/images/entry/oldmaid-hero-v1.webp', width: 1459, height: 681 },
} as const;
