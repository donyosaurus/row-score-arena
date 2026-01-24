/**
 * Format cents to dollars with proper decimal handling
 * Always shows 2 decimal places for consistency (e.g., $19.50, $20.00)
 */
export const formatCents = (cents: number): string => {
  const dollars = cents / 100;
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
