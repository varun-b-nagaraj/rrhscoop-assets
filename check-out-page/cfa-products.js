/* Shared product identities for the regular-store preorder guard. */
(function (root) {
  const skus = ['601_sku', '782_sku', '698_sku'];
  const ids = [779182392, 864700011, 813619469];
  const isPreorder = product => Boolean(product && (skus.includes(String(product.sku || '').toLowerCase()) || ids.includes(Number(product.id || product.productId))));
  const cartHasPreorder = cart => Boolean(cart && Array.isArray(cart.items) && cart.items.some(item => isPreorder(item?.product) || isPreorder(item)));
  const api = Object.freeze({ skus, ids, isPreorder, cartHasPreorder, url: 'https://rrhscoop.roundrockisd.org/teachers/chick-fil-a' });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RRHS_CFA_PRODUCTS = api;
}(typeof window === 'undefined' ? globalThis : window));
