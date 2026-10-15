import { createContext, useContext, useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router';
import { adminApi, auth } from '../api.js';
import './admin.css';

const MetaContext = createContext(null);
export const useMeta = () => useContext(MetaContext);

export default function AdminLayout() {
  const navigate = useNavigate();
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    if (!auth.token) return;
    let alive = true;
    const load = () => adminApi('/meta').then((m) => alive && setMeta(m)).catch(() => {});
    load();
    const timer = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  if (!auth.token) return <Navigate to="/admin/login" replace />;

  const signOut = () => {
    auth.set(null);
    navigate('/admin/login');
  };

  const chain = meta?.chain;
  const user = meta?.user;
  const isAdmin = user?.role === 'admin';

  return (
    <MetaContext.Provider value={meta}>
      <div className="a-root">
        <header className="a-bar">
          <div className="a-barIn">
            <NavLink to="/admin" className="a-brand">
              AUTHENTIC8
            </NavLink>
            <nav className="a-nav" aria-label="Admin">
              <NavLink to="/admin" end>
                Events
              </NavLink>
              <NavLink to="/admin/issue">Issue</NavLink>
              <NavLink to="/admin/certificates">Certificates</NavLink>
              <NavLink to="/admin/cards">Cards</NavLink>
              {isAdmin && <NavLink to="/admin/team">Team</NavLink>}
            </nav>
            {chain && (
              <span className={`a-pill a-chain ${chain.connected ? 'ok' : 'bad'}`} title={chain.connected ? chain.contract : chain.error}>
                {chain.connected ? chain.name : 'Blockchain offline'}
              </span>
            )}
            {user && (
              <span className="a-user" title={user.email}>
                {user.picture ? <img src={user.picture} alt="" referrerPolicy="no-referrer" /> : <span className="a-avatar">{(user.name || user.email || 'A')[0].toUpperCase()}</span>}
                <span>
                  {user.name || user.email} · {isAdmin ? 'Admin' : 'Employee'}
                </span>
              </span>
            )}
            <button type="button" className="a-btn small" onClick={signOut}>
              Sign out
            </button>
          </div>
        </header>
        <Outlet />
      </div>
    </MetaContext.Provider>
  );
}
