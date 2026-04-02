"""
parse_roadmap.py
----------------
Parses the AAI Ops roadmap Excel file and outputs:
  - tickets        : list of all TASK rows as structured dicts
  - schedule       : per-assignee, per-week hours breakdown
  - conflicts      : same assignee working >40 hrs in a week
  - parallel_tasks : tasks running in same week (different assignees) — fine
  - availability   : first free week per assignee after their last task
  - warnings       : unassigned tasks, effort mismatches

Usage:
    python parse_roadmap.py                          # prints JSON to stdout
    python parse_roadmap.py --file my_roadmap.xlsx   # custom file path
"""

import sys
import json
import datetime
import argparse
import openpyxl

# ── Constants ─────────────────────────────────────────────────────────────────
WEEK_COL_START = 9          # col index 9 = col I (1-based) = first week column
HOURS_PER_WEEK = 40         # threshold for "fully booked"

LEFT_COLS = {
    "type":        0,   # A
    "name":        1,   # B
    "description": 2,   # C
    "milestone":   3,   # D
    "epic":        4,   # E
    "priority":    5,   # F
    "effort_hrs":  6,   # G
    "assignee":    7,   # H
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def col_index_to_letter(idx):
    """1-based column index → Excel letter (e.g. 9 → 'I')."""
    return openpyxl.utils.get_column_letter(idx)


def parse_effort(raw):
    """Convert effort cell value to float, or None if blank/invalid."""
    if raw is None:
        return None
    try:
        return float(raw)
    except (ValueError, TypeError):
        return None


def date_key(dt):
    """datetime → 'YYYY-MM-DD' string used as dict key."""
    if isinstance(dt, datetime.datetime):
        return dt.date().isoformat()
    if isinstance(dt, datetime.date):
        return dt.isoformat()
    return str(dt)


# ── Core parser ───────────────────────────────────────────────────────────────

def parse(filepath: str) -> dict:
    wb = openpyxl.load_workbook(filepath, data_only=True)
    ws = wb.active  # assumes Roadmap is the first/active sheet

    all_rows = list(ws.iter_rows(min_row=1, values_only=True))

    # ── Step 1: build per-milestone week date map ─────────────────────────────
    # Each MILESTONE row has its own week sequence starting at col I (index 8).
    # We walk all rows once, and every time we hit a MILESTONE we record its
    # week dates. TASK rows then use the week dates of their current milestone.
    #
    # milestone_weeks: { milestone_name: ['YYYY-MM-DD', ...] }
    milestone_weeks = {}

    for row in all_rows:
        row_type = row[LEFT_COLS["type"]]
        # Normalize row type
        row_type = str(row_type).strip().upper() if row_type else ""
        
        if row_type == "MILESTONE":
            name = row[LEFT_COLS["name"]]
            dates = []
            for v in row[WEEK_COL_START - 1:]:   # 0-based slice from col I
                if isinstance(v, (datetime.datetime, datetime.date)):
                    dates.append(date_key(v))
            if dates:
                milestone_weeks[name] = dates

    if not milestone_weeks:
        raise ValueError(
            "No MILESTONE row with week dates found. "
            "Check that col I of a MILESTONE row contains a date."
        )

    # ── Step 2: walk every row ────────────────────────────────────────────────
    tickets    = []
    warnings   = []
    epics      = {}        # name → milestone
    milestones = []
    current_milestone_weeks = []   # week dates of the milestone currently in scope

    for row_num, row in enumerate(all_rows, start=1):
        row_type = row[LEFT_COLS["type"]]
        
        # Normalize row type to uppercase for case-insensitive matching
        row_type = str(row_type).strip().upper() if row_type else ""

        if row_type == "MILESTONE":
            m_name = row[LEFT_COLS["name"]]
            milestones.append(m_name)
            # Switch active week dates to this milestone's sequence
            current_milestone_weeks = milestone_weeks.get(m_name, [])
            continue

        if row_type == "EPIC":
            epics[row[LEFT_COLS["name"]]] = row[LEFT_COLS["milestone"]]
            continue

        if row_type != "TASK":
            continue  # skip header row, totals row, blank rows

        # ── Extract left-column fields ────────────────────────────────────────
        name        = row[LEFT_COLS["name"]]
        description = row[LEFT_COLS["description"]]
        milestone   = row[LEFT_COLS["milestone"]]
        epic        = row[LEFT_COLS["epic"]]
        priority    = row[LEFT_COLS["priority"]]
        effort_raw  = row[LEFT_COLS["effort_hrs"]]
        assignee    = row[LEFT_COLS["assignee"]]

        effort_hrs  = parse_effort(effort_raw)
        assignee    = assignee.strip() if assignee else None

        # Use the week dates belonging to this task's milestone.
        # current_milestone_weeks is already set to the right milestone
        # because we process rows top-to-bottom and update on every MILESTONE row.
        week_dates    = current_milestone_weeks
        week_col_count = len(week_dates)

        # ── Extract week hours (cols I onward) ────────────────────────────────
        week_hours = {}   # { 'YYYY-MM-DD': hours_float }
        week_vals  = row[WEEK_COL_START - 1:]   # 0-based

        planned_total = 0.0
        for i, val in enumerate(week_vals[:week_col_count]):
            if val is not None:
                try:
                    hrs = float(val)
                    if hrs > 0:
                        week_hours[week_dates[i]] = hrs
                        planned_total += hrs
                except (ValueError, TypeError):
                    pass

        # ── Warnings ──────────────────────────────────────────────────────────
        if not assignee:
            warnings.append({
                "row":     row_num,
                "task":    name,
                "issue":   "unassigned",
                "detail":  "Assignee is blank. Task cannot be scheduled or conflicted."
            })

        if effort_hrs is not None and planned_total > 0:
            diff = abs(planned_total - effort_hrs)
            if diff > 0.5:   # tolerance: 0.5 hrs
                warnings.append({
                    "row":    row_num,
                    "task":   name,
                    "issue":  "effort_mismatch",
                    "detail": (
                        f"Effort (hrs) col says {effort_hrs}h "
                        f"but week columns sum to {planned_total}h "
                        f"(diff: {diff}h)."
                    )
                })

        if effort_hrs is not None and planned_total == 0:
            warnings.append({
                "row":    row_num,
                "task":   name,
                "issue":  "no_weeks_planned",
                "detail": f"Effort is {effort_hrs}h but no week columns filled in."
            })

        ticket = {
            "row":          row_num,
            "name":         name,
            "description":  description,
            "milestone":    milestone,
            "epic":         epic,
            "priority":     priority,
            "effort_hrs":   effort_hrs,
            "assignee":     assignee,
            "week_hours":   week_hours,        # { week_date: hrs }
            "planned_total": planned_total,    # sum of week cols
            "active_weeks": sorted(week_hours.keys()),
        }
        tickets.append(ticket)

    # ── Step 3: per-assignee schedule ─────────────────────────────────────────
    # schedule[assignee][week_date] = { total_hrs, tasks: [name, ...] }
    schedule = {}

    for t in tickets:
        if not t["assignee"]:
            continue
        dev = t["assignee"]
        if dev not in schedule:
            schedule[dev] = {}
        for wk, hrs in t["week_hours"].items():
            if wk not in schedule[dev]:
                schedule[dev][wk] = {"total_hrs": 0.0, "tasks": []}
            schedule[dev][wk]["total_hrs"] += hrs
            schedule[dev][wk]["tasks"].append(t["name"])

    # Sort each dev's weeks
    schedule = {
        dev: dict(sorted(weeks.items()))
        for dev, weeks in sorted(schedule.items())
    }

    # ── Step 4: conflicts — same assignee, same week, total hrs > threshold ───
    conflicts = []
    for dev, weeks in schedule.items():
        for wk, info in weeks.items():
            if len(info["tasks"]) > 1:
                conflicts.append({
                    "assignee":   dev,
                    "week":       wk,
                    "total_hrs":  info["total_hrs"],
                    "tasks":      info["tasks"],
                    "overbooked": info["total_hrs"] > HOURS_PER_WEEK,
                })

    # ── Step 5: parallel tasks — different assignees, same week ──────────────
    # Build week → list of (task_name, assignee) for tasks with hours that week
    week_task_map = {}
    for t in tickets:
        if not t["assignee"]:
            continue
        for wk in t["active_weeks"]:
            if wk not in week_task_map:
                week_task_map[wk] = []
            week_task_map[wk].append((t["name"], t["assignee"]))

    parallel_tasks = []
    for wk in sorted(week_task_map.keys()):
        entries = week_task_map[wk]
        if len(entries) < 2:
            continue
        # Find pairs with different assignees
        seen = set()
        for i in range(len(entries)):
            for j in range(i + 1, len(entries)):
                n1, a1 = entries[i]
                n2, a2 = entries[j]
                if a1 != a2:
                    pair_key = tuple(sorted([n1, n2]))
                    if pair_key not in seen:
                        seen.add(pair_key)
                        parallel_tasks.append({
                            "week":       wk,
                            "task_a":     n1,
                            "assignee_a": a1,
                            "task_b":     n2,
                            "assignee_b": a2,
                        })

    # ── Step 6: availability — first free week after last task ────────────────
    availability = {}
    for dev, weeks in schedule.items():
        busy_weeks = sorted(weeks.keys())
        if not busy_weeks:
            availability[dev] = {"last_busy_week": None, "first_free_week": None}
            continue

        last_busy = busy_weeks[-1]
        # Next week after last busy
        last_dt   = datetime.date.fromisoformat(last_busy)
        first_free = (last_dt + datetime.timedelta(weeks=1)).isoformat()

        availability[dev] = {
            "last_busy_week": last_busy,
            "first_free_week": first_free,
            "total_tasks": len([t for t in tickets if t["assignee"] == dev]),
            "total_hrs_planned": sum(
                info["total_hrs"] for info in weeks.values()
            ),
        }

    # ── Step 7: assemble output ───────────────────────────────────────────────
    return {
        "meta": {
            "file":          filepath,
            "parsed_at":     datetime.datetime.now().isoformat(),
            "week_range":    {"start": week_dates[0], "end": week_dates[-1]},
            "total_weeks":   len(week_dates),
            "total_tasks":   len(tickets),
            "total_assignees": len(schedule),
        },
        "tickets":        tickets,
        "schedule":       schedule,
        "conflicts":      conflicts,
        "parallel_tasks": parallel_tasks,
        "availability":   availability,
        "warnings":       warnings,
    }


# ── CLI entry point ────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Parse AAI Ops roadmap Excel file.")
    parser.add_argument(
        "--file", "-f",
        default="roadmap_template_AAI_Ops.xlsx",
        help="Path to the roadmap .xlsx file"
    )
    parser.add_argument(
        "--section", "-s",
        choices=["meta","tickets","schedule","conflicts","parallel_tasks","availability","warnings"],
        default=None,
        help="Print only one section of the output"
    )
    args = parser.parse_args()

    result = parse(args.file)

    if args.section:
        print(json.dumps(result[args.section], indent=2, default=str))
    else:
        print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    main()