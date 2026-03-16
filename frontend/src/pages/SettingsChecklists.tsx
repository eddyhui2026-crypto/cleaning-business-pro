import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Save, Loader2, Plus, Trash2, ClipboardList } from 'lucide-react';
import { apiUrl } from '../lib/api';
import { getAuthHeaders } from '../lib/auth';
import { useToast } from '../context/ToastContext';
import { AdminBottomNav } from '../components/AdminBottomNav';
import { DEFAULT_CHECKLIST_TEMPLATES } from '../config/checklistTemplates';
import type { ChecklistTemplate, ChecklistTask } from '../types/checklist';

export const SettingsChecklists = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(apiUrl('/api/companies/checklist-templates'), { headers });
      const data = await res.json().catch(() => ({}));
      const list = Array.isArray(data.templates) && data.templates.length > 0
        ? data.templates
        : DEFAULT_CHECKLIST_TEMPLATES.map((t) => ({ ...t, tasks: [...t.tasks] }));
      setTemplates(list);
      setExpandedId(list[0]?.id ?? null);
    } catch {
      setTemplates(DEFAULT_CHECKLIST_TEMPLATES.map((t) => ({ ...t, tasks: [...t.tasks] })));
    } finally {
      setLoading(false);
    }
  };

  const saveTemplates = async () => {
    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(apiUrl('/api/companies/checklist-templates'), {
        method: 'PUT',
        headers,
        body: JSON.stringify({ templates }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error((err as any).error || 'Save failed');
        return;
      }
      toast.success('Checklists saved. Staff will see these on jobs.');
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const updateTemplate = (templateId: string, updater: (t: ChecklistTemplate) => ChecklistTemplate) => {
    setTemplates((prev) =>
      prev.map((t) => (t.id === templateId ? updater(t) : t))
    );
  };

  const addTask = (templateId: string) => {
    updateTemplate(templateId, (t) => {
      const maxOrder = t.tasks.length ? Math.max(...t.tasks.map((x) => x.order)) : 0;
      const prefix = t.id.replace(/^default-/, '').slice(0, 2);
      const newTask: ChecklistTask = {
        id: `${prefix}-${Date.now()}`,
        label: 'New task',
        order: maxOrder + 1,
      };
      return { ...t, tasks: [...t.tasks, newTask] };
    });
  };

  const removeTask = (templateId: string, taskId: string) => {
    updateTemplate(templateId, (t) => ({
      ...t,
      tasks: t.tasks.filter((x) => x.id !== taskId),
    }));
  };

  const updateTaskLabel = (templateId: string, taskId: string, label: string) => {
    updateTemplate(templateId, (t) => ({
      ...t,
      tasks: t.tasks.map((x) => (x.id === taskId ? { ...x, label } : x)),
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-emerald-400" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-20">
      <header className="sticky top-0 z-10 bg-slate-950/95 border-b border-slate-800 px-4 py-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="p-2 rounded-xl hover:bg-slate-800 text-slate-300"
          aria-label="Back"
        >
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1 flex items-center gap-2">
          <ClipboardList size={22} className="text-emerald-400" />
          <h1 className="text-lg font-black uppercase tracking-tight">Edit checklists</h1>
        </div>
        <button
          type="button"
          onClick={saveTemplates}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-sm hover:bg-emerald-400 disabled:opacity-50"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          Save
        </button>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <p className="text-slate-400 text-sm">
          These are the task lists staff tick on each job. You can add or remove items per template.
        </p>

        {templates.map((template) => (
          <div
            key={template.id}
            className="bg-slate-900/80 rounded-[2rem] border border-slate-800 overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setExpandedId(expandedId === template.id ? null : template.id)}
              className="w-full px-6 py-4 flex items-center justify-between text-left"
            >
              <span className="font-black text-slate-50 uppercase tracking-tight">{template.name}</span>
              <span className="text-slate-400 text-sm">{template.tasks.length} items</span>
            </button>

            {expandedId === template.id && (
              <div className="px-6 pb-6 pt-0 space-y-3 border-t border-slate-800">
                {template.tasks
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((task, idx) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 bg-slate-950 rounded-xl px-4 py-3 border border-slate-800"
                    >
                      <span className="text-slate-500 text-xs font-bold w-6">{idx + 1}.</span>
                      <input
                        type="text"
                        value={task.label}
                        onChange={(e) => updateTaskLabel(template.id, task.id, e.target.value)}
                        className="flex-1 bg-transparent border-none py-1 text-slate-50 font-medium placeholder:text-slate-500 focus:outline-none focus:ring-0"
                        placeholder="Task description"
                      />
                      <button
                        type="button"
                        onClick={() => removeTask(template.id, task.id)}
                        className="p-2 rounded-lg text-slate-400 hover:bg-rose-500/20 hover:text-rose-300 transition-colors"
                        aria-label="Remove task"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                <button
                  type="button"
                  onClick={() => addTask(template.id)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-slate-600 text-slate-400 hover:border-emerald-500/50 hover:text-emerald-400 transition-colors font-medium"
                >
                  <Plus size={20} /> Add item
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      <AdminBottomNav />
    </div>
  );
};
