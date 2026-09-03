/**
 * @file URL 解析
 * @author svon.me@gmail.com
 **/

const NODE_DEFAULT_ORIGIN = "http://localhost";

function getRuntimeOrigin(): string {
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin;
  }
  return NODE_DEFAULT_ORIGIN;
}

function normalizeBase(domain?: string): string {
  const runtimeOrigin = getRuntimeOrigin();
  if (!domain) {
    return runtimeOrigin;
  }
  if (domain.startsWith("//")) {
    return `${new globalThis.URL(runtimeOrigin).protocol}${domain}`;
  }
  if (/^https?:\/\//i.test(domain)) {
    return domain;
  }
  return runtimeOrigin;
}

export class URL extends globalThis.URL {
  constructor(value: string = "/", domain?: string) {
    super(value || "/", normalizeBase(domain));
  }

  getQuery(name: string): string | undefined {
    return this.searchParams.get(name) ?? undefined;
  }

  setQuery(key: string, value: string | number | undefined): void {
    if (value == null) {
      this.searchParams.delete(key);
    } else {
      this.searchParams.set(key, String(value));
    }
  }

  get query(): Map<string, string | number | undefined> {
    return new Map(this.searchParams.entries());
  }

  format(): string {
    return this.toString();
  }
}

