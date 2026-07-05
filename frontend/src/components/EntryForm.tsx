import { useMemo, useState, type FormEvent } from "react";
import { api, type Entry, type Rules, type Sprint } from "../api";
import { isWeekend, parseISODate } from "../dates";

interface Props {
  date: string; // YYYY-MM-DD
  rules: Rules;
  sprints: Sprint[];
  onCreated: (entry: Entry) => void;
  onCancel: () => void;
}

export default function EntryForm({ date, rules, sprints, onCreated, onCancel }: Props) {
  const weekend = isWeekend(parseISODate(date));
  const window = weekend ? rules.weekend : rules.weekday;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState(window.start);
  const [endTime, setEndTime] = useState(window.end);
  const [sprintId, setSprintId] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const hint = useMemo(
    () =>
      `${weekend ? "Weekend" : "Weekday"}: allowed ${window.start}–${window.end}`,
    [weekend, window]
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
      const entry = await api.createEntry({
        title,
        description,
        entry_date: date,
        start_time: startTime,
        end_time: endTime,
        sprint_id: sprintId === "" ? null : Number(sprintId),
      });
      onCreated(entry);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create entry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>New task · {date}</h3>
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
              <input
                type="time"
                value={startTime}
                min={window.start}
                max={window.end}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </label>
            <label>
              End
              <input
                type="time"
                value={endTime}
                min={window.start}
                max={window.end}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </label>
          </div>
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
              {busy ? "Saving…" : "Add task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
