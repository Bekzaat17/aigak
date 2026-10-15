/** Service-provider links are technical context, not an operator's related resources. */
export function isTechnicalResourceLink(url: URL): boolean {
  return (
    [
      'cloudflare.com',
      'challenges.cloudflare.com',
      'hcaptcha.com',
      'recaptcha.net',
      'gstatic.com',
      'cloudflareinsights.com',
    ].some((host) => url.hostname === host || url.hostname.endsWith('.' + host)) ||
    /\/(?:cdn-cgi|recaptcha)(?:\/|$)/i.test(url.pathname)
  );
}
