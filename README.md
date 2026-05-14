# ChronoLink

Enterprise-grade, deterministic academic scheduling and resource optimization engine built for Symbiosis Skills and Professional University (SSPU). ChronoLink bridges complex CP-SAT mathematics (Google OR-Tools) with an intuitive, high-density React frontend.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Tailwind CSS 4, shadcn/ui, Vite 6 |
| Backend | FastAPI (Python), SQLModel, SQLite |
| Solver | Google OR-Tools (CP-SAT) |
| State | Centralized `useState`/`useReducer` in `TimetableWorkspace.tsx` |

## Getting Started

### Prerequisites
- **Node.js** ≥ 18
- **Python** ≥ 3.10
- **pip** packages: `fastapi`, `uvicorn`, `sqlmodel`, `ortools`

### Install Dependencies

```bash
# Frontend
npm install

# Backend (from project root)
python -m pip install fastapi uvicorn sqlmodel ortools
```

### Run Frontend

```bash
npm run dev
```
Opens at [http://localhost:5173](http://localhost:5173).

### Run Backend (Solver API)

```bash
# Windows
.venv\Scripts\python.exe -m uvicorn backend.app.main:app --reload --port 8000

# Linux/macOS
python -m uvicorn backend.app.main:app --reload --port 8000
```
API at [http://localhost:8000](http://localhost:8000). Interactive docs at `/docs`.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | `http://localhost:8000` | Backend API base URL |

## Routes

| Route | Component | Auth |
|-------|-----------|------|
| `/` | `LandingPage` | Public |
| `/dashboard` | `Dashboard` | Admin |
| `/workspace` | `TimetableWorkspace` | Admin |
| `/faculty` | `FacultyDashboard` | Faculty |
| `/faculty/schedule` | `FacultySchedulePage` | Faculty |
| `/faculty/preferences` | `FacultyPreferencesPage` | Faculty |
| `/student` | `StudentDashboard` | Student |
| `/student/timetable` | `StudentTimetablePage` | Student |
| `/rooms` | `RoomManagement` | Admin |
| `/settings` | `SettingsPage` | Admin |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/solve` | Run CP-SAT solver → 200 (sessions) or 422 (infeasible) |
| `POST` | `/schedules/{id}/publish` | Change schedule status to PUBLISHED |
| `GET` | `/schedules/published/student/{group_id}` | Filtered sessions for a student group |
| `GET` | `/schedules/published/teacher/{teacher_id}` | Filtered sessions for a faculty member |
| `GET/POST/PUT/DELETE` | `/teachers`, `/rooms`, `/student-groups`, `/subjects`, `/constraints` | Full CRUD |

## Scripts

| Script | Command |
|--------|---------|
| Dev server | `npm run dev` |
| Production build | `npm run build` |

## Architecture Reference

See [chronolink_master_doc.md](./chronolink_master_doc.md) for the complete PRD, data model, and UI specification.