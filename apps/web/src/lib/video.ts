/** Id filmu z linku YouTube (`watch?v=` lub `youtu.be/`); null dla innych adresów. */
export function youtubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/)([\w-]{6,20})/i);
  return match ? match[1] : null;
}
