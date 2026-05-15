import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet as WalletIcon, Plus, History, ArrowUpRight, ArrowDownRight, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};
const itemAnim = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  show: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 200, damping: 20 } }
};

export default function Wallet() {
  const { currentUser, walletTransactions, addWallet, refreshWallet } = useAppContext();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => { refreshWallet(); }, []);

  const handleTopUp = async (amount) => {
    await addWallet(amount);
    setShowModal(false);
  };

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-12 pb-24">
      <motion.div variants={itemAnim}>
        <h1 className="text-6xl font-black font-display tracking-tight dark:text-white leading-[0.85] mb-4" style={{ color: '#2C2A29' }}>
          Digital<br/><span style={{ color: '#6C8B8A' }}>Wallet.</span>
        </h1>
        <p className="font-bold ml-1 tracking-tight dark:text-gray-400" style={{ color: '#A39B93' }}>Manage your balance and transactions.</p>
      </motion.div>

      {/* Balance Card */}
      <motion.div variants={itemAnim} className="relative overflow-hidden rounded-[3rem] p-12 text-white flex flex-col md:flex-row justify-between items-center shadow-2xl dark:from-v3-teal dark:via-cyan-600 dark:to-blue-700" style={{ background: 'linear-gradient(135deg, #6C8B8A 0%, #4a7170 50%, #3d5f60 100%)' }}>
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        <div className="flex items-center gap-6 mb-8 md:mb-0 relative z-10">
          <div className="p-5 bg-white/20 rounded-[2rem] backdrop-blur">
            <WalletIcon size={36} />
          </div>
          <div>
            <p className="text-white/60 font-bold text-sm uppercase tracking-widest mb-1">Available Balance</p>
            <h2 className="text-5xl font-display font-black tracking-tighter">
              {currentUser?.walletBalance?.toFixed(0) || 0} <span className="text-lg opacity-60">PKR</span>
            </h2>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-10 py-5 bg-white font-display font-black text-lg rounded-[2rem] hover:scale-105 active:scale-95 transition-all flex items-center gap-3 shadow-xl relative z-10"
          style={{ color: '#6C8B8A' }}
        >
          <Plus size={22} /> Add Funds
        </button>
      </motion.div>

      {/* Transaction History */}
      <motion.div variants={itemAnim} className="glass-panel rounded-[3rem] p-10">
        <h3 className="text-2xl font-display font-black mb-8 flex items-center gap-4 dark:text-white" style={{ color: '#2C2A29' }}>
          <History size={24} style={{ color: '#6C8B8A' }} /> Transaction History
        </h3>
        <div className="space-y-3">
          {walletTransactions.map(tx => (
            <div key={tx.id} className="flex justify-between items-center p-6 rounded-[1.5rem] hover:bg-light-liveFeed/50 dark:hover:bg-white/5 transition-colors" style={{ border: '1px solid #E5DFD7' }}>
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${tx.type === 'add' || tx.type === 'refund' ? 'bg-v3-emerald/10 text-v3-emerald' : 'bg-v3-ruby/10 text-v3-ruby'}`}>
                  {tx.type === 'add' || tx.type === 'refund' ? <ArrowDownRight size={20} /> : <ArrowUpRight size={20} />}
                </div>
                <div>
                  <p className="font-display font-black dark:text-white" style={{ color: '#2C2A29' }}>{tx.description}</p>
                  <p className="text-xs font-bold uppercase tracking-widest mt-1 dark:opacity-30" style={{ color: '#A39B93' }}>{new Date(tx.date).toLocaleString()}</p>
                </div>
              </div>
              <div className={`font-display font-black text-2xl ${tx.type === 'add' || tx.type === 'refund' ? 'text-v3-emerald' : 'text-v3-ruby'}`}>
                {tx.type === 'add' || tx.type === 'refund' ? '+' : '-'}{tx.amount} <span className="text-xs opacity-30">PKR</span>
              </div>
            </div>
          ))}
          {walletTransactions.length === 0 && (
            <p className="text-center py-12 font-display font-black text-lg" style={{ color: '#A39B93', opacity: 0.5 }}>No transactions yet.</p>
          )}
        </div>
      </motion.div>

      {/* Top Up Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="p-10 rounded-[3rem] w-full max-w-md shadow-2xl relative dark:bg-v3-slate dark:border-white/5"
              style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5DFD7' }}
            >
              <button onClick={() => setShowModal(false)} className="absolute top-6 right-6 p-2 text-gray-400 hover:text-v3-ruby transition-colors">
                <X size={24} />
              </button>
              <h3 className="text-3xl font-display font-black mb-2 text-center dark:text-white" style={{ color: '#2C2A29' }}>Top Up Wallet</h3>
              <p className="text-center text-sm mb-8 font-bold dark:opacity-40" style={{ color: '#A39B93' }}>Select an amount to add to your balance</p>
              <div className="grid grid-cols-2 gap-4 mb-8">
                {[500, 1000, 2500, 5000].map(amt => (
                  <button
                    key={amt}
                    onClick={() => handleTopUp(amt)}
                    className="py-6 rounded-[1.5rem] font-display font-black text-2xl transition-all dark:border-white/5 dark:hover:border-v3-teal dark:hover:bg-v3-teal/5"
                    style={{ border: '2px solid #E5DFD7' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#C26A5A'; e.currentTarget.style.backgroundColor = '#F1E4DF'; e.currentTarget.style.color = '#C26A5A'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5DFD7'; e.currentTarget.style.backgroundColor = ''; e.currentTarget.style.color = ''; }}
                  >
                    +{amt}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowModal(false)} className="w-full py-4 font-display font-black text-sm uppercase tracking-widest hover:text-v3-ruby transition-colors dark:opacity-40" style={{ color: '#A39B93' }}>
                Cancel
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
