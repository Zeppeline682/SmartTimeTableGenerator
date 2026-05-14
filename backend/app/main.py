from __future__ import annotations

from collections import defaultdict
from typing import Any, TypeVar, Union
from uuid import UUID, uuid4

from fastapi import Body, Depends, FastAPI, HTTPException, Query, Request, status
from ortools.sat.python import cp_model
from sqlalchemy.exc import IntegrityError
from sqlalchemy import inspect, text
from sqlmodel import Field, SQLModel, Session, select

from .database import engine, get_session, init_db
from .models import (
    Constraint,
    ConstraintRuleType,
    ConstraintTargetType,
    Room,
    Schedule,
    ScheduleStatus,
    ScheduledSession,
    StudentGroup,
    Subject,
    Teacher,
)
from .solver_engine import SessionBlueprint, solve_timetable_outcome
from .validator import VerificationError, ZeroTrustAuditMiddleware, verify_solver_output

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="ChronoLink API", version="1.0.0")
app.add_middleware(ZeroTrustAuditMiddleware)

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ModelType = TypeVar("ModelType")


class TeacherCreate(SQLModel):
    name: str
    code: str
    department_tag: str | None = None
    tags: list[str] = Field(default_factory=list)


class TeacherUpdate(SQLModel):
    name: str | None = None
    code: str | None = None
    department_tag: str | None = None
    tags: list[str] | None = None


class RoomCreate(SQLModel):
    name: str
    code: str
    capacity: int = Field(default=1, ge=1)
    building_tag: str | None = None
    floor: str | None = None
    tags: list[str] = Field(default_factory=list)


class RoomUpdate(SQLModel):
    name: str | None = None
    code: str | None = None
    capacity: int | None = Field(default=None, ge=1)
    building_tag: str | None = None
    floor: str | None = None
    tags: list[str] | None = None


class StudentGroupCreate(SQLModel):
    name: str
    code: str
    size: int = Field(default=1, ge=1)
    tags: list[str] = Field(default_factory=list)


class StudentGroupUpdate(SQLModel):
    name: str | None = None
    code: str | None = None
    size: int | None = Field(default=None, ge=1)
    tags: list[str] | None = None


class SubjectCreate(SQLModel):
    name: str
    code: str


class SubjectUpdate(SQLModel):
    name: str | None = None
    code: str | None = None


class ScheduledSessionCreate(SQLModel):
    day_of_week: int = Field(ge=0, le=4)
    start_slot: int = Field(ge=0, le=20)
    teacher_id: UUID
    room_id: UUID
    student_group_id: UUID
    subject_id: UUID


class ScheduledSessionUpdate(SQLModel):
    day_of_week: int | None = Field(default=None, ge=0, le=4)
    start_slot: int | None = Field(default=None, ge=0, le=20)
    teacher_id: UUID | None = None
    room_id: UUID | None = None
    student_group_id: UUID | None = None
    subject_id: UUID | None = None


class ConstraintCreate(SQLModel):
    id: Union[UUID, str, None] = None
    target_type: ConstraintTargetType
    target_id: Union[UUID, str]
    rule_type: ConstraintRuleType
    value: dict[str, Any]
    is_active: bool = True


class ConstraintUpdate(SQLModel):
    target_type: ConstraintTargetType | None = None
    target_id: Union[UUID, str, None] = None
    rule_type: ConstraintRuleType | None = None
    value: dict[str, Any] | None = None
    is_active: bool | None = None


class SolveRequest(SQLModel):
    session_ids: list[Union[UUID, str]] | None = None
    sessions: list[SessionBlueprint] | None = None
    constraints: list[ConstraintCreate] | None = None
    include_inactive_constraints: bool = False
    persist_solution: bool = False
    day_start_time: str = Field(default="09:00")
    total_days: int = Field(default=5, gt=0)
    total_slots_per_day: int = Field(default=21, gt=0)
    max_time_seconds: float = Field(default=30.0, gt=0)
    num_search_workers: int = Field(default=8, ge=1)


class SolveResponse(SQLModel):
    schedule_id: str
    verification_hash: str
    scheduled_sessions: list[ScheduledSession]
    persisted: bool


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    _ensure_schedule_id_column()


def _ensure_schedule_id_column() -> None:
    inspector = inspect(engine)
    if "scheduled_session" not in inspector.get_table_names():
        return

    column_names = {column["name"] for column in inspector.get_columns("scheduled_session")}
    if "schedule_id" in column_names:
        return

    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE scheduled_session ADD COLUMN schedule_id VARCHAR(32)"))
        connection.execute(
            text("CREATE INDEX IF NOT EXISTS ix_scheduled_session_schedule_id ON scheduled_session (schedule_id)")
        )


def _to_dict(model: SQLModel, *, exclude_unset: bool = False) -> dict[str, Any]:
    if hasattr(model, "model_dump"):
        return model.model_dump(exclude_unset=exclude_unset)
    return model.dict(exclude_unset=exclude_unset)


def _get_entity_or_404(
    session: Session,
    model_type: type[ModelType],
    entity_id: UUID,
    entity_name: str,
) -> ModelType:
    entity = session.get(model_type, entity_id)
    if entity is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{entity_name} not found")
    return entity


def _commit_or_raise(session: Session) -> None:
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Integrity error while writing to database",
        ) from exc


@app.get("/teachers", response_model=list[Teacher])
def list_teachers(session: Session = Depends(get_session)) -> list[Teacher]:
    return list(session.exec(select(Teacher)).all())


@app.post("/teachers", response_model=Teacher, status_code=status.HTTP_201_CREATED)
def create_teacher(payload: TeacherCreate, session: Session = Depends(get_session)) -> Teacher:
    teacher = Teacher(**_to_dict(payload))
    session.add(teacher)
    _commit_or_raise(session)
    session.refresh(teacher)
    return teacher


@app.get("/teachers/{teacher_id}", response_model=Teacher)
def get_teacher(teacher_id: UUID, session: Session = Depends(get_session)) -> Teacher:
    return _get_entity_or_404(session, Teacher, teacher_id, "Teacher")


@app.put("/teachers/{teacher_id}", response_model=Teacher)
def update_teacher(
    teacher_id: UUID,
    payload: TeacherUpdate,
    session: Session = Depends(get_session),
) -> Teacher:
    teacher = _get_entity_or_404(session, Teacher, teacher_id, "Teacher")
    for field_name, field_value in _to_dict(payload, exclude_unset=True).items():
        setattr(teacher, field_name, field_value)

    session.add(teacher)
    _commit_or_raise(session)
    session.refresh(teacher)
    return teacher


@app.delete("/teachers/{teacher_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_teacher(teacher_id: UUID, session: Session = Depends(get_session)) -> None:
    teacher = _get_entity_or_404(session, Teacher, teacher_id, "Teacher")
    session.delete(teacher)
    _commit_or_raise(session)


@app.get("/rooms", response_model=list[Room])
def list_rooms(session: Session = Depends(get_session)) -> list[Room]:
    return list(session.exec(select(Room)).all())


@app.post("/rooms", response_model=Room, status_code=status.HTTP_201_CREATED)
def create_room(payload: RoomCreate, session: Session = Depends(get_session)) -> Room:
    room = Room(**_to_dict(payload))
    session.add(room)
    _commit_or_raise(session)
    session.refresh(room)
    return room


@app.get("/rooms/{room_id}", response_model=Room)
def get_room(room_id: UUID, session: Session = Depends(get_session)) -> Room:
    return _get_entity_or_404(session, Room, room_id, "Room")


@app.put("/rooms/{room_id}", response_model=Room)
def update_room(room_id: UUID, payload: RoomUpdate, session: Session = Depends(get_session)) -> Room:
    room = _get_entity_or_404(session, Room, room_id, "Room")
    for field_name, field_value in _to_dict(payload, exclude_unset=True).items():
        setattr(room, field_name, field_value)

    session.add(room)
    _commit_or_raise(session)
    session.refresh(room)
    return room


@app.delete("/rooms/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_room(room_id: UUID, session: Session = Depends(get_session)) -> None:
    room = _get_entity_or_404(session, Room, room_id, "Room")
    session.delete(room)
    _commit_or_raise(session)


@app.get("/student-groups", response_model=list[StudentGroup])
def list_student_groups(session: Session = Depends(get_session)) -> list[StudentGroup]:
    return list(session.exec(select(StudentGroup)).all())


@app.post("/student-groups", response_model=StudentGroup, status_code=status.HTTP_201_CREATED)
def create_student_group(
    payload: StudentGroupCreate,
    session: Session = Depends(get_session),
) -> StudentGroup:
    student_group = StudentGroup(**_to_dict(payload))
    session.add(student_group)
    _commit_or_raise(session)
    session.refresh(student_group)
    return student_group


@app.get("/student-groups/{student_group_id}", response_model=StudentGroup)
def get_student_group(
    student_group_id: UUID,
    session: Session = Depends(get_session),
) -> StudentGroup:
    return _get_entity_or_404(session, StudentGroup, student_group_id, "StudentGroup")


@app.put("/student-groups/{student_group_id}", response_model=StudentGroup)
def update_student_group(
    student_group_id: UUID,
    payload: StudentGroupUpdate,
    session: Session = Depends(get_session),
) -> StudentGroup:
    student_group = _get_entity_or_404(session, StudentGroup, student_group_id, "StudentGroup")
    for field_name, field_value in _to_dict(payload, exclude_unset=True).items():
        setattr(student_group, field_name, field_value)

    session.add(student_group)
    _commit_or_raise(session)
    session.refresh(student_group)
    return student_group


@app.delete("/student-groups/{student_group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_student_group(student_group_id: UUID, session: Session = Depends(get_session)) -> None:
    student_group = _get_entity_or_404(session, StudentGroup, student_group_id, "StudentGroup")
    session.delete(student_group)
    _commit_or_raise(session)


@app.get("/subjects", response_model=list[Subject])
def list_subjects(session: Session = Depends(get_session)) -> list[Subject]:
    return list(session.exec(select(Subject)).all())


@app.post("/subjects", response_model=Subject, status_code=status.HTTP_201_CREATED)
def create_subject(payload: SubjectCreate, session: Session = Depends(get_session)) -> Subject:
    subject = Subject(**_to_dict(payload))
    session.add(subject)
    _commit_or_raise(session)
    session.refresh(subject)
    return subject


@app.get("/subjects/{subject_id}", response_model=Subject)
def get_subject(subject_id: UUID, session: Session = Depends(get_session)) -> Subject:
    return _get_entity_or_404(session, Subject, subject_id, "Subject")


@app.put("/subjects/{subject_id}", response_model=Subject)
def update_subject(
    subject_id: UUID,
    payload: SubjectUpdate,
    session: Session = Depends(get_session),
) -> Subject:
    subject = _get_entity_or_404(session, Subject, subject_id, "Subject")
    for field_name, field_value in _to_dict(payload, exclude_unset=True).items():
        setattr(subject, field_name, field_value)

    session.add(subject)
    _commit_or_raise(session)
    session.refresh(subject)
    return subject


@app.delete("/subjects/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subject(subject_id: UUID, session: Session = Depends(get_session)) -> None:
    subject = _get_entity_or_404(session, Subject, subject_id, "Subject")
    session.delete(subject)
    _commit_or_raise(session)


@app.get("/scheduled-sessions", response_model=list[ScheduledSession])
def list_scheduled_sessions(
    schedule_id: str | None = Query(default=None),
    session: Session = Depends(get_session),
) -> list[ScheduledSession]:
    query = select(ScheduledSession)
    if schedule_id is not None:
        query = query.where(ScheduledSession.schedule_id == schedule_id)

    return list(session.exec(query).all())


@app.post("/scheduled-sessions", response_model=ScheduledSession, status_code=status.HTTP_201_CREATED)
def create_scheduled_session(
    payload: ScheduledSessionCreate,
    session: Session = Depends(get_session),
) -> ScheduledSession:
    scheduled_session = ScheduledSession(**_to_dict(payload))
    session.add(scheduled_session)
    _commit_or_raise(session)
    session.refresh(scheduled_session)
    return scheduled_session


@app.get("/scheduled-sessions/{scheduled_session_id}", response_model=ScheduledSession)
def get_scheduled_session(
    scheduled_session_id: UUID,
    session: Session = Depends(get_session),
) -> ScheduledSession:
    return _get_entity_or_404(session, ScheduledSession, scheduled_session_id, "ScheduledSession")


@app.put("/scheduled-sessions/{scheduled_session_id}", response_model=ScheduledSession)
def update_scheduled_session(
    scheduled_session_id: UUID,
    payload: ScheduledSessionUpdate,
    session: Session = Depends(get_session),
) -> ScheduledSession:
    scheduled_session = _get_entity_or_404(
        session,
        ScheduledSession,
        scheduled_session_id,
        "ScheduledSession",
    )
    for field_name, field_value in _to_dict(payload, exclude_unset=True).items():
        setattr(scheduled_session, field_name, field_value)

    session.add(scheduled_session)
    _commit_or_raise(session)
    session.refresh(scheduled_session)
    return scheduled_session


@app.delete("/scheduled-sessions/{scheduled_session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_scheduled_session(
    scheduled_session_id: UUID,
    session: Session = Depends(get_session),
) -> None:
    scheduled_session = _get_entity_or_404(
        session,
        ScheduledSession,
        scheduled_session_id,
        "ScheduledSession",
    )
    session.delete(scheduled_session)
    _commit_or_raise(session)


@app.get("/constraints", response_model=list[Constraint])
def list_constraints(session: Session = Depends(get_session)) -> list[Constraint]:
    return list(session.exec(select(Constraint)).all())


@app.post("/constraints", response_model=Constraint, status_code=status.HTTP_201_CREATED)
def create_constraint(payload: ConstraintCreate, session: Session = Depends(get_session)) -> Constraint:
    constraint = Constraint(**_to_dict(payload))
    session.add(constraint)
    _commit_or_raise(session)
    session.refresh(constraint)
    return constraint


@app.get("/constraints/{constraint_id}", response_model=Constraint)
def get_constraint(constraint_id: UUID, session: Session = Depends(get_session)) -> Constraint:
    return _get_entity_or_404(session, Constraint, constraint_id, "Constraint")


@app.put("/constraints/{constraint_id}", response_model=Constraint)
def update_constraint(
    constraint_id: UUID,
    payload: ConstraintUpdate,
    session: Session = Depends(get_session),
) -> Constraint:
    constraint = _get_entity_or_404(session, Constraint, constraint_id, "Constraint")
    for field_name, field_value in _to_dict(payload, exclude_unset=True).items():
        setattr(constraint, field_name, field_value)

    session.add(constraint)
    _commit_or_raise(session)
    session.refresh(constraint)
    return constraint


@app.delete("/constraints/{constraint_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_constraint(constraint_id: UUID, session: Session = Depends(get_session)) -> None:
    constraint = _get_entity_or_404(session, Constraint, constraint_id, "Constraint")
    session.delete(constraint)
    _commit_or_raise(session)


# ── Schedule lifecycle endpoints (master doc §9) ──────────────────


@app.post("/schedules/{schedule_id}/publish", response_model=Schedule)
def publish_schedule(schedule_id: str, session: Session = Depends(get_session)) -> Schedule:
    """Changes a schedule's status to PUBLISHED so students/faculty can view it."""
    from uuid import UUID as _UUID
    try:
        schedule_uuid = _UUID(schedule_id)
    except (ValueError, AttributeError):
        schedule_uuid = schedule_id  # type: ignore[assignment]

    schedule = session.exec(
        select(Schedule).where(Schedule.id == schedule_uuid)
    ).first()

    if schedule is None:
        # Auto-create a Schedule record from a solve-generated schedule_id
        schedule = Schedule(id=schedule_uuid, status=ScheduleStatus.PUBLISHED)
        session.add(schedule)
    else:
        schedule.status = ScheduleStatus.PUBLISHED
        session.add(schedule)

    _commit_or_raise(session)
    session.refresh(schedule)
    return schedule


@app.get("/schedules/published/student/{group_id}", response_model=list[ScheduledSession])
def get_published_student_schedule(
    group_id: UUID,
    session: Session = Depends(get_session),
) -> list[ScheduledSession]:
    """Returns filtered active sessions for a student group from the latest published schedule."""
    published = session.exec(
        select(Schedule).where(Schedule.status == ScheduleStatus.PUBLISHED)
    ).first()

    if published is None:
        return []

    return list(
        session.exec(
            select(ScheduledSession)
            .where(ScheduledSession.schedule_id == str(published.id))
            .where(ScheduledSession.student_group_id == group_id)
        ).all()
    )


@app.get("/schedules/published/teacher/{teacher_id}", response_model=list[ScheduledSession])
def get_published_teacher_schedule(
    teacher_id: UUID,
    session: Session = Depends(get_session),
) -> list[ScheduledSession]:
    """Returns filtered active sessions for a faculty member from the latest published schedule."""
    published = session.exec(
        select(Schedule).where(Schedule.status == ScheduleStatus.PUBLISHED)
    ).first()

    if published is None:
        return []

    return list(
        session.exec(
            select(ScheduledSession)
            .where(ScheduledSession.schedule_id == str(published.id))
            .where(ScheduledSession.teacher_id == teacher_id)
        ).all()
    )


@app.post("/solve", response_model=SolveResponse)
def solve_schedule(
    request: Request,
    payload: SolveRequest = Body(default_factory=SolveRequest),
    session: Session = Depends(get_session),
) -> SolveResponse:
    db_sessions: list[ScheduledSession] = []

    if payload.session_ids:
        db_sessions = list(session.exec(select(ScheduledSession)).all())
        requested_ids = set(payload.session_ids)
        db_sessions = [item for item in db_sessions if item.id in requested_ids]
        found_ids = {item.id for item in db_sessions}
        missing_ids = [str(session_id) for session_id in payload.session_ids if session_id not in found_ids]
        if missing_ids:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"message": "Some session_ids were not found", "missing_session_ids": missing_ids},
            )

    if payload.constraints is not None:
        db_constraints = [
            Constraint(
                id=item.id if isinstance(item.id, (UUID, str)) else uuid4(),
                target_type=item.target_type,
                target_id=item.target_id,
                rule_type=item.rule_type,
                value=item.value,
                is_active=item.is_active,
            )
            for item in payload.constraints
        ]
    else:
        constraint_query = select(Constraint)
        if not payload.include_inactive_constraints:
            constraint_query = constraint_query.where(Constraint.is_active == True)  # noqa: E712
        db_constraints = list(session.exec(constraint_query).all())

    # Determine input sessions
    if payload.sessions:
        session_blueprints = [
            SessionBlueprint(
                id=item.id or uuid4(),
                teacher_id=item.teacher_id,
                room_id=item.room_id,
                student_group_id=item.student_group_id,
                subject_id=item.subject_id,
                duration=item.duration or 2,
            )
            for item in payload.sessions
        ]
    elif payload.session_ids:
        db_sessions = list(session.exec(select(ScheduledSession).where(ScheduledSession.id.in_(payload.session_ids))).all())
        session_blueprints = [
            SessionBlueprint(
                id=item.id,
                teacher_id=item.teacher_id,
                room_id=item.room_id,
                student_group_id=item.student_group_id,
                subject_id=item.subject_id,
                duration=item.duration,
            )
            for item in db_sessions
        ]
    else:
        db_sessions = list(session.exec(select(ScheduledSession)).all())
        session_blueprints = [
            SessionBlueprint(
                id=item.id,
                teacher_id=item.teacher_id,
                room_id=item.room_id,
                student_group_id=item.student_group_id,
                subject_id=item.subject_id,
                duration=item.duration,
            )
            for item in db_sessions
        ]

    # Session Synthesis: If no sessions provided, check if constraints imply a required count.
    if not session_blueprints and db_constraints:
        group_requirements: dict[UUID, int] = {}
        for c in db_constraints:
            if c.rule_type == ConstraintRuleType.CAPACITY and c.target_type == ConstraintTargetType.STUDENT_GROUP:
                req = c.value.get("required_total_sessions") or c.value.get("min_sessions_total")
                if isinstance(req, int):
                    group_requirements[c.target_id] = max(group_requirements.get(c.target_id, 0), req)
        
        for group_id, total_required in group_requirements.items():
            for _ in range(total_required):
                session_blueprints.append(
                    SessionBlueprint(
                        teacher_id=uuid4(),
                        room_id=uuid4(),
                        student_group_id=group_id,
                        subject_id=uuid4(),
                        id=uuid4()
                    )
                )

    outcome = solve_timetable_outcome(
        session_blueprints,
        db_constraints,
        total_days=payload.total_days,
        total_slots_per_day=payload.total_slots_per_day,
        max_time_seconds=payload.max_time_seconds,
        num_search_workers=payload.num_search_workers,
    )

    if outcome.status == cp_model.INFEASIBLE:
        # ── Build diagnostics explaining WHY the solver failed ──
        diagnostics: list[str] = []

        # Collect unique resource IDs from blueprints
        room_ids = {bp.room_id for bp in session_blueprints}
        teacher_ids = {bp.teacher_id for bp in session_blueprints}
        group_ids = {bp.student_group_id for bp in session_blueprints}

        available_slots_per_day = payload.total_slots_per_day
        total_available = available_slots_per_day * payload.total_days

        # Check per-room overload
        room_slot_demand: dict[UUID, int] = defaultdict(int)
        for bp in session_blueprints:
            room_slot_demand[bp.room_id] += bp.duration
        for rid, demand in room_slot_demand.items():
            if demand > total_available:
                diagnostics.append(
                    f"🚪 Room {rid} is overbooked — {demand} slots assigned but only "
                    f"{total_available} available across {payload.total_days} days."
                )

        # Check per-teacher overload
        teacher_slot_demand: dict[UUID, int] = defaultdict(int)
        for bp in session_blueprints:
            teacher_slot_demand[bp.teacher_id] += bp.duration
        for tid, demand in teacher_slot_demand.items():
            if demand > total_available:
                diagnostics.append(
                    f"👩‍🏫 Teacher {tid} is overloaded — {demand} slots assigned but only "
                    f"{total_available} available."
                )

        # Check per-group overload
        group_slot_demand: dict[UUID, int] = defaultdict(int)
        for bp in session_blueprints:
            group_slot_demand[bp.student_group_id] += bp.duration
        for gid, demand in group_slot_demand.items():
            if demand > total_available:
                diagnostics.append(
                    f"⏰ Group {gid} has too many sessions — needs {demand} slots but only "
                    f"{total_available} exist across {payload.total_days} days."
                )

        # Check if rooms are heavily shared (many sessions, few unique rooms)
        if len(room_ids) < 3 and len(session_blueprints) > 10:
            diagnostics.append(
                f"🏫 Only {len(room_ids)} unique room(s) for {len(session_blueprints)} sessions. "
                f"The solver may not be able to fit all sessions without room conflicts. "
                f"Consider adding more rooms."
            )

        # Summary
        total_demand = sum(bp.duration for bp in session_blueprints)
        if total_demand > total_available * len(room_ids):
            diagnostics.append(
                f"📊 Overall capacity: {total_demand} session-slots needed vs "
                f"{total_available * len(room_ids)} total room-slots available "
                f"({len(room_ids)} rooms × {total_available} slots)."
            )

        if not diagnostics:
            diagnostics.append(
                "The solver could not find a valid schedule. This may be due to "
                "conflicting constraints, break windows blocking too many slots, "
                "or too many sessions for the available time."
            )

        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "Solver infeasible",
                "conflicting_constraint_ids": [str(constraint_id) for constraint_id in outcome.conflicting_constraint_ids],
                "diagnostics": diagnostics,
            },
        )

    if outcome.status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "message": "Solver ended without a definitive result",
                "solver_status": outcome.status,
            },
        )

    solved_sessions = list(outcome.scheduled_sessions)
    published_schedule_id = uuid4().hex[:8]
    persisted = False

    for solved_session in solved_sessions:
        solved_session.schedule_id = published_schedule_id

    existing_by_id = {item.id: item for item in db_sessions}
    if payload.persist_solution and existing_by_id:
        for solved_session in solved_sessions:
            existing = existing_by_id.get(solved_session.id)
            if existing is None:
                continue
            existing.day_of_week = solved_session.day_of_week
            existing.start_slot = solved_session.start_slot
            existing.schedule_id = published_schedule_id
            existing.duration = solved_session.duration
            session.add(existing)

        _commit_or_raise(session)
        for existing in existing_by_id.values():
            session.refresh(existing)

        solved_sessions = list(existing_by_id.values())
        persisted = True

    try:
        verification_hash = verify_solver_output(
            solved_sessions,
            total_days=payload.total_days,
            total_slots_per_day=payload.total_slots_per_day,
        )
    except VerificationError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"message": "Zero-trust verification failed", "reason": str(exc)},
        ) from exc

    request.state.verification_hash = verification_hash

    return SolveResponse(
        schedule_id=published_schedule_id,
        verification_hash=verification_hash,
        scheduled_sessions=solved_sessions,
        persisted=persisted,
    )
