import { useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { motion } from 'framer-motion';
import { Gift, Share2, Star, Sparkles } from 'lucide-react';

const staggerContainer = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.12 } } };
const itemAnim = { hidden: { opacity: 0, scale: 0.95, y: 20 }, show: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 200, damping: 20 } } };

export default function LoyaltyRewards() {
  const { currentUser, pointTransactions, redeemPoints, refreshLoyalty } = useAppContext();
  useEffect(() => { refreshLoyalty(); }, []);

  const handleRedeem = async () => {
    if ((currentUser.points || 0) < 500) { alert("You need at least 500 points to redeem a reward."); return; }
    const code = await redeemPoints();
    if (code) { alert(`Successfully generated code: ${code}. Use it during your next booking!`); }
  };

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-12 pb-24">
      <motion.div variants={itemAnim}>
        <h1 className="text-6xl font-black font-display tracking-tight dark:text-white leading-[0.85] mb-4" style={{ color: '#2C2A29' }}>
          Loyalty<br/><span style={{ color: '#D9A13B' }}>Rewards.</span>
        </h1>
        <p className="font-bold ml-1 tracking-tight dark:text-gray-400" style={{ color: '#A39B93' }}>Earn, redeem, and grow your rewards.</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Points Banner */}
        <motion.div variants={itemAnim} className="relative overflow-hidden rounded-[3rem] p-12 text-white shadow-2xl flex flex-col justify-between" style={{ background: 'linear-gradient(135deg, #D9A13B 0%, #c0872e 50%, #a67526 100%)' }}>
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
          <div>
            <div className="flex gap-3 items-center mb-6">
              <Star fill="white" size={28} />
              <span className="font-display font-black text-xl">Total Points</span>
            </div>
            <div className="text-7xl font-black font-display tracking-tighter mb-6">{currentUser?.points || 0}</div>
            <p className="opacity-80 font-bold text-sm uppercase tracking-widest mb-8">500 points = 50 PKR Discount</p>
          </div>
          <button onClick={handleRedeem} className="w-full py-5 bg-white font-display font-black text-lg rounded-[1.5rem] hover:scale-[1.02] active:scale-[0.98] transition-all flex justify-center items-center gap-3 shadow-xl" style={{ color: '#D9A13B' }}>
            <Sparkles size={22} /> Redeem Now
          </button>
        </motion.div>

        {/* Referrals */}
        <motion.div variants={itemAnim} className="glass-panel rounded-[3rem] p-12 flex flex-col justify-between">
          <div>
            <h3 className="text-2xl font-display font-black mb-3 dark:text-white" style={{ color: '#2C2A29' }}>Refer & Earn</h3>
            <p className="text-sm font-bold mb-8 leading-relaxed dark:opacity-40" style={{ color: '#6B6259' }}>Share your code. When a friend signs up with your code, you both get 200 points instantly!</p>
            <div className="p-6 rounded-[1.5rem] font-mono text-2xl font-black text-center mb-6 select-all tracking-widest dark:bg-black/40 dark:border-white/5" style={{ backgroundColor: '#F0EBE3', border: '1px solid #E5DFD7', color: '#2C2A29' }}>
              {currentUser?.referralCode || '—'}
            </div>
          </div>
          <button onClick={() => navigator.clipboard.writeText(currentUser?.referralCode || '').then(() => alert('Copied!'))}
            className="w-full py-4 rounded-[1.5rem] font-display font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all dark:bg-black/20 dark:hover:bg-v3-teal/10 dark:border-white/5"
            style={{ backgroundColor: '#F0EBE3', border: '1px solid #E5DFD7', color: '#6B6259' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F1E4DF'; e.currentTarget.style.color = '#C26A5A'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#F0EBE3'; e.currentTarget.style.color = '#6B6259'; }}
          >
            <Share2 size={18} /> Copy Code
          </button>
        </motion.div>
      </div>

      {/* Point History */}
      <motion.div variants={itemAnim} className="glass-panel rounded-[3rem] p-10 overflow-hidden">
        <h3 className="text-2xl font-display font-black mb-8 flex items-center gap-4 dark:text-white" style={{ color: '#2C2A29' }}>
          <Gift size={24} style={{ color: '#D9A13B' }} /> Point History
        </h3>
        <div className="space-y-3">
          {pointTransactions.map(tx => (
            <div key={tx.id} className="flex justify-between items-center p-6 rounded-[1.5rem] hover:bg-light-liveFeed/50 dark:hover:bg-white/5 transition-colors" style={{ border: '1px solid #E5DFD7' }}>
              <div>
                <p className="font-display font-black dark:text-white" style={{ color: '#2C2A29' }}>{tx.reason}</p>
                <p className="text-xs font-bold uppercase tracking-widest mt-1 dark:opacity-30" style={{ color: '#A39B93' }}>{new Date(tx.date).toLocaleString()}</p>
              </div>
              <div className={`font-display font-black text-2xl ${tx.change > 0 ? 'text-v3-emerald' : 'text-v3-ruby'}`}>
                {tx.change > 0 ? '+' : ''}{tx.change}
              </div>
            </div>
          ))}
          {pointTransactions.length === 0 && (
            <p className="text-center py-12 font-display font-black text-lg" style={{ color: '#A39B93', opacity: 0.5 }}>No points activity yet.</p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
