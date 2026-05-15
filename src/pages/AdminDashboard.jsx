import { useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { motion } from 'framer-motion';
import { DollarSign, Users, Car, AlertTriangle, TrendingUp, Zap, BarChart3, Database, CheckCircle2, XCircle, UserCheck, Activity, PieChart } from 'lucide-react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, Filler, ArcElement
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, Filler, ArcElement);

const itemAnim = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 200, damping: 20 } }
};

export default function AdminDashboard() {
  const { adminStats, refreshAdminStats, adminUsers, refreshAdminUsers, dbHealth, checkHealth, theme } = useAppContext();
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    refreshAdminStats();
    refreshAdminUsers();
    checkHealth();
  }, []);

  const stats = adminStats || {
    totalRevenue: 0, totalUsers: 0, activeBookings: 0, totalBookings: 0,
    totalViolations: 0, unpaidViolations: 0,
    dailyRevenue: [], dailyBookings: [],
    zoneOccupancy: [], pricingState: [],
    violations: [], recentBookings: []
  };

  const isDark = theme === 'dark';
  const accentColor = isDark ? '#00ced1' : '#C26A5A';
  const secondaryColor = isDark ? '#10b981' : '#6C8B8A';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
  const textColor = isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)';

  const revenueData = {
    labels: stats.dailyRevenue.length > 0
      ? stats.dailyRevenue.map(d => new Date(d.day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }))
      : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [{
      label: 'Revenue (PKR)',
      data: stats.dailyRevenue.length > 0 ? stats.dailyRevenue.map(d => d.revenue) : [0, 0, 0, 0, 0, 0, 0],
      borderColor: accentColor,
      backgroundColor: isDark ? 'rgba(0, 206, 209, 0.1)' : 'rgba(194, 106, 90, 0.1)',
      fill: true,
      tension: 0.4,
      borderWidth: 3,
      pointRadius: 6,
      pointBackgroundColor: accentColor,
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
    }]
  };

  const bookingsData = {
    labels: stats.dailyBookings.length > 0
      ? stats.dailyBookings.map(d => new Date(d.day).toLocaleDateString('en-US', { weekday: 'short' }))
      : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [{
      label: 'Bookings',
      data: stats.dailyBookings.length > 0 ? stats.dailyBookings.map(d => d.count) : [0, 0, 0, 0, 0, 0, 0],
      backgroundColor: isDark ? 'rgba(0, 206, 209, 0.6)' : 'rgba(194, 106, 90, 0.6)',
      borderColor: accentColor,
      borderWidth: 2,
      borderRadius: 12,
      barThickness: 24,
    }]
  };

  const zoneColors = ['#C26A5A', '#6C8B8A', '#D9A13B'];
  const zoneDarkColors = ['#00ced1', '#10b981', '#fbbf24'];
  const zoneOccupancyData = {
    labels: (stats.zoneOccupancy || []).map(z => `Zone ${z.zone}`),
    datasets: [{
      data: (stats.zoneOccupancy || []).map(z => z.occupied),
      backgroundColor: isDark ? zoneDarkColors : zoneColors,
      borderWidth: 0,
      cutout: '70%',
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { 
      legend: { display: false }, 
      tooltip: { 
        enabled: true, 
        backgroundColor: isDark ? '#0f172a' : '#fff', 
        titleColor: isDark ? '#fff' : '#2C2A29', 
        bodyColor: isDark ? '#ccc' : '#6B6259', 
        borderColor: isDark ? '#333' : '#E5DFD7', 
        borderWidth: 1,
        titleFont: { family: 'Outfit', weight: 'bold' },
        bodyFont: { family: 'Inter' }
      } 
    },
    scales: {
      y: { grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'Outfit', weight: 'bold' } } },
      x: { grid: { display: false }, ticks: { color: textColor, font: { family: 'Outfit', weight: 'bold' } } }
    }
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
    cutout: '70%'
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'users', label: 'User Registry' },
    { id: 'bookings', label: 'Recent Bookings' },
    { id: 'violations', label: 'Violations' },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10 pb-24 font-sans">
      {/* Header */}
      <motion.div variants={itemAnim} initial="hidden" animate="show" className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
           <h1 className="text-6xl font-black font-display tracking-tighter dark:text-white leading-[0.8] mb-2" style={{ color: isDark ? '' : '#2C2A29' }}>Network <span className="dark:text-v3-teal" style={{ color: isDark ? '' : '#C26A5A' }}>Control.</span></h1>
           <p className="font-bold ml-1 tracking-tight dark:text-gray-400" style={{ color: isDark ? '' : '#A39B93' }}>Root level administrative overview & analytics.</p>
        </div>
        <div className="flex gap-3 items-center">
           <div className={`px-5 py-3 rounded-2xl flex items-center gap-3 border shadow-aesthetic transition-colors ${
             dbHealth?.status === 'connected' 
               ? 'bg-v3-emerald/5 border-v3-emerald/20 dark:bg-v3-emerald/10 dark:border-v3-emerald/30' 
               : 'bg-v3-ruby/5 border-v3-ruby/20 dark:bg-v3-ruby/10 dark:border-v3-ruby/30'
           }`}>
              {dbHealth?.status === 'connected' 
                ? <CheckCircle2 className="text-v3-emerald" size={18}/>
                : <XCircle className="text-v3-ruby" size={18}/>
              }
              <div>
                <span className={`font-black text-xs uppercase tracking-widest ${dbHealth?.status === 'connected' ? 'text-v3-emerald' : 'text-v3-ruby'}`}>
                  {dbHealth?.status === 'connected' ? 'DB Connected' : 'DB Error'}
                </span>
                {dbHealth?.status === 'connected' && (
                  <p className="text-[10px] opacity-40 font-bold dark:text-white" style={{ color: isDark ? '' : '#2C2A29' }}>{dbHealth.database} • {dbHealth.userCount} users</p>
                )}
              </div>
           </div>
           <div className="px-5 py-3 bg-white dark:bg-v3-teal/10 rounded-2xl flex items-center gap-3 border border-gray-100 dark:border-v3-teal/20 shadow-aesthetic" style={{ borderColor: isDark ? '' : '#E5DFD7' }}>
              <Zap className="dark:text-v3-teal animate-pulse" style={{ color: isDark ? '' : '#C26A5A' }} size={18}/>
              <span className="dark:text-v3-teal font-black text-xs uppercase tracking-widest" style={{ color: isDark ? '' : '#C26A5A' }}>Live Data</span>
           </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex bg-white dark:bg-black/20 p-2 rounded-2xl gap-2 shadow-aesthetic border border-gray-100 dark:border-white/5" style={{ borderColor: isDark ? '' : '#E5DFD7' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
              activeTab === tab.id
                ? 'text-white dark:text-v3-slate shadow-vibrant'
                : 'opacity-40 hover:opacity-70 dark:text-white'
            }`}
            style={{
              backgroundColor: activeTab === tab.id ? (isDark ? '#00ced1' : '#C26A5A') : 'transparent',
              color: (activeTab !== tab.id && !isDark) ? '#2C2A29' : ''
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <KPI icon={<DollarSign size={28}/>} label="Total Revenue" value={`${stats.totalRevenue.toLocaleString()} PKR`} bg="bg-v3-emerald" trend={`${stats.totalBookings} total bookings`} isDark={isDark} />
            <KPI icon={<Users size={28}/>} label="Total Users" value={stats.totalUsers} bg="bg-v3-indigo" trend="Registered accounts" isDark={isDark} />
            <KPI icon={<Car size={28}/>} label="Active Bookings" value={stats.activeBookings} bg="bg-v3-teal" trend={`of ${stats.totalBookings} total`} isDark={isDark} />
            <KPI icon={<AlertTriangle size={28}/>} label="Violations" value={stats.totalViolations} bg="bg-v3-ruby" trend={`${stats.unpaidViolations} unpaid`} isDark={isDark} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <motion.div variants={itemAnim} initial="hidden" animate="show" className="lg:col-span-2 glass-panel rounded-[2.5rem] p-8 flex flex-col">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-xl font-black font-display flex items-center gap-3 dark:text-v3-teal" style={{ color: isDark ? '' : '#C26A5A' }}><TrendingUp size={24}/> Weekly Revenue</h2>
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-40 dark:text-white" style={{ color: isDark ? '' : '#A39B93' }}>Last 7 Days</span>
                </div>
                <div className="flex-1 min-h-[280px]">
                    <Line data={revenueData} options={chartOptions} />
                </div>
            </motion.div>

            <motion.div variants={itemAnim} initial="hidden" animate="show" className="glass-panel rounded-[2.5rem] p-8 flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                  <PieChart className="dark:text-v3-teal" style={{ color: isDark ? '' : '#C26A5A' }} size={22}/>
                  <span className="text-lg font-black font-display dark:text-white" style={{ color: isDark ? '' : '#2C2A29' }}>Zone Occupancy</span>
                </div>
                <div className="flex-1 min-h-[200px] flex items-center justify-center">
                  {(stats.zoneOccupancy || []).some(z => z.occupied > 0) ? (
                    <Doughnut data={zoneOccupancyData} options={doughnutOptions} />
                  ) : (
                    <p className="font-display font-black opacity-20 text-center dark:text-white" style={{ color: isDark ? '' : '#A39B93' }}>No active bookings</p>
                  )}
                </div>
                <div className="mt-4 space-y-2">
                  {(stats.zoneOccupancy || []).map((z, i) => (
                    <div key={z.zone} className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ background: isDark ? zoneDarkColors[i] : zoneColors[i] }}></div>
                        <span className="font-bold opacity-60 dark:text-white" style={{ color: isDark ? '' : '#6B6259' }}>Zone {z.zone}</span>
                      </div>
                      <span className="font-display font-black dark:text-white" style={{ color: isDark ? '' : '#2C2A29' }}>{z.occupied}/{z.total}</span>
                    </div>
                  ))}
                </div>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <motion.div variants={itemAnim} initial="hidden" animate="show" className="lg:col-span-2 glass-panel rounded-[2.5rem] p-8 flex flex-col">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-xl font-black font-display flex items-center gap-3 dark:text-white" style={{ color: isDark ? '' : '#2C2A29' }}><Activity size={24} className="text-v3-emerald"/> Booking Trends</h2>
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-40 dark:text-white" style={{ color: isDark ? '' : '#A39B93' }}>Daily Volume</span>
                </div>
                <div className="flex-1 min-h-[250px]">
                    <Bar data={bookingsData} options={chartOptions} />
                </div>
            </motion.div>

            <motion.div variants={itemAnim} initial="hidden" animate="show" className="glass-panel rounded-[2.5rem] p-8 flex flex-col justify-between overflow-hidden relative">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-v3-indigo/5 rounded-full blur-3xl"></div>
                <div>
                   <div className="flex items-center gap-3 mb-6">
                     <BarChart3 className="text-v3-gold" size={22}/>
                     <span className="text-lg font-black font-display dark:text-white" style={{ color: isDark ? '' : '#2C2A29' }}>Dynamic Pricing</span>
                   </div>
                   <div className="space-y-4">
                     {(stats.pricingState || []).map(p => (
                       <div key={p.zone} className="p-4 rounded-2xl border border-black/5 dark:border-white/5 bg-white/40 dark:bg-black/20" style={{ borderColor: isDark ? '' : '#E5DFD7' }}>
                         <div className="flex justify-between items-center mb-2">
                           <span className="font-display font-black text-lg dark:text-white" style={{ color: isDark ? '' : '#2C2A29' }}>Zone {p.zone}</span>
                           <span className={`px-3 py-1 rounded-lg text-[10px] font-black tracking-widest uppercase ${
                             p.surgeActive ? 'bg-v3-ruby/10 text-v3-ruby' : 'bg-v3-emerald/10 text-v3-emerald'
                           }`}>
                             {p.surgeActive ? 'SURGE' : 'NORMAL'}
                           </span>
                         </div>
                         <div className="flex justify-between items-center">
                           <span className="text-xs font-bold opacity-40 dark:text-white" style={{ color: isDark ? '' : '#A39B93' }}>Occupancy: {p.occupancyPercent}%</span>
                           <span className="font-display font-black text-xl dark:text-white" style={{ color: isDark ? '' : '#2C2A29' }}>{p.multiplier}x</span>
                         </div>
                         <div className="w-full h-2 bg-gray-100 dark:bg-black/40 rounded-full overflow-hidden mt-2">
                           <div
                             className={`h-full rounded-full transition-all ${p.surgeActive ? 'bg-v3-ruby' : 'bg-v3-emerald'}`}
                             style={{ width: `${Math.min(p.occupancyPercent, 100)}%` }}
                           />
                         </div>
                       </div>
                     ))}
                   </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/5" style={{ borderColor: isDark ? '' : '#E5DFD7' }}>
                  <p className="text-[10px] font-bold opacity-30 text-center dark:text-white" style={{ color: isDark ? '' : '#6B6259' }}>Surge activates at &gt;80% zone occupancy (1.2x multiplier)</p>
                </div>
            </motion.div>
          </div>
        </>
      )}

      {activeTab === 'users' && (
        <motion.div variants={itemAnim} initial="hidden" animate="show" className="glass-panel rounded-[2.5rem] overflow-hidden">
          <div className="p-8 border-b border-gray-100 dark:border-white/5 bg-gray-50/30 dark:bg-white/5 flex items-center justify-between" style={{ backgroundColor: isDark ? '' : 'rgba(240,235,227,0.4)', borderColor: isDark ? '' : '#E5DFD7' }}>
            <div className="flex items-center gap-4">
              <UserCheck size={24} className="dark:text-v3-teal" style={{ color: isDark ? '' : '#C26A5A' }} />
              <span className="font-display font-black text-lg dark:text-white" style={{ color: isDark ? '' : '#2C2A29' }}>Registered Users</span>
            </div>
            <span className="text-xs font-black uppercase tracking-widest opacity-40 dark:text-white" style={{ color: isDark ? '' : '#A39B93' }}>{adminUsers.length} Total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 border-b border-gray-100 dark:border-white/5" style={{ borderColor: isDark ? '' : '#E5DFD7', color: isDark ? '' : '#A39B93' }}>
                  <th className="p-6">ID</th>
                  <th className="p-6">Name</th>
                  <th className="p-6">Email</th>
                  <th className="p-6">Phone</th>
                  <th className="p-6">Plate</th>
                  <th className="p-6">Balance</th>
                  <th className="p-6">Points</th>
                  <th className="p-6 text-right">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-white/5" style={{ borderColor: isDark ? '' : 'rgba(229,223,215,0.5)' }}>
                {adminUsers.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                    <td className="p-6 font-mono font-bold dark:text-v3-teal" style={{ color: isDark ? '' : '#C26A5A' }}>#{u.id}</td>
                    <td className="p-6 font-display font-black dark:text-white" style={{ color: isDark ? '' : '#2C2A29' }}>{u.name}</td>
                    <td className="p-6 text-sm opacity-60 dark:text-white" style={{ color: isDark ? '' : '#6B6259' }}>{u.email}</td>
                    <td className="p-6 text-sm opacity-60 dark:text-white" style={{ color: isDark ? '' : '#6B6259' }}>{u.phone || '—'}</td>
                    <td className="p-6 font-mono font-bold text-sm dark:text-white" style={{ color: isDark ? '' : '#2C2A29' }}>{u.vehiclePlate || '—'}</td>
                    <td className="p-6 font-display font-black dark:text-white" style={{ color: isDark ? '' : '#2C2A29' }}>{u.walletBalance} <span className="text-[10px] opacity-30">PKR</span></td>
                    <td className="p-6 font-display font-black text-v3-gold">{u.points}</td>
                    <td className="p-6 text-right">
                      <span className={`px-3 py-1 rounded-lg text-[10px] font-black tracking-widest uppercase ${
                        u.role === 'admin' ? 'bg-v3-indigo/10 text-v3-indigo dark:bg-v3-teal/10 dark:text-v3-teal' : 'bg-gray-100 dark:bg-black/40 opacity-50'
                      }`} style={(!isDark && u.role === 'admin') ? { backgroundColor: '#F1E4DF', color: '#C26A5A' } : {}}>
                        {u.role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {activeTab === 'bookings' && (
        <motion.div variants={itemAnim} initial="hidden" animate="show" className="glass-panel rounded-[2.5rem] overflow-hidden">
          <div className="p-8 border-b border-gray-100 dark:border-white/5 bg-gray-50/30 dark:bg-white/5 flex items-center gap-4" style={{ backgroundColor: isDark ? '' : 'rgba(240,235,227,0.4)', borderColor: isDark ? '' : '#E5DFD7' }}>
            <Car size={24} className="dark:text-v3-teal" style={{ color: isDark ? '' : '#C26A5A' }} />
            <span className="font-display font-black text-lg dark:text-white" style={{ color: isDark ? '' : '#2C2A29' }}>Recent Bookings</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 border-b border-gray-100 dark:border-white/5" style={{ borderColor: isDark ? '' : '#E5DFD7', color: isDark ? '' : '#A39B93' }}>
                  <th className="p-6">User</th>
                  <th className="p-6">Spot</th>
                  <th className="p-6">Start</th>
                  <th className="p-6">End</th>
                  <th className="p-6">Price</th>
                  <th className="p-6 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-white/5" style={{ borderColor: isDark ? '' : 'rgba(229,223,215,0.5)' }}>
                {(stats.recentBookings || []).map(b => (
                  <tr key={b.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                    <td className="p-6 font-display font-black dark:text-white" style={{ color: isDark ? '' : '#2C2A29' }}>{b.userName}</td>
                    <td className="p-6 font-display font-black dark:text-v3-teal text-xl" style={{ color: isDark ? '' : '#C26A5A' }}>{b.spotId}</td>
                    <td className="p-6 text-xs opacity-40 dark:text-white" style={{ color: isDark ? '' : '#6B6259' }}>{b.startTime ? new Date(b.startTime).toLocaleString() : ''}</td>
                    <td className="p-6 text-xs opacity-40 dark:text-white" style={{ color: isDark ? '' : '#6B6259' }}>{b.endTime ? new Date(b.endTime).toLocaleString() : ''}</td>
                    <td className="p-6 font-display font-black dark:text-white" style={{ color: isDark ? '' : '#2C2A29' }}>{b.price} <span className="text-[10px] opacity-30">PKR</span></td>
                    <td className="p-6 text-right">
                      <span className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase ${
                        b.status === 'active' ? 'bg-v3-emerald/20 text-v3-emerald' :
                        b.status === 'completed' ? 'bg-gray-100 dark:bg-black/40 opacity-50' :
                        'bg-v3-ruby/20 text-v3-ruby'
                      }`} style={(!isDark && b.status === 'completed') ? { backgroundColor: '#F1E4DF', color: '#A39B93' } : {}}>{b.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {activeTab === 'violations' && (
        <motion.div variants={itemAnim} initial="hidden" animate="show" className="glass-panel rounded-[2.5rem] overflow-hidden">
          <div className="p-8 border-b border-gray-100 dark:border-white/5 bg-v3-ruby/5 dark:bg-v3-ruby/10 flex items-center gap-4" style={{ borderColor: isDark ? '' : 'rgba(225,29,72,0.1)' }}>
            <AlertTriangle size={24} className="text-v3-ruby" />
            <span className="font-display font-black text-lg text-v3-ruby">Violation Registry</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 border-b border-gray-100 dark:border-white/5" style={{ borderColor: isDark ? '' : '#E5DFD7', color: isDark ? '' : '#A39B93' }}>
                  <th className="p-6">User</th><th className="p-6">Reservation</th><th className="p-6">Fine</th><th className="p-6 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-white/5" style={{ borderColor: isDark ? '' : 'rgba(229,223,215,0.5)' }}>
                {(stats.violations || []).map(v => (
                  <tr key={v.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                    <td className="py-6 px-6 font-mono font-bold dark:text-v3-teal" style={{ color: isDark ? '' : '#C26A5A' }}>User #{v.userId}</td>
                    <td className="py-6 px-6 font-mono opacity-50 dark:text-white" style={{ color: isDark ? '' : '#6B6259' }}>#{v.reservationId}</td>
                    <td className="py-6 px-6 font-black font-display text-xl dark:text-white" style={{ color: isDark ? '' : '#2C2A29' }}>{v.fineAmount} <span className="text-[10px] opacity-40">PKR</span></td>
                    <td className="py-6 px-6 text-right">
                      <span className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase ${v.isPaid ? 'bg-v3-emerald/20 text-v3-emerald' : 'bg-v3-ruby/20 text-v3-ruby'}`}>{v.isPaid ? 'RECOVERED' : 'AWAITING'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function KPI({ icon, label, value, bg, trend, isDark }) {
  return (
    <motion.div
        variants={itemAnim}
        initial="hidden"
        animate="show"
        whileHover={{ scale: 1.03, y: -6 }}
        className="glass-panel rounded-[2rem] p-8 flex flex-col h-full group overflow-hidden relative"
    >
        <div className={`absolute -bottom-8 -right-8 w-28 h-28 ${bg} opacity-10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700`}></div>
        <div className={`p-5 ${bg} rounded-[1.2rem] w-fit shadow-xl group-hover:rotate-12 transition-transform duration-500 text-white`}>
           {icon}
        </div>
        <div className="mt-8 relative z-10">
           <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-2 leading-none dark:text-white" style={{ color: isDark ? '' : '#A39B93' }}>{label}</p>
           <h3 className="text-3xl font-black font-display tracking-tighter leading-none mb-3 dark:text-white group-hover:text-v3-indigo dark:group-hover:text-v3-teal transition-colors" style={{ color: isDark ? '' : '#2C2A29' }}>{value}</h3>
           <div className="flex items-center gap-2">
              <TrendingUp size={12} className="text-v3-emerald"/>
              <span className="text-[10px] font-black uppercase tracking-widest text-v3-emerald">{trend}</span>
           </div>
        </div>
    </motion.div>
  );
}
