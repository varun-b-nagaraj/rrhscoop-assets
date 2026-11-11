/* Hunt settings. Turn the hunt on or off with RRHS_HUNT_ENABLED in Vercel, not here. */
(function (root) {
  'use strict';
  const config = Object.freeze({
    DEV_PREVIEW_ENABLED: true,
    DEV_ALL_EGGS_ENABLED: false,
    stickerPath: 'dragon-package-sticker.png?v=1',
    startsAt: '2026-11-09T00:00:00-06:00',
    // Exclusive cutoff: includes the entire 11:59 PM minute on Friday, Central.
    expiresAt: '2026-11-14T00:00:00-06:00',
    locations: Object.freeze([
      { id: 'inventory-intelligence', selector: '[data-egg-location="inventory-intelligence"]' },
      { id: 'projects-library', selector: '.library-heading h2' },
      { id: 'projects-method', selector: '.method h2' },
      { id: 'projects-impact', selector: '.closing h2' },
      { id: 'why-gear', selector: '.benefit:nth-child(1) h3' },
      { id: 'why-students', selector: '.benefit:nth-child(3) h3' },
      { id: 'why-return', selector: '.step:nth-child(4) h3' },
      { id: 'faq-answers', selector: '.faq-topline h2' },
      { id: 'faq-contact', selector: '.contact h2' },
      { id: 'category-merch', selector: '.category-card:nth-child(1) .category-card__title' },
      { id: 'category-supplies', selector: '.category-card:nth-child(4) .category-card__title' },
      { id: 'store-footer', selector: '.rrhs-footer-column:nth-child(3) h2' },
    ]),
  });
  if (typeof module === 'object' && module.exports) module.exports = config;
  else root.RRHS_HUNT_CONFIG = config;
})(typeof window === 'undefined' ? globalThis : window);
