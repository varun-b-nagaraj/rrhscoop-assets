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
  const COMBINED_TRANSACTION_FEE_ROW_CLASS = 'ec-cart-summary__row--paypal-stripe-transaction-fee';
  const AUTO_TRANSACTION_FEE_INTERVAL_KEY = '__RRHS_AUTO_TRANSACTION_FEE_INTERVAL__';
  const TRANSACTION_FEE_LABEL = 'PayPal/Stripe Transaction Fee';

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

  function parseMoneyAmount(text) {
    if (typeof text !== 'string') return NaN;
    const normalized = text.replace(/[^0-9.-]/g, '');
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  function formatUsd(amount) {
    if (!Number.isFinite(amount)) return '$0.00';
    return `$${amount.toFixed(2)}`;
  }

  function getRowFeeAmount(row) {
    if (!row) return 0;
    const feeTextEl = row.querySelector('.ec-cart-summary__price span');
    if (!feeTextEl) return 0;
    const value = parseMoneyAmount(feeTextEl.textContent || '');
    return Number.isFinite(value) ? value : 0;
  }

  function hideRow(row) {
    if (!row) return;
    row.style.display = 'none';
    row.setAttribute('aria-hidden', 'true');
  }

  function ensureCombinedFeeRow(summaryBody, insertBeforeRow) {
    let combinedRow = summaryBody.querySelector(`.${COMBINED_TRANSACTION_FEE_ROW_CLASS}`);
    if (combinedRow) return combinedRow;

    combinedRow = document.createElement('tr');
    combinedRow.className = `ec-cart-summary__row ${COMBINED_TRANSACTION_FEE_ROW_CLASS}`;
    combinedRow.innerHTML =
      `<td class="ec-cart-summary__cell ec-cart-summary__title">${TRANSACTION_FEE_LABEL}</td>` +
      '<td class="ec-cart-summary__cell ec-cart-summary__price"><span>$0.00</span></td>';

    if (insertBeforeRow && insertBeforeRow.parentNode === summaryBody) {
      summaryBody.insertBefore(combinedRow, insertBeforeRow);
    } else {
      summaryBody.appendChild(combinedRow);
    }

    return combinedRow;
  }

  function updateCombinedTransactionFeeRow(summaryBody) {
    const handlingFeeRow = summaryBody.querySelector('.ec-cart-summary__row--handling-fee');
    const paymentFeeRow = summaryBody.querySelector('.ec-cart-summary__row--surcharge');
    const handlingFeeContentRow = summaryBody.querySelector('.ec-cart-summary__row--handling-fee-content');

    if (!handlingFeeRow && !paymentFeeRow) return;

    const combinedFee = roundToCents(getRowFeeAmount(handlingFeeRow) + getRowFeeAmount(paymentFeeRow));
    const insertBeforeRow = handlingFeeRow || paymentFeeRow || null;
    const combinedRow = ensureCombinedFeeRow(summaryBody, insertBeforeRow);
    const combinedFeeText = combinedRow.querySelector('.ec-cart-summary__price span');
    if (combinedFeeText) {
      combinedFeeText.textContent = formatUsd(Number.isFinite(combinedFee) ? combinedFee : 0);
    }

    hideRow(handlingFeeRow);
    hideRow(paymentFeeRow);
    hideRow(handlingFeeContentRow);
  }

  function refreshCheckoutTransactionFeeRows() {
    if (typeof document === 'undefined') return;
    const summaryBodies = document.querySelectorAll('tbody.ec-cart-summary__body');
    summaryBodies.forEach(updateCombinedTransactionFeeRow);
  }

  function startTransactionFeeSync(intervalMs) {
    if (typeof window === 'undefined' || typeof document === 'undefined') return null;

    const safeInterval = Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 10;
    refreshCheckoutTransactionFeeRows();
    return window.setInterval(refreshCheckoutTransactionFeeRows, safeInterval);
  }

  function startAutoTransactionFeeSync() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (window[AUTO_TRANSACTION_FEE_INTERVAL_KEY]) return;
    window[AUTO_TRANSACTION_FEE_INTERVAL_KEY] = startTransactionFeeSync(10);
  }

  startAutoTransactionFeeSync();

  return {
    SURCHARGE_ID,
    SURCHARGE_DESCRIPTION,
    COMBINED_TRANSACTION_FEE_ROW_CLASS,
    TRANSACTION_FEE_LABEL,
    toFiniteNumber,
    roundToCents,
    computeOpsServiceChargeFromSubtotal,
    buildEcwidSurchargeResponseFromSubtotal,
    parseMoneyAmount,
    formatUsd,
    getRowFeeAmount,
    updateCombinedTransactionFeeRow,
    refreshCheckoutTransactionFeeRows,
    startTransactionFeeSync,
    startAutoTransactionFeeSync,
  };
});
