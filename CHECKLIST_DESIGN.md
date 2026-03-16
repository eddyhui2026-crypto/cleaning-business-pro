# Checklist System — Design & Spec

Minimal checklist system for cleaners: templates (admin), tick tasks (staff), show completed checklist on Service Report (owner + customer).

---

## 1. Checklist Templates (4 defaults)

### Standard Clean
| # | Task |
|---|------|
| 1 | Vacuum all floors |
| 2 | Mop hard floors |
| 3 | Dust surfaces and shelves |
| 4 | Clean kitchen worktops and sink |
| 5 | Clean bathroom basin and toilet |
| 6 | Empty bins and replace bags |
| 7 | Wipe door handles and switches |
| 8 | Tidy and make beds (if requested) |

### Office Clean
| # | Task |
|---|------|
| 1 | Vacuum carpets and mop hard floors |
| 2 | Empty all bins and replace liners |
| 3 | Wipe desks and work surfaces |
| 4 | Clean kitchen/break room and appliances |
| 5 | Clean and restock toilets and hand soap |
| 6 | Dust monitors, keyboards and phone areas |
| 7 | Wipe door handles and light switches |
| 8 | Check and refill paper towels / tissues |

### Deep Clean
| # | Task |
|---|------|
| 1 | Vacuum and mop all floors (including under furniture) |
| 2 | Dust all surfaces, skirting boards and high areas |
| 3 | Clean inside kitchen cupboards and fridge |
| 4 | Deep clean oven and hob |
| 5 | Descale and clean bathroom (taps, shower, toilet) |
| 6 | Clean windows (interior) and sills |
| 7 | Clean light fittings and vents |
| 8 | Wipe all doors, handles and switches |
| 9 | Empty and wipe bins; replace bags |
| 10 | Final walk-through and touch-ups |

### End of Tenancy
| # | Task |
|---|------|
| 1 | Vacuum and mop all rooms |
| 2 | Clean inside all cupboards and drawers |
| 3 | Clean oven, hob, extractor and fridge |
| 4 | Descale and clean all bathrooms |
| 5 | Clean windows (interior) and sills |
| 6 | Dust skirting boards, doors and frames |
| 7 | Remove cobwebs and clean light fittings |
| 8 | Wipe switches, handles and marks on walls |
| 9 | Empty and clean all bins |
| 10 | Final inspection and lock-up check |

---

## 2. Data Structure

### Checklist template (admin-managed)
```ts
interface ChecklistTask {
  id: string;           // uuid or short id
  label: string;         // e.g. "Vacuum all floors"
  order: number;         // display order
}

interface ChecklistTemplate {
  id: string;
  company_id: string;
  name: string;          // e.g. "Standard Clean"
  tasks: ChecklistTask[];
  is_default?: boolean;  // true = built-in, read-only name; false = custom
  created_at?: string;
  updated_at?: string;
}
```

### Job checklist snapshot (stored on the job when staff complete)
Stored in `job.details.checklist` so the Service Report shows exactly what was done for that job.

```ts
interface JobChecklistTask {
  id: string;
  label: string;
  order: number;
  completed: boolean;
  completed_at?: string; // ISO optional, for audit
}

interface JobChecklistSnapshot {
  template_name: string;   // e.g. "Standard Clean"
  template_id?: string;    // optional link back to template
  tasks: JobChecklistTask[];
  completed_at?: string;   // when last task was ticked (or job completed)
}
```

### Where it lives
- **Templates:** Table `checklist_templates` (company_id, name, tasks JSONB, is_default). Seed with 4 default templates per company (or use global defaults and allow override).
- **Per job:** `jobs.details` JSON. Add:
  - `details.checklist` = `JobChecklistSnapshot` (filled when job is created from a template, updated when staff tick; written in full when job completed so Report is immutable).
  - Optionally `details.checklist_template_id` when job is created so staff see the same template.

---

## 3. Admin UI Concept

**Goal:** Edit templates, add/remove tasks, create custom templates. Simple list + edit screen.

- **List screen (e.g. Settings → Checklists or Admin → Checklists)**
  - List all templates: default 4 + custom.
  - Each row: template name, task count, “Edit” button.
  - One button: “Create custom template” (name + start from empty or copy from existing).

- **Edit template screen**
  - Title: template name (editable for custom; display-only for default with note “Default template – you can add or remove tasks”).
  - **Task list:** Each row = one task: checkbox (for reorder later if needed), text input (label), “Remove” (except if only one task). Drag handle optional for reorder.
  - Buttons: “Add task” (appends new row with placeholder “New task”), “Save”, “Cancel”.
  - No complex fields – just task label and order. Mobile-friendly: big tap targets, one column.

- **Create custom**
  - Modal or new page: “Template name” + “Start from: [Empty / Standard Clean / Office Clean / …]”. Then same task list as Edit.

Keep it minimal: no sub-tasks, no timers, no photos per task.

---

## 4. Staff UI Concept

**Goal:** See the checklist on the job, tick tasks, see progress. Mobile-first.

- **Where:** On the existing job detail screen (e.g. Staff Job View), below job info and START/FINISH, a **Checklist** section.

- **When visible:** Always when `job.details.checklist` exists (i.e. job was assigned a template). If no checklist, hide section.

- **Layout (mobile):**
  - Section title: “Checklist” + progress: e.g. “3/8 done”.
  - Progress bar: thin bar, filled proportion (e.g. 3/8 = 37.5%).
  - List of tasks. Each row:
    - Large tap area (whole row or a big checkbox).
    - Unchecked: circle or empty checkbox + task label.
    - Checked: tick (✓) + task label (e.g. muted or strikethrough).
  - Tap toggles completed. Save immediately (PATCH job details or dedicated endpoint) so no “Save” button needed.

- **Behaviour:**
  - Only show checklist when job is **in progress** or **completed** (optional: show in pending as “Checklist will appear when you start”).
  - When staff marks “Finish” (job completed), optionally auto-save final checklist snapshot to `job.details.checklist` (if not already saved) so the Service Report has a fixed snapshot.

- **Simplicity:** No timers, no notes per task, no photos per task. Just tick and progress.

---

## 5. Service Report — Where to Show the Checklist

**Requirement:** After the employee completes the job, the job’s checklist should appear on the Service Report in a suitable place for the owner and customer to see.

**Recommended position:** **After “Service Summary” (notes) and before “Visual Verification” (before/after photos).**

Order of sections:
1. Customer information + completion date  
2. **Service Summary** (notes)  
3. **Checklist completed** ← new section  
4. Visual Verification (before/after photos)  
5. Footer / company info  

**Content of the section:**
- Heading: e.g. “Tasks completed” or “Checklist”.
- Subheading: template name (e.g. “Standard Clean”).
- List of tasks with a tick (✓) and label; optionally grey out or strikethrough not-done if you ever support partial (for now: all tasks shown, completed = ✓).

**PDF:** Include the same “Checklist completed” block in the report PDF (same position: after summary, before photos) so downloaded/printed reports also show it.

This keeps the report clear: what was agreed (notes), what was done (checklist), what it looked like (photos).

---

## 6. Implementation Notes

- **Defaults:** Ship the 4 templates as seed data or in-app constant; admin can copy to create company templates or edit copies. Defaults can be read-only by name, but tasks editable (add/remove/reorder).
- **Creating a job:** When admin creates a job, they pick a “Checklist template” (dropdown). Set `details.checklist` to `snapshotFromTemplate(selectedTemplate)` (see `frontend/src/config/checklistTemplates.ts`). Staff then see and tick that checklist; the snapshot is stored on the job and shown on the Service Report.
- **Completing the job:** On “Finish”, backend or frontend writes the current `details.checklist` (with completed flags and optional `completed_at`) so the Service Report and PDF use this snapshot.
- **Mobile:** Use large touch targets (min 44px), one column, no hover-only actions. Avoid complex features.
