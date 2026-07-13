import { useCallback, useEffect, useState } from "react";
import { api, type Rules, type Sprint, type UserPublic } from "./api";
import { useAuth } from "./auth";
import LoginPage from "./components/LoginPage";
import PeoplePanel from "./components/PeoplePanel";
import SprintsPanel from "./components/SprintsPanel";
import WeekView from "./components/WeekView";

export default function App() {
  const { user, loading, logout } = useAuth();
  const [rules, setRules] = useState<Rules | null>(null);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!user) return;
    api.rules().then(setRules).catch(() => setRules(null));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    api.listSprints().then(setSprints).catch(() => setSprints([]));
    api.listUsers().then(setUsers).catch(() => setUsers([]));
  }, [user, tick]);

  if (loading) {
    return <div className="center muted">Loading…</div>;
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand-sm">edu-timetabelo</div>
        <div className="topbar-right">
          <div className="user-chip">
            <span className="avatar">
              {(user.display_name || user.email).charAt(0).toUpperCase()}
            </span>
            <span className="small">{user.display_name || user.email}</span>
          </div>
          <button className="ghost" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      <main className="layout">
        {rules ? (
          <WeekView
            rules={rules}
            sprints={sprints}
            users={users}
            currentUserId={user.id}
            onDataChanged={refresh}
          />
        ) : (
          <p className="muted">Loading rules…</p>
        )}
        <div className="side">
          <PeoplePanel currentUserId={user.id} tick={tick} />
          <SprintsPanel sprints={sprints} onChanged={refresh} />
        </div>
      </main>
    </div>
  );
}
