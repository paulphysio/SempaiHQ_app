/**
 * Format numbers with suffixes (k, M, B, T)
 * Examples: 1234 -> 1.2k, 1234567 -> 1.2M, 1234567890 -> 1.2B
 */
export const formatNumber = (num) => {
  if (num === null || num === undefined || isNaN(num)) return '0';
  
  const absNum = Math.abs(num);
  
  if (absNum >= 1e12) {
    return (num / 1e12).toFixed(1) + 'T';
  } else if (absNum >= 1e9) {
    return (num / 1e9).toFixed(1) + 'B';
  } else if (absNum >= 1e6) {
    return (num / 1e6).toFixed(1) + 'M';
  } else if (absNum >= 1e3) {
    return (num / 1e3).toFixed(1) + 'k';
  } else {
    return num.toFixed(2);
  }
};

/**
 * Format numbers with suffixes for integers (no decimals)
 * Examples: 1234 -> 1k, 1234567 -> 1M, 1234567890 -> 1B
 */
export const formatNumberInt = (num) => {
  if (num === null || num === undefined || isNaN(num)) return '0';
  
  const absNum = Math.abs(num);
  
  if (absNum >= 1e12) {
    return Math.round(num / 1e12) + 'T';
  } else if (absNum >= 1e9) {
    return Math.round(num / 1e9) + 'B';
  } else if (absNum >= 1e6) {
    return Math.round(num / 1e6) + 'M';
  } else if (absNum >= 1e3) {
    return Math.round(num / 1e3) + 'k';
  } else {
    return Math.round(num).toString();
  }
};
