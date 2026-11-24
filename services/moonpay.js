// Buy crypto with MoonPay: live quotes (every fee shown before leaving the app) and the widget link.
// The widget link comes from sempaihq.com/api/moonpay-widget, which holds MoonPay's publishable key
// (a public key, safe in a URL). If that endpoint ever signs the link, we must not edit it, so the
// coin / amount / method are then only passed in the request body.

import { SITE_API } from '../constants';

const WIDGET_ENDPOINT = `${SITE_API}/moonpay-widget`;
const API = 'https://api.moonpay.com/v3/currencies';

export const BUY_ASSETS = [
  { value: 'usdc_sol', label: 'USDC', symbol: 'USDC' },
  { value: 'sol', label: 'SOL', symbol: 'SOL' },
];
export const BUY_METHODS = [
  { value: 'credit_debit_card', label: 'Card' },
  { value: 'ach_bank_transfer', label: 'Bank (US)' },
];

let keyCache = null;

/** { widgetUrl, apiKey, testMode } for this wallet. */
async function widget(walletAddress, opts = {}) {
  const r = await fetch(WIDGET_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress, fiatCurrency: 'USD', defaultFiatAmount: String(opts.amount || 100), ...opts }),
  });
  if (!r.ok) throw new Error(`MoonPay link failed (${r.status})`);
  const { widgetUrl } = await r.json();
  const url = new URL(widgetUrl);
  const apiKey = url.searchParams.get('apiKey') || '';
  keyCache = apiKey;
  return { url, apiKey, testMode: apiKey.startsWith('pk_test') };
}

export async function moonpayMode(walletAddress) {
  try {
    const { testMode } = await widget(walletAddress);
    return testMode ? 'test' : 'live';
  } catch {
    return null;
  }
}

/**
 * MoonPay's quote for spending `usd` (before fees). Fees are added on top, so:
 * total = usd + feeAmount + networkFeeAmount + extraFeeAmount.
 */
export async function getBuyQuote({ walletAddress, asset, usd, method }) {
  if (!keyCache) await widget(walletAddress);
  const q = new URLSearchParams({
    apiKey: keyCache,
    baseCurrencyAmount: String(usd),
    baseCurrencyCode: 'usd',
    paymentMethod: method,
  });
  const r = await fetch(`${API}/${asset}/buy_quote?${q}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.message || 'MoonPay could not price this amount.');
  return {
    spend: Number(j.baseCurrencyAmount), // MoonPay raises amounts below its minimum to the minimum
    receive: Number(j.quoteCurrencyAmount),
    price: Number(j.quoteCurrencyPrice),
    fee: Number(j.feeAmount || 0) + Number(j.extraFeeAmount || 0),
    networkFee: Number(j.networkFeeAmount || 0),
    total: Number(j.totalAmount),
    min: Number(j.baseCurrency?.minBuyAmount) || null,
    max: Number(j.baseCurrency?.maxBuyAmount) || null,
  };
}

/** The MoonPay page for this purchase, with the coin, amount and method filled in. */
export async function buyUrl({ walletAddress, asset, usd, method }) {
  const { url } = await widget(walletAddress, { currencyCode: asset, amount: usd, paymentMethod: method });
  if (!url.searchParams.has('signature')) {
    url.searchParams.set('currencyCode', asset);
    url.searchParams.set('baseCurrencyAmount', String(usd));
    url.searchParams.set('paymentMethod', method);
  }
  return url.toString();
}
