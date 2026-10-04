import { useState } from "react";

import { ExternalLinkIcon } from "@/components/ExternalLinkIcon";
import { youtubeId } from "@/lib/video";

type VideoEmbedProps = {
  url: string;
  /** Czego dotyczy film — trafia do tytułu ramki i etykiety przycisku */
  title: string;
};

/**
 * Film ładuje się dopiero po kliknięciu (bez autoodtwarzania i bez ciasteczek
 * YouTube przed zgodą użytkownika). Dla innych adresów — zwykły link.
 */
export function VideoEmbed({ url, title }: VideoEmbedProps) {
  const [playing, setPlaying] = useState(false);
  const id = youtubeId(url);

  if (!id) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="kb-link">
        Obejrzyj film: {title}
        <ExternalLinkIcon />
        <span className="sr-only"> (otwiera się w nowej karcie)</span>
      </a>
    );
  }

  if (!playing) {
    return (
      <button type="button" className="kb-video-poster" onClick={() => setPlaying(true)}>
        <span className="kb-video-play" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" focusable="false">
            <path d="M8 5.5v13l11-6.5z" />
          </svg>
        </span>
        <span className="font-display text-sm font-semibold">Odtwórz film</span>
        <span className="text-xs opacity-80">{title} · YouTube</span>
      </button>
    );
  }

  return (
    <div className="kb-video-frame">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`}
        title={`Film: ${title}`}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
      />
    </div>
  );
}
