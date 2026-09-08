/** Catalog coordinate picker. Shown locally for now; later also for admin users. */
export function isCatalogMapEnabled() {
  return process.env.NODE_ENV === "development";
}
