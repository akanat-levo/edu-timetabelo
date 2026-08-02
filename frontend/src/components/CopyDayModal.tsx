import { useState } from "react";
import { api } from "../api";

export interface DayOption {
  iso: string;
  label: string; // e.g. "Monday"
  num: number; // day of month
}

interface Props {
  sourceDate: string; // iso
  sourceLabel: string;
  taskCount: number;
  dayOptions: DayOption[]; // all 7 days of the visible week
  onDone: () => void;
  onCancel: () => void;
}

export default function CopyDayModal({
  sourceDate,
  sourceLabel,
  taskCount,
  dayOptions,
  onDone,
  onCancel,
}: Props) {
  const targets = dayOptions.filter((d) => d.iso !== sourceDate);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allSelected = selected.size === targets.length && targets.length > 0;

  function toggle(iso: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(iso) ? next.delete(iso) : next.add(iso);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(targets.map((d) => d.iso)));
  }

  async function copy() {
    if (selected.size === 0) {
      setError("Pick at least one day to copy to.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.copyDay(sourceDate, [...selected]);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not copy tasks.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Copy {sourceLabel}'s tasks</h3>
        <p className="muted small">
          {taskCount} task{taskCount === 1 ? "" : "s"} will be copied to the days
          you pick.
        </p>

        <div className="stack">
          <button type="button" className="ghost" onClick={toggleAll}>
            {allSelected ? "Clear all" : "Select all days"}
          </button>

          <div className="copy-day-grid">
            {targets.map((d) => (
              <label key={d.iso} className="copy-day-option">
                <input
                  type="checkbox"
                  checked={selected.has(d.iso)}
                  onChange={() => toggle(d.iso)}
                />
                <span>
                  {d.label.slice(0, 3)} {d.num}
                </span>
              </label>
            ))}
          </div>

          {error && <div className="error">{error}</div>}

          <div className="row end">
            <button type="button" className="ghost" onClick={onCancel}>
              Cancel
            </button>
            <button
              type="button"
              className="primary"
              onClick={copy}
              disabled={busy}
            >
              {busy
                ? "Copying…"
                : `Copy to ${selected.size || "0"} day${
                    selected.size === 1 ? "" : "s"
                  }`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
