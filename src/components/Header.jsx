import { useAppContext } from '../context/AppContext';
import { Sun, Moon, User } from 'lucide-react';

export default function Header() {
  const { theme, toggleTheme, currentUser, isAdmin } = useAppContext();

  return (
    <header className="h-20 border-b flex items-center justify-between px-10 shrink-0 z-10 backdrop-blur-xl sticky top-0 bg-white/70 dark:bg-v3-slate/70 border-light-border dark:border-white/5">
      <div className="dark:hidden">
        <div className="text-2xl font-display font-black tracking-tighter" style={{ color: '#2C2A29' }}>
          Hello, <span style={{ color: '#6C8B8A' }}>{currentUser?.name?.split(' ')[0] || 'User'}</span>
        </div>
      </div>
      <div className="hidden dark:block">
        <div className="text-2xl font-display font-black tracking-tighter text-white">
          Hello, <span className="text-v3-teal">{currentUser?.name?.split(' ')[0] || 'User'}</span>
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        {isAdmin && (
          <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg" style={{ backgroundColor: '#F1E4DF', color: '#C26A5A' }}>
            <span className="dark:hidden">Admin</span>
          </span>
        )}
        {isAdmin && (
          <span className="hidden dark:inline text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg bg-v3-teal/10 text-v3-teal">Admin</span>
        )}
        <button onClick={toggleTheme} className="p-3 rounded-xl transition-all bg-light-liveFeed dark:bg-black/40 text-light-textSecondary dark:text-gray-400 border border-light-border dark:border-white/5">
          {theme === 'dark' ? <Sun size={22} /> : <Moon size={22} />}
        </button>
        <div className="flex items-center gap-4 py-2 pl-2 pr-6 rounded-2xl bg-light-liveFeed dark:bg-black/40 border border-light-border dark:border-white/5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shadow-lg dark:bg-v3-teal dark:text-v3-slate" style={{ backgroundColor: '#C26A5A', color: '#FFFFFF' }}>
            {currentUser?.name?.charAt(0) || <User size={18} />}
          </div>
          <div className="hidden sm:flex flex-col leading-none">
             <span className="font-black text-sm uppercase tracking-tighter dark:text-white" style={{ color: '#2C2A29' }}>{currentUser?.name}</span>
             <span className="text-[10px] font-bold tracking-widest" style={{ color: '#A39B93' }}>{currentUser?.email}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
