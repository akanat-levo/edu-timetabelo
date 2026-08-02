import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type Entry, type Rules, type Sprint, type UserPublic } from "../api";
import {
  DAY_NAMES,
  addDays,
  formatRange,
  formatTime12,
  isWeekend,
  parseISODate,
  toISODate,
  weekDays,
} from "../dates";
import CopyDayModal, { type DayOption } from "./CopyDayModal";
import EntryForm from "./EntryForm";

interface Props {
  rules: Rules;
  sprints: Sprint[];
  users: UserPublic[];
  currentUserId: number;
  onDataChanged: () => void;
}

export default function WeekView({
  rules,
  sprints,
  users,
  currentUserId,
  onDataChanged,
}: Props) {
  const [anchor, setAnchor] = useState(() => new Date());
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [formDate, setFormDate] = useState<string | null>(null);
  const [editEntry, setEditEntry] = useState<Entry | null>(null);
  const [copyFrom, setCopyFrom] = useState<string | null>(null);
  const [personFilter, setPersonFilter] = useState<number | "all">("all");

  const days = useMemo(() => weekDays(anchor), [anchor]);
  const rangeStart = days[0];
  const rangeEnd = days[6];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listEntries({
        start: toISODate(rangeStart),
        end: toISODate(rangeEnd),
        assignee_id: personFilter === "all" ? undefined : personFilter,
      });
      setEntries(data);
    } finally {
      setLoading(false);
    }
  }, [rangeStart, rangeEnd, personFilter]);

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

  // Global "+ Task" opens the form on today if it's in view, else the week's Monday.
  const defaultAddDate = (() => {
    const t = new Date();
    return t >= rangeStart && t <= rangeEnd ? toISODate(t) : toISODate(rangeStart);
  })();

  return (
    <section className="week">
      <div className="week-header">
        <div>
          <h2>Week of {formatRange(rangeStart, rangeEnd)}</h2>
          <p className="muted small">Schedule tasks any time, any day</p>
        </div>

        <div className="toolbar">
          <div className="filter-pill" title="Filter by assignee">
            <svg viewBox="0 0 24 24" className="icon" aria-hidden="true">
              <path d="M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-8 1a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm0 2c-2.3 0-6 1.2-6 3.5V20h7v-2.5c0-.9.4-1.7 1-2.4A9.6 9.6 0 0 0 8 14Zm8 0c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4Z" />
            </svg>
            <select
              className="person-filter"
              value={personFilter}
              onChange={(e) =>
                setPersonFilter(
                  e.target.value === "all" ? "all" : Number(e.target.value)
                )
              }
            >
              <option value="all">Everyone</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.display_name || u.email}
                  {u.id === currentUserId ? " (me)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="seg">
            <button
              onClick={() => setAnchor((d) => addDays(d, -7))}
              title="Previous week"
              aria-label="Previous week"
            >
              ‹
            </button>
            <button onClick={() => setAnchor(new Date())} className="seg-mid">
              Today
            </button>
            <button
              onClick={() => setAnchor((d) => addDays(d, 7))}
              title="Next week"
              aria-label="Next week"
            >
              ›
            </button>
          </div>

          <button
            className="add-task-btn"
            onClick={() => setFormDate(defaultAddDate)}
          >
            <svg viewBox="0 0 24 24" className="icon" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Task
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
                <div className="day-head-right">
                  {dayEntries.length > 0 && (
                    <button
                      className="copy-day-btn"
                      title="Copy this day's tasks to other days"
                      onClick={() => setCopyFrom(iso)}
                    >
                      <svg viewBox="0 0 24 24" className="icon" aria-hidden="true">
                        <rect x="9" y="9" width="11" height="11" rx="2" />
                        <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                      </svg>
                    </button>
                  )}
                  <span className="day-num">{day.getDate()}</span>
                </div>
              </div>

              <div className="day-body">
                {dayEntries.map((e) => {
                  const canModify =
                    e.owner_id === currentUserId || e.assignee_id === currentUserId;
                  return (
                    <div
                      key={e.id}
                      className={`entry ${e.completed ? "done" : ""} ${
                        canModify ? "editable" : ""
                      }`}
                      onClick={canModify ? () => setEditEntry(e) : undefined}
                      title={canModify ? "Click to edit" : undefined}
                    >
                      <div className="entry-time">
                        {formatTime12(e.start_time)} – {formatTime12(e.end_time)}
                      </div>
                      <div className="entry-title">{e.title}</div>
                      {e.assignee_name && (
                        <div className="entry-assignee" title="Assigned to">
                          <span className="avatar">
                            {e.assignee_name.charAt(0).toUpperCase()}
                          </span>
                          {e.assignee_name}
                        </div>
                      )}
                      {canModify && (
                        <div className="entry-actions">
                          <button
                            title="Toggle done"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              toggle(e);
                            }}
                          >
                            {e.completed ? "↺" : "✓"}
                          </button>
                          <button
                            title="Delete"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              remove(e);
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button className="add-btn" onClick={() => setFormDate(iso)}>
                + Task
              </button>
            </div>
          );
        })}
      </div>

      {loading && <p className="muted small">Loading…</p>}

      {(formDate || editEntry) && (
        <EntryForm
          date={editEntry ? editEntry.entry_date : formDate!}
          entry={editEntry ?? undefined}
          rules={rules}
          sprints={sprints}
          users={users}
          currentUserId={currentUserId}
          onCancel={() => {
            setFormDate(null);
            setEditEntry(null);
          }}
          onSaved={(saved) => {
            setEntries((prev) => {
              const exists = prev.some((e) => e.id === saved.id);
              return exists
                ? prev.map((e) => (e.id === saved.id ? saved : e))
                : [...prev, saved];
            });
            setFormDate(null);
            setEditEntry(null);
            onDataChanged();
          }}
        />
      )}

      {copyFrom && (
        <CopyDayModal
          sourceDate={copyFrom}
          sourceLabel={
            DAY_NAMES[(parseISODate(copyFrom).getDay() + 6) % 7]
          }
          taskCount={(byDate[copyFrom] || []).length}
          dayOptions={days.map(
            (d, i): DayOption => ({
              iso: toISODate(d),
              label: DAY_NAMES[i],
              num: d.getDate(),
            })
          )}
          onCancel={() => setCopyFrom(null)}
          onDone={() => {
            setCopyFrom(null);
            load();
            onDataChanged();
          }}
        />
      )}
    </section>
  );
}
