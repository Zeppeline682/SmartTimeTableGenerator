from __future__ import annotations

from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any, Union
from uuid import UUID, uuid4

from ortools.sat.python import cp_model

from .models import Constraint, ConstraintRuleType, ConstraintTargetType, ScheduledSession



@dataclass(frozen=True, slots=True)
class SessionBlueprint:
    """Input shape for a session that must be placed into the timetable grid."""

    teacher_id: Union[UUID, str]
    room_id: Union[UUID, str]
    student_group_id: Union[UUID, str]
    subject_id: Union[UUID, str]
    duration: int = 2
    id: Union[UUID, str, None] = None


AssignmentKey = tuple[int, int, int]  # (session_index, day_of_week, start_slot)
TargetIndex = dict[ConstraintTargetType, dict[Union[UUID, str], list[int]]]


@dataclass(frozen=True, slots=True)
class SolveOutcome:
    """Detailed CP-SAT solve result with status and payloads."""

    status: int
    scheduled_sessions: list[ScheduledSession]
    conflicting_constraint_ids: list[UUID | str]


def solve_timetable(
    session_blueprints: Sequence[SessionBlueprint],
    constraints: Sequence[Constraint],
    total_days: int,
    total_slots_per_day: int,
    *,
    max_time_seconds: float = 30.0,
    num_search_workers: int = 8,
) -> list[ScheduledSession] | list[UUID]:
    """
    Solve the timetable with CP-SAT.

    Returns:
        - list[ScheduledSession] when a feasible schedule exists.
        - list[UUID] unsat core (Constraint IDs) when infeasible.
    """
    outcome = solve_timetable_outcome(
        session_blueprints,
        constraints,
        total_days=total_days,
        total_slots_per_day=total_slots_per_day,
        max_time_seconds=max_time_seconds,
        num_search_workers=num_search_workers,
    )

    if outcome.status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return outcome.scheduled_sessions

    if outcome.status == cp_model.INFEASIBLE:
        return outcome.conflicting_constraint_ids

    raise RuntimeError(f"Solver ended without a definitive result. CP-SAT status: {outcome.status}")


def solve_timetable_outcome(
    session_blueprints: Sequence[SessionBlueprint],
    constraints: Sequence[Constraint],
    total_days: int,
    total_slots_per_day: int,
    *,
    max_time_seconds: float = 30.0,
    num_search_workers: int = 8,
) -> SolveOutcome:
    """Solve and return explicit CP-SAT status information."""
    
    # Critical: Normalize all IDs to ensure grouping and indexing logic works correctly.
    # Without this, a UUID object and its string representation would create duplicate entries,
    # causing the model constraints to explode in size and timeout.
    normalized_blueprints = []
    for sb in session_blueprints:
        normalized_blueprints.append(SessionBlueprint(
            id=_parse_uuid(sb.id, field_name="id"),
            teacher_id=_parse_uuid(sb.teacher_id, field_name="teacher_id"),
            room_id=_parse_uuid(sb.room_id, field_name="room_id"),
            student_group_id=_parse_uuid(sb.student_group_id, field_name="student_group_id"),
            subject_id=_parse_uuid(sb.subject_id, field_name="subject_id"),
            duration=sb.duration
        ))
    session_blueprints = normalized_blueprints

    model = cp_model.CpModel()
    x = _build_assignment_variables(model, session_blueprints, total_days, total_slots_per_day)

    _add_exactly_one_timeslot_constraints(model, x, session_blueprints, total_days, total_slots_per_day)
    _add_hard_resource_constraints(model, x, session_blueprints, total_days, total_slots_per_day)

    target_index = _build_target_index(session_blueprints)
    assumption_literal_to_constraint_id: dict[int, UUID] = {}
    apply_constraints_from_model(
        model=model,
        x=x,
        constraints=constraints,
        target_index=target_index,
        assumption_literal_to_constraint_id=assumption_literal_to_constraint_id,
        session_blueprints=session_blueprints,
        total_days=total_days,
        total_slots_per_day=total_slots_per_day,
    )

    _add_spread_objective(
        model, 
        x, 
        session_blueprints, 
        total_days, 
        total_slots_per_day,
        constraints=constraints,
        target_index=target_index
    )

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = max_time_seconds
    solver.parameters.num_search_workers = num_search_workers
    # Speed optimisations: skip expensive linearisation passes (model is
    # already Boolean/linear), allow large neighbourhood moves, and hint
    # the search toward feasibility fast before polishing the objective.
    solver.parameters.linearization_level = 0
    solver.parameters.optimize_with_core = False
    solver.parameters.cp_model_presolve = True

    status = solver.Solve(model)

    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return SolveOutcome(
            status=status,
            scheduled_sessions=_build_solved_sessions(solver, x, session_blueprints, total_days, total_slots_per_day),
            conflicting_constraint_ids=[],
        )

    if status == cp_model.INFEASIBLE:
        return SolveOutcome(
            status=status,
            scheduled_sessions=[],
            conflicting_constraint_ids=_extract_unsat_core_ids(solver, assumption_literal_to_constraint_id),
        )

    return SolveOutcome(status=status, scheduled_sessions=[], conflicting_constraint_ids=[])


def apply_constraints_from_model(
    *,
    model: cp_model.CpModel,
    x: dict[AssignmentKey, cp_model.IntVar],
    constraints: Sequence[Constraint],
    target_index: TargetIndex,
    assumption_literal_to_constraint_id: dict[int, UUID],
    session_blueprints: Sequence[SessionBlueprint],
    total_days: int,
    total_slots_per_day: int,
) -> None:
    """
    Iterates through Constraint rows and applies each rule to the CP-SAT model.

    Each Constraint is guarded by an assumption literal so infeasible runs can
    return a minimal unsat core of conflicting Constraint IDs.
    """
    # Diagnostic: log the target_index keys for debugging constraint matching
    import logging
    logger = logging.getLogger("solver_engine")
    logger.setLevel(logging.DEBUG)
    if not logger.handlers:
        logger.addHandler(logging.StreamHandler())

    for tt, mapping in target_index.items():
        logger.debug(f"[TargetIndex] {tt.value}: {len(mapping)} unique IDs → {dict((str(k)[:8], len(v)) for k, v in mapping.items())}")

    for constraint in constraints:
        if not constraint.is_active:
            logger.debug(f"[Constraint] SKIP inactive: {constraint.id}")
            continue

        assumption = model.NewBoolVar(f"assume[{constraint.id}]")
        model.AddAssumption(assumption)
        _register_assumption(assumption, constraint.id, assumption_literal_to_constraint_id)

        # Try direct lookup first
        target_session_indexes = target_index[constraint.target_type].get(constraint.target_id, [])

        # If not found, try string-based matching as fallback
        if not target_session_indexes:
            # The target_id might be a string while the index has UUID objects or vice versa
            str_target = str(constraint.target_id)
            for key, indexes in target_index[constraint.target_type].items():
                if str(key) == str_target:
                    target_session_indexes = indexes
                    logger.debug(f"[Constraint] FALLBACK MATCH: {constraint.rule_type.value} on {constraint.target_type.value} "
                                 f"target_id={str_target[:8]}... matched via string comparison → {len(indexes)} sessions")
                    break

        if not target_session_indexes:
            logger.warning(f"[Constraint] NO MATCH: {constraint.rule_type.value} on {constraint.target_type.value} "
                           f"target_id={str(constraint.target_id)[:8]}... (type={type(constraint.target_id).__name__}) — "
                           f"available keys: {[str(k)[:8] for k in target_index[constraint.target_type].keys()]}")
            continue
        else:
            logger.debug(f"[Constraint] APPLIED: {constraint.rule_type.value} on {constraint.target_type.value} "
                         f"target_id={str(constraint.target_id)[:8]}... → {len(target_session_indexes)} sessions, "
                         f"value_keys={list(constraint.value.keys())}")

        if constraint.rule_type == ConstraintRuleType.AVAILABILITY:
            _apply_availability_constraint(model, x, target_session_indexes, constraint.value, assumption, total_days, total_slots_per_day, session_blueprints)
        elif constraint.rule_type == ConstraintRuleType.CAPACITY:
            _apply_capacity_constraint(model, x, target_session_indexes, constraint.value, assumption, total_days, total_slots_per_day)
        elif constraint.rule_type == ConstraintRuleType.AFFINITY:
            _apply_affinity_constraint(
                model=model,
                x=x,
                target_index=target_index,
                left_session_indexes=target_session_indexes,
                payload=constraint.value,
                assumption=assumption,
                total_days=total_days,
                total_slots_per_day=total_slots_per_day,
            )
        elif constraint.rule_type == ConstraintRuleType.LOCATION_PREFERENCE:
            # LocationPreference is a soft constraint — it does not block infeasibility.
            # We simply skip the hard constraint logic; the preference is noted for future
            # reward-based optimization when building_tag matching is wired.
            pass
        else:
            raise ValueError(f"Unsupported rule_type: {constraint.rule_type}")


def _build_assignment_variables(
    model: cp_model.CpModel,
    session_blueprints: Sequence[SessionBlueprint],
    total_days: int,
    total_slots_per_day: int,
) -> dict[AssignmentKey, cp_model.IntVar]:
    """Only create variables for VALID start slots (slot + duration <= total_slots_per_day).
    This alone can halve the variable count when sessions have duration > 1."""
    x: dict[AssignmentKey, cp_model.IntVar] = {}
    for si, session in enumerate(session_blueprints):
        valid_slots = range(total_slots_per_day - session.duration + 1)
        for day in range(total_days):
            for slot in valid_slots:
                x[(si, day, slot)] = model.NewBoolVar(f"x[{si},{day},{slot}]")
    return x


def _add_exactly_one_timeslot_constraints(
    model: cp_model.CpModel,
    x: dict[AssignmentKey, cp_model.IntVar],
    session_blueprints: Sequence[SessionBlueprint],
    total_days: int,
    total_slots_per_day: int,
) -> None:
    """Since variables are only created for valid slots, a single AddExactlyOne suffices."""
    for si, session in enumerate(session_blueprints):
        valid_slots = range(total_slots_per_day - session.duration + 1)
        model.AddExactlyOne(x[(si, day, slot)] for day in range(total_days) for slot in valid_slots)




def _add_spread_objective(
    model: cp_model.CpModel,
    x: dict[AssignmentKey, cp_model.IntVar],
    session_blueprints: Sequence[SessionBlueprint],
    total_days: int,
    total_slots_per_day: int,
    constraints: Sequence[Constraint] = (),
    target_index: TargetIndex = None,
) -> None:
    """
    Soft objective:
    1. Lec+Prac pairing – same day, practical after lecture.
    2. Same-day grouping – 3-session subjects grouped on one day.
    3. Block pairing – even L+P counts paired per day.
    4. No gaps – empty slots sandwiched between sessions (break-aware).
    5. No 3-in-a-row – 6+ contiguous slots without break (break-aware).
    6. Symmetric teacher load balancing – penalise total early AND late usage.
    7. Minimal perturbation – soft-prefer existing slot placements.
    """
    penalty_terms = []

    WEIGHT_LEC_PRAC      = 100
    WEIGHT_3_SAME_DAY    = 50
    WEIGHT_BATCHING      = 10
    WEIGHT_3_CONSECUTIVE = 30
    WEIGHT_GAP           = 15
    WEIGHT_CONSEC_GAP    = 35
    WEIGHT_EARLY_COST    = 8
    WEIGHT_PERTURBATION  = 40

    # ── Collect break slots from StudentGroup Availability constraints ──────
    all_break_slots: set[int] = set()
    group_breaks: dict[str, set[int]] = defaultdict(set)
    if constraints:
        for c in constraints:
            if (
                c.rule_type == ConstraintRuleType.AVAILABILITY
                and c.target_type == ConstraintTargetType.STUDENT_GROUP
            ):
                raw = c.value.get("unavailable_slots", [])
                if raw:
                    g_id = str(_parse_uuid(c.target_id, field_name="target_id")).lower()
                    group_breaks[g_id].update(raw)
                    all_break_slots.update(raw)

    # ── Single-pass index building ───────────────────────────────────────────
    teacher_to_sessions: dict[str, list[int]] = defaultdict(list)
    group_to_sessions:   dict[str, list[int]] = defaultdict(list)
    subject_sessions: dict[tuple, dict[str, list[int]]] = defaultdict(
        lambda: {"lectures": [], "practicals": []}
    )
    for si, session in enumerate(session_blueprints):
        t_id = str(session.teacher_id).lower()
        g_id = str(session.student_group_id).lower()
        teacher_to_sessions[t_id].append(si)
        group_to_sessions[g_id].append(si)
        key = (g_id, str(session.subject_id).lower())
        if session.duration >= 2:
            subject_sessions[key]["practicals"].append(si)
        else:
            subject_sessions[key]["lectures"].append(si)

    # Helper: build teaching segments (contiguous non-break slot runs)
    def _make_segments(break_slots: set[int]) -> list[list[int]]:
        segs: list[list[int]] = []
        seg: list[int] = []
        for s in range(total_slots_per_day):
            if s in break_slots:
                if seg:
                    segs.append(seg)
                    seg = []
            else:
                seg.append(s)
        if seg:
            segs.append(seg)
        return segs

    global_segments = _make_segments(all_break_slots)

    # ── 1-4: Subject-level objectives ───────────────────────────────────────
    for (group_id, subject_id), parts in subject_sessions.items():
        lectures   = parts["lectures"]
        practicals = parts["practicals"]
        total_sessions = len(lectures) + len(practicals)
        all_idxs   = lectures + practicals
        max_batch  = 3 if total_sessions == 3 else 2

        for day in range(total_days):
            # 1a. Batch size
            s_day = model.NewIntVar(0, total_sessions, f"sd[{group_id[:6]},{subject_id[:6]},{day}]")
            model.Add(s_day == sum(
                x[(idx, day, slot)]
                for idx in all_idxs
                for slot in range(total_slots_per_day)
            ))
            is_one = model.NewBoolVar(f"s1[{group_id[:6]},{subject_id[:6]},{day}]")
            model.Add(s_day == 1).OnlyEnforceIf(is_one)
            model.Add(s_day != 1).OnlyEnforceIf(is_one.Not())
            overflow = model.NewIntVar(0, total_sessions, f"ov[{group_id[:6]},{subject_id[:6]},{day}]")
            model.AddMaxEquality(overflow, [model.NewConstant(0), s_day - max_batch])
            penalty_terms.append(is_one * WEIGHT_BATCHING)
            penalty_terms.append(overflow * WEIGHT_BATCHING)

            # 1b. Consecutive same-subject lectures split by breaks
            if len(lectures) >= 2 and total_sessions != 3:
                block_start_vars = []
                for seg in global_segments:
                    prev_active = None
                    for slot in seg:
                        cur = model.NewBoolVar(f"la[{group_id[:6]},{subject_id[:6]},{day},{slot}]")
                        model.Add(sum(x[(l, day, slot)] for l in lectures) == 1).OnlyEnforceIf(cur)
                        model.Add(sum(x[(l, day, slot)] for l in lectures) == 0).OnlyEnforceIf(cur.Not())
                        b_var = model.NewBoolVar(f"bs[{group_id[:6]},{subject_id[:6]},{day},{slot}]")
                        if prev_active is None:
                            model.Add(b_var == cur)
                        else:
                            model.AddBoolAnd([cur, prev_active.Not()]).OnlyEnforceIf(b_var)
                            model.AddBoolOr([cur.Not(), prev_active]).OnlyEnforceIf(b_var.Not())
                        block_start_vars.append(b_var)
                        prev_active = cur
                if block_start_vars:
                    nb = model.NewIntVar(0, len(block_start_vars), f"nb[{group_id[:6]},{subject_id[:6]},{day}]")
                    model.Add(nb == sum(block_start_vars))
                    cp_ = model.NewIntVar(0, len(block_start_vars), f"cp[{group_id[:6]},{subject_id[:6]},{day}]")
                    model.AddMaxEquality(cp_, [model.NewConstant(0), nb - 1])
                    penalty_terms.append(cp_ * WEIGHT_BATCHING)

        # 2. Practical-after-lecture ordering (flat weighted-start approach)
        if lectures and practicals:
            for li, lec_idx in enumerate(lectures):
                prac_idx = practicals[li % len(practicals)]
                lec_start = model.NewIntVar(0, total_days * total_slots_per_day,
                    f"ls[{group_id[:6]},{subject_id[:6]},{li}]")
                prac_start = model.NewIntVar(0, total_days * total_slots_per_day,
                    f"ps[{group_id[:6]},{subject_id[:6]},{li}]")
                model.Add(lec_start == sum(
                    x[(lec_idx, d, s)] * (d * total_slots_per_day + s)
                    for d in range(total_days) for s in range(total_slots_per_day)
                ))
                model.Add(prac_start == sum(
                    x[(prac_idx, d, s)] * (d * total_slots_per_day + s)
                    for d in range(total_days) for s in range(total_slots_per_day)
                ))
                wrong_order = model.NewBoolVar(f"wo[{group_id[:6]},{subject_id[:6]},{li}]")
                model.Add(prac_start <= lec_start).OnlyEnforceIf(wrong_order)
                model.Add(prac_start > lec_start).OnlyEnforceIf(wrong_order.Not())
                penalty_terms.append(wrong_order * WEIGHT_LEC_PRAC)
                for day in range(total_days):
                    lec_on = model.NewBoolVar(f"lo[{group_id[:6]},{subject_id[:6]},{li},{day}]")
                    prac_on = model.NewBoolVar(f"po[{group_id[:6]},{subject_id[:6]},{li},{day}]")
                    model.Add(sum(x[(lec_idx, day, s)] for s in range(total_slots_per_day)) >= 1).OnlyEnforceIf(lec_on)
                    model.Add(sum(x[(lec_idx, day, s)] for s in range(total_slots_per_day)) == 0).OnlyEnforceIf(lec_on.Not())
                    model.Add(sum(x[(prac_idx, day, s)] for s in range(total_slots_per_day)) >= 1).OnlyEnforceIf(prac_on)
                    model.Add(sum(x[(prac_idx, day, s)] for s in range(total_slots_per_day)) == 0).OnlyEnforceIf(prac_on.Not())
                    apart = model.NewBoolVar(f"ap[{group_id[:6]},{subject_id[:6]},{li},{day}]")
                    model.AddBoolAnd([lec_on, prac_on.Not()]).OnlyEnforceIf(apart)
                    model.AddBoolOr([lec_on.Not(), prac_on]).OnlyEnforceIf(apart.Not())
                    penalty_terms.append(apart * WEIGHT_LEC_PRAC)

        # 3. Same-day grouping for 3-session subjects
        if total_sessions == 3:
            for day in range(total_days):
                flags = []
                for idx in all_idxs:
                    b = model.NewBoolVar(f"s3[{group_id[:6]},{subject_id[:6]},{idx},{day}]")
                    model.Add(sum(x[(idx, day, s)] for s in range(total_slots_per_day)) >= 1).OnlyEnforceIf(b)
                    model.Add(sum(x[(idx, day, s)] for s in range(total_slots_per_day)) == 0).OnlyEnforceIf(b.Not())
                    flags.append(b)
                cnt = model.NewIntVar(0, 3, f"s3c[{group_id[:6]},{subject_id[:6]},{day}]")
                model.Add(cnt == sum(flags))
                any_here = model.NewBoolVar(f"s3a[{group_id[:6]},{subject_id[:6]},{day}]")
                model.Add(cnt >= 1).OnlyEnforceIf(any_here)
                model.Add(cnt == 0).OnlyEnforceIf(any_here.Not())
                miss = model.NewIntVar(0, 3, f"s3m[{group_id[:6]},{subject_id[:6]},{day}]")
                model.Add(miss == 3 - cnt).OnlyEnforceIf(any_here)
                model.Add(miss == 0).OnlyEnforceIf(any_here.Not())
                penalty_terms.append(miss * WEIGHT_3_SAME_DAY)

        # 4. Block pairing for even L+P counts (>=2 each)
        if len(lectures) >= 2 and len(practicals) >= 2 and len(lectures) == len(practicals):
            for pi in range(len(lectures)):
                lec_idx  = lectures[pi]
                prac_idx = practicals[pi]
                for day in range(total_days):
                    ld  = model.NewBoolVar(f"bll[{group_id[:6]},{subject_id[:6]},{pi},{day}]")
                    pd_ = model.NewBoolVar(f"blp[{group_id[:6]},{subject_id[:6]},{pi},{day}]")
                    model.Add(sum(x[(lec_idx, day, s)] for s in range(total_slots_per_day)) >= 1).OnlyEnforceIf(ld)
                    model.Add(sum(x[(lec_idx, day, s)] for s in range(total_slots_per_day)) == 0).OnlyEnforceIf(ld.Not())
                    model.Add(sum(x[(prac_idx, day, s)] for s in range(total_slots_per_day)) >= 1).OnlyEnforceIf(pd_)
                    model.Add(sum(x[(prac_idx, day, s)] for s in range(total_slots_per_day)) == 0).OnlyEnforceIf(pd_.Not())
                    un = model.NewBoolVar(f"blu[{group_id[:6]},{subject_id[:6]},{pi},{day}]")
                    model.AddBoolAnd([ld, pd_.Not()]).OnlyEnforceIf(un)
                    model.AddBoolOr([ld.Not(), pd_]).OnlyEnforceIf(un.Not())
                    penalty_terms.append(un * WEIGHT_LEC_PRAC)

    # ── 5 & 6: Per-group gap + consecutive penalties (break-aware) ───────────
    for g_id_str, session_indexes in group_to_sessions.items():
        break_slots = group_breaks.get(g_id_str, all_break_slots)
        segs = _make_segments(break_slots)

        # Pre-compute coverage: slot -> list of (session_idx, start_slot) pairs
        slot_coverage: dict[int, list[tuple[int, int]]] = defaultdict(list)
        for idx in session_indexes:
            dur = session_blueprints[idx].duration
            for slot in range(total_slots_per_day):
                if slot in break_slots:
                    continue
                for start_s in range(max(0, slot - dur + 1), min(slot + 1, total_slots_per_day - dur + 1)):
                    slot_coverage[slot].append((idx, start_s))

        for day in range(total_days):
            # Build active vars only for non-break slots
            slot_active: dict[int, cp_model.IntVar] = {}
            for slot in range(total_slots_per_day):
                if slot in break_slots:
                    continue
                s_var = model.NewBoolVar(f"ga[{g_id_str[:6]},{day},{slot}]")
                valid_terms = [x[(idx, day, st)] for (idx, st) in slot_coverage[slot]
                               if (idx, day, st) in x]
                if valid_terms:
                    model.Add(sum(valid_terms) >= 1).OnlyEnforceIf(s_var)
                    model.Add(sum(valid_terms) == 0).OnlyEnforceIf(s_var.Not())
                else:
                    model.Add(s_var == 0)
                slot_active[slot] = s_var

            for seg in segs:
                if len(seg) < 2:
                    continue
                seg_vars = [slot_active[sl] for sl in seg]

                # Gap: empty slot sandwiched inside a segment
                for i in range(1, len(seg) - 1):
                    slot = seg[i]
                    before_vars = seg_vars[:i]
                    after_vars  = seg_vars[i + 1:]
                    hb = model.NewBoolVar(f"hb[{g_id_str[:6]},{day},{slot}]")
                    ha = model.NewBoolVar(f"ha[{g_id_str[:6]},{day},{slot}]")
                    ig = model.NewBoolVar(f"ig[{g_id_str[:6]},{day},{slot}]")
                    model.AddMaxEquality(hb, before_vars)
                    model.AddMaxEquality(ha, after_vars)
                    model.AddMinEquality(ig, [hb, ha, seg_vars[i].Not()])
                    penalty_terms.append(ig * WEIGHT_GAP)

                    # Consecutive gap (heavier)
                    if i >= 2:
                        prev_slot = seg[i - 1]
                        phb = model.NewBoolVar(f"phb[{g_id_str[:6]},{day},{slot}]")
                        pha = model.NewBoolVar(f"pha[{g_id_str[:6]},{day},{slot}]")
                        pig = model.NewBoolVar(f"pig[{g_id_str[:6]},{day},{slot}]")
                        model.AddMaxEquality(phb, seg_vars[:i - 1])
                        model.AddMaxEquality(pha, seg_vars[i:])
                        model.AddMinEquality(pig, [phb, pha, seg_vars[i - 1].Not()])
                        cg = model.NewBoolVar(f"cg[{g_id_str[:6]},{day},{slot}]")
                        model.AddMinEquality(cg, [pig, ig])
                        penalty_terms.append(cg * WEIGHT_CONSEC_GAP)

                # 3-consecutive: runs of 6+ within a segment (break resets the run)
                consecutive_limit = 6
                if len(seg) >= consecutive_limit:
                    for i in range(len(seg) - consecutive_limit + 1):
                        run_vars = seg_vars[i:i + consecutive_limit]
                        cv = model.NewBoolVar(f"gc[{g_id_str[:6]},{day},{seg[i]}]")
                        model.AddMinEquality(cv, run_vars)
                        penalty_terms.append(cv * WEIGHT_3_CONSECUTIVE)

    # ── 7: Teacher load balancing (imbalance-based, not band-avoidance) ─────
    # Goal: no single teacher should have disproportionately more early-slot
    # sessions than their peers. We count each teacher's total early-slot
    # assignments across the whole week, then penalise the spread (max - min).
    # This lets the solver freely use early slots as long as load is balanced.
    non_break = [s for s in range(total_slots_per_day) if s not in all_break_slots]
    early_cutoff = max(1, len(non_break) // 3)
    early_band = set(non_break[:early_cutoff])

    WEIGHT_LOAD_IMBALANCE = 25

    teacher_early_totals = []
    for t_id_str, session_indexes in teacher_to_sessions.items():
        week_early_terms = [
            x[(idx, day, slot)]
            for idx in session_indexes
            for day in range(total_days)
            for slot in range(total_slots_per_day)
            if slot in early_band and (idx, day, slot) in x
        ]
        if week_early_terms:
            tot = model.NewIntVar(0, len(week_early_terms), f"wt[{t_id_str[:6]}]")
            model.Add(tot == sum(week_early_terms))
            teacher_early_totals.append(tot)

    if len(teacher_early_totals) >= 2:
        max_early = model.NewIntVar(0, len(session_blueprints), "max_early")
        min_early = model.NewIntVar(0, len(session_blueprints), "min_early")
        model.AddMaxEquality(max_early, teacher_early_totals)
        model.AddMinEquality(min_early, teacher_early_totals)
        spread = model.NewIntVar(0, len(session_blueprints), "early_spread")
        model.Add(spread == max_early - min_early)
        penalty_terms.append(spread * WEIGHT_LOAD_IMBALANCE)

    # ── 8: Minimal perturbation (LocationPreference) ─────────────────────────
    if constraints and target_index:
        for constraint in constraints:
            if not constraint.is_active or constraint.rule_type != ConstraintRuleType.LOCATION_PREFERENCE:
                continue
            pref_day  = constraint.value.get("preferred_day")
            pref_slot = constraint.value.get("preferred_slot")
            if pref_day is None or pref_slot is None:
                continue
            tgt = target_index[constraint.target_type].get(constraint.target_id, [])
            if not tgt:
                str_target = str(constraint.target_id)
                for key, idxs in target_index[constraint.target_type].items():
                    if str(key) == str_target:
                        tgt = idxs
                        break
            exp_subj = str(constraint.value.get("subject_id", "")).lower()
            for idx in tgt:
                if exp_subj:
                    ss = str(_parse_uuid(session_blueprints[idx].subject_id, field_name="sub")).lower()
                    if ss != exp_subj:
                        continue
                if (idx, pref_day, pref_slot) in x:
                    penalty_terms.append(x[(idx, pref_day, pref_slot)].Not() * WEIGHT_PERTURBATION)

    if penalty_terms:
        model.Minimize(sum(penalty_terms))



def _add_hard_resource_constraints(
    model: cp_model.CpModel,
    x: dict[AssignmentKey, cp_model.IntVar],
    session_blueprints: Sequence[SessionBlueprint],
    total_days: int,
    total_slots_per_day: int,
) -> None:
    """No-overlap constraints for teachers, rooms, and student groups.

    Pre-compute a coverage map once:
      coverage[(entity_key, day, slot)] = list of x-vars that occupy that slot
    Then emit one AddAtMostOne per non-empty entry.  AddAtMostOne is tighter
    than Add(sum <= 1) because the solver can use clause-learning on it.
    """
    # entity buckets
    teacher_sessions: dict[str, list[int]] = defaultdict(list)
    room_sessions:    dict[str, list[int]] = defaultdict(list)
    group_sessions:   dict[str, list[int]] = defaultdict(list)
    for si, s in enumerate(session_blueprints):
        teacher_sessions[str(s.teacher_id)].append(si)
        room_sessions[str(s.room_id)].append(si)
        group_sessions[str(s.student_group_id)].append(si)

    def _add_no_overlap(entity_map: dict) -> None:
        for entity_id, idxs in entity_map.items():
            for day in range(total_days):
                for slot in range(total_slots_per_day):
                    # vars that start in [slot-dur+1 .. slot] and are valid
                    overlap_vars = [
                        x[(i, day, s)]
                        for i in idxs
                        for s in range(max(0, slot - session_blueprints[i].duration + 1), slot + 1)
                        if (i, day, s) in x
                    ]
                    if len(overlap_vars) > 1:
                        model.AddAtMostOne(overlap_vars)

    _add_no_overlap(teacher_sessions)
    _add_no_overlap(room_sessions)
    _add_no_overlap(group_sessions)


def _build_target_index(session_blueprints: Sequence[SessionBlueprint]) -> TargetIndex:
    index: TargetIndex = {
        ConstraintTargetType.TEACHER: defaultdict(list),
        ConstraintTargetType.ROOM: defaultdict(list),
        ConstraintTargetType.STUDENT_GROUP: defaultdict(list),
        ConstraintTargetType.SUBJECT: defaultdict(list),
    }

    for session_index, session in enumerate(session_blueprints):
        # Normalize all IDs to lowercase strings for reliable dict matching.
        # This avoids UUID object equality issues between different instantiation paths.
        t_id = str(_parse_uuid(session.teacher_id, field_name="teacher_id")).lower()
        r_id = str(_parse_uuid(session.room_id, field_name="room_id")).lower()
        g_id = str(_parse_uuid(session.student_group_id, field_name="student_group_id")).lower()
        s_id = str(_parse_uuid(session.subject_id, field_name="subject_id")).lower()

        index[ConstraintTargetType.TEACHER][t_id].append(session_index)
        index[ConstraintTargetType.ROOM][r_id].append(session_index)
        index[ConstraintTargetType.STUDENT_GROUP][g_id].append(session_index)
        index[ConstraintTargetType.SUBJECT][s_id].append(session_index)

    return index


def _apply_availability_constraint(
    model: cp_model.CpModel,
    x: dict[AssignmentKey, cp_model.IntVar],
    target_session_indexes: list[int],
    payload: dict[str, Any],
    assumption: cp_model.IntVar,
    total_days: int,
    total_slots_per_day: int,
    session_blueprints: Sequence[SessionBlueprint] = (),
) -> None:
    unavailable_slots = _parse_slot_list(payload.get("unavailable_slots"), field_name="unavailable_slots", total_days=total_days, total_slots_per_day=total_slots_per_day)
    unavailable_pairs = _parse_day_slot_pairs(payload.get("unavailable"), field_name="unavailable", total_days=total_days, total_slots_per_day=total_slots_per_day)

    available_slots = _parse_slot_list(payload.get("available_slots"), field_name="available_slots", total_days=total_days, total_slots_per_day=total_slots_per_day)
    available_pairs = _parse_day_slot_pairs(payload.get("available"), field_name="available", total_days=total_days, total_slots_per_day=total_slots_per_day)

    forced_slot = payload.get("force_slot")
    forced_day = payload.get("force_day")

    if not any([unavailable_slots, unavailable_pairs, available_slots, available_pairs, forced_slot is not None, forced_day is not None]):
        raise ValueError(
            "Availability payload must include unavailable_slots, unavailable, available_slots, available, force_slot, or force_day"
        )

    allowed_pairs: set[tuple[int, int]] = set()
    if available_slots:
        for day in range(total_days):
            for slot in available_slots:
                allowed_pairs.add((day, slot))
    allowed_pairs.update(available_pairs)

    for session_index in target_session_indexes:
        # Determine session duration from blueprints if available, otherwise default to 1
        session_duration = 1
        if session_blueprints and session_index < len(session_blueprints):
            session_duration = getattr(session_blueprints[session_index], 'duration', 1)

        # --- unavailable_slots: block all start positions that would occupy a forbidden slot ---
        # A session of duration D starting at start_slot occupies slots [start_slot, start_slot+D-1].
        # To prevent the session from occupying forbidden_slot, we must block all
        # start_slot values in [forbidden_slot - D + 1, forbidden_slot].
        for forbidden_slot in unavailable_slots:
            for day in range(total_days):
                for start in range(max(0, forbidden_slot - session_duration + 1), forbidden_slot + 1):
                    if (session_index, day, start) in x:
                        model.Add(x[(session_index, day, start)] == 0).OnlyEnforceIf(assumption)

        # --- unavailable pairs: block specific (day, slot) combinations ---
        for day, forbidden_slot in unavailable_pairs:
            for start in range(max(0, forbidden_slot - session_duration + 1), forbidden_slot + 1):
                if (session_index, day, start) in x:
                    model.Add(x[(session_index, day, start)] == 0).OnlyEnforceIf(assumption)

        # --- allowed_pairs: only permit sessions to start at explicitly allowed (day, slot) ---
        if allowed_pairs:
            for day in range(total_days):
                for slot in range(total_slots_per_day):
                    if (day, slot) not in allowed_pairs:
                        model.Add(x[(session_index, day, slot)] == 0).OnlyEnforceIf(assumption)

        # --- force_slot: session must start at a specific slot on any day ---
        if forced_slot is not None:
            for day in range(total_days):
                for slot in range(total_slots_per_day):
                    if slot != forced_slot:
                        model.Add(x[(session_index, day, slot)] == 0).OnlyEnforceIf(assumption)

        # --- force_day: session must be on a specific day ---
        if forced_day is not None:
            for day in range(total_days):
                for slot in range(total_slots_per_day):
                    if day != forced_day:
                        model.Add(x[(session_index, day, slot)] == 0).OnlyEnforceIf(assumption)


def _apply_capacity_constraint(
    model: cp_model.CpModel,
    x: dict[AssignmentKey, cp_model.IntVar],
    target_session_indexes: list[int],
    payload: dict[str, Any],
    assumption: cp_model.IntVar,
    total_days: int,
    total_slots_per_day: int,
) -> None:
    max_per_day = payload.get("max_sessions_per_day")
    max_total = payload.get("max_sessions_total")
    min_total = payload.get("required_total_sessions") or payload.get("min_sessions_total")

    if max_per_day is None and max_total is None and min_total is None:
        raise ValueError("Capacity payload must include max_sessions_per_day, max_sessions_total, and/or min_sessions_total")

    if max_per_day is not None:
        if not isinstance(max_per_day, int) or max_per_day < 0:
            raise ValueError("max_sessions_per_day must be a non-negative integer")
        for day in range(total_days):
            model.Add(
                sum(x[(idx, day, slot)] for idx in target_session_indexes for slot in range(total_slots_per_day)) <= max_per_day
            ).OnlyEnforceIf(assumption)

    if max_total is not None:
        if not isinstance(max_total, int) or max_total < 0:
            raise ValueError("max_sessions_total must be a non-negative integer")
        model.Add(
            sum(x[(idx, day, slot)] for idx in target_session_indexes for day in range(total_days) for slot in range(total_slots_per_day))
            <= max_total
        ).OnlyEnforceIf(assumption)

    if min_total is not None:
        if not isinstance(min_total, int) or min_total < 0:
            raise ValueError("min_sessions_total must be a non-negative integer")
        model.Add(
            sum(x[(idx, day, slot)] for idx in target_session_indexes for day in range(total_days) for slot in range(total_slots_per_day))
            >= min_total
        ).OnlyEnforceIf(assumption)



def _apply_affinity_constraint(
    *,
    model: cp_model.CpModel,
    x: dict[AssignmentKey, cp_model.IntVar],
    target_index: TargetIndex,
    left_session_indexes: list[int],
    payload: dict[str, Any],
    assumption: cp_model.IntVar,
    total_days: int,
    total_slots_per_day: int,
) -> None:
    with_target_type_raw = payload.get("with_target_type")
    with_target_id_raw = payload.get("with_target_id")

    if with_target_type_raw is None or with_target_id_raw is None:
        raise ValueError("Affinity payload requires with_target_type and with_target_id")

    with_target_type = ConstraintTargetType(with_target_type_raw)
    with_target_id = _parse_uuid(with_target_id_raw, field_name="with_target_id")
    right_session_indexes = target_index[with_target_type].get(with_target_id, [])

    if not right_session_indexes:
        return

    same_day = bool(payload.get("same_day", False))
    same_slot = bool(payload.get("same_slot", False))
    different_day = bool(payload.get("different_day", False))
    different_slot = bool(payload.get("different_slot", False))
    different_timeslot = bool(payload.get("different_timeslot", False))

    if not any([same_day, same_slot, different_day, different_slot, different_timeslot]):
        raise ValueError("Affinity payload must declare at least one relation flag")

    for left_idx in left_session_indexes:
        for right_idx in right_session_indexes:
            if left_idx == right_idx:
                continue

            if same_day:
                for day in range(total_days):
                    model.Add(
                        sum(x[(left_idx, day, slot)] for slot in range(total_slots_per_day))
                        == sum(x[(right_idx, day, slot)] for slot in range(total_slots_per_day))
                    ).OnlyEnforceIf(assumption)

            if same_slot:
                for slot in range(total_slots_per_day):
                    model.Add(
                        sum(x[(left_idx, day, slot)] for day in range(total_days))
                        == sum(x[(right_idx, day, slot)] for day in range(total_days))
                    ).OnlyEnforceIf(assumption)

            if different_day:
                for day in range(total_days):
                    model.Add(
                        sum(x[(left_idx, day, slot)] for slot in range(total_slots_per_day))
                        + sum(x[(right_idx, day, slot)] for slot in range(total_slots_per_day))
                        <= 1
                    ).OnlyEnforceIf(assumption)

            if different_slot:
                for slot in range(total_slots_per_day):
                    model.Add(
                        sum(x[(left_idx, day, slot)] for day in range(total_days))
                        + sum(x[(right_idx, day, slot)] for day in range(total_days))
                        <= 1
                    ).OnlyEnforceIf(assumption)

            if different_timeslot:
                for day in range(total_days):
                    for slot in range(total_slots_per_day):
                        model.Add(x[(left_idx, day, slot)] + x[(right_idx, day, slot)] <= 1).OnlyEnforceIf(
                            assumption
                        )


def _build_solved_sessions(
    solver: cp_model.CpSolver,
    x: dict[AssignmentKey, cp_model.IntVar],
    session_blueprints: Sequence[SessionBlueprint],
    total_days: int,
    total_slots_per_day: int,
) -> list[ScheduledSession]:
    solved_sessions: list[ScheduledSession] = []

    for session_index, blueprint in enumerate(session_blueprints):
        selected_day: int | None = None
        selected_slot: int | None = None

        for day in range(total_days):
            for slot in range(total_slots_per_day):
                if solver.BooleanValue(x[(session_index, day, slot)]):
                    selected_day = day
                    selected_slot = slot
                    break
            if selected_day is not None:
                break

        if selected_day is None or selected_slot is None:
            raise RuntimeError(f"No solution assignment found for session index {session_index}")

        solved_sessions.append(
            ScheduledSession(
                id=blueprint.id or uuid4(),
                day_of_week=selected_day,
                start_slot=selected_slot,
                teacher_id=blueprint.teacher_id,
                room_id=blueprint.room_id,
                student_group_id=blueprint.student_group_id,
                subject_id=blueprint.subject_id,
                duration=blueprint.duration,
            )
        )

    return solved_sessions


def _extract_unsat_core_ids(
    solver: cp_model.CpSolver,
    assumption_literal_to_constraint_id: dict[int, UUID],
) -> list[UUID]:
    unsat_core_ids: list[UUID] = []
    seen: set[UUID] = set()

    for literal in solver.SufficientAssumptionsForInfeasibility():
        constraint_id = assumption_literal_to_constraint_id.get(literal)
        if constraint_id is None:
            continue
        if constraint_id in seen:
            continue
        unsat_core_ids.append(constraint_id)
        seen.add(constraint_id)

    return unsat_core_ids


def _register_assumption(
    assumption: cp_model.IntVar,
    constraint_id: UUID,
    assumption_literal_to_constraint_id: dict[int, UUID],
) -> None:
    assumption_literal_to_constraint_id[assumption.Index()] = constraint_id
    assumption_literal_to_constraint_id[-assumption.Index() - 1] = constraint_id


def _parse_slot_list(raw_value: Any, *, field_name: str, total_days: int, total_slots_per_day: int) -> set[int]:
    if raw_value is None:
        return set()

    if not isinstance(raw_value, list):
        raise ValueError(f"{field_name} must be a list of slot integers")

    slot_set: set[int] = set()
    for raw_slot in raw_value:
        if not isinstance(raw_slot, int):
            raise ValueError(f"{field_name} must contain only integers")
        _validate_day_slot(day=0, slot=raw_slot, total_days=total_days, total_slots_per_day=total_slots_per_day)
        slot_set.add(raw_slot)

    return slot_set


def _parse_day_slot_pairs(raw_value: Any, *, field_name: str, total_days: int, total_slots_per_day: int) -> set[tuple[int, int]]:
    if raw_value is None:
        return set()

    if not isinstance(raw_value, list):
        raise ValueError(f"{field_name} must be a list of day/slot objects")

    day_slot_pairs: set[tuple[int, int]] = set()
    for item in raw_value:
        if not isinstance(item, dict):
            raise ValueError(f"{field_name} entries must be objects")

        day = item.get("day")
        slot = item.get("slot")
        if not isinstance(day, int) or not isinstance(slot, int):
            raise ValueError(f"{field_name} entries must include integer day and slot")

        _validate_day_slot(day=day, slot=slot, total_days=total_days, total_slots_per_day=total_slots_per_day)
        day_slot_pairs.add((day, slot))

    return day_slot_pairs


def _parse_uuid(raw_value: Any, *, field_name: str) -> UUID | str:
    if isinstance(raw_value, UUID):
        return raw_value

    if isinstance(raw_value, str):
        try:
            return UUID(raw_value)
        except ValueError:
            return raw_value

    return str(raw_value)


def _validate_day_slot(*, day: int, slot: int, total_days: int, total_slots_per_day: int) -> None:
    if day < 0 or day >= total_days:
        # We still raise for day because that's usually a more serious logic error
        raise ValueError(f"day must be in range [0, {total_days - 1}]")
    if slot < 0 or slot >= total_slots_per_day:
        raise ValueError(f"slot {slot} is out of range [0, {total_slots_per_day - 1}]. Check that the constraint grid uses the correct number of slots per day.")
