import { motion } from 'framer-motion';
import { DownloadCloud, TrendingUp, Users, Trophy, AlertTriangle } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

const staggerContainer = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemAnim = { hidden: { opacity: 0, scale: 0.95, y: 20 }, show: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 200, damping: 20 } } };

export default function Reports() {
  const { API_BASE, currentUser } = useAppContext();

  const triggerDownload = async (type) => {
    if (!currentUser) return;
    try {
      const res = await fetch(`${API_BASE}/reports/${type}?sender_id=${currentUser.id}`);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_report.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Download failed: ${err.message}`);
    }
  };

  const reports = [
    { id: 'revenue', title: 'Weekly Revenue', icon: <TrendingUp size={28} />, desc: 'Aggregated income from all zones, day by day.', color: '#10b981', bg: 'bg-v3-emerald' },
    { id: 'customers', title: 'Top Customers', icon: <Users size={28} />, desc: 'Users sorted by total spend and booking count.', color: '#C26A5A', bg: 'bg-v3-indigo' },
    { id: 'leaderboard', title: 'Points Leaderboard', icon: <Trophy size={28} />, desc: 'Complete breakdown of all loyalty points.', color: '#D9A13B', bg: 'bg-v3-gold' },
    { id: 'violations', title: 'Unpaid Violations', icon: <AlertTriangle size={28} />, desc: 'Filter for active unresolved fines.', color: '#e11d48', bg: 'bg-v3-ruby' }
  ];

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-12 pb-24">
      <motion.div variants={itemAnim}>
        <h1 className="text-6xl font-black font-display tracking-tight dark:text-white leading-[0.85] mb-4" style={{ color: '#2C2A29' }}>
          Data<br/><span className="dark:text-v3-teal" style={{ color: '#C26A5A' }}>Reports.</span>
        </h1>
        <p className="font-bold ml-1 tracking-tight dark:text-gray-400" style={{ color: '#A39B93' }}>Generate and download comprehensive CSV datasets.</p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
        {reports.map(r => (
          <motion.div key={r.id} variants={itemAnim} whileHover={{ y: -8, scale: 1.02 }}
            className="glass-panel rounded-[3rem] p-10 flex flex-col gap-6 group relative overflow-hidden"
          >
            <div className={`absolute -top-8 -right-8 w-32 h-32 ${r.bg} opacity-[0.05] rounded-full group-hover:scale-150 transition-transform duration-1000`}></div>
            <div className={`p-5 ${r.bg} rounded-[1.5rem] w-fit text-white shadow-xl group-hover:rotate-6 transition-transform duration-500`}>
              {r.icon}
            </div>
            <div>
              <h3 className="text-xl font-display font-black mb-2 dark:text-white" style={{ color: '#2C2A29' }}>{r.title}</h3>
              <p className="text-sm font-bold leading-relaxed dark:opacity-30" style={{ color: '#6B6259' }}>{r.desc}</p>
            </div>
            <button onClick={() => triggerDownload(r.id)}
              className="mt-auto w-full py-5 font-display font-black text-sm uppercase tracking-widest rounded-[1.5rem] flex justify-center items-center gap-3 transition-all dark:bg-black/20 dark:hover:bg-v3-teal dark:hover:text-v3-slate dark:border-white/5"
              style={{ backgroundColor: '#F0EBE3', border: '1px solid #E5DFD7', color: '#6B6259' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#C26A5A'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#C26A5A'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#F0EBE3'; e.currentTarget.style.color = '#6B6259'; e.currentTarget.style.borderColor = '#E5DFD7'; }}
            >
              <DownloadCloud size={18}/> Download CSV
            </button>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
