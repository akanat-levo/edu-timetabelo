import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type Entry, type Rules, type Sprint } from "../api";
import {
  DAY_NAMES,
  addDays,
  formatRange,
  isWeekend,
  toISODate,
  weekDays,
} from "../dates";
import EntryForm from "./EntryForm";

interface Props {
  rules: Rules;
  sprints: Sprint[];
  onDataChanged: () => void;
}

export default function WeekView({ rules, sprints, onDataChanged }: Props) {
  const [anchor, setAnchor] = useState(() => new Date());
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [formDate, setFormDate] = useState<string | null>(null);

  const days = useMemo(() => weekDays(anchor), [anchor]);
  const rangeStart = days[0];
  const rangeEnd = days[6];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listEntries({
        start: toISODate(rangeStart),
        end: toISODate(rangeEnd),
      });
      setEntries(data);
    } finally {
      setLoading(false);
    }
  }, [rangeStart, rangeEnd]);

  useEffect(() => {
    load();
  }, [load]);

  const byDate = useMemo(() => {
    const map: Record<string, Entry[]> = {};
    for (const e of entries) {
      (map[e.entry_date] ||= []).push(e);
    }
    return map;
  }, [entries]);

  async function toggle(entry: Entry) {
    const updated = await api.updateEntry(entry.id, { completed: !entry.completed });
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? updated : e)));
    onDataChanged();
  }

  async function remove(entry: Entry) {
    await api.deleteEntry(entry.id);
    setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    onDataChanged();
  }

  const todayISO = toISODate(new Date());

  return (
    <section className="week">
      <div className="week-header">
        <div>
          <h2>Week of {formatRange(rangeStart, rangeEnd)}</h2>
          <p className="muted small">
            Weekdays {rules.weekday.start}–{rules.weekday.end} · Weekends{" "}
            {rules.weekend.start}–{rules.weekend.end}
          </p>
        </div>
        <div className="nav">
          <button className="ghost" onClick={() => setAnchor((d) => addDays(d, -7))}>
            ← Prev
          </button>
          <button className="ghost" onClick={() => setAnchor(new Date())}>
            Today
          </button>
          <button className="ghost" onClick={() => setAnchor((d) => addDays(d, 7))}>
            Next →
          </button>
        </div>
      </div>

      <div className="grid">
        {days.map((day, i) => {
          const iso = toISODate(day);
          const dayEntries = (byDate[iso] || []).sort((a, b) =>
            a.start_time.localeCompare(b.start_time)
          );
          return (
            <div
              key={iso}
              className={`day ${isWeekend(day) ? "weekend" : ""} ${
                iso === todayISO ? "today" : ""
              }`}
            >
              <div className="day-head">
                <span className="day-name">{DAY_NAMES[i].slice(0, 3)}</span>
                <span className="day-num">{day.getDate()}</span>
              </div>

              <div className="day-body">
                {dayEntries.map((e) => (
                  <div key={e.id} className={`entry ${e.completed ? "done" : ""}`}>
                    <div className="entry-time">
                      {e.start_time}–{e.end_time}
                    </div>
                    <div className="entry-title">{e.title}</div>
                    <div className="entry-actions">
                      <button title="Toggle done" onClick={() => toggle(e)}>
                        {e.completed ? "↺" : "✓"}
                      </button>
                      <button title="Delete" onClick={() => remove(e)}>
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button className="add-btn" onClick={() => setFormDate(iso)}>
                + Task
              </button>
            </div>
          );
        })}
      </div>

      {loading && <p className="muted small">Loading…</p>}

      {formDate && (
        <EntryForm
          date={formDate}
          rules={rules}
          sprints={sprints}
          onCancel={() => setFormDate(null)}
          onCreated={(entry) => {
            setEntries((prev) => [...prev, entry]);
            setFormDate(null);
            onDataChanged();
          }}
        />
      )}
    </section>
  );
}
