import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(JSON.parse(localStorage.getItem('parking_user')) || null);
  const [spots, setSpots] = useState([]);
  const [dashboardData, setDashboardData] = useState({ wallet: 0, points: 0, lifetimePoints: 0, referralCode: '', history: [] });
  const [violations, setViolations] = useState([]);
  const [walletTransactions, setWalletTransactions] = useState([]);
  const [pointTransactions, setPointTransactions] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [leaderboardData, setLeaderboardData] = useState({ leaderboard: [], totalUsers: 0 });
  const [adminStats, setAdminStats] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);
  const [dbHealth, setDbHealth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('parking_theme') || 'light');
  const isFetching = useRef(false);

  const isAdmin = currentUser?.role === 'admin';
  // Use environment variable for deployment, fallback to localhost for local dev
  const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000") + "/api";
  
  useEffect(() => {
    console.log('Current User Role:', currentUser?.role);
    console.log('isAdmin:', isAdmin);
  }, [currentUser, isAdmin]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('parking_theme', newTheme);
  };

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [theme]);

  // ===== HEALTH CHECK =====
  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/health`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const data = await res.json();
      setDbHealth(data);
      return data;
    } catch (err) {
      const errData = { status: 'error', message: 'Cannot reach backend server' };
      setDbHealth(errData);
      return errData;
    }
  }, []);

  // ===== SPOTS =====
  const refreshSpots = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/parking/spots`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const data = await res.json();
      setSpots(data);
    } catch (err) { console.error('refreshSpots:', err); }
  }, []);

  // ===== DASHBOARD =====
  const refreshDashboard = useCallback(async () => {
    if (!currentUser || isFetching.current) return;
    isFetching.current = true;
    try {
      const res = await fetch(`${API_BASE}/user/${currentUser.id}/dashboard`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const data = await res.json();
      setDashboardData(data);
      setCurrentUser(prev => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          walletBalance: data.wallet,
          points: data.points,
          referralCode: data.referralCode || prev.referralCode
        };
        localStorage.setItem('parking_user', JSON.stringify(updated));
        return updated;
      });
    } catch (err) { console.error('refreshDashboard:', err); }
    finally { isFetching.current = false; }
  }, [currentUser?.id]);

  // ===== VIOLATIONS =====
  const refreshViolations = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`${API_BASE}/user/${currentUser.id}/violations`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const data = await res.json();
      setViolations(data);
    } catch (err) { console.error('refreshViolations:', err); }
  }, [currentUser?.id]);

  const payFine = async (violation) => {
    try {
      const res = await fetch(`${API_BASE}/user/${currentUser.id}/violations/pay`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ violationId: violation.id })
      });
      const data = await res.json();
      if (data.status === 'success') {
        await Promise.all([refreshViolations(), refreshDashboard(), refreshWallet()]);
        return true;
      } else {
        alert(data.message || 'Payment failed');
        return false;
      }
    } catch (err) { console.error('payFine:', err); return false; }
  };

  const triggerOverstays = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`${API_BASE}/user/${currentUser.id}/violations/check`, {
        method: 'POST',
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const data = await res.json();
      await refreshViolations();
      return data.violationsCreated || 0;
    } catch (err) { console.error('triggerOverstays:', err); return 0; }
  };

  // ===== LOYALTY =====
  const refreshLoyalty = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`${API_BASE}/user/${currentUser.id}/loyalty`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const data = await res.json();
      setPointTransactions(data.transactions || []);
      setCurrentUser(prev => prev ? { ...prev, points: data.points } : prev);
    } catch (err) { console.error('refreshLoyalty:', err); }
  }, [currentUser?.id]);

  const redeemPoints = async () => {
    try {
      const res = await fetch(`${API_BASE}/user/${currentUser.id}/loyalty/redeem`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        }
      });
      const data = await res.json();
      if (data.status === 'success') {
        await refreshLoyalty();
        await refreshDashboard();
        return data.code;
      } else {
        alert(data.message || 'Redeem failed');
        return null;
      }
    } catch (err) { console.error('redeemPoints:', err); return null; }
  };

  // ===== WALLET =====
  const refreshWallet = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`${API_BASE}/user/${currentUser.id}/wallet`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const data = await res.json();
      setWalletTransactions(data.transactions || []);
      setCurrentUser(prev => prev ? { ...prev, walletBalance: data.balance } : prev);
    } catch (err) { console.error('refreshWallet:', err); }
  }, [currentUser?.id]);

  const addWallet = async (amount) => {
    try {
      const res = await fetch(`${API_BASE}/user/${currentUser.id}/wallet/topup`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ amount })
      });
      const data = await res.json();
      if (data.status === 'success') {
        await refreshWallet();
        await refreshDashboard();
        return true;
      }
      return false;
    } catch (err) { console.error('addWallet:', err); return false; }
  };

  // ===== BOOKINGS =====
  const refreshBookings = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`${API_BASE}/user/${currentUser.id}/bookings`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const data = await res.json();
      setBookings(Array.isArray(data) ? data : []);
    } catch (err) { console.error('refreshBookings:', err); }
  }, [currentUser?.id]);

  const cancelReservation = async (reservation) => {
    try {
      const res = await fetch(`${API_BASE}/user/${currentUser.id}/bookings/cancel`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ reservationId: reservation.id })
      });
      const data = await res.json();
      if (data.status === 'success') {
        await refreshBookings();
        await refreshDashboard();
        await refreshWallet();
        await refreshSpots();
        return { success: true, refund: data.refund };
      } else {
        alert(data.message || 'Cancel failed');
        return { success: false };
      }
    } catch (err) { console.error('cancelReservation:', err); return { success: false }; }
  };

  // ===== LEADERBOARD =====
  const refreshLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/leaderboard`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const data = await res.json();
      setLeaderboardData(data);
    } catch (err) { console.error('refreshLeaderboard:', err); }
  }, []);

  // ===== ADMIN =====
  const refreshAdminStats = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`${API_BASE}/admin/stats?sender_id=${currentUser.id}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const data = await res.json();
      setAdminStats(data);
    } catch (err) { console.error('refreshAdminStats:', err); }
  }, [currentUser?.id]);

  const refreshAdminUsers = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`${API_BASE}/admin/users?sender_id=${currentUser.id}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const data = await res.json();
      setAdminUsers(data.users || []);
    } catch (err) { console.error('refreshAdminUsers:', err); }
  }, [currentUser?.id]);

  const updateUserAdmin = async (userId, updateData) => {
    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId}?sender_id=${currentUser.id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify(updateData)
      });
      const data = await res.json();
      if (data.status === 'success') {
        await refreshAdminUsers();
        return true;
      }
      return false;
    } catch (err) { console.error('updateUserAdmin:', err); return false; }
  };

  const deleteUserAdmin = async (userId) => {
    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId}?sender_id=${currentUser.id}`, {
        method: 'DELETE',
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const data = await res.json();
      if (data.status === 'success') {
        await refreshAdminUsers();
        return true;
      }
      return false;
    } catch (err) { console.error('deleteUserAdmin:', err); return false; }
  };

  const addParkingSpot = async (spotId, zoneId) => {
    try {
      const res = await fetch(`${API_BASE}/admin/spots?sender_id=${currentUser.id}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ spotId, zoneId })
      });
      const data = await res.json();
      if (data.status === 'success') {
        await refreshSpots();
        await refreshAdminStats();
        return true;
      }
      return false;
    } catch (err) { console.error('addParkingSpot:', err); return false; }
  };

  const deleteParkingSpot = async (spotId) => {
    try {
      const res = await fetch(`${API_BASE}/admin/spots/${spotId}?sender_id=${currentUser.id}`, {
        method: 'DELETE',
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const data = await res.json();
      if (data.status === 'success') {
        await refreshSpots();
        await refreshAdminStats();
        return true;
      }
      return false;
    } catch (err) { console.error('deleteParkingSpot:', err); return false; }
  };

  const toggleZoneStatus = async (zone_id, active) => {
    try {
      const res = await fetch(`${API_BASE}/admin/zones/${zone_id}/status?sender_id=${currentUser.id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ active })
      });
      const data = await res.json();
      if (data.status === 'success') {
        await refreshSpots();
        await refreshAdminStats();
        return true;
      } else {
        alert(data.message || 'Action failed');
        return false;
      }
    } catch (err) { console.error('toggleZoneStatus:', err); return false; }
  };

  const toggleSpotStatus = async (spotId, active) => {
    try {
      const res = await fetch(`${API_BASE}/admin/spots/${spotId}/status?sender_id=${currentUser.id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ active })
      });
      const data = await res.json();
      if (data.status === 'success') {
        await refreshSpots();
        await refreshAdminStats();
        return true;
      } else {
        alert(data.message || 'Action failed');
        return false;
      }
    } catch (err) { console.error('toggleSpotStatus:', err); return false; }
  };

  const deleteViolationAdmin = async (vId) => {
    try {
      const res = await fetch(`${API_BASE}/admin/violations/${vId}?sender_id=${currentUser.id}`, {
        method: 'DELETE',
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const data = await res.json();
      if (data.status === 'success') {
        await refreshAdminStats();
        return true;
      }
      return false;
    } catch (err) { console.error('deleteViolationAdmin:', err); return false; }
  };

  const markViolationPaidAdmin = async (vId) => {
    try {
      const res = await fetch(`${API_BASE}/admin/violations/${vId}/pay?sender_id=${currentUser.id}`, {
        method: 'PATCH',
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const data = await res.json();
      if (data.status === 'success') {
        await refreshAdminStats();
        return true;
      }
      return false;
    } catch (err) { console.error('markViolationPaidAdmin:', err); return false; }
  };

  const forceCompleteBooking = async (resId) => {
    try {
      const res = await fetch(`${API_BASE}/admin/bookings/${resId}/force-complete?sender_id=${currentUser.id}`, {
        method: 'POST',
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const data = await res.json();
      if (data.status === 'success') {
        await refreshAdminStats();
        return true;
      } else {
        alert(data.message || 'Force complete failed');
        return false;
      }
    } catch (err) { console.error('forceCompleteBooking:', err); return false; }
  };

  // ===== AUTH =====
  const login = async (email, password) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true"
        },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.status === "success") {
        const user = data.user;
        setCurrentUser(user);
        localStorage.setItem('parking_user', JSON.stringify(user));
        return true;
      } else {
        return data.message || false;
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
    return false;
  };

  const register = async (userData) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true"
        },
        body: JSON.stringify(userData)
      });
      const data = await res.json();
      if (data.status === "success") return await login(userData.email, userData.password);
      else return data.message || false;
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
    return false;
  };

  const bookSpot = async (bookingData) => {
    try {
      const res = await fetch(`${API_BASE}/parking/book`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true"
        },
        body: JSON.stringify(bookingData)
      });
      const data = await res.json();
      if (data.status === "success") {
        await refreshSpots();
        await refreshDashboard();
        await refreshBookings();
        await refreshWallet();
        return { success: true, price: data.price };
      } else {
        alert(data.message || 'Booking failed');
      }
    } catch (e) { console.error(e); }
    return { success: false };
  };

  const checkIn = async (resId) => {
    try {
      const res = await fetch(`${API_BASE}/parking/arrive`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
        body: JSON.stringify({ reservationId: resId })
      });
      const data = await res.json();
      if (data.status === "success") {
        await refreshDashboard();
        await refreshBookings();
        return true;
      }
      return false;
    } catch (e) { console.error(e); return false; }
  };

  const checkOut = async (resId) => {
    try {
      const res = await fetch(`${API_BASE}/parking/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
        body: JSON.stringify({ reservationId: resId })
      });
      const data = await res.json();
      if (data.status === "success") {
        await Promise.all([refreshDashboard(), refreshBookings(), refreshViolations()]);
        return true;
      }
      return false;
    } catch (e) { console.error(e); return false; }
  };

  const logout = () => {
    setCurrentUser(null);
    setDashboardData({ wallet: 0, points: 0, lifetimePoints: 0, referralCode: '', history: [] });
    setViolations([]);
    setWalletTransactions([]);
    setPointTransactions([]);
    setBookings([]);
    setAdminUsers([]);
    setAdminStats(null);
    setDbHealth(null);
    localStorage.removeItem('parking_user');
  };

  // ===== AUTO-REFRESH =====
  useEffect(() => {
    refreshSpots();
    const interval = setInterval(refreshSpots, 20000);
    return () => clearInterval(interval);
  }, [refreshSpots]);

  useEffect(() => {
    if (currentUser?.id) {
      refreshDashboard();
      refreshBookings();
    }
  }, [currentUser?.id]);

  const value = {
    currentUser,
    spots,
    dashboardData,
    reservations: dashboardData.history,
    bookings,
    violations,
    walletTransactions,
    pointTransactions,
    leaderboardData,
    adminStats,
    adminUsers,
    dbHealth,
    isAdmin,
    vehicleTypes: [
      { id: 'v1', name: 'Bike', baseRate: 40 },
      { id: 'v2', name: 'Car', baseRate: 80 },
      { id: 'v3', name: 'SUV', baseRate: 120 }
    ],
    login, register, logout, bookSpot, loading,
    theme, toggleTheme,
    checkIn, checkOut,
    refreshSpots, refreshDashboard, refreshViolations, refreshWallet,
    refreshLoyalty, refreshBookings, refreshLeaderboard, refreshAdminStats,
    refreshAdminUsers, checkHealth,
    payFine, triggerOverstays, cancelReservation,
    addWallet, redeemPoints,
    updateUserAdmin, deleteUserAdmin, addParkingSpot, deleteParkingSpot, toggleZoneStatus, toggleSpotStatus,
    deleteViolationAdmin, markViolationPaidAdmin,
    API_BASE
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useAppContext = () => useContext(AppContext);
