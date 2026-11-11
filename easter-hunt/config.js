/* Hunt settings. Turn the hunt on or off with RRHS_HUNT_ENABLED in Vercel, not here. */
(function (root) {
  'use strict';
  // One sticker per page (the long Teacher Hub has a top and a bottom one).
  // `page` is a regular expression tested against the page's path: a storefront path on
  // rrhscoop.roundrockisd.org, or the iframe file for pages built from our iframes.
  // `text` picks the matching heading when the selector alone is not unique.
  // Rewards per sticker live only in the Apps Script (HUNT_EGGS), never in the browser.
  const config = Object.freeze({
    DEV_PREVIEW_ENABLED: true,
    DEV_ALL_EGGS_ENABLED: false,
    stickerPath: 'dragon-package-sticker.png?v=1',
    startsAt: '2026-11-09T00:00:00-06:00',
    // Exclusive cutoff: includes the entire 11:59 PM minute on Friday, Central.
    expiresAt: '2026-11-14T00:00:00-06:00',
    locations: Object.freeze([
      // Product pages
      { id: 'shop-snacks', label: 'Snacks', page: '-c169641499$', selector: 'h1.page-title__name' },
      { id: 'shop-drinks', label: 'Drinks', page: '-c169641959$', selector: 'h1.page-title__name' },
      { id: 'shop-long-sleeves', label: 'Long Sleeves', page: '-c189785506$', selector: 'h1.page-title__name' },
      { id: 'shop-t-shirts', label: 'T-Shirts', page: '-c189782259$', selector: 'h1.page-title__name' },
      { id: 'shop-accessories', label: 'Accessories', page: '-c189785755$', selector: 'h1.page-title__name' },
      { id: 'shop-school-supplies', label: 'School Supplies', page: '-c194772751$', selector: 'h1.page-title__name' },
      { id: 'shop-merchandise', label: 'Merchandise', page: '-c(189782257|176456552)$', selector: 'h1.page-title__name' },
      // Main pages
      { id: 'home-why-coop', label: 'Home · Why the CO-OP', page: '^/iframes/why-coop/', selector: '.benefit:nth-child(1) h3' },
      { id: 'teachers-top', label: 'Teacher Hub · Good things for our faculty', page: '^/iframes/teachers/index', selector: '#faculty-title' },
      { id: 'leadership', label: 'Leadership · Leadership with a store-wide view', page: '^/iframes/leadership/index', selector: '#executive-title' },
      { id: 'faq', label: 'FAQ', page: '^/iframes/faq/', selector: '.faq-topline h2' },
      { id: 'shop-chick-fil-a', label: 'Chick-fil-A', page: '-c(196956751|196908210)$', selector: 'h1.page-title__name' },
      { id: 'about-us', label: 'About us', page: '^/products/pages/about$', selector: 'h1.page-title__name' },
      // Deeper pages
      { id: 'inventory-intelligence', label: 'Student Projects · Inventory Intelligence', page: '^/iframes/projects/', selector: '[data-egg-location="inventory-intelligence"]' },
      { id: 'team-25-26', label: '2025–26 Leadership · E-Commerce Development', page: '^/team-25-26$', selector: '.ins-tile__title', text: 'E-Commerce Development' },
      { id: 'teachers-bottom', label: 'Teacher Hub · More reasons to stop by', page: '^/iframes/teachers/index', selector: 'h3', text: 'More reasons to stop by' },
      { id: 'payment-methods', label: 'Payment methods · Contact Information', page: '^/products/pages/shipping-payment$', selector: 'h3', text: 'C. Contact Information' },
      { id: 'shipping-returns', label: 'Shipping & returns', page: '^/products/pages/returns$', selector: 'h1.page-title__name' },
      { id: 'terms', label: 'Terms & Conditions · Contact Information', page: '^/products/pages/terms$', selector: 'h3', text: '5. Contact Information' },
      // Deepest
      { id: 'privacy-policy', label: 'Privacy policy · Customers’ Rights', page: '^/products/pages/privacy-policy$', selector: 'h3', text: '5. Customers' },
    ].map(Object.freeze)),
  });
  if (typeof module === 'object' && module.exports) module.exports = config;
  else root.RRHS_HUNT_CONFIG = config;
})(typeof window === 'undefined' ? globalThis : window);
