import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CarFront, Calendar, AlertTriangle, Gift, FileText, Wallet, Trophy, Shield, LogOut } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export default function Sidebar() {
  const { logout, currentUser, isAdmin } = useAppContext();

  const userLinks = [
    { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} /> },
    { name: 'New Booking', path: '/book', icon: <CarFront size={20} /> },
    { name: 'My Bookings', path: '/my-bookings', icon: <Calendar size={20} /> },
    { name: 'Violations', path: '/violations', icon: <AlertTriangle size={20} /> },
    { name: 'Loyalty Rewards', path: '/loyalty', icon: <Gift size={20} /> },
    { name: 'Digital Wallet', path: '/wallet', icon: <Wallet size={20} /> },
    { name: 'Leaderboard', path: '/leaderboard', icon: <Trophy size={20} /> },
  ];

  const adminLinks = [
    { name: 'Admin Dashboard', path: '/admin', icon: <Shield size={20} /> },
    { name: 'Reports', path: '/reports', icon: <FileText size={20} /> },
  ];

  const links = isAdmin ? [...userLinks, ...adminLinks] : userLinks;

  return (
    <div className="w-80 h-full flex flex-col p-8 backdrop-blur-xl z-20 bg-white/80 dark:bg-v3-slate border-r border-light-border dark:border-white/5 shadow-aesthetic lg:shadow-none">
      {/* Logo */}
      <div className="font-display font-black text-3xl mb-14 flex items-center gap-4 tracking-tight leading-none group cursor-pointer">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl group-hover:rotate-6 transition-transform duration-500 dark:bg-v3-teal dark:text-v3-slate dark:shadow-v3-teal/20" style={{ backgroundColor: '#C26A5A', color: '#FFFFFF', boxShadow: '0 8px 20px rgba(194,106,90,0.25)' }}>
          <CarFront size={28}/>
        </div>
        <span className="dark:text-white" style={{ color: '#2C2A29' }}>
          Smart<br/>
          <span className="dark:text-v3-teal" style={{ color: '#C26A5A' }}>Parking.</span>
        </span>
      </div>
      
      <nav className="flex-1 flex flex-col gap-2 overflow-y-auto pr-2 scrollbar-thin">
        {links.map((link) => (
          <NavLink 
            key={link.name} 
            to={link.path}
            className={({ isActive }) => `
              flex items-center gap-5 p-5 rounded-[1.5rem] transition-all font-display font-bold text-sm tracking-tight
              ${isActive 
                ? 'text-white dark:text-v3-slate dark:bg-v3-teal' 
                : 'hover:bg-light-border/60 dark:hover:bg-white/5 dark:text-gray-400 dark:hover:text-v3-teal'}
            `}
            style={({ isActive }) => isActive ? {
              backgroundColor: '#C26A5A',
              color: '#FFFFFF',
              boxShadow: '0 8px 24px rgba(194,106,90,0.25)',
              transform: 'scale(1.02)'
            } : {}}
          >
            {link.icon}
            {link.name}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto mb-2 space-y-3">
        {isAdmin && (
          <div className="px-4 py-2 rounded-xl text-center bg-light-secured dark:bg-v3-teal/10 border border-light-border dark:border-v3-teal/20">
            <span className="text-[10px] font-black uppercase tracking-widest dark:text-v3-teal" style={{ color: '#C26A5A' }}>
              Administrator
            </span>
          </div>
        )}
        <button onClick={logout} className="w-full flex items-center gap-4 p-4 rounded-2xl text-v3-ruby hover:bg-v3-ruby/5 transition-all font-black text-sm tracking-widest border border-v3-ruby/10">
          <LogOut size={20} /> LOGOUT
        </button>
      </div>
    </div>
  );
}
