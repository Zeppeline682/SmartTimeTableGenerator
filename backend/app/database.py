from __future__ import annotations

import os
from collections.abc import Generator

from sqlmodel import SQLModel, Session, create_engine

from . import models  # noqa: F401  # Registers model metadata.

DATABASE_URL = os.getenv("CHRONOLINK_DATABASE_URL", "sqlite:///./chronolink.db")
SQL_ECHO = os.getenv("CHRONOLINK_SQL_ECHO", "false").lower() == "true"

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    echo=SQL_ECHO,
    pool_pre_ping=True,
    connect_args=connect_args,
)


def init_db() -> None:
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
