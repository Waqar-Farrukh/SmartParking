import { useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  DollarSign, Users, Car, AlertTriangle, TrendingUp, Zap, BarChart3, 
  Database, CheckCircle2, XCircle, UserCheck, Activity, PieChart,
  Search, Filter, Edit3, Trash2, ShieldAlert, Plus, MapPin, Power
} from 'lucide-react';
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
  const { 
    adminStats, refreshAdminStats, adminUsers, refreshAdminUsers, 
    dbHealth, checkHealth, theme, currentUser, spots,
    updateUserAdmin, deleteUserAdmin, addParkingSpot, deleteParkingSpot, toggleZoneStatus, toggleSpotStatus,
    deleteViolationAdmin, markViolationPaidAdmin
  } = useAppContext();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  
  // Modals
  const [editingUser, setEditingUser] = useState(null);
  const [showAddSpot, setShowAddSpot] = useState(false);
  const [newSpot, setNewSpot] = useState({ id: '', zone: 'A' });

  useEffect(() => {
    refreshAdminStats();
    refreshAdminUsers();
    checkHealth();
  }, []);

  const stats = adminStats || {
    totalRevenue: 0, totalUsers: 0, activeBookings: 0, completedBookings: 0, cancelledBookings: 0, totalBookings: 0,
    totalViolations: 0, unpaidViolations: 0,
    dailyRevenue: [], dailyBookings: [],
    zoneOccupancy: [], pricingState: [],
    violations: [], recentBookings: []
  };

  const isDark = theme === 'dark';
  const accentColor = isDark ? '#00ced1' : '#C26A5A';
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
      fill: true, tension: 0.4, borderWidth: 3, pointRadius: 6, pointBackgroundColor: accentColor, pointBorderColor: '#fff', pointBorderWidth: 2,
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
      borderColor: accentColor, borderWidth: 2, borderRadius: 12, barThickness: 24,
    }]
  };

  const zoneColors = ['#C26A5A', '#6C8B8A', '#D9A13B'];
  const zoneDarkColors = ['#00ced1', '#10b981', '#fbbf24'];
  const zoneOccupancyData = {
    labels: (stats.zoneOccupancy || []).map(z => `Zone ${z.zone}`),
    datasets: [{
      data: (stats.zoneOccupancy || []).map(z => z.occupied),
      backgroundColor: isDark ? zoneDarkColors : zoneColors,
      borderWidth: 0, cutout: '70%',
    }]
  };

  const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { 
      legend: { display: false }, 
      tooltip: { 
        enabled: true, backgroundColor: isDark ? '#0f172a' : '#fff', titleColor: isDark ? '#fff' : '#2C2A29', bodyColor: isDark ? '#ccc' : '#6B6259', 
        borderColor: isDark ? '#333' : '#E5DFD7', borderWidth: 1, titleFont: { family: 'Outfit', weight: 'bold' }, bodyFont: { family: 'Inter' }
      } 
    },
    scales: {
      y: { grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'Outfit', weight: 'bold' } } },
      x: { grid: { display: false }, ticks: { color: textColor, font: { family: 'Outfit', weight: 'bold' } } }
    }
  };

  const doughnutOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
    cutout: '70%'
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'users', label: 'User Registry' },
    { id: 'parking', label: 'Infrastructure' },
    { id: 'bookings', label: 'Recent History' },
    { id: 'violations', label: 'Violations' },
  ];

  // Logic
  const filteredUsers = adminUsers.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (u.vehiclePlate && u.vehiclePlate.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleEditUser = (user) => {
    setEditingUser({ ...user });
  };

  const saveUserEdit = async () => {
    const success = await updateUserAdmin(editingUser.id, editingUser);
    if (success) setEditingUser(null);
    else alert("Failed to update user");
  };

  const handleDeleteUser = async (id) => {
    if (window.confirm("Are you sure you want to delete this user? All their history will be removed.")) {
      const success = await deleteUserAdmin(id);
      if (!success) alert("Failed to delete user");
    }
  };

  const handleAddSpot = async () => {
    if (!newSpot.id) return;
    const success = await addParkingSpot(newSpot.id, newSpot.zone);
    if (success) {
      setShowAddSpot(false);
      setNewSpot({ id: '', zone: 'A' });
    } else {
      alert("Failed to add spot (maybe ID already exists?)");
    }
  };

  const handleToggleZone = async (zone, currentStatus) => {
    const confirmMsg = currentStatus > 0 
      ? `Force Zone ${zone} offline? All spots will become unavailable.` 
      : `Bring Zone ${zone} back online?`;
      
    if (window.confirm(confirmMsg)) {
      await toggleZoneStatus(zone, currentStatus > 0 ? false : true);
    }
  };

  const handleDeleteSpot = async (id) => {
    if (window.confirm(`Delete spot ${id}? If it has history, it will be deactivated instead.`)) {
      await deleteParkingSpot(id);
    }
  };

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
      <div className="flex bg-white dark:bg-black/20 p-2 rounded-2xl gap-2 shadow-aesthetic border border-gray-100 dark:border-white/5 overflow-x-auto scrollbar-none" style={{ borderColor: isDark ? '' : '#E5DFD7' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all whitespace-nowrap ${
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
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
            <KPI icon={<DollarSign size={28}/>} label="Total Revenue" value={`${stats.totalRevenue.toLocaleString()} PKR`} bg="bg-v3-emerald" trend={`${stats.totalBookings} total bookings`} isDark={isDark} />
            <KPI icon={<Users size={28}/>} label="Total Users" value={stats.totalUsers} bg="bg-v3-indigo" trend="Registered accounts" isDark={isDark} />
            <KPI icon={<Car size={28}/>} label="Active Session" value={stats.activeBookings} bg="bg-v3-teal" trend="Parked right now" isDark={isDark} />
            <KPI icon={<CheckCircle2 size={28}/>} label="Completed" value={stats.completedBookings} bg="bg-v3-emerald" trend="Finished sessions" isDark={isDark} />
            <KPI icon={<XCircle size={28}/>} label="Cancelled" value={stats.cancelledBookings} bg="bg-v3-ruby" trend="User cancellations" isDark={isDark} />
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <motion.div variants={itemAnim} initial="hidden" animate="show" className="glass-panel rounded-[2.5rem] p-8 flex flex-col">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-xl font-black font-display flex items-center gap-3 dark:text-v3-teal" style={{ color: isDark ? '' : '#C26A5A' }}><BarChart3 size={24}/> Weekly Bookings</h2>
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-40 dark:text-white" style={{ color: isDark ? '' : '#A39B93' }}>Last 7 Days</span>
                </div>
                <div className="flex-1 min-h-[280px]">
                    <Bar data={bookingsData} options={chartOptions} />
                </div>
            </motion.div>

            <motion.div variants={itemAnim} initial="hidden" animate="show" className="glass-panel rounded-[2.5rem] p-8 flex flex-col">
                <div className="flex items-center gap-3 mb-8">
                    <Zap className="dark:text-v3-emerald" style={{ color: isDark ? '' : '#6C8B8A' }} size={24}/>
                    <h2 className="text-xl font-black font-display dark:text-white" style={{ color: isDark ? '' : '#2C2A29' }}>Dynamic Parking Surge</h2>
                </div>
                <div className="space-y-4 max-h-[280px] overflow-y-auto pr-2 scrollbar-thin">
                  {(stats.pricingState || []).map((zone, idx) => (
                    <div key={idx} className="p-4 rounded-2xl bg-white/50 dark:bg-black/20 border border-gray-100 dark:border-white/5 flex items-center justify-between" style={{ borderColor: isDark ? '' : '#E5DFD7' }}>
                       <div>
                          <p className="font-display font-black text-lg dark:text-white" style={{ color: isDark ? '' : '#2C2A29' }}>Zone {zone.zone}</p>
                          <p className="text-xs font-bold opacity-60 dark:text-white" style={{ color: isDark ? '' : '#6B6259' }}>{zone.occupancyPercent}% Occupied (Cap: 80%)</p>
                       </div>
                       <div className="text-right flex flex-col gap-1 items-end">
                          <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${zone.surgeActive ? 'bg-v3-ruby/10 text-v3-ruby' : 'bg-v3-emerald/10 text-v3-emerald'}`}>
                            {zone.surgeActive ? 'Surge Active' : 'Normal Rate'}
                          </span>
                          {zone.surgeActive && <span className="text-[9px] font-black uppercase text-v3-ruby opacity-80 leading-none">Dynamic parking implemented</span>}
                       </div>
                    </div>
                  ))}
                  {(!stats.pricingState || stats.pricingState.length === 0) && (
                    <p className="font-display font-black opacity-20 text-center dark:text-white pt-10" style={{ color: isDark ? '' : '#A39B93' }}>No pricing data</p>
                  )}
                </div>
            </motion.div>
          </div>
        </>
      )}

      {activeTab === 'users' && (
        <motion.div variants={itemAnim} initial="hidden" animate="show" className="glass-panel rounded-[2.5rem] overflow-hidden">
          <div className="p-8 border-b border-gray-100 dark:border-white/5 bg-gray-50/30 dark:bg-white/5 space-y-6" style={{ backgroundColor: isDark ? '' : 'rgba(240,235,227,0.4)', borderColor: isDark ? '' : '#E5DFD7' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <UserCheck size={24} className="dark:text-v3-teal" style={{ color: isDark ? '' : '#C26A5A' }} />
                <span className="font-display font-black text-lg dark:text-white" style={{ color: isDark ? '' : '#2C2A29' }}>User Registry</span>
              </div>
              <span className="text-xs font-black uppercase tracking-widest opacity-40 dark:text-white" style={{ color: isDark ? '' : '#A39B93' }}>{filteredUsers.length} Found</span>
            </div>
            
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 dark:text-white" size={18} />
                <input 
                  type="text" 
                  placeholder="Search by name, email or plate..."
                  className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white/50 dark:bg-black/20 border border-gray-100 dark:border-white/5 font-bold text-sm focus:ring-2 ring-v3-teal/30 focus:border-v3-teal outline-none transition-all dark:text-white"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 bg-white/50 dark:bg-black/20 p-2 rounded-2xl border border-gray-100 dark:border-white/5">
                <Filter className="ml-2 opacity-30 dark:text-white" size={18} />
                <select 
                  className="bg-transparent border-none font-black text-xs uppercase tracking-widest outline-none px-4 py-2 dark:text-white"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Admins</option>
                  <option value="user">Users</option>
                </select>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 border-b border-gray-100 dark:border-white/5" style={{ borderColor: isDark ? '' : '#E5DFD7', color: isDark ? '' : '#A39B93' }}>
                  <th className="p-6">User Details</th>
                  <th className="p-6">Vehicle</th>
                  <th className="p-6">Financials</th>
                  <th className="p-6">Role</th>
                  <th className="p-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-white/5" style={{ borderColor: isDark ? '' : 'rgba(229,223,215,0.5)' }}>
                {filteredUsers.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                    <td className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-v3-teal/10 flex items-center justify-center font-display font-black text-v3-teal">
                          {u.name[0]}
                        </div>
                        <div>
                          <p className="font-display font-black dark:text-white" style={{ color: isDark ? '' : '#2C2A29' }}>{u.name}</p>
                          <p className="text-xs opacity-40 dark:text-white" style={{ color: isDark ? '' : '#6B6259' }}>{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-6">
                       <span className="font-mono font-bold text-xs p-2 rounded-lg bg-gray-100 dark:bg-black/40 dark:text-white" style={{ color: isDark ? '' : '#2C2A29' }}>{u.vehiclePlate || '—'}</span>
                       <p className="text-[10px] mt-1 opacity-40 dark:text-white" style={{ color: isDark ? '' : '#A39B93' }}>{u.phone || 'No Phone'}</p>
                    </td>
                    <td className="p-6">
                      <div className="flex flex-col gap-1">
                        <span className="font-display font-black text-sm dark:text-white" style={{ color: isDark ? '' : '#2C2A29' }}>{u.walletBalance} <span className="text-[10px] opacity-40 uppercase tracking-widest">PKR</span></span>
                        {u.role !== 'admin' ? (
                          <span className="text-[10px] font-black text-v3-gold uppercase tracking-widest">{u.points} Points</span>
                        ) : (
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest opacity-50">—</span>
                        )}
                      </div>
                    </td>
                    <td className="p-6">
                      <span className={`px-3 py-1 rounded-lg text-[10px] font-black tracking-widest uppercase ${
                        u.role === 'admin' ? 'bg-indigo-500/10 text-indigo-500 dark:bg-v3-teal/10 dark:text-v3-teal' : 'bg-gray-100 dark:bg-black/40 opacity-50'
                      }`} style={(!isDark && u.role === 'admin') ? { backgroundColor: '#F1E4DF', color: '#C26A5A' } : {}}>
                        {u.role}
                      </span>
                    </td>
                    <td className="p-6 text-right">
                       <div className="flex justify-end gap-2">
                          <button onClick={() => handleEditUser(u)} className="p-3 bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl hover:bg-v3-indigo hover:text-white dark:hover:bg-v3-teal dark:hover:text-v3-slate transition-all shadow-sm">
                            <Edit3 size={16} />
                          </button>
                          {u.id !== currentUser.id && (
                            <button onClick={() => handleDeleteUser(u.id)} className="p-3 bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl hover:bg-v3-ruby hover:text-white transition-all shadow-sm group">
                              <Trash2 size={16} className="group-hover:animate-bounce" />
                            </button>
                          )}
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {activeTab === 'parking' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <motion.div variants={itemAnim} initial="hidden" animate="show" className="glass-panel rounded-[2.5rem] p-8">
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                  <Database size={22} className="text-v3-indigo" />
                  <h2 className="text-xl font-black font-display dark:text-white" style={{ color: isDark ? '' : '#2C2A29' }}>Spot Inventory</h2>
                </div>
                <button 
                  onClick={() => setShowAddSpot(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-v3-teal text-v3-slate font-black text-xs uppercase tracking-widest rounded-xl shadow-vibrant hover:scale-105 transition-transform"
                >
                  <Plus size={16} /> Add New Spot
                </button>
              </div>

              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin">
                {(stats.zoneOccupancy || []).map(zone => (
                  <div key={zone.zone} className="p-6 rounded-3xl bg-white/50 dark:bg-black/20 border border-gray-100 dark:border-white/5" style={{ borderColor: isDark ? '' : '#E5DFD7' }}>
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-3">
                        <MapPin size={18} className="dark:text-v3-teal" style={{ color: isDark ? '' : '#C26A5A' }} />
                        <span className="font-display font-black text-lg dark:text-white" style={{ color: isDark ? '' : '#2C2A29' }}>Zone {zone.zone}</span>
                      </div>
                      <button 
                        onClick={() => handleToggleZone(zone.zone, zone.online)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                          zone.online > 0 ? 'bg-v3-emerald/10 text-v3-emerald hover:bg-v3-ruby/10 hover:text-v3-ruby' : 'bg-v3-ruby/10 text-v3-ruby hover:bg-v3-emerald/10 hover:text-v3-emerald'
                        }`}
                      >
                        <Power size={12} /> {zone.online > 0 ? 'Zone Online' : 'Zone Offline'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-4">
                       {spots.filter(s => s.zone === zone.zone).map(spot => {
                         const isOccupied = spot.status === 'occupied';
                         const isOffline = spot.status === 'unavailable';
                         
                         return (
                           <button 
                             key={spot.id}
                             onClick={() => toggleSpotStatus(spot.id, isOffline ? true : false)}
                             className={`px-4 py-3 rounded-2xl font-mono font-black text-xs transition-all border shadow-sm relative min-w-[120px] flex flex-col items-center gap-1 ${
                               isOffline 
                                 ? 'bg-blue-500/10 border-blue-500/30 text-blue-600' 
                                 : isOccupied
                                   ? 'bg-v3-ruby/10 border-v3-ruby/30 text-v3-ruby'
                                   : 'bg-white dark:bg-white/5 border-gray-100 dark:border-white/10 dark:text-white hover:border-v3-teal'
                             }`}
                             title={isOffline ? `Click to enable ${spot.id}` : (isOccupied ? 'Currently Occupied' : `Click to disable ${spot.id}`)}
                           >
                             <span className="text-sm">{spot.id}</span>
                             <span className="text-[8px] uppercase tracking-tighter opacity-80">
                               {isOffline ? 'Offline now' : (isOccupied ? 'Reserved vehicle parked here' : 'Available')}
                             </span>
                             <div className={`w-2 h-2 rounded-full absolute top-2 right-2 ${isOffline ? 'bg-blue-500' : (isOccupied ? 'bg-v3-ruby' : 'bg-v3-emerald')}`}></div>
                           </button>
                         );
                       })}
                    </div>
                  </div>
                ))}
              </div>
           </motion.div>

           <motion.div variants={itemAnim} initial="hidden" animate="show" className="glass-panel rounded-[2.5rem] p-8 flex flex-col justify-center items-center text-center">
              <ShieldAlert size={64} className="text-v3-ruby/20 mb-6" />
              <h2 className="text-3xl font-black font-display tracking-tighter mb-4 dark:text-white" style={{ color: isDark ? '' : '#2C2A29' }}>Infrastructure <span className="text-v3-ruby">Audit.</span></h2>
              <p className="max-w-xs font-bold opacity-60 mb-8 dark:text-white" style={{ color: isDark ? '' : '#6B6259' }}>Manage the physical layout of the smart parking network. Changes here affect live availability.</p>
              <div className="grid grid-cols-2 gap-4 w-full">
                 <div className="p-6 rounded-3xl bg-v3-emerald/5 border border-v3-emerald/10 text-center">
                    <p className="text-2xl font-black font-display text-v3-emerald leading-tight">{stats.zoneOccupancy?.reduce((a,b) => a + b.available, 0)}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-40 text-v3-emerald">Free Spots</p>
                 </div>
                 <div className="p-6 rounded-3xl bg-v3-indigo/5 border border-v3-indigo/10 text-center">
                    <p className="text-2xl font-black font-display text-v3-indigo leading-tight">{stats.zoneOccupancy?.length || 0}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-40 text-v3-indigo">Active Sectors</p>
                 </div>
              </div>
           </motion.div>
        </div>
      )}

      {/* Other tabs kept as is but updated with styles */}
      {activeTab === 'bookings' && (
        <motion.div variants={itemAnim} initial="hidden" animate="show" className="glass-panel rounded-[2.5rem] overflow-hidden">
          <div className="p-8 border-b border-gray-100 dark:border-white/5 bg-gray-50/30 dark:bg-white/5 flex items-center gap-4" style={{ backgroundColor: isDark ? '' : 'rgba(240,235,227,0.4)', borderColor: isDark ? '' : '#E5DFD7' }}>
            <Car size={24} className="dark:text-v3-teal" style={{ color: isDark ? '' : '#C26A5A' }} />
            <span className="font-display font-black text-lg dark:text-white" style={{ color: isDark ? '' : '#2C2A29' }}>Live Analytics</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 border-b border-gray-100 dark:border-white/5" style={{ borderColor: isDark ? '' : '#E5DFD7', color: isDark ? '' : '#A39B93' }}>
                  <th className="p-6">User</th><th className="p-6">Spot</th><th className="p-6">Start</th><th className="p-6">End</th><th className="p-6">Price</th><th className="p-6 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-white/5" style={{ borderColor: isDark ? '' : 'rgba(229,223,215,0.5)' }}>
                {(stats.recentBookings || []).map(b => (
                  <tr key={b.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                    <td className="p-6 font-display font-black dark:text-white" style={{ color: isDark ? '' : '#2C2A29' }}>{b.userName}</td>
                    <td className="p-6 font-display font-black dark:text-v3-teal text-xl" style={{ color: isDark ? '' : '#C26A5A' }}>{b.spotId}</td>
                    <td className="p-6 text-xs opacity-40 dark:text-white" style={{ color: isDark ? '' : '#6B6259' }}>{b.startTime ? new Date(b.startTime).toLocaleString() : ''}</td>
                    <td className="p-6 text-xs opacity-40 dark:text-white" style={{ color: isDark ? '' : '#6B6259' }}>{b.endTime ? new Date(b.endTime).toLocaleString() : ''}</td>
                    <td className="p-6 font-display font-black dark:text-white" style={{ color: isDark ? '' : '#2C2A29' }}>{b.finalPrice} <span className="text-[10px] opacity-30">PKR</span></td>
                    <td className="p-6 text-right">
                      <div className="flex justify-end gap-2 items-center">
                        {b.status === 'active' && (
                          <button 
                            onClick={async () => {
                              if(window.confirm("Force complete this session? No additional fines will be calculated.")) {
                                await forceCompleteBooking(b.id);
                              }
                            }}
                            className="px-3 py-1.5 bg-v3-ruby/10 text-v3-ruby rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-v3-ruby hover:text-white transition-all shadow-sm"
                          >
                            Force End
                          </button>
                        )}
                        <span className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase ${
                          b.status === 'active' ? 'bg-v3-emerald/20 text-v3-emerald' :
                          b.status === 'completed' ? 'bg-gray-50 dark:bg-black/40 opacity-50' : 'bg-v3-ruby/20 text-v3-ruby'
                        }`}>{b.status}</span>
                      </div>
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
          <div className="p-8 border-b border-gray-100 dark:border-white/5 bg-v3-ruby/5 dark:bg-v3-ruby/10 flex items-center gap-4">
            <AlertTriangle size={24} className="text-v3-ruby" />
            <span className="font-display font-black text-lg text-v3-ruby">System Violations</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 border-b border-gray-100 dark:border-white/5" style={{ color: isDark ? '' : '#A39B93' }}>
                  <th className="p-6">Identifier</th><th className="p-6">Reservation</th><th className="p-6">Fine Amount</th><th className="p-6 text-right">Payment Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                {(stats.violations || []).map(v => (
                  <tr key={v.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                    <td className="py-6 px-6 font-mono font-bold dark:text-v3-teal" style={{ color: isDark ? '' : '#C26A5A' }}>
                      <span className="font-display">User #{v.userId}</span>
                      {v.userName && <span className="ml-2 px-2 py-1 bg-black/5 dark:bg-white/5 rounded-md text-[10px] font-sans opacity-70 uppercase tracking-widest">{v.userName}</span>}
                    </td>
                    <td className="py-6 px-6 font-mono opacity-50 dark:text-white" style={{ color: isDark ? '' : '#6B6259' }}>#{v.reservationId}</td>
                    <td className="py-6 px-6 font-black font-display text-xl dark:text-white" style={{ color: isDark ? '' : '#2C2A29' }}>{v.fineAmount} <span className="text-[10px] opacity-40">PKR</span></td>
                    <td className="py-6 px-6 text-right">
                       <div className="flex justify-end gap-3 items-center">
                          {!v.isPaid && (
                            <button 
                              onClick={async () => await markViolationPaidAdmin(v.id)}
                              className="px-4 py-2 bg-v3-emerald/10 text-v3-emerald rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-v3-emerald hover:text-white transition-all shadow-sm"
                            >
                              Mark Paid
                            </button>
                          )}
                          <button 
                            onClick={async () => {
                              if(window.confirm("Forgive this violation? It will be permanently removed.")) {
                                await deleteViolationAdmin(v.id);
                              }
                            }}
                            className="p-2.5 bg-white dark:bg-white/5 border border-v3-ruby/20 rounded-xl text-v3-ruby hover:bg-v3-ruby hover:text-white transition-all shadow-sm"
                            title="Forgive Violation"
                          >
                            <Trash2 size={16} />
                          </button>
                          <span className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase ${v.isPaid ? 'bg-v3-emerald/20 text-v3-emerald' : 'bg-v3-ruby/20 text-v3-ruby'}`}>
                            {v.isPaid ? 'PAID' : 'PENDING'}
                          </span>
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* MODALS */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 sm:p-0">
             <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               onClick={() => setEditingUser(null)}
               className="absolute inset-0 bg-black/60 backdrop-blur-sm"
             />
             <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
               className="glass-panel w-full max-w-xl rounded-[2.5rem] p-10 relative z-10 overflow-hidden"
             >
                <div className="absolute top-0 right-0 w-32 h-32 bg-v3-teal/5 rounded-full blur-3xl"></div>
                <h2 className="text-3xl font-black font-display tracking-tighter mb-8 dark:text-white" style={{ color: isDark ? '' : '#2C2A29' }}>Edit User <span className="text-v3-teal">Profile.</span></h2>
                
                <div className="space-y-6">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest opacity-40 dark:text-white">Full Name</label>
                        <input type="text" value={editingUser.name} onChange={e => setEditingUser({...editingUser, name: e.target.value})} className="w-full p-4 rounded-xl bg-black/5 dark:bg-white/5 border-none font-bold text-sm dark:text-white focus:ring-2 ring-v3-teal" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest opacity-40 dark:text-white">Vehicle Plate</label>
                        <input type="text" value={editingUser.vehiclePlate} onChange={e => setEditingUser({...editingUser, vehiclePlate: e.target.value})} className="w-full p-4 rounded-xl bg-black/5 dark:bg-white/5 border-none font-bold text-sm dark:text-white focus:ring-2 ring-v3-teal font-mono uppercase" />
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-widest opacity-40 dark:text-white">Loyalty Points Management</label>
                        <div className="bg-v3-gold/5 dark:bg-v3-gold/10 p-5 rounded-3xl border border-v3-gold/20 shadow-sm">
                           <input type="number" value={editingUser.points} onChange={e => setEditingUser({...editingUser, points: parseInt(e.target.value) || 0})} className="w-full bg-transparent border-none font-black text-2xl text-v3-gold outline-none p-0 mb-4" />
                           <div className="grid grid-cols-3 gap-2">
                             {[100, 500, 1000].map(amt => (
                               <button key={amt} onClick={() => setEditingUser({...editingUser, points: editingUser.points + amt})} className="py-2 rounded-xl bg-v3-gold text-white font-black text-[10px] hover:scale-105 active:scale-95 transition-all shadow-sm">+{amt}</button>
                             ))}
                             {[100, 500, 1000].map(amt => ( // Corrected logic: subtract amt
                               <button key={`minus-${amt}`} onClick={() => setEditingUser({...editingUser, points: Math.max(0, editingUser.points - amt)})} className="py-2 rounded-xl bg-white dark:bg-black/20 border border-v3-gold text-v3-gold font-black text-[10px] hover:scale-105 active:scale-95 transition-all shadow-sm">-{amt}</button>
                             ))}
                           </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-widest opacity-40 dark:text-white">Wallet Balance Management</label>
                        <div className="bg-v3-teal/5 dark:bg-v3-teal/10 p-5 rounded-3xl border border-v3-teal/20 shadow-sm">
                           <div className="flex items-center gap-1">
                             <input type="number" value={editingUser.walletBalance} onChange={e => setEditingUser({...editingUser, walletBalance: parseFloat(e.target.value) || 0})} className="w-full bg-transparent border-none font-black text-2xl dark:text-white outline-none p-0 mb-4" />
                             <span className="text-[10px] font-black opacity-30 mt-[-1rem]">PKR</span>
                           </div>
                           <div className="grid grid-cols-3 gap-2">
                             {[100, 500, 1000].map(amt => (
                               <button key={amt} onClick={() => setEditingUser({...editingUser, walletBalance: editingUser.walletBalance + amt})} className="py-2 rounded-xl bg-v3-teal text-v3-slate font-black text-[10px] hover:scale-105 active:scale-95 transition-all shadow-sm">+{amt}</button>
                             ))}
                             {[100, 500, 1000].map(amt => (
                               <button key={`minus-${amt}`} onClick={() => setEditingUser({...editingUser, walletBalance: Math.max(0, editingUser.walletBalance - amt)})} className="py-2 rounded-xl bg-white dark:bg-black/20 border border-v3-teal text-v3-teal font-black text-[10px] hover:scale-105 active:scale-95 transition-all shadow-sm">-{amt}</button>
                             ))}
                           </div>
                        </div>
                      </div>
                   </div>

                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest opacity-40 dark:text-white">User Role</label>
                          <select value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value})} className="w-full p-4 rounded-xl bg-black/5 dark:bg-white/5 border-none font-black text-xs uppercase tracking-widest dark:text-white focus:ring-2 ring-v3-teal">
                              <option value="user">Normal User</option>
                              <option value="admin">Administrator</option>
                          </select>
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest opacity-40 dark:text-white">Vehicle Type</label>
                          <select value={editingUser.vehicleTypeId} onChange={e => setEditingUser({...editingUser, vehicleTypeId: parseInt(e.target.value)})} className="w-full p-4 rounded-xl bg-black/5 dark:bg-white/5 border-none font-black text-xs uppercase tracking-widest dark:text-white focus:ring-2 ring-v3-teal">
                              <option value={1}>Bike (v1)</option>
                              <option value={2}>Car (v2)</option>
                              <option value={3}>SUV (v3)</option>
                          </select>
                       </div>
                    </div>

                   <div className="flex gap-4 pt-6">
                      <button onClick={saveUserEdit} className="flex-1 py-4 bg-gray-900 text-white dark:bg-v3-teal dark:text-v3-slate font-black text-xs uppercase tracking-widest rounded-2xl shadow-vibrant hover:scale-[1.02] transition-all">Save Changes</button>
                      <button onClick={() => setEditingUser(null)} className="flex-1 py-4 bg-white/5 border border-black/10 dark:border-white/10 font-black text-xs uppercase tracking-widest rounded-2xl dark:text-white hover:bg-v3-ruby/10 hover:text-v3-ruby transition-all">Cancel</button>
                   </div>
                </div>
             </motion.div>
          </div>
        )}

        {showAddSpot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 sm:p-0">
             <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               onClick={() => setShowAddSpot(false)}
               className="absolute inset-0 bg-black/60 backdrop-blur-sm"
             />
             <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
               className="glass-panel w-full max-w-sm rounded-[2.5rem] p-10 relative z-10"
             >
                <h2 className="text-2xl font-black font-display tracking-tighter mb-8 dark:text-white">Add Parking <span className="text-v3-indigo">Spot.</span></h2>
                
                <div className="space-y-4">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest opacity-40 dark:text-white">Zone ID</label>
                      <div className="flex flex-col gap-3">
                          <div className="flex gap-2">
                             {['A', 'B', 'C'].map(z => (
                               <button 
                                 key={z} 
                                 onClick={() => setNewSpot({...newSpot, zone: z})}
                                 className={`flex-1 py-3 rounded-xl font-black transition-all ${newSpot.zone === z ? 'bg-v3-indigo text-white shadow-lg' : 'bg-black/5 dark:bg-white/5 opacity-40 dark:text-white'}`}
                               >
                                 Zone {z}
                               </button>
                             ))}
                          </div>
                          <input 
                            type="text" 
                            placeholder="Or enter new Zone (e.g. A12)" 
                            value={newSpot.zone}
                            onChange={(e) => setNewSpot({...newSpot, zone: e.target.value.toUpperCase()})}
                            className="w-full p-4 rounded-xl bg-black/5 dark:bg-white/5 border-none font-black text-xs text-center focus:ring-2 ring-v3-indigo dark:text-white placeholder:opacity-30"
                          />
                       </div>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest opacity-40 dark:text-white">Spot Identifier</label>
                      <input 
                        type="text" 
                        placeholder="e.g. A11" 
                        value={newSpot.id} 
                        onChange={e => setNewSpot({...newSpot, id: e.target.value.toUpperCase()})}
                        className="w-full p-4 rounded-xl bg-black/5 dark:bg-white/5 border-none font-black text-xl text-center focus:ring-2 ring-v3-indigo dark:text-white placeholder:opacity-20" 
                      />
                   </div>
                   <button onClick={handleAddSpot} className="w-full py-4 bg-v3-indigo text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-aesthetic hover:scale-[1.02] transition-all mt-4">Confirm Deployment</button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
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
