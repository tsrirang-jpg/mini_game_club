// Version the filename when replacing an asset, so the browser can cache it.
export const brandImage = {
  src: '/images/brand/wong-sian-yinyang-04-v1.png', width: 192, height: 192,
} as const;

export const menuImages = {
  undercover: { src: '/images/menu/undercover-trio-v2.png', width: 1000, height: 666 },
} as const;

export const entryImages = {
  undercover: menuImages.undercover,
  liar: { src: '/images/entry/liar-hero-v2.png', width: 1000, height: 666 },
  whoami: { src: '/images/entry/whoami-hero-v1.webp', width: 1680, height: 936 },
  poker: { src: '/images/entry/poker-hero-v1.webp', width: 1535, height: 658 },
  spyfall: { src: '/images/entry/spyfall-hero-v1.webp', width: 1527, height: 680 },
  oldmaid: { src: '/images/entry/oldmaid-hero-v1.webp', width: 1459, height: 681 },
} as const;

// Loaded only when the voted player's role is revealed; one cached sprite for all roles.
export const undercoverRoleImage = { src: '/images/undercover/role-reveal-v1.png', width: 1080, height: 360 } as const;
