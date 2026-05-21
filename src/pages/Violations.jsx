import { useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { motion } from 'framer-motion';
import { AlertTriangle, ShieldAlert, CheckCircle2, Loader2 } from 'lucide-react';

const staggerContainer = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemAnim = { hidden: { opacity: 0, scale: 0.95, y: 20 }, show: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 200, damping: 20 } } };

export default function Violations() {
  const { currentUser, violations, triggerOverstays, payFine, refreshViolations } = useAppContext();
  const [payingId, setPayingId] = useState(null);
  const [checkingOverstays, setCheckingOverstays] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => { refreshViolations(); }, []);

  const handlePay = async (v) => {
    if (payingId) return;
    if ((currentUser.walletBalance || 0) < v.fineAmount) {
      setNotice({ type: 'error', text: 'Insufficient wallet balance. Please add funds first.' });
      setTimeout(() => setNotice(null), 4000);
      return;
    }
    setPayingId(v.id);
    try {
      await payFine(v);
    } finally {
      setPayingId(null);
    }
  };

  const handleCheckOverstays = async () => {
    if (checkingOverstays) return;
    setCheckingOverstays(true);
    try {
      const count = await triggerOverstays();
      setNotice({ type: 'success', text: `Overstay check complete. ${count} new violation(s) found.` });
      setTimeout(() => setNotice(null), 4000);
    } finally {
      setCheckingOverstays(false);
    }
  };

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-12 pb-24">
      {notice && (
        <div className={`p-4 rounded-2xl text-sm font-bold text-center ${notice.type === 'error' ? 'bg-v3-ruby/10 text-v3-ruby' : 'bg-v3-emerald/10 text-v3-emerald'}`}>
          {notice.text}
        </div>
      )}
      <motion.div variants={itemAnim} className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <h1 className="text-6xl font-black font-display tracking-tight dark:text-white leading-[0.85] mb-4" style={{ color: '#2C2A29' }}>
            Violation<br/><span className="text-v3-ruby">Registry.</span>
          </h1>
          <p className="font-bold ml-1 tracking-tight dark:text-gray-400" style={{ color: '#A39B93' }}>Manage overstays and parking fines.</p>
        </div>
        <button
          onClick={handleCheckOverstays}
          disabled={checkingOverstays}
          className="px-8 py-5 font-display font-black text-sm uppercase tracking-widest rounded-[1.5rem] flex items-center gap-3 transition-all shadow-aesthetic dark:bg-v3-slate/40 dark:border-white/5 dark:hover:bg-v3-ruby/10 disabled:opacity-50"
          style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5DFD7' }}
          onMouseEnter={e => { if (!checkingOverstays) e.currentTarget.style.backgroundColor = '#FDF2F2'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
        >
          {checkingOverstays ? <Loader2 size={20} className="animate-spin text-v3-ruby" /> : <AlertTriangle size={20} className="text-v3-ruby" />}
          {checkingOverstays ? 'Checking...' : 'Check Overstays'}
        </button>
      </motion.div>

      <motion.div variants={itemAnim} className="glass-panel rounded-[3rem] overflow-hidden">
        <div className="p-8 bg-v3-ruby/5 dark:bg-v3-ruby/10 flex items-center gap-4" style={{ borderBottom: '1px solid rgba(225,29,72,0.1)' }}>
          <ShieldAlert className="text-v3-ruby" size={24} />
          <span className="text-sm font-bold text-v3-ruby">10-minute grace after your reserved end time, then 100 PKR + 50 PKR/hr. Fines only apply after you confirm arrival.</span>
        </div>
        <div className="p-8 space-y-4">
          {violations.map(v => (
            <motion.div key={v.id} variants={itemAnim} className="flex flex-col md:flex-row justify-between items-center p-8 rounded-[2rem] gap-6 dark:border-white/5 dark:bg-black/20" style={{ border: '1px solid #E5DFD7', backgroundColor: 'rgba(255,255,255,0.4)' }}>
              <div className="flex gap-5 items-center">
                <div className={`p-4 rounded-[1.5rem] ${v.isPaid ? 'bg-v3-emerald/10 text-v3-emerald' : 'bg-v3-ruby/10 text-v3-ruby'}`}>
                  {v.isPaid ? <CheckCircle2 size={28} /> : <AlertTriangle size={28} />}
                </div>
                <div>
                  <p className="font-display font-black text-xl dark:text-white" style={{ color: '#2C2A29' }}>Overstay Fine</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest dark:opacity-40" style={{ color: '#A39B93' }}>Reservation #{v.reservationId} • Issued {new Date(v.createdAt).toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-8">
                <div className="font-display font-black text-3xl tracking-tight dark:text-white" style={{ color: '#2C2A29' }}>{v.fineAmount} <span className="text-xs opacity-30">PKR</span></div>
                {v.isPaid ? (
                  <span className="px-6 py-3 bg-v3-emerald/10 text-v3-emerald font-black text-xs uppercase tracking-widest rounded-xl">PAID</span>
                ) : (
                  <button
                    onClick={() => handlePay(v)}
                    disabled={payingId === v.id}
                    className="px-8 py-4 bg-v3-ruby text-white font-display font-black text-sm rounded-[1.5rem] hover:scale-105 active:scale-95 transition-all shadow-xl disabled:opacity-60 disabled:hover:scale-100 flex items-center gap-2 min-w-[140px] justify-center"
                  >
                    {payingId === v.id ? <><Loader2 size={16} className="animate-spin" /> Paying...</> : 'Pay Fine'}
                  </button>
                )}
              </div>
            </motion.div>
          ))}
          {violations.length === 0 && (
            <div className="text-center py-20">
              <CheckCircle2 size={48} className="mx-auto mb-4 text-v3-emerald opacity-40" />
              <p className="font-display font-black text-xl" style={{ color: '#A39B93', opacity: 0.5 }}>No violations found. Great job!</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
