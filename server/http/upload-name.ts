/** Multipart filenames arrive as latin1; strip path separators and control characters. */
export function uploadName(originalName: string, maxLength = 160): string {
  return (
    Array.from(Buffer.from(originalName, 'latin1').toString('utf8'), (character) =>
      character.charCodeAt(0) < 32 || character === '/' || character === '\\' ? '_' : character,
    )
      .join('')
      .slice(0, maxLength) || 'file'
  );
}
