/* checkout-charges.js
 *
 * Shared service-charge calculation logic for Ecwid's server-side cart calculation hook (discountUrl).
 * Intentionally pure/idempotent: derives output only from the incoming cart subtotal.
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.RRHS_CHECKOUT_CHARGES = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SURCHARGE_ID = 'ops_service_charge';
  const SURCHARGE_DESCRIPTION =
    'This charge covers the cost of bags, stamps, promotions, and allows us to bring the best delivery service possible.';

  function toFiniteNumber(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return NaN;
      const parsed = Number.parseFloat(trimmed);
      return Number.isFinite(parsed) ? parsed : NaN;
    }
    return NaN;
  }

  // Standard currency rounding to 2 decimals.
  function roundToCents(amount) {
    if (!Number.isFinite(amount)) return NaN;
    return Math.round((amount + Number.EPSILON) * 100) / 100;
  }

  function computeOpsServiceChargeFromSubtotal(subtotal) {
    const numericSubtotal = toFiniteNumber(subtotal);
    if (!Number.isFinite(numericSubtotal) || numericSubtotal <= 0) return null;

    const fee = roundToCents(numericSubtotal * 0.029 + 0.3);
    if (!Number.isFinite(fee) || fee < 0.01) return null;

    // Ensure output is a simple number with 2dp.
    return Number(fee.toFixed(2));
  }

  function buildEcwidSurchargeResponseFromSubtotal(subtotal) {
    const fee = computeOpsServiceChargeFromSubtotal(subtotal);
    if (fee == null) return { surcharges: [] };

    return {
      surcharges: [
        {
          id: SURCHARGE_ID,
          type: 'ABSOLUTE',
          value: fee,
          description: SURCHARGE_DESCRIPTION,
          taxable: true,
        },
      ],
    };
  }

  return {
    SURCHARGE_ID,
    SURCHARGE_DESCRIPTION,
    toFiniteNumber,
    roundToCents,
    computeOpsServiceChargeFromSubtotal,
    buildEcwidSurchargeResponseFromSubtotal,
  };
});
