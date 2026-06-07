import {NavLink, Outlet} from 'react-router-dom';
import {useAuth} from '@/auth/AuthContext';
import {Button} from './ui/Button';

const nav = [
  {to: '/', label: 'Dashboard', end: true},
  {to: '/subjects', label: 'Subjects'},
  {to: '/courses', label: 'Courses'},
  {to: '/generate', label: 'Generate Questions'},
  {to: '/questions', label: 'Manage Questions'},
  {to: '/users', label: 'Users'},
  {to: '/api-usage', label: 'API Usage'},
  {to: '/activity', label: 'Activity Logs'},
  {to: '/device-locations', label: 'Device Locations'},
];

export function Layout() {
  const {user, logout} = useAuth();

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="flex w-60 flex-shrink-0 flex-col bg-slate-900 text-slate-300">
        <div className="px-5 py-5 text-lg font-bold text-white">Exam Admin</div>
        <nav className="flex-1 space-y-1 px-3">
          {nav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({isActive}) =>
                `block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand-600 text-white' : 'hover:bg-slate-800 hover:text-white'
                }`
              }>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-800 px-5 py-4 text-xs text-slate-400">
          Signed in as
          <div className="truncate font-medium text-slate-200">{user?.email}</div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <span className="text-sm text-slate-500">Manage subjects, courses & view analytics</span>
          <Button variant="secondary" onClick={() => void logout()}>
            Log out
          </Button>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
