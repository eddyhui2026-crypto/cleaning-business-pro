/**
 * Checklist system: templates (admin) and job snapshot (staff ticks, shown on Service Report).
 */

export interface ChecklistTask {
  id: string;
  label: string;
  order: number;
}

export interface ChecklistTemplate {
  id: string;
  company_id?: string;
  name: string;
  tasks: ChecklistTask[];
  is_default?: boolean;
}

/** Snapshot stored on job.details.checklist — what staff see and tick; shown on Service Report. */
export interface JobChecklistTask {
  id: string;
  label: string;
  order: number;
  completed: boolean;
  completed_at?: string;
}

export interface JobChecklistSnapshot {
  template_name: string;
  template_id?: string;
  tasks: JobChecklistTask[];
  completed_at?: string;
}

export function getChecklistProgress(snapshot: JobChecklistSnapshot): { done: number; total: number } {
  const total = snapshot.tasks?.length ?? 0;
  const done = snapshot.tasks?.filter((t) => t.completed).length ?? 0;
  return { done, total };
}
