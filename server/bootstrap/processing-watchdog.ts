/** Terminate a stuck worker so its durable task can be recovered by the next process. */
export function processingWatchdog(timeoutMs: number): () => void {
  const timer = setTimeout(() => {
    console.error('PROCESSING_DEADLINE_EXCEEDED');
    process.exit(1);
  }, timeoutMs);
  timer.unref();
  return () => clearTimeout(timer);
}
