/** Public diagnostics only: never persist raw browser errors, request bodies or credentials. */
export function collectionError(error: unknown) {
  if (!(error instanceof Error)) return 'CAPTURE_FAILED';
  const code = 'code' in error ? error.code : undefined;
  if (
    typeof code === 'string' &&
    /^(ENOTFOUND|EAI_AGAIN|EAI_NONAME|ECONNREFUSED|ECONNRESET|ETIMEDOUT|CERT_HAS_EXPIRED|DEPTH_ZERO_SELF_SIGNED_CERT|UNABLE_TO_VERIFY_LEAF_SIGNATURE|ERR_TLS_CERT_ALTNAME_INVALID)$/.test(
      code,
    )
  )
    return code;
  if (/^[A-Z_]+$/.test(error.message)) return error.message;
  const network = error.message.match(/net::(ERR_[A-Z_]+)/)?.[1];
  if (network) return network;
  return error.name === 'TimeoutError'
    ? 'BROWSER_TIMEOUT'
    : error.name === 'AbortError'
      ? 'CAPTURE_DEADLINE'
      : 'CAPTURE_FAILED';
}
