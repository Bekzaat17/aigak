/** Public diagnostics only: never persist raw browser errors, request bodies or credentials. */
export function collectionError(error: unknown) {
  if (!(error instanceof Error)) return 'CAPTURE_FAILED';
  if (/^[A-Z_]+$/.test(error.message)) return error.message;
  const network = error.message.match(/net::(ERR_[A-Z_]+)/)?.[1];
  if (network) return network;
  return error.name === 'TimeoutError'
    ? 'BROWSER_TIMEOUT'
    : error.name === 'AbortError'
      ? 'CAPTURE_DEADLINE'
      : 'CAPTURE_FAILED';
}
