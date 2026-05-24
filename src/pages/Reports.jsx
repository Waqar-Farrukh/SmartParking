import { useState } from 'react';
import { motion } from 'framer-motion';
import { DownloadCloud, TrendingUp, Users, Trophy, AlertTriangle } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

const staggerContainer = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemAnim = { hidden: { opacity: 0, scale: 0.95, y: 20 }, show: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 200, damping: 20 } } };

export default function Reports() {
  const { API_BASE, currentUser, API_HEADERS } = useAppContext();
  const [downloading, setDownloading] = useState(null);

  const triggerDownload = async (type, isPdf) => {
    try {
      setDownloading(`${type}-${isPdf ? 'pdf' : 'csv'}`);
      const endpoint = isPdf ? `reports/pdf/${type}` : `reports/${type}`;
      const url = `${API_BASE}/${endpoint}?sender_id=${currentUser.id}`;
      
      const res = await fetch(url, { headers: API_HEADERS });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `Server error: ${res.status}`);
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `SmartParking_${type}_${new Date().toISOString().split('T')[0]}.${isPdf ? 'pdf' : 'csv'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Download failed:', err);
      alert(`Download failed: ${err.message}`);
    } finally {
      setDownloading(null);
    }
  };

  const reports = [
    { id: 'revenue', title: 'Revenue Overview', icon: <TrendingUp size={28} />, desc: 'Interactive financial insights with trend charts.', color: '#10b981', bg: 'bg-emerald-500' },
    { id: 'customers', title: 'Customer Activity', icon: <Users size={28} />, desc: 'Spending analysis and top-tier user tracking.', color: '#3b82f6', bg: 'bg-blue-500' },
    { id: 'leaderboard', title: 'Loyalty Leaderboard', icon: <Trophy size={28} />, desc: 'Ranking of users by loyalty and engagement.', color: '#f59e0b', bg: 'bg-amber-500' },
    { id: 'violations', title: 'Compliance Audit', icon: <AlertTriangle size={28} />, desc: 'Tracking and analytics of system violations.', color: '#ef4444', bg: 'bg-rose-500' }
  ];

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-12 pb-24 px-4 sm:px-0">
      <motion.div variants={itemAnim}>
        <h1 className="text-6xl font-black tracking-tight dark:text-white leading-[0.85] mb-4">
          Data<br/><span className="text-blue-600 dark:text-blue-400">Analytics.</span>
        </h1>
        <p className="font-bold ml-1 tracking-tight text-gray-500 dark:text-gray-400">Export system intelligence in professional formats.</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {reports.map(r => (
          <motion.div key={r.id} variants={itemAnim} whileHover={{ y: -8 }}
            className="bg-white dark:bg-slate-800/50 backdrop-blur-xl border border-slate-200 dark:border-slate-700/50 rounded-[2rem] p-8 flex flex-col gap-6 group relative shadow-xl shadow-slate-200/50 dark:shadow-none h-full"
          >
            <div className={`p-4 ${r.bg} rounded-2xl w-fit text-white shadow-lg group-hover:rotate-6 transition-transform duration-500`}>
              {r.icon}
            </div>
            <div>
              <h3 className="text-xl font-black mb-1 dark:text-white">{r.title}</h3>
              <p className="text-xs font-bold leading-relaxed text-gray-500 dark:text-gray-400 uppercase tracking-tighter">{r.desc}</p>
            </div>
            
            <div className="mt-auto space-y-3">
              <button 
                onClick={() => triggerDownload(r.id, true)}
                disabled={downloading !== null}
                className="w-full py-4 bg-slate-900 dark:bg-blue-600 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl flex justify-center items-center gap-2 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
              >
                {downloading === `${r.id}-pdf` ? 'Generating...' : <><DownloadCloud size={16}/> Export PDF</>}
              </button>
              
              <button 
                onClick={() => triggerDownload(r.id, false)}
                disabled={downloading !== null}
                className="w-full py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl flex justify-center items-center gap-2 transition-all hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95 disabled:opacity-50"
              >
                {downloading === `${r.id}-csv` ? 'Preparing...' : <><DownloadCloud size={14}/> CSV Raw Data</>}
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
