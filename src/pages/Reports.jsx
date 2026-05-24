import { useState } from 'react';
import { motion } from 'framer-motion';
import { DownloadCloud, TrendingUp, Users, Trophy, AlertTriangle } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

const staggerContainer = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemAnim = { hidden: { opacity: 0, scale: 0.95, y: 20 }, show: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 200, damping: 20 } } };

async function parseErrorResponse(res) {
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    return json.message || text;
  } catch {
    return text || `Server error (${res.status})`;
  }
}

export default function Reports() {
  const { API_BASE, currentUser, API_HEADERS } = useAppContext();
  const [downloading, setDownloading] = useState(null);

  const triggerDownload = async (type, isPdf) => {
    if (!currentUser?.id) {
      alert('Please log in as admin to download reports.');
      return;
    }
    const key = `${type}-${isPdf ? 'pdf' : 'csv'}`;
    try {
      setDownloading(key);
      const endpoint = isPdf ? `reports/pdf/${type}` : `reports/${type}`;
      const url = `${API_BASE}/${endpoint}?sender_id=${currentUser.id}`;

      const res = await fetch(url, {
        method: 'GET',
        headers: API_HEADERS,
        mode: 'cors',
        cache: 'no-store',
      });

      if (!res.ok) {
        throw new Error(await parseErrorResponse(res));
      }

      const expectedType = isPdf ? 'application/pdf' : 'text/csv';
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes(isPdf ? 'pdf' : 'csv') && contentType.includes('application/json')) {
        throw new Error(await parseErrorResponse(res));
      }

      const blob = await res.blob();
      if (!blob.size) {
        throw new Error('Empty file received from server.');
      }

      const ext = isPdf ? 'pdf' : 'csv';
      const filename = `${type}_report.${ext}`;
      const downloadUrl = window.URL.createObjectURL(blob);
      if (isPdf) {
        window.open(downloadUrl, '_blank', 'noopener,noreferrer');
      }
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 30_000);
    } catch (err) {
      console.error('Download failed:', err);
      const msg = err?.message || String(err);
      if (msg.toLowerCase().includes('failed to fetch')) {
        alert('Download failed: Cannot reach the API. Start python app.py and ensure VITE_API_URL / ngrok is running.');
      } else {
        alert(`Download failed: ${msg}`);
      }
    } finally {
      setDownloading(null);
    }
  };

  const reports = [
    { id: 'revenue', title: 'Weekly Revenue', icon: <TrendingUp size={28} />, desc: 'Daily revenue and booking counts.', color: '#10b981', bg: 'bg-emerald-500' },
    { id: 'customers', title: 'Top Customers', icon: <Users size={28} />, desc: 'User ID, email, spend, and bookings.', color: '#3b82f6', bg: 'bg-blue-500' },
    { id: 'leaderboard', title: 'Points Leaderboard', icon: <Trophy size={28} />, desc: 'Rank, user ID, points, lifetime points.', color: '#f59e0b', bg: 'bg-amber-500' },
    { id: 'violations', title: 'Unpaid Violations', icon: <AlertTriangle size={28} />, desc: 'Violation ID, user, reservation, fine, status, date.', color: '#ef4444', bg: 'bg-rose-500' }
  ];

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-12 pb-24 px-4 sm:px-0">
      <motion.div variants={itemAnim}>
        <h1 className="text-6xl font-black tracking-tight dark:text-white leading-[0.85] mb-4">
          Data<br/><span className="text-blue-600 dark:text-blue-400">Reports.</span>
        </h1>
        <p className="font-bold ml-1 tracking-tight text-gray-500 dark:text-gray-400">
          Download full-detail CSV exports or professional PDF summaries.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {reports.map(r => (
          <motion.div key={r.id} variants={itemAnim} whileHover={{ y: -8 }}
            className="glass-panel rounded-[3rem] p-10 flex flex-col gap-6 group relative overflow-hidden"
          >
            <div className={`p-5 ${r.bg} rounded-[1.5rem] w-fit text-white shadow-xl`}>
              {r.icon}
            </div>
            <div>
              <h3 className="text-xl font-display font-black mb-2 dark:text-white" style={{ color: '#2C2A29' }}>{r.title}</h3>
              <p className="text-sm font-bold leading-relaxed dark:opacity-40" style={{ color: '#6B6259' }}>{r.desc}</p>
            </div>

            <div className="mt-auto flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => triggerDownload(r.id, true)}
                disabled={downloading !== null}
                className="flex-1 py-5 font-display font-black text-sm uppercase tracking-widest rounded-[1.5rem] flex justify-center items-center gap-3 transition-all bg-slate-900 dark:bg-blue-600 text-white hover:scale-[1.02] active:scale-95 disabled:opacity-50"
              >
                {downloading === `${r.id}-pdf` ? 'Generating PDF…' : <><DownloadCloud size={18}/> Download PDF</>}
              </button>
              <button
                onClick={() => triggerDownload(r.id, false)}
                disabled={downloading !== null}
                className="flex-1 py-5 font-display font-black text-sm uppercase tracking-widest rounded-[1.5rem] flex justify-center items-center gap-3 transition-all dark:bg-black/20 dark:hover:bg-v3-teal dark:hover:text-v3-slate disabled:opacity-50"
                style={{ backgroundColor: '#F0EBE3', border: '1px solid #E5DFD7', color: '#6B6259' }}
              >
                {downloading === `${r.id}-csv` ? 'Preparing CSV…' : <><DownloadCloud size={16}/> Download CSV</>}
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
