import { NavLink, Outlet } from 'react-router-dom';

const navLinks = [
  { to: '/tickets', label: 'Ticket Inbox' },
  { to: '/tickets/new', label: 'New Ticket' },
  { to: '/dashboard', label: 'Agent Dashboard' },
  { to: '/analytics', label: 'Analytics' },
];

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <nav className="bg-blue-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-8 h-14">
          <span className="font-bold text-lg tracking-tight">SupportIQ</span>
          {navLinks.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `text-sm font-medium px-3 py-1 rounded transition ${isActive ? 'bg-blue-900 text-white' : 'text-blue-100 hover:bg-blue-600'}`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
