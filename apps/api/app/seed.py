import threading

from sqlmodel import Session, select

from .config import get_settings
from .dependencies.auth import get_user, hash_password
from .dependencies.logger import get_logger
from .models import ActualProject, KnowledgeResource, KnowledgeResourceKind, RoleEnum, User
from .scripts.scrape_rops import refresh_new_projects

logger = get_logger(__name__)


def seed_admin_user(session: Session) -> None:
    settings = get_settings()
    email = settings.admin_email.lower()
    existing = get_user(session, email)
    if existing is not None:
        if existing.role != RoleEnum.ADMIN:
            existing.role = RoleEnum.ADMIN
            session.add(existing)
            session.commit()
            logger.warning("Istniejący użytkownik %s dostał rolę admina (seed)", existing.id)
        return

    parts = (settings.admin_full_name or "MaloHUB Admin").strip().split(None, 1)
    admin = User(
        email=email,
        hashed_password=hash_password(settings.admin_password),
        name=parts[0] if parts else "Admin",
        surname=parts[1] if len(parts) > 1 else "MaloHUB",
        phone_number=None,
        role=RoleEnum.ADMIN,
    )
    session.add(admin)
    session.commit()
    logger.info("Utworzono konto admina (seed)")
    if settings.admin_password == "admin12345":
        logger.warning("Admin ma domyślne hasło — ustaw ADMIN_PASSWORD przed wdrożeniem")


# Działy serwisu rops.krakow.pl — punkt startowy Zasobnika wiedzy; admin redaguje je w panelu.
ROPS_URL = "https://rops.krakow.pl"
KNOWLEDGE_SEED: tuple[tuple[KnowledgeResourceKind, str, str, str], ...] = (
    (KnowledgeResourceKind.CHALLENGE, "Raporty z badań", "Raporty",
     "/badania-analizy-raporty/raporty-z-badan"),
    (KnowledgeResourceKind.CHALLENGE, "Internetowy Obserwator Statystyk Społecznych", "Statystyki",
     "/badania-analizy-raporty/internetowy-obserwator-statystyk-spolecznych"),
    (KnowledgeResourceKind.CHALLENGE,
     "Ocena zasobów pomocy społecznej w województwie małopolskim — bieżąca ocena", "Raport",
     "/badania-analizy-raporty/ocena-zasobow-pomocy-spolecznej-w-woj-malopolskim/biezaca-ocena"),
    (KnowledgeResourceKind.MATERIAL, "Publikacje ze świata innowacji", "Publikacje",
     "/innowacje-spoleczne/publikacje-ze-swiata-innowacji"),
    (KnowledgeResourceKind.MATERIAL, "Innowacje w małopolskich modelach", "Publikacje",
     "/innowacje-spoleczne/innowacje-w-malopolskich-modelach"),
    (KnowledgeResourceKind.MATERIAL, "Pracownicy socjalni — materiały edukacyjne",
     "Materiały edukacyjne", "/dla-kadr-pomocy-spolecznej/pracownicy-socjalni-materialy-edukacyjne"),
    (KnowledgeResourceKind.MATERIAL, "Domy Pomocy Społecznej — materiały edukacyjne",
     "Materiały edukacyjne",
     "/dla-kadr-pomocy-spolecznej/domy-pomocy-spolecznej-materialy-edukacyjne"),
    (KnowledgeResourceKind.MATERIAL, "Środowiskowe Domy Samopomocy — materiały edukacyjne",
     "Materiały edukacyjne",
     "/dla-kadr-pomocy-spolecznej/srodowiskowe-domy-samopomocy-materialy-edukacyjne"),
)


def seed_knowledge_resources(session: Session) -> None:
    if session.exec(select(KnowledgeResource)).first() is not None:
        return
    for kind, title, label, path in KNOWLEDGE_SEED:
        session.add(
            KnowledgeResource(kind=kind, title=title, format=label, url=f"{ROPS_URL}{path}")
        )
    session.commit()
    logger.info("Zasobnik wiedzy: dodano %s zasobów startowych", len(KNOWLEDGE_SEED))


def _scrape_innovation_library() -> None:
    try:
        added = refresh_new_projects()
    except Exception:
        logger.exception("Biblioteka Innowacji: pobieranie startowe nie powiodło się")
        return
    logger.info("Biblioteka Innowacji: pobrano %s projektów na starcie", added)


def seed_innovation_library(session: Session) -> threading.Thread | None:
    """Pusta Biblioteka Innowacji → scraper rops.krakow.pl w wątku w tle.

    Pełne pobranie trwa kilka minut, więc nie blokuje startu API. Gdy projekty już są,
    nic nie robi — nowe dociąga admin (`POST /knowledge/refresh`).
    """
    if not get_settings().scrape_on_startup:
        return None
    if session.exec(select(ActualProject)).first() is not None:
        return None
    logger.info("Biblioteka Innowacji jest pusta — pobieram z rops.krakow.pl w tle")
    thread = threading.Thread(target=_scrape_innovation_library, name="scrape-rops", daemon=True)
    thread.start()
    return thread
