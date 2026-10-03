type LocationKind = "area" | "gps";

type LocationRequestCardProps = {
  kind: LocationKind;
  busy?: boolean;
  onShareGps: () => void;
  onSkip?: () => void;
};

export function LocationRequestCard({
  kind,
  busy = false,
  onShareGps,
  onSkip,
}: LocationRequestCardProps) {
  const isGps = kind === "gps";

  return (
    <div
      className={`location-request-card ${isGps ? "location-request-card-urgent" : ""}`}
      role="region"
      aria-label={isGps ? "Udostępnij aktualną lokalizację" : "Podaj lokalizację miejsca"}
    >
      <p className="location-request-kicker">
        {isGps ? "Aktualna lokalizacja" : "Lokalizacja miejsca"}
      </p>
      <p className="location-request-text">
        {isGps
          ? "Jeśli możesz — udostępnij pozycję z urządzenia. Przy bezpośrednim zagrożeniu najpierw 112."
          : "Wpisz ulicę / punkt w wiadomości albo udostępnij pozycję z mapy telefonu, jeśli jesteś na miejscu."}
      </p>
      <div className="location-request-actions">
        <button
          type="button"
          className="btn-primary"
          disabled={busy}
          onClick={onShareGps}
        >
          {busy ? "Pobieram…" : isGps ? "Udostępnij lokalizację" : "Udostępnij pozycję z GPS"}
        </button>
        {onSkip && (
          <button type="button" className="btn-ghost text-sm" disabled={busy} onClick={onSkip}>
            Wpiszę ręcznie
          </button>
        )}
      </div>
    </div>
  );
}
