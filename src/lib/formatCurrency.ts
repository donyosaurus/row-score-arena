/**
 * Format cents to dollars with proper decimal handling
 * Shows decimals only when needed (e.g., $19.50 not $20, but $20 not $20.00)
 */
export const formatCents = (cents: number): string => {
  const dollars = cents / 100;
  // If it's a whole number, don't show decimals
  if (Number.isInteger(dollars)) {
    return `$${dollars}`;
  }
  // Otherwise show up to 2 decimal places
  return `$${dollars.toFixed(2)}`;
};

/**
 * Format cents to dollars as a raw number string (no $ symbol)
 */
export const formatCentsRaw = (cents: number): string => {
  const dollars = cents / 100;
  if (Number.isInteger(dollars)) {
    return dollars.toString();
  }
  return dollars.toFixed(2);
};
