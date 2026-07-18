// WAY <-> USD conversion.
// Founder-set rate (placeholder). Swap for a live oracle/price feed later by
// exporting getWayUsdRate() that fetches from an API/precompile.
// UI principle (founder 2026-07-17): users think in DOLLARS, not decimals.
// Every amount field shows the USD value; raw wei is hidden.

export const WAY_USD_RATE = 0.10; // 1 WAY = $0.10 (PLACEHOLDER — founder-set)
export const BTC_USD_RATE = 65000; // 1 BTC = $65,000 (PLACEHOLDER — founder-set)

// way (human units, e.g. 12.5) -> USD string
export function wayToUsd(way) {
  const n = Number(way) || 0;
  return (n * WAY_USD_RATE).toFixed(2);
}
// usd -> way (human units)
export function usdToWay(usd) {
  const n = Number(usd) || 0;
  return (n / WAY_USD_RATE).toFixed(4);
}
// format a human WAY amount without wei noise
export function fmtWay(way) {
  const n = Number(way) || 0;
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}
// sats -> USD string
export function satsToUsd(sats) {
  const n = Number(sats) || 0;
  return ((n / 1e8) * BTC_USD_RATE).toFixed(2);
}
