"""Tester innowacji — zgłoszenia do testów oraz opinie (ocena, feedback, usprawnienia)."""

import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from sqlmodel import Session, col, func, select

from ..dependencies.auth import CurrentAdminDep, CurrentUserDep
from ..dependencies.db import SessionDep
from ..dependencies.logger import get_logger
from ..models import (
    REVIEW_TEXT_MAX,
    TESTER_MOTIVATION_MAX,
    ActualProject,
    CategoriesOfProjects,
    ProposalOfNewProject,
    SolutionReview,
    StatusEnum,
    TesterSignup,
    TestTargetKind,
    User,
)
from .ideas import _author_label
from .knowledge import split_sections

router = APIRouter(tags=["testing"])
logger = get_logger(__name__)

SUMMARY_MAX_CHARS = 400

TargetKey = tuple[TestTargetKind, uuid.UUID]


class TestSolution(BaseModel):
    kind: TestTargetKind
    id: uuid.UUID
    name: str
    summary: str
    category_name: str | None = None
    rating_avg: float | None = None
    reviews_count: int = 0
    testers_count: int = 0  # osoby ze zgłoszeniem oczekującym lub przyjętym


class ReviewInput(BaseModel):
    rating: int = Field(ge=1, le=5)
    feedback: str = Field(default="", max_length=REVIEW_TEXT_MAX)
    improvement: str = Field(default="", max_length=REVIEW_TEXT_MAX)


class ReviewPublic(BaseModel):
    id: uuid.UUID
    target_kind: TestTargetKind
    target_id: uuid.UUID
    target_name: str | None = None
    author_name: str | None = None
    rating: int
    feedback: str
    improvement: str
    created_at: str
    updated_at: str


class ReviewAdmin(ReviewPublic):
    author_full_name: str | None = None
    author_email: str | None = None


class SignupInput(BaseModel):
    motivation: str = Field(default="", max_length=TESTER_MOTIVATION_MAX)


class SignupPublic(BaseModel):
    id: uuid.UUID
    target_kind: TestTargetKind
    target_id: uuid.UUID
    target_name: str | None = None
    motivation: str
    status: StatusEnum
    created_at: str


class SignupAdmin(SignupPublic):
    tester_full_name: str | None = None
    tester_email: str | None = None


class SignupStatusUpdate(BaseModel):
    status: StatusEnum


class MyTesting(BaseModel):
    signups: list[SignupPublic]
    reviews: list[ReviewPublic]


def _shorten(text: str) -> str:
    text = text.strip()
    if len(text) <= SUMMARY_MAX_CHARS:
        return text
    return text[:SUMMARY_MAX_CHARS].rsplit(" ", 1)[0] + "…"


def _full_name(user: User | None) -> str | None:
    return f"{user.name} {user.surname}".strip() or None if user else None


def _check_target(session: Session, kind: TestTargetKind, target_id: uuid.UUID) -> None:
    if kind == TestTargetKind.INNOVATION:
        found = session.get(ActualProject, target_id) is not None
    else:
        idea = session.get(ProposalOfNewProject, target_id)
        # 404 także dla niezatwierdzonej fiszki — nie zdradzamy, że istnieje.
        found = idea is not None and idea.status == StatusEnum.APPROVED
    if not found:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brak rozwiązania")


def _target_names(session: Session, keys: set[TargetKey]) -> dict[TargetKey, str]:
    names: dict[TargetKey, str] = {}
    for kind, model in (
        (TestTargetKind.INNOVATION, ActualProject),
        (TestTargetKind.IDEA, ProposalOfNewProject),
    ):
        ids = [target_id for key_kind, target_id in keys if key_kind == kind]
        if ids:
            rows = session.exec(select(model.id, model.name).where(col(model.id).in_(ids))).all()
            names.update({(kind, row_id): name for row_id, name in rows})
    return names


def _reviews_out(
    session: Session, reviews: list[SolutionReview], *, admin: bool = False
) -> list[ReviewPublic]:
    names = _target_names(session, {(r.target_kind, r.target_id) for r in reviews})
    result: list[ReviewPublic] = []
    for review in reviews:
        author = session.get(User, review.author_id)
        data = dict(
            id=review.id,
            target_kind=review.target_kind,
            target_id=review.target_id,
            target_name=names.get((review.target_kind, review.target_id)),
            author_name=_author_label(author),
            rating=review.rating,
            feedback=review.feedback,
            improvement=review.improvement,
            created_at=review.created_at,
            updated_at=review.updated_at,
        )
        if admin:
            result.append(
                ReviewAdmin(
                    **data,
                    author_full_name=_full_name(author),
                    author_email=author.email if author else None,
                )
            )
        else:
            result.append(ReviewPublic(**data))
    return result


def _signups_out(
    session: Session, signups: list[TesterSignup], *, admin: bool = False
) -> list[SignupPublic]:
    names = _target_names(session, {(s.target_kind, s.target_id) for s in signups})
    result: list[SignupPublic] = []
    for signup in signups:
        data = dict(
            id=signup.id,
            target_kind=signup.target_kind,
            target_id=signup.target_id,
            target_name=names.get((signup.target_kind, signup.target_id)),
            motivation=signup.motivation,
            status=signup.status,
            created_at=signup.created_at,
        )
        if admin:
            tester = session.get(User, signup.user_id)
            result.append(
                SignupAdmin(
                    **data,
                    tester_full_name=_full_name(tester),
                    tester_email=tester.email if tester else None,
                )
            )
        else:
            result.append(SignupPublic(**data))
    return result


# --- Publiczne --------------------------------------------------------------


@router.get("/testing/solutions", response_model=list[TestSolution])
async def list_solutions(session: SessionDep) -> list[TestSolution]:
    """Rozwiązania do oceny i testów: Biblioteka Innowacji + zatwierdzone fiszki."""
    ratings: dict[TargetKey, tuple[float, int]] = {
        (kind, target_id): (float(avg), count)
        for kind, target_id, avg, count in session.exec(
            select(
                SolutionReview.target_kind,
                SolutionReview.target_id,
                func.avg(SolutionReview.rating),
                func.count(),
            ).group_by(SolutionReview.target_kind, SolutionReview.target_id)
        ).all()
    }
    testers: dict[TargetKey, int] = {
        (kind, target_id): count
        for kind, target_id, count in session.exec(
            select(
                TesterSignup.target_kind,
                TesterSignup.target_id,
                func.count(func.distinct(TesterSignup.user_id)),
            )
            .where(TesterSignup.status != StatusEnum.REJECTED)
            .group_by(TesterSignup.target_kind, TesterSignup.target_id)
        ).all()
    }
    categories = {c.id: c.name for c in session.exec(select(CategoriesOfProjects)).all()}

    def solution(kind: TestTargetKind, row, summary: str) -> TestSolution:
        avg, count = ratings.get((kind, row.id), (None, 0))
        return TestSolution(
            kind=kind,
            id=row.id,
            name=row.name,
            summary=_shorten(summary),
            category_name=categories.get(row.category_id),
            rating_avg=round(avg, 1) if avg is not None else None,
            reviews_count=count,
            testers_count=testers.get((kind, row.id), 0),
        )

    result: list[TestSolution] = []
    for idea in session.exec(
        select(ProposalOfNewProject)
        .where(ProposalOfNewProject.status == StatusEnum.APPROVED)
        .order_by(col(ProposalOfNewProject.created_at).desc())
    ).all():
        result.append(solution(TestTargetKind.IDEA, idea, idea.description))
    for project in session.exec(select(ActualProject).order_by(ActualProject.name)).all():
        sections = split_sections(project.description)
        result.append(
            solution(
                TestTargetKind.INNOVATION,
                project,
                sections[0].body if sections else project.description,
            )
        )
    return result


@router.get(
    "/testing/solutions/{kind}/{target_id}/reviews", response_model=list[ReviewPublic]
)
async def list_reviews(
    kind: TestTargetKind, target_id: uuid.UUID, session: SessionDep
) -> list[ReviewPublic]:
    _check_target(session, kind, target_id)
    reviews = session.exec(
        select(SolutionReview)
        .where(SolutionReview.target_kind == kind, SolutionReview.target_id == target_id)
        .order_by(col(SolutionReview.updated_at).desc())
    ).all()
    return _reviews_out(session, list(reviews))


# --- Zalogowany -------------------------------------------------------------


@router.get("/testing/mine", response_model=MyTesting)
async def my_testing(user: CurrentUserDep, session: SessionDep) -> MyTesting:
    signups = session.exec(
        select(TesterSignup)
        .where(TesterSignup.user_id == user.id)
        .order_by(col(TesterSignup.created_at).desc())
    ).all()
    reviews = session.exec(
        select(SolutionReview)
        .where(SolutionReview.author_id == user.id)
        .order_by(col(SolutionReview.updated_at).desc())
    ).all()
    return MyTesting(
        signups=_signups_out(session, list(signups)),
        reviews=_reviews_out(session, list(reviews)),
    )


@router.post(
    "/testing/solutions/{kind}/{target_id}/signups",
    response_model=SignupPublic,
    status_code=status.HTTP_201_CREATED,
)
async def create_signup(
    kind: TestTargetKind,
    target_id: uuid.UUID,
    payload: SignupInput,
    user: CurrentUserDep,
    session: SessionDep,
) -> SignupPublic:
    _check_target(session, kind, target_id)
    signup = TesterSignup(
        user_id=user.id,
        target_kind=kind,
        target_id=target_id,
        motivation=payload.motivation.strip(),
    )
    session.add(signup)
    session.commit()
    session.refresh(signup)
    logger.info("Zgłoszenie testera %s (%s %s, user %s)", signup.id, kind.value, target_id, user.id)
    return _signups_out(session, [signup])[0]


@router.delete("/testing/signups/{signup_id}", status_code=status.HTTP_204_NO_CONTENT)
async def withdraw_signup(signup_id: uuid.UUID, user: CurrentUserDep, session: SessionDep) -> None:
    signup = session.get(TesterSignup, signup_id)
    if signup is None or signup.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brak zgłoszenia")
    session.delete(signup)
    session.commit()
    logger.info("Wycofano zgłoszenie testera %s (user %s)", signup_id, user.id)


def _my_review(
    session: Session, kind: TestTargetKind, target_id: uuid.UUID, user: User
) -> SolutionReview | None:
    return session.exec(
        select(SolutionReview).where(
            SolutionReview.target_kind == kind,
            SolutionReview.target_id == target_id,
            SolutionReview.author_id == user.id,
        )
    ).first()


@router.put("/testing/solutions/{kind}/{target_id}/review", response_model=ReviewPublic)
async def save_review(
    kind: TestTargetKind,
    target_id: uuid.UUID,
    payload: ReviewInput,
    user: CurrentUserDep,
    session: SessionDep,
) -> ReviewPublic:
    """Jedna opinia na osobę i rozwiązanie — kolejne wysłanie ją aktualizuje.

    Opiniować może tylko tester: osoba z przyjętym zgłoszeniem do testów tego rozwiązania.
    """
    _check_target(session, kind, target_id)
    was_tester = session.exec(
        select(TesterSignup.id).where(
            TesterSignup.user_id == user.id,
            TesterSignup.target_kind == kind,
            TesterSignup.target_id == target_id,
            TesterSignup.status == StatusEnum.APPROVED,
        )
    ).first()
    if was_tester is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Opinię może dodać tylko tester tego rozwiązania",
        )
    review = _my_review(session, kind, target_id, user)
    if review is None:
        review = SolutionReview(
            author_id=user.id, target_kind=kind, target_id=target_id, rating=payload.rating
        )
    else:
        review.updated_at = datetime.now().isoformat()
    review.rating = payload.rating
    review.feedback = payload.feedback.strip()
    review.improvement = payload.improvement.strip()
    session.add(review)
    session.commit()
    session.refresh(review)
    logger.info("Opinia %s (%s %s, autor %s)", review.id, kind.value, target_id, user.id)
    return _reviews_out(session, [review])[0]


@router.delete(
    "/testing/solutions/{kind}/{target_id}/review", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_my_review(
    kind: TestTargetKind, target_id: uuid.UUID, user: CurrentUserDep, session: SessionDep
) -> None:
    review = _my_review(session, kind, target_id, user)
    if review is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brak opinii")
    session.delete(review)
    session.commit()


# --- Admin ------------------------------------------------------------------


@router.get("/admin/testing/signups", response_model=list[SignupAdmin])
async def admin_list_signups(_: CurrentAdminDep, session: SessionDep) -> list[SignupPublic]:
    signups = session.exec(
        select(TesterSignup).order_by(col(TesterSignup.created_at).desc())
    ).all()
    return _signups_out(session, list(signups), admin=True)


@router.patch("/admin/testing/signups/{signup_id}", response_model=SignupAdmin)
async def admin_set_signup_status(
    signup_id: uuid.UUID,
    payload: SignupStatusUpdate,
    admin: CurrentAdminDep,
    session: SessionDep,
) -> SignupPublic:
    signup = session.get(TesterSignup, signup_id)
    if signup is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brak zgłoszenia")
    signup.status = payload.status
    session.add(signup)
    session.commit()
    session.refresh(signup)
    logger.info(
        "Zgłoszenie testera %s → %s (admin %s)", signup.id, signup.status.value, admin.id
    )
    return _signups_out(session, [signup], admin=True)[0]


@router.get("/admin/testing/reviews", response_model=list[ReviewAdmin])
async def admin_list_reviews(_: CurrentAdminDep, session: SessionDep) -> list[ReviewPublic]:
    reviews = session.exec(
        select(SolutionReview).order_by(col(SolutionReview.updated_at).desc())
    ).all()
    return _reviews_out(session, list(reviews), admin=True)


@router.delete("/admin/testing/reviews/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_review(
    review_id: uuid.UUID, admin: CurrentAdminDep, session: SessionDep
) -> None:
    review = session.get(SolutionReview, review_id)
    if review is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brak opinii")
    session.delete(review)
    session.commit()
    logger.info("Usunięto opinię %s (admin %s)", review_id, admin.id)
