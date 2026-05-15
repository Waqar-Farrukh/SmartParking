import { useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { motion } from 'framer-motion';
import { Calendar, X } from 'lucide-react';

const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } }
};

const itemAnim = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  show: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 200, damping: 20 } }
};

export default function MyBookings() {
  const { bookings, cancelReservation, refreshBookings } = useAppContext();

  useEffect(() => {
    refreshBookings();
  }, []);

  const handleCancel = async (r) => {
    if (window.confirm('Are you sure you want to cancel this booking? The amount will be refunded.')) {
      await cancelReservation(r);
    }
  };

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-12 pb-24">
      <motion.div variants={itemAnim}>
        <h1 className="text-6xl font-black font-display tracking-tight dark:text-white leading-[0.85] mb-4" style={{ color: '#2C2A29' }}>
          My<br/><span className="dark:text-v3-teal" style={{ color: '#C26A5A' }}>Bookings.</span>
        </h1>
        <p className="font-bold ml-1 tracking-tight dark:text-gray-400" style={{ color: '#A39B93' }}>View and manage your reservations.</p>
      </motion.div>

      <motion.div variants={itemAnim} className="glass-panel rounded-[3rem] overflow-hidden">
        <div className="p-8 flex items-center gap-4 dark:bg-white/5 dark:border-white/5" style={{ borderBottom: '1px solid #E5DFD7', backgroundColor: 'rgba(240,235,227,0.4)' }}>
          <Calendar size={24} style={{ color: '#C26A5A' }} className="dark:text-v3-teal" />
          <span className="font-display font-black text-lg dark:text-white" style={{ color: '#2C2A29' }}>Reservation Log</span>
          <span className="ml-auto text-xs font-black uppercase tracking-widest dark:opacity-30" style={{ color: '#A39B93' }}>{bookings.length} Total</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase font-black tracking-[0.3em] dark:text-gray-400 dark:border-white/5" style={{ borderBottom: '1px solid #E5DFD7', color: '#A39B93' }}>
                <th className="p-8">Spot</th>
                <th className="p-8">Start</th>
                <th className="p-8">End</th>
                <th className="p-8">Price</th>
                <th className="p-8">Status</th>
                <th className="p-8 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map(b => (
                <tr key={b.id} className="hover:bg-light-liveFeed/40 dark:hover:bg-white/5 transition-colors" style={{ borderBottom: '1px solid rgba(229,223,215,0.4)' }}>
                  <td className="p-8 font-display font-black text-2xl tracking-tighter dark:text-v3-teal" style={{ color: '#C26A5A' }}>{b.spotId}</td>
                  <td className="p-8 text-sm font-bold uppercase tracking-widest dark:opacity-40" style={{ color: '#A39B93' }}>{new Date(b.startTime).toLocaleString()}</td>
                  <td className="p-8 text-sm font-bold uppercase tracking-widest dark:opacity-40" style={{ color: '#A39B93' }}>{new Date(b.endTime).toLocaleString()}</td>
                  <td className="p-8 font-display font-black text-xl dark:text-white" style={{ color: '#2C2A29' }}>{b.finalPrice} <span className="text-[10px] opacity-30">PKR</span></td>
                  <td className="p-8">
                    <span className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase ${
                      b.status === 'active' ? 'bg-v3-emerald/20 text-v3-emerald' :
                      b.status === 'completed' ? 'dark:bg-black/40 dark:opacity-50' :
                      'bg-v3-ruby/20 text-v3-ruby'
                    }`} style={b.status === 'completed' ? { backgroundColor: '#F1E4DF', color: '#A39B93' } : {}}>
                      {b.status}
                    </span>
                  </td>
                  <td className="p-8 text-right">
                    {b.status === 'active' && (
                      <button
                        onClick={() => handleCancel(b)}
                        className="px-6 py-3 bg-v3-ruby/10 text-v3-ruby rounded-xl text-xs font-black uppercase tracking-widest hover:bg-v3-ruby hover:text-white transition-all flex items-center gap-2 ml-auto"
                      >
                        <X size={14} /> Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {bookings.length === 0 && (
                <tr>
                  <td colSpan="6" className="p-16 text-center font-display font-black text-lg" style={{ color: '#A39B93', opacity: 0.5 }}>
                    No bookings yet. Book your first spot!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
}
