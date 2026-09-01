export function formatDate(dateValue) {
  if (!dateValue) {
    return "Not sent";
  }

  // Parse the date string correctly
  let parsed;
  if (typeof dateValue === "string" && dateValue.includes("-")) {
    // Handle YYYY-MM-DD format
    const parts = dateValue.split("-").map(Number);
    // Create date using UTC to avoid timezone issues
    parsed = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  } else {
    parsed = new Date(dateValue);
  }

  if (Number.isNaN(parsed.getTime())) {
    return dateValue;
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC", // Add this to ensure consistent formatting
  }).format(parsed);
}
export function formatCurrency(value) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}
