from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, List, Union
from uuid import UUID, uuid4

from pydantic import validator
from sqlalchemy import CheckConstraint, Column, DateTime, Enum as SAEnum, JSON, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlmodel import Field, Relationship, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ConstraintTargetType(str, Enum):
    TEACHER = "Teacher"
    ROOM = "Room"
    STUDENT_GROUP = "StudentGroup"
    SUBJECT = "Subject"


class ConstraintRuleType(str, Enum):
    AVAILABILITY = "Availability"
    CAPACITY = "Capacity"
    AFFINITY = "Affinity"
    LOCATION_PREFERENCE = "LocationPreference"


class Teacher(SQLModel, table=True):
    __tablename__ = "teacher"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    name: str = Field(min_length=1, max_length=120, index=True)
    code: str = Field(min_length=1, max_length=40, unique=True, index=True)
    department_tag: str | None = Field(default=None, max_length=80, index=True)
    tags: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False, server_default="[]"))
    created_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )

    sessions: List["ScheduledSession"] = Relationship(sa_relationship=relationship("ScheduledSession", back_populates="teacher"))


class Room(SQLModel, table=True):
    __tablename__ = "room"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    name: str = Field(min_length=1, max_length=120, index=True)
    code: str = Field(min_length=1, max_length=40, unique=True, index=True)
    capacity: int = Field(default=1, ge=1)
    building_tag: str | None = Field(default=None, max_length=80, index=True)
    floor: str | None = Field(default=None, max_length=40, index=True)
    tags: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False, server_default="[]"))
    created_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )

    sessions: List["ScheduledSession"] = Relationship(sa_relationship=relationship("ScheduledSession", back_populates="room"))


class StudentGroup(SQLModel, table=True):
    __tablename__ = "student_group"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    name: str = Field(min_length=1, max_length=120, index=True)
    code: str = Field(min_length=1, max_length=40, unique=True, index=True)
    size: int = Field(default=1, ge=1)
    tags: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False, server_default="[]"))
    created_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )

    sessions: List["ScheduledSession"] = Relationship(sa_relationship=relationship("ScheduledSession", back_populates="student_group"))


class Subject(SQLModel, table=True):
    __tablename__ = "subject"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    name: str = Field(min_length=1, max_length=120, index=True)
    code: str = Field(min_length=1, max_length=40, unique=True, index=True)
    tags: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False, server_default="[]"))
    created_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )

    sessions: List["ScheduledSession"] = Relationship(sa_relationship=relationship("ScheduledSession", back_populates="subject"))


class ScheduledSession(SQLModel, table=True):
    __tablename__ = "scheduled_session"
    __table_args__ = (
        UniqueConstraint("teacher_id", "day_of_week", "start_slot", name="uq_teacher_timeslot"),
        UniqueConstraint("room_id", "day_of_week", "start_slot", name="uq_room_timeslot"),
        UniqueConstraint("student_group_id", "day_of_week", "start_slot", name="uq_group_timeslot"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    schedule_id: str | None = Field(default=None, index=True, nullable=True)
    day_of_week: int = Field(description="0=Monday ... 4=Friday")
    start_slot: int = Field(description="30-minute slot index from 0 to 20")

    teacher_id: UUID = Field(foreign_key="teacher.id", index=True)
    room_id: UUID = Field(foreign_key="room.id", index=True)
    student_group_id: UUID = Field(foreign_key="student_group.id", index=True)
    subject_id: UUID = Field(foreign_key="subject.id", index=True)
    duration: int = Field(default=2, description="Number of 30-minute slots. Default 2 (1 hour)")

    created_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )

    teacher: Teacher = Relationship(back_populates="sessions")
    room: Room = Relationship(back_populates="sessions")
    student_group: StudentGroup = Relationship(back_populates="sessions")
    subject: Subject = Relationship(back_populates="sessions")


class ScheduleStatus(str, Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"


class Schedule(SQLModel, table=True):
    __tablename__ = "schedule"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    status: ScheduleStatus = Field(
        default=ScheduleStatus.DRAFT,
        sa_column=Column(SAEnum(ScheduleStatus, name="schedule_status"), nullable=False),
    )
    created_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )



class Constraint(SQLModel, table=True):
    __tablename__ = "constraint"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    target_type: ConstraintTargetType = Field(
        sa_column=Column(SAEnum(ConstraintTargetType, name="constraint_target_type"), nullable=False)
    )
    target_id: UUID = Field(index=True)
    rule_type: ConstraintRuleType = Field(
        sa_column=Column(SAEnum(ConstraintRuleType, name="constraint_rule_type"), nullable=False)
    )
    value: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    is_active: bool = Field(default=True)
    created_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )

    @validator("value")
    def validate_value(cls, value: dict[str, Any]) -> dict[str, Any]:
        if not isinstance(value, dict):
            raise ValueError("value must be a JSON object")
        if not value:
            raise ValueError("value cannot be empty")
        return value
