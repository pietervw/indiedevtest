function hasQueryValue(value: string | string[] | undefined): boolean {
  if (value === undefined || value === "") {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some((entry) => Boolean(entry));
  }
  return true;
}

/** Filtered/sorted browse URLs canonicalize to /browse and should not be indexed. */
export function browseSearchParamsAreIndexable(
  params: Record<string, string | string[] | undefined>
): boolean {
  return !Object.values(params).some(hasQueryValue);
}
