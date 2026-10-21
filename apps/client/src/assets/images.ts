// Version the filename when replacing an asset, so the browser can cache it.
export const brandImage = {
  src: '/images/brand/wong-sian-yinyang-04-v1.png', width: 192, height: 192,
} as const;

export const entryImages = {
  whoami: { src: '/images/entry/whoami-hero-v1.webp', width: 1680, height: 936 },
} as const;

// Shared by public vote reveals and final results; one cached sprite for all roles.
export const undercoverRoleImage = { src: '/images/undercover/role-reveal-v1.png', width: 1080, height: 360 } as const;
