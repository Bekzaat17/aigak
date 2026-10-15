/** Only Cloudflare's browser-verification transport; never account or payment endpoints. */
export function isChallengeRequest(url: URL, pageUrl: string, bytes: number): boolean {
  try {
    const page = new URL(pageUrl);
    return (
      page.protocol === 'https:' &&
      url.protocol === 'https:' &&
      url.port === '' &&
      !url.username &&
      !url.password &&
      bytes <= 262144 &&
      url.pathname.startsWith('/cdn-cgi/challenge-platform/') &&
      (url.origin === page.origin || url.hostname === 'challenges.cloudflare.com')
    );
  } catch {
    return false;
  }
}
