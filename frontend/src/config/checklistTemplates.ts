/**
 * Default checklist templates (6–10 tasks each).
 * Used as seed/fallback until company-specific templates exist in backend.
 */
import type { ChecklistTemplate, JobChecklistSnapshot } from '../types/checklist';

const id = (prefix: string, i: number) => `${prefix}-${i}`;

export const DEFAULT_CHECKLIST_TEMPLATES: ChecklistTemplate[] = [
  {
    id: 'default-standard-clean',
    name: 'Standard Clean',
    is_default: true,
    tasks: [
      { id: id('sc', 1), label: 'Vacuum all floors', order: 1 },
      { id: id('sc', 2), label: 'Mop hard floors', order: 2 },
      { id: id('sc', 3), label: 'Dust surfaces and shelves', order: 3 },
      { id: id('sc', 4), label: 'Clean kitchen worktops and sink', order: 4 },
      { id: id('sc', 5), label: 'Clean bathroom basin and toilet', order: 5 },
      { id: id('sc', 6), label: 'Empty bins and replace bags', order: 6 },
      { id: id('sc', 7), label: 'Wipe door handles and switches', order: 7 },
      { id: id('sc', 8), label: 'Tidy and make beds (if requested)', order: 8 },
    ],
  },
  {
    id: 'default-office-clean',
    name: 'Office Clean',
    is_default: true,
    tasks: [
      { id: id('oc', 1), label: 'Vacuum carpets and mop hard floors', order: 1 },
      { id: id('oc', 2), label: 'Empty all bins and replace liners', order: 2 },
      { id: id('oc', 3), label: 'Wipe desks and work surfaces', order: 3 },
      { id: id('oc', 4), label: 'Clean kitchen/break room and appliances', order: 4 },
      { id: id('oc', 5), label: 'Clean and restock toilets and hand soap', order: 5 },
      { id: id('oc', 6), label: 'Dust monitors, keyboards and phone areas', order: 6 },
      { id: id('oc', 7), label: 'Wipe door handles and light switches', order: 7 },
      { id: id('oc', 8), label: 'Check and refill paper towels / tissues', order: 8 },
    ],
  },
  {
    id: 'default-deep-clean',
    name: 'Deep Clean',
    is_default: true,
    tasks: [
      { id: id('dc', 1), label: 'Vacuum and mop all floors (including under furniture)', order: 1 },
      { id: id('dc', 2), label: 'Dust all surfaces, skirting boards and high areas', order: 2 },
      { id: id('dc', 3), label: 'Clean inside kitchen cupboards and fridge', order: 3 },
      { id: id('dc', 4), label: 'Deep clean oven and hob', order: 4 },
      { id: id('dc', 5), label: 'Descale and clean bathroom (taps, shower, toilet)', order: 5 },
      { id: id('dc', 6), label: 'Clean windows (interior) and sills', order: 6 },
      { id: id('dc', 7), label: 'Clean light fittings and vents', order: 7 },
      { id: id('dc', 8), label: 'Wipe all doors, handles and switches', order: 8 },
      { id: id('dc', 9), label: 'Empty and wipe bins; replace bags', order: 9 },
      { id: id('dc', 10), label: 'Final walk-through and touch-ups', order: 10 },
    ],
  },
  {
    id: 'default-end-of-tenancy',
    name: 'End of Tenancy',
    is_default: true,
    tasks: [
      { id: id('eot', 1), label: 'Vacuum and mop all rooms', order: 1 },
      { id: id('eot', 2), label: 'Clean inside all cupboards and drawers', order: 2 },
      { id: id('eot', 3), label: 'Clean oven, hob, extractor and fridge', order: 3 },
      { id: id('eot', 4), label: 'Descale and clean all bathrooms', order: 4 },
      { id: id('eot', 5), label: 'Clean windows (interior) and sills', order: 5 },
      { id: id('eot', 6), label: 'Dust skirting boards, doors and frames', order: 6 },
      { id: id('eot', 7), label: 'Remove cobwebs and clean light fittings', order: 7 },
      { id: id('eot', 8), label: 'Wipe switches, handles and marks on walls', order: 8 },
      { id: id('eot', 9), label: 'Empty and clean all bins', order: 9 },
      { id: id('eot', 10), label: 'Final inspection and lock-up check', order: 10 },
    ],
  },
];

/** Build job checklist snapshot from a template (all unchecked). */
export function snapshotFromTemplate(template: ChecklistTemplate): JobChecklistSnapshot {
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
