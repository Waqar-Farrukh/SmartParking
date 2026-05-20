import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Star, Car, ArrowRight, CalendarDays, Zap, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';

const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.15 } }
};

const itemAnim = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  show: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 200, damping: 20 } }
};

export default function Dashboard() {
  const { currentUser, reservations, violations, refreshDashboard, checkIn, checkOut } = useAppContext();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [isOverstay, setIsOverstay] = useState(false);

  useEffect(() => {
    refreshDashboard();
  }, []);

  useEffect(() => {
    if (!currentUser || !reservations) return;
    const now = new Date();
    
    // 1. Priority: Find current 'active' session (even if expired)
    let primary = (reservations || []).find(r => r.status === 'active');
    
    // 2. Secondary: Nearest upcoming 'reserved' session
    if (!primary) {
      primary = (reservations || [])
        .filter(r => r.status === 'reserved' && new Date(r.endTime) > now)
        .sort((a,b) => new Date(a.startTime) - new Date(b.startTime))[0];
    }

    setSession(primary || null);

    if (primary) {
      const interval = setInterval(() => {
        const currentTime = new Date();
        const start = new Date(primary.startTime);
        const end = new Date(primary.endTime);

        if (primary.status === 'reserved') {
          if (currentTime < start) {
            setTimeLeft(`Starting in ${Math.floor((start - currentTime)/60000)}m`);
            setIsOverstay(false);
          } else {
            setTimeLeft('Ready for Arrival');
            setIsOverstay(false);
          }
        } else if (primary.status === 'active') {
          if (currentTime > end) {
            // Counting UP (overstay)
            const diff = currentTime - end;
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setTimeLeft(`Overstaying: ${h}h ${m}m ${s}s`);
            setIsOverstay(true);
          } else {
            // Counting DOWN (normal)
            const diff = end - currentTime;
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setTimeLeft(`Ends in ${h}h ${m}m ${s}s`);
            setIsOverstay(false);
          }
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [reservations, currentUser?.id]);

  if (!currentUser) return null;

  const recentBookings = (reservations || []).slice(0, 3);

  return (
    <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="space-y-16 pb-32"
    >
      {/* Header */}
      <motion.div variants={itemAnim} className="flex flex-col md:flex-row md:items-end justify-between gap-10">
        <div>
           <div className="flex items-center gap-3 mb-6 px-4 py-2 rounded-full w-fit bg-light-secured dark:bg-v3-teal/10 dark:text-v3-teal border border-light-border dark:border-v3-teal/20">
              <ShieldCheck size={18} className="text-light-accentPrimary dark:text-v3-teal"/>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-light-accentPrimary dark:text-v3-teal">Authenticated Node</span>
           </div>
           <h1 className="text-7xl font-black font-display tracking-tight dark:text-white leading-[0.8] mb-4" style={{ color: '#2C2A29' }}>
             Space.<br/>
             <span className="dark:text-v3-teal" style={{ color: '#C26A5A' }}>Control.</span>
           </h1>
           <p className="ml-2 font-bold tracking-tight dark:text-gray-400" style={{ color: '#A39B93' }}>Your digital parking matrix status.</p>
        </div>
        <div className="flex p-4 rounded-[2rem] shadow-aesthetic items-center gap-6 pr-10 bg-white dark:bg-v3-slate/40 border border-light-border dark:border-white/5">
           <div className="w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-white shadow-xl bg-light-accentPrimary dark:bg-v3-teal dark:text-v3-slate">
             <Zap size={32}/>
           </div>
           <div>
              <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1" style={{ color: '#A39B93' }}>Status</p>
              <h4 className="text-xl font-black tracking-tight leading-none uppercase dark:text-white" style={{ color: '#2C2A29' }}>Live Feed</h4>
           </div>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <motion.div variants={staggerContainer} className="grid grid-cols-1 md:grid-cols-3 gap-10">
        <KPI
            title="Wallet Balance"
            value={`${currentUser.walletBalance?.toFixed(0) || 0} PKR`}
            icon={<Wallet size={32} />}
            color="bg-v3-emerald"
            colorHex="#10b981"
            sub="Ready for reservations"
        />
        <KPI
            title="Loyalty Points"
            value={currentUser.points || 0}
            icon={<Star size={32} />}
            color="bg-v3-gold"
            colorHex="#D9A13B"
            sub="Network rewards"
        />
        <KPI
            title="Registry Status"
            value={(reservations || []).filter(r => r.status === 'active' || r.status === 'reserved').length}
            icon={<Car size={32} />}
            color="bg-v3-indigo"
            colorHex="#C26A5A"
            sub="Upcoming & Live"
        />
      </motion.div>

      {/* Violation Alert */}
      {violations.filter(v => !v.isPaid).length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => navigate('/violations')}
          className="p-6 bg-v3-ruby/10 border border-v3-ruby/20 rounded-[2rem] flex items-center justify-between cursor-pointer hover:bg-v3-ruby/20 transition-all shadow-lg mb-10"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-v3-ruby text-white rounded-full">
              <AlertTriangle size={24} />
            </div>
            <div>
              <p className="font-display font-black text-xl text-v3-ruby">Unpaid Violations Detected</p>
              <p className="text-xs font-bold opacity-60 text-v3-ruby">You have {violations.filter(v => !v.isPaid).length} pending fine(s). Please clear them to avoid account restrictions.</p>
            </div>
          </div>
          <ArrowRight className="text-v3-ruby" />
        </motion.div>
      )}

      {/* Smart Action Banner */}
      <AnimatePresence>
      {session && (
        <motion.div
            variants={itemAnim}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0, scale: 0.95 }}
            className={`group relative overflow-hidden rounded-[4rem] p-12 md:p-16 flex flex-col md:flex-row justify-between items-center gap-12 transition-colors duration-500`}
            style={{ 
              backgroundColor: isOverstay ? '#9F1239' : (session.status === 'reserved' ? '#3B82F6' : '#2C2A29'), 
              color: '#FFFFFF', 
              boxShadow: '0 50px 100px rgba(0,0,0,0.3)' 
            }}
        >
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none"></div>
          <div className="flex flex-col md:flex-row items-center gap-10 z-10 w-full">
            <div className={`p-8 rounded-[2.5rem] ${isOverstay ? 'animate-vibrant-pulse bg-white/20' : 'bg-white/10'}`}>
              <Car size={48} strokeWidth={3} />
            </div>
            <div className="flex-1">
              <h3 className="text-[10px] font-black uppercase tracking-[0.4em] mb-3 leading-none opacity-60">
                {session.status === 'reserved' ? 'Upcoming Reservation' : (isOverstay ? 'Violation Tracking Active' : 'Live Parking Session')}
              </h3>
              <div className="text-5xl font-black font-display tracking-tight leading-none mb-4">
                {session.spotId} <span className="opacity-20 mx-2">/</span> {timeLeft}
              </div>
              <p className="opacity-60 font-bold text-xs uppercase tracking-[0.2em]">
                {session.status === 'reserved' 
                   ? `Valid between ${new Date(session.startTime).toLocaleTimeString()} - ${new Date(session.endTime).toLocaleTimeString()}`
                   : `Reserved until ${new Date(session.endTime).toLocaleTimeString()}`
                }
              </p>
            </div>
            
            <div className="z-10 w-full md:w-auto">
              {session.status === 'reserved' ? (
                <button 
                  onClick={() => checkIn(session.id)}
                  disabled={new Date() < new Date(session.startTime)}
                  className={`px-12 py-6 rounded-[2rem] font-display font-black text-sm uppercase tracking-widest transition-all ${
                    new Date() < new Date(session.startTime) 
                      ? 'bg-white/10 border border-white/20 text-white/40 cursor-not-allowed' 
                      : 'bg-white text-blue-600 hover:scale-105 active:scale-95 shadow-2xl'
                  }`}
                >
                  {new Date() < new Date(session.startTime) ? 'Wait for Start' : 'Confirm Arrival'}
                </button>
              ) : (
                <button 
                  onClick={() => {
                    if(window.confirm(isOverstay ? "Finalize session? Overstay fees will be added." : "End session now?")) {
                      checkOut(session.id);
                    }
                  }}
                  className="px-12 py-6 bg-white text-v3-slate rounded-[2rem] font-display font-black text-sm uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-2xl"
                >
                  Confirm Departure
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Recent Bookings Table */}
      <motion.div variants={itemAnim} className="glass-panel rounded-[4rem] overflow-hidden mt-16">
        <div className="p-12 flex justify-between items-center bg-light-liveFeed/40 dark:bg-white/5 border-b border-light-border dark:border-white/5">
            <h2 className="text-3xl font-black font-display tracking-tight flex items-center gap-4 dark:text-white" style={{ color: '#2C2A29' }}>
              <CalendarDays size={32} style={{ color: '#C26A5A' }} className="dark:text-v3-teal"/>
              Session Logs
            </h2>
            <button onClick={() => navigate('/my-bookings')} className="p-5 rounded-[1.5rem] shadow-aesthetic transition-all group dark:bg-black/20 dark:hover:bg-v3-teal dark:hover:text-v3-slate" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5DFD7' }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#C26A5A'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.color = ''; }}>
              <ArrowRight size={28} className="group-hover:translate-x-2 transition-transform duration-300"/>
            </button>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead>
                    <tr style={{ borderBottom: '1px solid #E5DFD7', color: '#A39B93' }} className="text-[10px] uppercase font-black tracking-[0.4em] dark:border-white/5 dark:text-gray-400">
                        <th className="p-12">Spot</th><th className="p-12">Arrival</th><th className="p-12">Status</th><th className="p-12 text-right">Debit</th>
                    </tr>
                </thead>
                <tbody>
                    {recentBookings.map((b) => (
                        <tr key={b.id} className="hover:bg-light-liveFeed/50 dark:hover:bg-white/5 transition-colors" style={{ borderBottom: '1px solid rgba(229,223,215,0.5)' }}>
                            <td className="p-12 font-display font-black text-3xl tracking-tighter dark:text-white" style={{ color: '#2C2A29' }}>{b.spotId}</td>
                            <td className="p-12 text-sm font-bold uppercase tracking-widest dark:opacity-40" style={{ color: '#A39B93' }}>{new Date(b.startTime).toLocaleString()}</td>
                            <td className="p-12">
                                <div className={`w-fit px-5 py-2 rounded-xl text-[10px] font-black tracking-[0.2em] uppercase ${
                                    b.status === 'active' ? 'bg-v3-emerald/20 text-v3-emerald' : 'bg-light-secured dark:bg-black/40 text-light-tertiary dark:text-gray-500'
                                }`}>
                                  {b.status}
                                </div>
                            </td>
                            <td className="p-12 text-right font-display font-black text-3xl text-v3-ruby">
                              -{b.finalPrice?.toFixed(0) || 0} <span className="text-[10px] opacity-20 ml-1">PKR</span>
                            </td>
                        </tr>
                    ))}
                    {recentBookings.length === 0 && (
                        <tr>
                          <td colSpan="4" className="p-16 text-center font-display font-black text-lg" style={{ color: '#A39B93', opacity: 0.5 }}>No sessions recorded yet.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </motion.div>
    </motion.div>
  );
}

function KPI({ title, value, icon, color, colorHex, sub }) {
  return (
    <motion.div
        variants={itemAnim}
        whileHover={{ y: -12, scale: 1.02 }}
        className="glass-panel rounded-[3rem] p-12 flex flex-col justify-between h-[320px] group relative overflow-hidden"
    >
      <div className={`absolute -top-10 -right-10 w-40 h-40 ${color} opacity-[0.03] rounded-full group-hover:scale-150 transition-transform duration-1000`}></div>
      <div className="flex justify-between items-start">
          <div className={`w-20 h-20 ${color} rounded-[2rem] flex items-center justify-center text-white shadow-2xl shadow-black/10 group-hover:rotate-6 transition-transform`}>
             {icon}
          </div>
          {/* SECURED badge */}
          <div className="text-[10px] font-black uppercase tracking-[0.3em] px-3 py-1 rounded-full bg-light-secured dark:bg-white/5 border border-light-border dark:border-white/10 text-light-accentPrimary dark:text-v3-teal">
            Secured
          </div>
      </div>
      <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-3 leading-none dark:opacity-30 dark:text-white" style={{ color: '#A39B93' }}>{title}</p>
          <h3 className="text-5xl font-black font-display tracking-tighter leading-none mb-4 dark:text-white" style={{ color: '#2C2A29' }}>{value}</h3>
          <p className="text-xs font-bold uppercase tracking-widest dark:opacity-30 dark:text-white" style={{ color: '#A39B93' }}>{sub}</p>
      </div>
    </motion.div>
  );
}
