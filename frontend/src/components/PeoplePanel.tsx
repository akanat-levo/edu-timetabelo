import { useCallback, useEffect, useState } from "react";
import { api, type UserProgress } from "../api";

interface Props {
  currentUserId: number;
  tick: number; // bump to force a refresh
}

export default function PeoplePanel({ currentUserId, tick }: Props) {
  const [rows, setRows] = useState<UserProgress[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await api.usersProgress());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, tick]);

  return (
    <aside className="people">
      <h2>People</h2>
      {loading && rows.length === 0 && <p className="muted small">Loading…</p>}
      <div className="people-list">
        {rows.map((r) => (
          <div
            key={r.user.id}
            className={`person-card ${r.user.id === currentUserId ? "me" : ""}`}
          >
            <div className="person-head">
              <span className="avatar">
                {(r.user.display_name || r.user.email).charAt(0).toUpperCase()}
              </span>
              <div className="person-meta">
                <div className="person-name">
                  {r.user.display_name || r.user.email}
                  {r.user.id === currentUserId && <span className="you"> you</span>}
                </div>
                <div className="muted small">
                  {r.completed}/{r.total} done · {r.pending} pending
                </div>
              </div>
              <div className="person-pct">{r.percent}%</div>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${r.percent}%` }} />
            </div>
          </div>
        ))}
        {!loading && rows.length === 0 && (
          <p className="muted small">No people yet.</p>
        )}
      </div>
    </aside>
  );
}
