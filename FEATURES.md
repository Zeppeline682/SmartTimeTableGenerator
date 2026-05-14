# ChronoLink - Feature Overview

## 🎯 Core Features Implemented

### 1. **Multi-View Architecture**
- **Dashboard (Admin View)**: Overview of groups, live timetables, statistics, and recent activity
- **Timetable Workspace**: Full-featured timetable editor with constraint engine
- **Faculty Dashboard**: Personal dashboard for professors to manage schedules and preferences
- **Optimization View**: Performance metrics, perfection score, and burnout heatmap
- **Integration Hub**: Import/Export management and external integrations
- **Live View**: Public read-only view for students with real-time updates

### 2. **Constraint Engine**
- ✅ Visual constraint builder with enable/disable toggles
- ✅ Priority levels (High, Medium, Low)
- ✅ Pre-built constraint types:
  - No back-to-back classes
  - Practicals after lectures
  - Max hours per day
  - Faculty preferences
  - Custom constraints
- ✅ Live constraint satisfaction tracking

### 3. **Conflict Detection & Resolution**
- ✅ Minecraft-style live conflict log
- ✅ Real-time conflict detection
- ✅ Severity levels (Error, Warning, Info)
- ✅ Auto-resolve suggestions
- ✅ Timestamp tracking

### 4. **Optimization Engine**
- ✅ Perfection Score (0-100)
- ✅ Multi-metric evaluation:
  - Constraint Satisfaction
  - Workload Balance
  - Student Satisfaction
  - Faculty Satisfaction
- ✅ Iteration history with version comparison
- ✅ Re-optimization capability

### 5. **Burnout Heatmap**
- ✅ Visual workload intensity analysis
- ✅ Color-coded heat levels (Green/Orange/Red)
- ✅ Per-day hour breakdown
- ✅ Student and faculty workload tracking
- ✅ Intensity classification (Low/Medium/High)

### 6. **Live Orchestration**
- ✅ "Go Live" functionality
- ✅ Shareable custom URLs for student access
- ✅ Real-time status indicators
- ✅ Live update timestamps
- ✅ Recent changes feed
- ✅ Notification subscription ready

### 7. **Faculty Features**
- ✅ Absence marking system
- ✅ Personal schedule view
- ✅ Scheduling preferences management
- ✅ Time slot preferences
- ✅ Maximum classes per day settings

### 8. **Integration Capabilities**
- ✅ Excel (.xlsx) import/export support
- ✅ JSON configuration export
- ✅ Google Drive integration UI (ready for connection)
- ✅ Project key generation for sharing
- ✅ Import history tracking
- ✅ File structure browsing

### 9. **User Experience**
- ✅ Dark/Light theme support (default: dark)
- ✅ Command menu (⌘K) for quick navigation
- ✅ Keyboard shortcuts support
- ✅ Toast notifications
- ✅ Loading states and skeletons
- ✅ Error boundary for graceful error handling
- ✅ Custom scrollbar styling
- ✅ Welcome banner for new users
- ✅ Responsive grid layout

### 10. **Design System**
- ✅ Linear-inspired high-density UI
- ✅ Vercel-style status indicators
- ✅ Resend-like minimalist aesthetics
- ✅ Inter font for crisp typography
- ✅ Custom color palette:
  - Accent Blue (#0070f3)
  - Accent Purple (#8b5cf6)
  - Status Green (#10b981)
  - Status Orange (#f59e0b)
  - Status Red (#ef4444)

## 🔧 Technical Stack

- **Framework**: React 18.3.1
- **Routing**: React Router 7.13.0 (Data mode)
- **Styling**: Tailwind CSS 4.1.12
- **Theming**: next-themes 0.4.6
- **UI Components**: Radix UI primitives
- **Command Menu**: cmdk
- **Icons**: Lucide React
- **Notifications**: Sonner
- **File Handling**: xlsx library
- **Animations**: Motion (Framer Motion)

## 📊 Data Models

### Group
- ID, Name, Course, Semester, Student Count
- Live status and shareable link

### Faculty
- ID, Name, Email, Department
- Subject assignments
- Absence tracking

### TimeSlot
- Day, Time range, Subject, Faculty, Room
- Type (Lecture/Practical/Tutorial)

### Constraint
- Type, Priority, Description, Rule
- Enabled/Disabled state

### Conflict
- Timestamp, Type, Severity
- Affected slots, Suggestions

### OptimizationScore
- Overall, Constraint satisfaction
- Workload balance, Satisfaction metrics

### WorkloadData
- Role (Student/Faculty)
- Hours per day, Total hours
- Intensity level

## 🎨 Color System

### Status Colors
- 🟢 Green: Live, Active, Success, Low intensity
- 🟠 Orange: Warning, Medium intensity
- 🔴 Red: Error, Absent, High intensity
- 🔵 Blue: Info, Primary actions
- 🟣 Purple: Secondary actions, Special features

## ⌨️ Keyboard Shortcuts

- `⌘ K` - Open command menu
- `⌘ S` - Save timetable
- `⌘ E` - Export
- `⌘ I` - Import
- `⌘ /` - Show shortcuts
- `ESC` - Close dialogs

## 🚀 Next Steps (Future Enhancements)

1. **Backend Integration**: Connect to Supabase for real-time data persistence
2. **WebSocket Support**: True real-time updates across clients
3. **Google Drive API**: Complete Drive integration
4. **Advanced Optimization**: ML-based schedule optimization
5. **Mobile App**: React Native version
6. **Collaboration**: Multi-user editing with conflict resolution
7. **Analytics**: Advanced reporting and insights
8. **Export Formats**: PDF, CSV, iCal support
9. **Email Notifications**: Automated alerts for changes
10. **Role Management**: Granular permission system
