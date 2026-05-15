import { useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { motion } from 'framer-motion';
import { Trophy, Medal, Award, Crown } from 'lucide-react';

const staggerContainer = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const itemAnim = { hidden: { opacity: 0, scale: 0.95, y: 20 }, show: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 200, damping: 20 } } };

export default function Leaderboard() {
  const { currentUser, leaderboardData, refreshLeaderboard } = useAppContext();
  useEffect(() => { refreshLeaderboard(); }, []);

  const topUsers = leaderboardData.leaderboard || [];
  const totalUsers = leaderboardData.totalUsers || 0;
  const currentUserRank = topUsers.findIndex(u => u.id == currentUser?.id) + 1;

  const getRankIcon = (index) => {
    if (index === 0) return <Crown style={{ color: '#D9A13B' }} size={28} />;
    if (index === 1) return <Medal className="text-gray-400" size={26} />;
    if (index === 2) return <Award className="text-amber-700" size={26} />;
    return <span className="font-display font-black text-xl opacity-30 w-7 text-center">#{index + 1}</span>;
  };

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-12 pb-24">
      <motion.div variants={itemAnim}>
        <h1 className="text-6xl font-black font-display tracking-tight dark:text-white leading-[0.85] mb-4" style={{ color: '#2C2A29' }}>
          Leader<br/><span style={{ color: '#D9A13B' }}>Board.</span>
        </h1>
        <p className="font-bold ml-1 tracking-tight dark:text-gray-400" style={{ color: '#A39B93' }}>Top performers in the parking network.</p>
      </motion.div>

      {/* Your Rank Banner */}
      <motion.div variants={itemAnim} className="glass-panel rounded-[3rem] p-10 flex flex-col md:flex-row items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-[1.5rem] flex items-center justify-center shadow-xl" style={{ backgroundColor: '#D9A13B' }}>
            <Trophy size={32} className="text-white" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest mb-1 dark:opacity-30" style={{ color: '#A39B93' }}>Your Rank</p>
            <h2 className="text-4xl font-display font-black tracking-tighter dark:text-white" style={{ color: '#2C2A29' }}>
              {currentUserRank > 0 ? `#${currentUserRank}` : '—'} <span className="text-lg font-bold" style={{ color: '#A39B93' }}>of {totalUsers}</span>
            </h2>
          </div>
        </div>
        <div className="mt-6 md:mt-0 text-right">
          <p className="text-xs font-black uppercase tracking-widest mb-1 dark:opacity-30" style={{ color: '#A39B93' }}>Your Points</p>
          <h2 className="text-5xl font-display font-black tracking-tighter" style={{ color: '#D9A13B' }}>{currentUser?.points || 0}</h2>
        </div>
      </motion.div>

      {/* Leaderboard Table */}
      <motion.div variants={itemAnim} className="glass-panel rounded-[3rem] overflow-hidden">
        <div className="p-8 flex items-center gap-4 dark:bg-white/5 dark:border-white/5" style={{ borderBottom: '1px solid #E5DFD7', backgroundColor: 'rgba(240,235,227,0.4)' }}>
          <Trophy size={22} style={{ color: '#D9A13B' }} />
          <span className="font-display font-black text-lg dark:text-white" style={{ color: '#2C2A29' }}>Top 10 Rankings</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase font-black tracking-[0.3em] dark:text-gray-400 dark:border-white/5" style={{ borderBottom: '1px solid #E5DFD7', color: '#A39B93' }}>
                <th className="p-8 w-20 text-center">Rank</th>
                <th className="p-8">User</th>
                <th className="p-8 text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {topUsers.map((u, index) => (
                <tr key={u.id} className={`hover:bg-light-liveFeed/50 dark:hover:bg-white/5 transition-colors ${u.id == currentUser?.id ? 'dark:bg-v3-gold/10' : ''}`}
                  style={{ borderBottom: '1px solid rgba(229,223,215,0.4)', ...(u.id == currentUser?.id ? { backgroundColor: 'rgba(217,161,59,0.05)' } : {}) }}
                >
                  <td className="p-8 text-center">{getRankIcon(index)}</td>
                  <td className="p-8">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-[1rem] flex items-center justify-center text-sm font-display font-black uppercase dark:bg-white/5" style={{ backgroundColor: '#F0EBE3', color: '#6B6259' }}>
                        {u.name.substring(0, 2)}
                      </div>
                      <div>
                        <span className="font-display font-black text-lg dark:text-white" style={{ color: '#2C2A29' }}>{u.name}</span>
                        {u.id == currentUser?.id && (
                          <span className="ml-3 text-[10px] text-white px-3 py-1 rounded-full font-black tracking-widest" style={{ backgroundColor: '#D9A13B' }}>YOU</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-8 text-right font-display font-black text-3xl tracking-tighter dark:text-white" style={{ color: '#2C2A29' }}>{u.points}</td>
                </tr>
              ))}
              {topUsers.length === 0 && (
                <tr>
                  <td colSpan="3" className="p-16 text-center font-display font-black text-lg" style={{ color: '#A39B93', opacity: 0.5 }}>
                    No leaderboard data available.
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
