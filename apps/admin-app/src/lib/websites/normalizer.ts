export function normalizeDomain(url: string): string {
  let domain = url.trim().toLowerCase();

  if (!domain.startsWith("http://") && !domain.startsWith("https://")) {
    domain = "https://" + domain;
  }

  try {
    const parsed = new URL(domain);
    domain = parsed.hostname + parsed.pathname.replace(/\/+$/, "");
  } catch {
    domain = domain.replace(/^https?:\/\//, "").split("/")[0];
  }

  domain = domain.replace(/^www\./, "").replace(/\/+$/, "");

  return domain;
}

export function extractDomain(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].split("?")[0];
  }
}
