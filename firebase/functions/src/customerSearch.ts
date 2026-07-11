export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildNameSearchPrefixes(value: string): string[] {
  const normalized = normalizeSearchText(value);
  const sources = [...normalized.split(" "), normalized].filter((item) => item.length >= 2);
  const prefixes = new Set<string>();

  for (const source of sources) {
    for (let length = 2; length <= source.length && prefixes.size < 120; length += 1) {
      prefixes.add(source.slice(0, length));
    }
  }

  return [...prefixes];
}
