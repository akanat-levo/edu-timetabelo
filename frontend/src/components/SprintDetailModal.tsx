import { useEffect, useState } from "react";
import { api, type SprintDetail } from "../api";
import { DAY_NAMES } from "../dates";

interface Props {
  sprintId: number;
  onClose: () => void;
}

export default function SprintDetailModal({ sprintId, onClose }: Props) {
  const [detail, setDetail] = useState<SprintDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .sprintBreakdown(sprintId)
      .then((d) => active && setDetail(d))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [sprintId]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal detail-modal" onClick={(e) => e.stopPropagation()}>
        {loading && <p className="muted">Loading breakdown…</p>}

        {detail && (
          <>
            <div className="detail-head">
              <div>
                <span className={`badge ${detail.sprint.kind}`}>
                  {detail.sprint.kind}
                </span>
                <h3>{detail.sprint.title}</h3>
                <p className="muted small">
                  {detail.sprint.start_date} → {detail.sprint.end_date}
                </p>
              </div>
              <button className="ghost" onClick={onClose}>
                Close
              </button>
            </div>

            {detail.sprint.description && (
              <p className="detail-desc muted">{detail.sprint.description}</p>
            )}

            <div className="detail-summary">
              <div className="summary-ring">
                <span className="summary-pct">{detail.percent}%</span>
              </div>
              <div>
                <div className="summary-line">
                  <strong>{detail.completed}</strong> of{" "}
                  <strong>{detail.total}</strong> tasks done
                </div>
                <div className="muted small">
                  {detail.total - detail.completed} pending across the sprint
                </div>
                <div className="progress-bar" style={{ marginTop: 8 }}>
                  <div
                    className="progress-fill"
                    style={{ width: `${detail.percent}%` }}
                  />
                </div>
              </div>
            </div>

            <h4 className="detail-subtitle">Day-by-day</h4>
            <div className="day-progress-list">
              {detail.days.map((d) => (
                  <div
                    key={d.date}
                    className={`day-progress-row ${d.is_weekend ? "weekend" : ""}`}
                  >
                    <div className="dp-date">
                      <span className="dp-day">
                        {DAY_NAMES[d.day_of_week].slice(0, 3)}
                      </span>
                      <span className="muted small">{d.date.slice(5)}</span>
                    </div>
                    <div className="dp-bar-wrap">
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{ width: `${d.percent}%` }}
                        />
                      </div>
                    </div>
                    <div className="dp-counts">
                      {d.total === 0 ? (
                        <span className="muted small">—</span>
                      ) : (
                        <span className="small">
                          {d.completed}/{d.total}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
