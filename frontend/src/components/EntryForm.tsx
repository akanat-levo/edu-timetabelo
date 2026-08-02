import { useMemo, useState, type FormEvent } from "react";
import { api, type Entry, type Rules, type Sprint, type UserPublic } from "../api";
import { isWeekend, parseISODate } from "../dates";
import TimePicker from "./TimePicker";

interface Props {
  date: string; // YYYY-MM-DD
  rules: Rules;
  sprints: Sprint[];
  users: UserPublic[];
  currentUserId: number;
  entry?: Entry; // when present, the form edits this task instead of creating
  onSaved: (entry: Entry) => void;
  onCancel: () => void;
}

export default function EntryForm({
  date,
  rules,
  sprints,
  users,
  currentUserId,
  entry,
  onSaved,
  onCancel,
}: Props) {
  const editing = !!entry;
  const weekend = isWeekend(parseISODate(date));
  const window = weekend ? rules.weekend : rules.weekday;
  const fullDay = window.start === "00:00" && window.end === "23:59";

  const [title, setTitle] = useState(entry?.title ?? "");
  const [description, setDescription] = useState(entry?.description ?? "");
  const [startTime, setStartTime] = useState(
    entry?.start_time ?? (fullDay ? "09:00" : window.start)
  );
  const [endTime, setEndTime] = useState(
    entry?.end_time ?? (fullDay ? "10:00" : window.end)
  );
  const [sprintId, setSprintId] = useState<number | "">(entry?.sprint_id ?? "");
  const [assigneeId, setAssigneeId] = useState<number>(
    entry?.assignee_id ?? currentUserId
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const hint = useMemo(
    () =>
      fullDay
        ? "Any time of day"
        : `${weekend ? "Weekend" : "Weekday"}: allowed ${window.start}–${window.end}`,
    [fullDay, weekend, window]
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // Client-side guard mirroring the backend rule for quick feedback.
    if (startTime < window.start || endTime > window.end) {
      setError(`Time must be within ${window.start}–${window.end} for this day.`);
      return;
    }
    if (startTime >= endTime) {
      setError("Start time must be earlier than end time.");
      return;
    }

    setBusy(true);
    try {
      const sprint_id = sprintId === "" ? null : Number(sprintId);
      let saved: Entry;
      if (editing && entry) {
        saved = await api.updateEntry(entry.id, {
          title,
          description,
          start_time: startTime,
          end_time: endTime,
          sprint_id,
          assignee_id: assigneeId,
        });
      } else {
        saved = await api.createEntry({
          title,
          description,
          entry_date: date,
          start_time: startTime,
          end_time: endTime,
          sprint_id,
          assignee_id: assigneeId,
        });
      }
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save task.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>
          {editing ? "Edit task" : "New task"} · {date}
        </h3>
        <p className="muted small">{hint}</p>

        <form onSubmit={onSubmit} className="stack">
          <label>
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label>
            Notes
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </label>
          <div className="row">
            <label>
              Start
              <TimePicker value={startTime} onChange={setStartTime} />
            </label>
            <label>
              End
              <TimePicker value={endTime} onChange={setEndTime} />
            </label>
          </div>
          <label>
            Assign to
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(Number(e.target.value))}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.display_name || u.email}
                  {u.id === currentUserId ? " (me)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sprint (optional)
            <select
              value={sprintId}
              onChange={(e) =>
                setSprintId(e.target.value === "" ? "" : Number(e.target.value))
              }
            >
              <option value="">— none —</option>
              {sprints.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.kind} · {s.title}
                </option>
              ))}
            </select>
          </label>

          {error && <div className="error">{error}</div>}

          <div className="row end">
            <button type="button" className="ghost" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="primary" disabled={busy}>
              {busy ? "Saving…" : editing ? "Save changes" : "Add task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
