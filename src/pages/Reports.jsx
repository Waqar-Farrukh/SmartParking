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
    { id: 'revenue', title: 'Revenue Overview', icon: <TrendingUp size={28} />, desc: 'Interactive financial insights with trend charts.', color: '#10b981', bg: 'bg-v3-emerald' },
    { id: 'customers', title: 'Customer Activity', icon: <Users size={28} />, desc: 'Spending analysis and top-tier user tracking.', color: '#C26A5A', bg: 'bg-v3-indigo' },
    { id: 'violations', title: 'Compliance Audit', icon: <AlertTriangle size={28} />, desc: 'Unpaid fine tracking and zonal violations.', color: '#e11d48', bg: 'bg-v3-ruby' }
  ];

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-12 pb-24">
      <motion.div variants={itemAnim}>
        <h1 className="text-6xl font-black font-display tracking-tight dark:text-white leading-[0.85] mb-4" style={{ color: '#2C2A29' }}>
          Data<br/><span className="dark:text-v3-teal" style={{ color: '#C26A5A' }}>Analytics.</span>
        </h1>
        <p className="font-bold ml-1 tracking-tight dark:text-gray-400" style={{ color: '#A39B93' }}>Export system intelligence in professional formats.</p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {reports.map(r => (
          <motion.div key={r.id} variants={itemAnim} whileHover={{ y: -8, scale: 1.02 }}
            className="glass-panel rounded-[2.5rem] p-8 flex flex-col gap-5 group relative overflow-hidden h-full shadow-2xl"
          >
            <div className={`p-4 ${r.bg} rounded-[1.2rem] w-fit text-white shadow-lg group-hover:rotate-6 transition-transform duration-500`}>
              {r.icon}
            </div>
            <div>
              <h3 className="text-xl font-display font-black mb-1 dark:text-white" style={{ color: '#2C2A29' }}>{r.title}</h3>
              <p className="text-xs font-bold leading-relaxed opacity-50 uppercase tracking-tighter" style={{ color: '#6B6259' }}>{r.desc}</p>
            </div>
            
            <div className="mt-auto space-y-3">
              <button onClick={() => triggerDownload(r.id, 'pdf')}
                className="w-full py-4 font-display font-black text-[10px] uppercase tracking-[0.2em] rounded-[1.2rem] flex justify-center items-center gap-2 transition-all bg-v3-slate text-white hover:bg-v3-teal hover:scale-[1.02] shadow-md shadow-v3-teal/20"
              >
                <DownloadCloud size={16}/> Export PDF
              </button>
              
              <button onClick={() => triggerDownload(r.id, 'csv')}
                className="w-full py-3 font-display font-black text-[10px] uppercase tracking-[0.2em] rounded-[1.2rem] flex justify-center items-center gap-2 transition-all border border-black/5 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 opacity-60 hover:opacity-100"
              >
                <DownloadCloud size={14}/> CSV Raw Data
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
