"""Zasobnik wiedzy — publiczny odczyt, redakcja i trendy potrzeb tylko dla admina."""

import asyncio
import re
import uuid
from collections import Counter
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, col, select

from ..dependencies.auth import CurrentAdminDep
from ..dependencies.db import SessionDep
from ..models import (
    ActualProject,
    CategoriesOfProjects,
    KnowledgeResource,
    KnowledgeResourceCreate,
    NeedSignal,
)
from ..scripts.scrape_rops import refresh_new_projects

router = APIRouter(tags=["knowledge"])

# Opisy z Biblioteki mają stałe sekcje: „1. Na czym polega rozwiązanie?”, „2. …”.
SECTION_RE = re.compile(r"^(\d{1,2})\.\s+(.{3,120})$")
TREND_WEEKS = 8
UNMET_LIMIT = 30


class InnovationSection(BaseModel):
    title: str
    body: str


class InnovationSummary(BaseModel):
    id: uuid.UUID
    name: str
    category_id: uuid.UUID
    solution: str  # sekcja 1 — na czym polega
    problem: str  # sekcja 2 — jakich problemów dotyczy
    has_video: bool


class InnovationDetail(BaseModel):
    id: uuid.UUID
    name: str
    category_id: uuid.UUID
    category_name: str
    sections: list[InnovationSection]
    source_url: str | None
    video_url: str | None
    folder_url: str | None


class KnowledgeArea(BaseModel):
    id: uuid.UUID
    name: str
    innovations: int


class KnowledgeOverview(BaseModel):
    areas: list[KnowledgeArea]
    innovations: list[InnovationSummary]
    resources: list[KnowledgeResource]


class AreaTrend(BaseModel):
    category_id: uuid.UUID | None  # None = potrzeby bez odpowiedzi w bazie
    name: str
    total: int
    last_30_days: int
    previous_30_days: int
    weekly: list[int]  # od najstarszego tygodnia, długość = len(weeks)


class UnmetNeed(BaseModel):
    created_at: str
    summary: str


class NeedTrends(BaseModel):
    weeks: list[str]  # poniedziałki (ISO) kolejnych tygodni
    areas: list[AreaTrend]
    unmet: list[UnmetNeed]
    total: int


class RefreshResult(BaseModel):
    added: int


def split_sections(description: str) -> list[InnovationSection]:
    sections: list[InnovationSection] = []
    lines: list[str] = []
    title = ""
    for line in description.splitlines():
        match = SECTION_RE.match(line.strip())
        if match:
            if title or lines:
                sections.append(InnovationSection(title=title, body="\n".join(lines).strip()))
            title, lines = match.group(2).strip(), []
        else:
            lines.append(line)
    if title or lines:
        sections.append(InnovationSection(title=title, body="\n".join(lines).strip()))
    return sections


def _summary(project: ActualProject) -> InnovationSummary:
    sections = split_sections(project.description)
    return InnovationSummary(
        id=project.id,
        name=project.name,
        category_id=project.category_id,
        solution=sections[0].body if sections else "",
        problem=sections[1].body if len(sections) > 1 else "",
        has_video=bool(project.video_url),
    )


@router.get("/knowledge", response_model=KnowledgeOverview)
async def knowledge_overview(session: SessionDep) -> KnowledgeOverview:
    projects = session.exec(select(ActualProject).order_by(ActualProject.name)).all()
    counts = Counter(project.category_id for project in projects)
    categories = session.exec(
        select(CategoriesOfProjects).order_by(CategoriesOfProjects.name)
    ).all()
    return KnowledgeOverview(
        areas=[
            KnowledgeArea(id=c.id, name=c.name, innovations=counts.get(c.id, 0))
            for c in categories
        ],
        innovations=[_summary(project) for project in projects],
        resources=list(
            session.exec(select(KnowledgeResource).order_by(KnowledgeResource.title)).all()
        ),
    )


@router.get("/knowledge/innovations/{project_id}", response_model=InnovationDetail)
async def innovation_detail(project_id: uuid.UUID, session: SessionDep) -> InnovationDetail:
    project = session.get(ActualProject, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brak innowacji")
    category = session.get(CategoriesOfProjects, project.category_id)
    return InnovationDetail(
        id=project.id,
        name=project.name,
        category_id=project.category_id,
        category_name=category.name if category else "",
        sections=split_sections(project.description),
        source_url=project.source_url,
        video_url=project.video_url,
        folder_url=project.folder_url,
    )


def _check_category(session: Session, category_id: uuid.UUID | None) -> None:
    if category_id is not None and session.get(CategoriesOfProjects, category_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Obszar nie istnieje"
        )


@router.post(
    "/admin/knowledge/resources",
    response_model=KnowledgeResource,
    status_code=status.HTTP_201_CREATED,
)
async def create_resource(
    payload: KnowledgeResourceCreate, _: CurrentAdminDep, session: SessionDep
) -> KnowledgeResource:
    _check_category(session, payload.category_id)
    resource = KnowledgeResource(**payload.model_dump())
    session.add(resource)
    session.commit()
    session.refresh(resource)
    return resource


@router.patch("/admin/knowledge/resources/{resource_id}", response_model=KnowledgeResource)
async def update_resource(
    resource_id: uuid.UUID,
    payload: KnowledgeResourceCreate,
    _: CurrentAdminDep,
    session: SessionDep,
) -> KnowledgeResource:
    resource = session.get(KnowledgeResource, resource_id)
    if resource is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brak zasobu")
    _check_category(session, payload.category_id)
    for key, value in payload.model_dump().items():
        setattr(resource, key, value)
    resource.updated_at = datetime.now().isoformat()
    session.add(resource)
    session.commit()
    session.refresh(resource)
    return resource


@router.delete(
    "/admin/knowledge/resources/{resource_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_resource(
    resource_id: uuid.UUID, _: CurrentAdminDep, session: SessionDep
) -> None:
    resource = session.get(KnowledgeResource, resource_id)
    if resource is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brak zasobu")
    session.delete(resource)
    session.commit()


@router.post("/admin/knowledge/refresh", response_model=RefreshResult)
async def refresh_library(_: CurrentAdminDep) -> RefreshResult:
    """Dociąga z Biblioteki Innowacji Społecznych innowacje, których nie ma w bazie."""
    return RefreshResult(added=await asyncio.to_thread(refresh_new_projects))


@router.get("/admin/trends", response_model=NeedTrends)
async def need_trends(_: CurrentAdminDep, session: SessionDep) -> NeedTrends:
    now = datetime.now()
    this_monday = (now - timedelta(days=now.weekday())).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    week_starts = [
        this_monday - timedelta(weeks=offset) for offset in range(TREND_WEEKS - 1, -1, -1)
    ]
    names = {c.id: c.name for c in session.exec(select(CategoriesOfProjects)).all()}
    signals = session.exec(select(NeedSignal).order_by(col(NeedSignal.created_at).desc())).all()

    by_area: dict[uuid.UUID | None, AreaTrend] = {}
    for signal in signals:
        area = by_area.setdefault(
            signal.category_id,
            AreaTrend(
                category_id=signal.category_id,
                name=names.get(signal.category_id, "Bez odpowiedzi w bazie")
                if signal.category_id
                else "Bez odpowiedzi w bazie",
                total=0,
                last_30_days=0,
                previous_30_days=0,
                weekly=[0] * TREND_WEEKS,
            ),
        )
        created = datetime.fromisoformat(signal.created_at)
        age = now - created
        area.total += 1
        if age <= timedelta(days=30):
            area.last_30_days += 1
        elif age <= timedelta(days=60):
            area.previous_30_days += 1
        if created >= week_starts[0]:
            index = min((created - week_starts[0]).days // 7, TREND_WEEKS - 1)
            area.weekly[index] += 1

    return NeedTrends(
        weeks=[start.date().isoformat() for start in week_starts],
        areas=sorted(by_area.values(), key=lambda a: (-a.last_30_days, -a.total, a.name)),
        unmet=[
            UnmetNeed(created_at=s.created_at, summary=s.summary)
            for s in signals
            if s.category_id is None
        ][:UNMET_LIMIT],
        total=len(signals),
    )
