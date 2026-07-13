import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, type Sprint, type SprintProgress } from "../api";
import { toISODate } from "../dates";
import SprintDetailModal from "./SprintDetailModal";

interface Props {
  sprints: Sprint[];
  onChanged: () => void;
}

export default function SprintsPanel({ sprints, onChanged }: Props) {
  const [kind, setKind] = useState<"weekly" | "monthly">("weekly");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [anchor, setAnchor] = useState(toISODate(new Date()));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Record<number, SprintProgress>>({});
  const [openSprintId, setOpenSprintId] = useState<number | null>(null);

  const loadProgress = useCallback(async () => {
    const results = await Promise.all(
      sprints.map((s) => api.sprintProgress(s.id).catch(() => null))
    );
    const map: Record<number, SprintProgress> = {};
    results.forEach((p) => {
      if (p) map[p.sprint.id] = p;
    });
    setProgress(map);
  }, [sprints]);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.createSprintAuto({ kind, title, description, anchor_date: anchor });
      setTitle("");
      setDescription("");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create sprint.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    await api.deleteSprint(id);
    onChanged();
  }

  return (
    <aside className="sprints">
      <h2>Sprints</h2>

      <form onSubmit={create} className="stack sprint-form">
        <div className="row">
          <label>
            Type
            <select value={kind} onChange={(e) => setKind(e.target.value as "weekly" | "monthly")}>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
          <label>
            Any date inside
            <input type="date" value={anchor} onChange={(e) => setAnchor(e.target.value)} />
          </label>
        </div>
        <label>
          Goal / title
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
        {error && <div className="error">{error}</div>}
        <button className="primary" type="submit" disabled={busy}>
          {busy ? "Creating…" : "Add sprint"}
        </button>
      </form>

      <div className="sprint-list">
        {sprints.length === 0 && <p className="muted small">No sprints yet.</p>}
        {sprints.map((s) => {
          const p = progress[s.id];
          return (
            <div
              key={s.id}
              className={`sprint-card clickable ${s.kind}`}
              onClick={() => setOpenSprintId(s.id)}
              title="View day-by-day progress"
            >
              <div className="sprint-top">
                <span className="badge">{s.kind}</span>
                <button
                  className="link-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(s.id);
                  }}
                >
                  remove
                </button>
              </div>
              <div className="sprint-title">{s.title}</div>
              <div className="muted small">
                {s.start_date} → {s.end_date}
              </div>
              {p && (
                <div className="progress">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${p.percent}%` }} />
                  </div>
                  <span className="muted small">
                    {p.completed}/{p.total} done ({p.percent}%)
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {openSprintId != null && (
        <SprintDetailModal
          sprintId={openSprintId}
          onClose={() => setOpenSprintId(null)}
        />
      )}
    </aside>
  );
}
