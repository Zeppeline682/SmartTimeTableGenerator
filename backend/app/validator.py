from __future__ import annotations

import hashlib
from collections.abc import Sequence

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from .models import ScheduledSession


class VerificationError(ValueError):
    """Raised when post-solve schedule verification fails."""


def verify_solver_output(solved_sessions: Sequence[ScheduledSession], total_days: int, total_slots_per_day: int) -> str:
    """
    Zero-trust validation of the solver output.

    Uses explicit nested loops to check all overlapping conflicts:
    - teacher overlap
    - room overlap
    - student group overlap
    """
    for session in solved_sessions:
        if session.day_of_week < 0 or session.day_of_week >= total_days:
            raise VerificationError(
                f"Invalid day_of_week for session {session.id}: {session.day_of_week}"
            )
        if session.start_slot < 0 or session.start_slot >= total_slots_per_day:
            raise VerificationError(
                f"Invalid start_slot for session {session.id}: {session.start_slot}"
            )

    for left_index, left_session in enumerate(solved_sessions):
        left_start = left_session.start_slot
        left_end = left_start + getattr(left_session, "duration", 1)

        for right_session in solved_sessions[left_index + 1 :]:
            if left_session.day_of_week != right_session.day_of_week:
                continue

            right_start = right_session.start_slot
            right_end = right_start + getattr(right_session, "duration", 1)

            # Check if the two sessions' slot ranges overlap
            if left_start >= right_end or right_start >= left_end:
                continue

            if left_session.teacher_id == right_session.teacher_id:
                raise VerificationError(
                    "Teacher overlap detected "
                    f"({left_session.teacher_id}) at day={left_session.day_of_week}, "
                    f"slots={left_start}-{left_end} vs {right_start}-{right_end}"
                )

            if left_session.room_id == right_session.room_id:
                raise VerificationError(
                    "Room overlap detected "
                    f"({left_session.room_id}) at day={left_session.day_of_week}, "
                    f"slots={left_start}-{left_end} vs {right_start}-{right_end}"
                )

            if left_session.student_group_id == right_session.student_group_id:
                raise VerificationError(
                    "Student group overlap detected "
                    f"({left_session.student_group_id}) at day={left_session.day_of_week}, "
                    f"slots={left_start}-{left_end} vs {right_start}-{right_end}"
                )

    canonical_rows = sorted(
        (
            f"{session.id}|{session.teacher_id}|{session.room_id}|"
            f"{session.student_group_id}|{session.subject_id}|"
            f"{session.day_of_week}|{session.start_slot}"
        )
        for session in solved_sessions
    )
    digest = hashlib.sha256("\n".join(canonical_rows).encode("utf-8")).hexdigest()
    return f"Verification Secured:{digest}"


class ZeroTrustAuditMiddleware(BaseHTTPMiddleware):
    """Adds the schedule verification hash to response headers when available."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)

        verification_hash = getattr(request.state, "verification_hash", None)
        if verification_hash:
            response.headers["X-Verification-Secured"] = str(verification_hash)

        return response
