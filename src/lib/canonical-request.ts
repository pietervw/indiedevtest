export const PRODUCTION_APEX_HOST = "indiedevtest.com";
export const PRODUCTION_WWW_HOST = `www.${PRODUCTION_APEX_HOST}`;

function hostnameWithoutPort(host: string): string {
  return host.toLowerCase().split(":")[0] ?? "";
}

function protocolName(protocol: string): string {
  return protocol.replace(/:$/, "").toLowerCase();
}

/**
 * Production apex must be served on HTTPS without www.
 * Preview / localhost hosts are left alone.
 */
export function canonicalHttpsRedirectUrl(input: {
  hostname: string;
  protocol: string;
  pathname: string;
  search?: string;
}): string | null {
  const hostname = hostnameWithoutPort(input.hostname);
  const isProductionHost =
    hostname === PRODUCTION_APEX_HOST || hostname === PRODUCTION_WWW_HOST;
  if (!isProductionHost) {
    return null;
  }

  const protocol = protocolName(input.protocol);
  const needsHttps = protocol === "http";
  const needsApex = hostname === PRODUCTION_WWW_HOST;
  if (!needsHttps && !needsApex) {
    return null;
  }

  const pathname = input.pathname || "/";
  const search = input.search ?? "";
  return `https://${PRODUCTION_APEX_HOST}${pathname}${search}`;
}

export function forwardedProtocol(
  xForwardedProto: string | null,
  fallbackProtocol: string
): string {
  const forwarded = xForwardedProto?.split(",")[0]?.trim();
  return forwarded || protocolName(fallbackProtocol);
}
