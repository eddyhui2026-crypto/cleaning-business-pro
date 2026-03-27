/**
 * Job checklist snapshots live in job.details.checklist.
 * Some jobs are created without a snapshot (e.g. quick create modal). Staff UI
 * only renders when details.checklist.tasks is non-empty — merge company default here.
 */

export interface JobChecklistSnapshot {
  template_name: string;
  template_id?: string;
  tasks: Array<{
    id: string;
    label: string;
    order: number;
    completed: boolean;
    completed_at?: string;
  }>;
}

export function snapshotFromTemplate(template: {
  id: string;
  name: string;
  tasks: Array<{ id: string; label: string; order: number }>;
}): JobChecklistSnapshot {
  return {
    template_name: template.name,
    template_id: template.id,
    tasks: template.tasks.map((t) => ({
      id: t.id,
      label: t.label,
      order: t.order,
      completed: false,
    })),
  };
}

/** First template marked is_default, else first template with tasks. */
export function pickDefaultChecklistTemplate(templates: unknown): {
  id: string;
  name: string;
  tasks: Array<{ id: string; label: string; order: number }>;
} | null {
  if (!Array.isArray(templates) || templates.length === 0) return null;
  const withTasks = templates.filter(
    (t: any) => t && typeof t === 'object' && Array.isArray(t.tasks) && t.tasks.length > 0,
  ) as Array<{ id: string; name: string; is_default?: boolean; tasks: Array<{ id: string; label: string; order: number }> }>;
  if (withTasks.length === 0) return null;
  const explicit = withTasks.find((t) => t.is_default === true);
  const chosen = explicit ?? withTasks[0];
  return {
    id: String(chosen.id),
    name: String(chosen.name ?? 'Checklist'),
    tasks: chosen.tasks.map((task, i) => ({
      id: String(task.id ?? `task-${i}`),
      label: String(task.label ?? ''),
      order: typeof task.order === 'number' ? task.order : i,
    })),
  };
}

function jobHasChecklistTasks(job: any): boolean {
  const n = job?.details?.checklist?.tasks?.length;
  return typeof n === 'number' && n > 0;
}

export function mergeDefaultChecklistIntoJob(job: any, snapshot: JobChecklistSnapshot | null): any {
  if (!job || !snapshot || jobHasChecklistTasks(job)) return job;
  const prevDetails = job.details && typeof job.details === 'object' ? job.details : {};
  return {
    ...job,
    details: { ...prevDetails, checklist: snapshot },
  };
}
