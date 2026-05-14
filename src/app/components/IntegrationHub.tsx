import { FileSpreadsheet, Download, Upload, Database, FolderOpen, Share2, Key, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { downloadChronoLinkTemplate } from '../utils/excelTemplate';
import { exportTimetableAsXlsx, exportTimetableAsJson } from '../utils/excelExport';
import { ImportWizard } from './ImportWizard';

export function IntegrationHub() {
  const [wizardOpen, setWizardOpen] = useState(false);

  const handleExport = (format: 'xlsx' | 'json') => {
    try {
      if (format === 'xlsx') {
        exportTimetableAsXlsx();
        toast.success('Exported as Excel', { description: 'ChronoLink-Timetable-*.xlsx downloaded.' });
      } else {
        exportTimetableAsJson();
        toast.success('Exported as JSON', { description: 'ChronoLink-Config-*.json downloaded.' });
      }
    } catch (e) {
      toast.error('Export failed', { description: String(e) });
    }
  };

  const handleGenerateKey = () => {
    const key = 'CL-' + Math.random().toString(36).substring(2, 15).toUpperCase();
    navigator.clipboard.writeText(key);
    toast.success('Project key generated', {
      description: `${key} (copied to clipboard)`,
    });
  };

  const handleClearWorkspace = () => {
    if (!window.confirm('This will delete all imported data from the workspace. Are you sure?')) return;
    window.localStorage.removeItem('realtime-timetable.workspace.v2');
    window.localStorage.removeItem('realtime-faculty-registry');
    window.dispatchEvent(new CustomEvent('chronolink:import', { detail: {} }));
    toast.success('Workspace cleared', { description: 'All imported data has been removed. Import a new file to start fresh.' });
  };

  const handleDownloadTemplate = () => {
    try {
      downloadChronoLinkTemplate();
      toast.success('Template downloaded', {
        description: 'Open ChronoLink-Import-Template.xlsx and fill in your data.',
      });
    } catch (e) {
      toast.error('Download failed', { description: String(e) });
    }
  };

  return (
    <div className="min-h-full bg-background">
      <ImportWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />

      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="px-8 py-6">
          <h1 className="text-2xl font-semibold">Integration Hub</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage imports, exports, and external integrations
          </p>
        </div>
      </div>

      <div className="px-8 py-6">
        {/* ── Template Download ─────────────────────────────── */}
        <div className="bg-card border border-border rounded-lg p-6 mb-6"
          style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.04) 0%, rgba(139,92,246,0.04) 100%)' }}>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.15))', border: '1px solid rgba(139,92,246,0.2)' }}>
              <Sparkles className="w-6 h-6 text-violet-500" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">Start Here — Download Import Template</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Download this multi-sheet Excel file, fill it in, and upload it below.
                It has three separate sheets:{' '}
                <strong>Faculty</strong> (one row per professor),{' '}
                <strong>Rooms</strong> (one row per room, with optional unavailability windows), and{' '}
                <strong>Timetable</strong> (one row per session). Faculty Name and Room Name link the sections — no IDs needed.
              </p>
              <div className="flex items-center gap-3 mt-4 flex-wrap">
                <button
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-white text-sm hover:opacity-90 transition-opacity"
                  style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}
                >
                  <Download className="w-4 h-4" />
                  Download Template (.xlsx)
                </button>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {['3 sheets', 'Add rows freely', 'Cross-sheet validation'].map(tag => (
                    <span key={tag} className="flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Sheet preview chips */}
          <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                name:   'Faculty sheet',
                color:  '#8b5cf6',
                hint:   'Name · Email · Dept · Max/Day',
                detail: 'One row per professor.',
              },
              {
                name:   'Rooms sheet',
                color:  '#10b981',
                hint:   'Name · Capacity · Type · Unavailable',
                detail: 'Room constraints and availability.',
              },
              {
                name:   'Classes sheet',
                color:  '#f59e0b',
                hint:   'Name · Code · Size · Semester',
                detail: 'One row per class or student group.',
              },
              {
                name:   'Timetable sheet',
                color:  '#3b82f6',
                hint:   'Day · Start · End · Faculty · Room',
                detail: 'One row per scheduled session.',
              },
            ].map(sheet => (
              <div key={sheet.name}
                className="rounded-lg px-4 py-3 border"
                style={{ background: `${sheet.color}0d`, borderColor: `${sheet.color}30` }}>
                <div className="font-medium text-sm" style={{ color: sheet.color }}>{sheet.name}</div>
                <div className="text-muted-foreground text-xs mt-0.5">{sheet.hint}</div>
                <div className="text-muted-foreground text-xs mt-2 opacity-70">{sheet.detail}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Import/Export Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Import */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-lg bg-[var(--accent-blue)]/10 flex items-center justify-center">
                <Upload className="w-6 h-6" style={{ color: 'var(--accent-blue)' }} />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Import Data</h2>
                <p className="text-sm text-muted-foreground">Upload timetable files</p>
              </div>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => setWizardOpen(true)}
                className="w-full flex items-center justify-center gap-3 p-6 border-2 border-dashed border-border rounded-lg hover:bg-accent/30 hover:border-[#3b82f6]/40 transition-all group"
              >
                <FileSpreadsheet className="w-6 h-6 text-muted-foreground group-hover:text-[#3b82f6] transition-colors" />
                <div className="text-left">
                  <div className="font-medium group-hover:text-[#3b82f6] transition-colors">Open Import Wizard</div>
                  <div className="text-sm text-muted-foreground">Upload & preview before importing</div>
                </div>
              </button>

              <div className="text-xs text-muted-foreground">
                <p className="mb-2">The wizard will:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Parse your Excel or JSON file</li>
                  <li>Show a live preview of detected rows</li>
                  <li>Validate column names against the schema</li>
                  <li>Confirm before loading into ChronoLink</li>
                </ul>
              </div>

              <button
                onClick={handleClearWorkspace}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-red-500/30 text-red-400 text-sm hover:bg-red-500/10 transition-colors"
              >
                Clear workspace data
              </button>
            </div>
          </div>

          {/* Export */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-lg bg-[var(--status-green)]/10 flex items-center justify-center">
                <Download className="w-6 h-6" style={{ color: 'var(--status-green)' }} />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Export Data</h2>
                <p className="text-sm text-muted-foreground">Download current timetable data</p>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => handleExport('xlsx')}
                className="w-full flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-5 h-5" style={{ color: 'var(--status-green)' }} />
                  <div className="text-left">
                    <div className="font-medium">Excel Format</div>
                    <div className="text-sm text-muted-foreground">TimeSlots, Faculty, Groups, Rooms</div>
                  </div>
                </div>
                <Download className="w-4 h-4 text-muted-foreground" />
              </button>

              <button
                onClick={() => handleExport('json')}
                className="w-full flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Database className="w-5 h-5" style={{ color: 'var(--accent-blue)' }} />
                  <div className="text-left">
                    <div className="font-medium">JSON Format</div>
                    <div className="text-sm text-muted-foreground">Full configuration snapshot</div>
                  </div>
                </div>
                <Download className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>

        {/* Google Drive Integration */}
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-lg bg-[var(--accent-purple)]/10 flex items-center justify-center">
              <FolderOpen className="w-6 h-6" style={{ color: 'var(--accent-purple)' }} />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">Google Drive</h2>
              <p className="text-sm text-muted-foreground">Connect and manage Drive folders</p>
            </div>
            <button className="px-4 py-2 bg-[var(--accent-blue)] text-white rounded-lg hover:opacity-90 transition-opacity">
              Connect Drive
            </button>
          </div>

          <div className="border border-border rounded-lg p-4 bg-muted/30">
            <div className="text-sm text-muted-foreground">
              No Google Drive connected. Connect your account to:
            </div>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground list-disc list-inside">
              <li>View and browse folder structures</li>
              <li>Store timetable iterations temporarily</li>
              <li>Manage file-level permissions</li>
              <li>Sync data across devices</li>
            </ul>
          </div>
        </div>

        {/* Project Keys */}
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-lg bg-[var(--status-orange)]/10 flex items-center justify-center">
              <Key className="w-6 h-6" style={{ color: 'var(--status-orange)' }} />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">Project Keys</h2>
              <p className="text-sm text-muted-foreground">Share temporary database states</p>
            </div>
            <button
              onClick={handleGenerateKey}
              className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors"
            >
              <Share2 className="w-4 h-4" />
              Generate Key
            </button>
          </div>

          <div className="space-y-3">
            {[
              { key: 'CL-A7X9K2M', created: '2 days ago', uses: 3 },
              { key: 'CL-B3N8P5Q', created: '1 week ago', uses: 12 },
            ].map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between p-4 border border-border rounded-lg"
              >
                <div>
                  <code className="font-mono font-medium">{item.key}</code>
                  <div className="text-sm text-muted-foreground mt-1">
                    Created {item.created} • {item.uses} uses
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-accent transition-colors">
                    Copy
                  </button>
                  <button className="px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 p-4 border border-border rounded-lg bg-muted/30">
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> Project keys allow colleagues to access temporary snapshots of your
              timetable database. Keys expire after 30 days or can be manually revoked.
            </p>
          </div>
        </div>

        {/* Import History */}
        <div className="mt-6 bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Import History</h2>
          <div className="space-y-2">
            {[
              { file: 'CS-Timetable-2024.xlsx', date: 'Apr 17, 2026 10:24 AM', status: 'Success' },
              { file: 'Faculty-Preferences.json', date: 'Apr 15, 2026 3:45 PM', status: 'Success' },
              { file: 'Room-Allocation.xlsx', date: 'Apr 14, 2026 2:20 PM', status: 'Failed' },
            ].map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 border border-border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{item.file}</div>
                    <div className="text-sm text-muted-foreground">{item.date}</div>
                  </div>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs ${
                    item.status === 'Success'
                      ? 'bg-[var(--status-green)]/10 text-[var(--status-green)]'
                      : 'bg-[var(--status-red)]/10 text-[var(--status-red)]'
                  }`}
                >
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

