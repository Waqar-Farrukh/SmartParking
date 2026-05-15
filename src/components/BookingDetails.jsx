import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FiArrowLeft, FiClock, FiDollarSign } from 'react-icons/fi';
import { VEHICLE_TYPES } from '../mockData';

const variants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.2 } }
};

export default function BookingDetails({ bookingState, setBookingState, navigate }) {
  const { selectedZone, vehicleType, startTime, endTime } = bookingState;
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  // Calculate pricing
  useEffect(() => {
    if (!selectedZone) return;

    // Time difference logic
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    
    let diffHours = (endH + endM / 60) - (startH + startM / 60);
    
    if (diffHours <= 0) {
      setErrorMsg('End time must be after start time.');
      setEstimatedCost(0);
      return;
    }
    
    // Constraint: must book for at least 1 hour
    if (diffHours < 1) {
      setErrorMsg('Minimum booking duration is 1 hour.');
      diffHours = 1; // Enforce minimum but allow user to adjust
    } else {
      setErrorMsg('');
    }

    const vehicle = VEHICLE_TYPES.find(v => v.id === vehicleType);
    let rate = vehicle ? vehicle.baseRate : 80;

    const occupancyRate = selectedZone.occupiedSpots / selectedZone.totalCapacity;
    if (occupancyRate > 0.8) {
      rate = rate * 1.2; // 20% Surge
    }

    setEstimatedCost(Math.ceil(rate * diffHours));
  }, [startTime, endTime, vehicleType, selectedZone]);

  const handleNext = () => {
    if (errorMsg && errorMsg !== 'Minimum booking duration is 1 hour.') return; // strict block only on invalid time
    navigate('slots');
  };

  if (!selectedZone) {
    return <div onClick={() => navigate('dashboard')}>Go back</div>;
  }

  const occupancyRate = selectedZone.occupiedSpots / selectedZone.totalCapacity;
  const isHighDemand = occupancyRate > 0.8;

  return (
    <motion.div 
      className="screen-container"
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem' }}>
        <button onClick={() => navigate('dashboard')} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '50%', padding: '0.5rem', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex' }}>
          <FiArrowLeft size={20} />
        </button>
        <h1 style={{ fontSize: '1.25rem', margin: 0 }}>Booking Details</h1>
      </div>

      <div style={{ background: 'var(--glass-bg)', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid var(--border-color)', boxShadow: 'var(--card-shadow)' }}>
        <h3 style={{ margin: 0, color: 'var(--primary)', marginBottom: '0.25rem' }}>{selectedZone.name}</h3>
        {isHighDemand && <span style={{ color: 'var(--warning)', fontSize: '0.8rem', fontWeight: 'bold' }}>⚡ High Demand Pricing Active (+20%)</span>}
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>Vehicle Type</h3>
        <div style={{ display: 'flex', background: 'var(--pill-bg)', borderRadius: '999px', padding: '0.25rem', position: 'relative' }}>
          {VEHICLE_TYPES.map(v => (
            <button 
              key={v.id}
              onClick={() => setBookingState(prev => ({ ...prev, vehicleType: v.id }))}
              style={{ flex: 1, zIndex: 1, position: 'relative', background: 'none', border: 'none', padding: '0.5rem', fontWeight: '600', cursor: 'pointer',
                       color: vehicleType === v.id ? 'var(--pill-active-text)' : 'var(--pill-text)'
              }}
            >
              {vehicleType === v.id && (
                <motion.div 
                  layoutId="active-pill"
                  style={{ position: 'absolute', inset: 0, background: 'var(--primary)', borderRadius: '999px', zIndex: -1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
              {v.name}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Entry Time</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FiClock style={{ color: 'var(--primary)' }} />
            <input 
              type="time" 
              value={startTime}
              onChange={(e) => setBookingState(prev => ({ ...prev, startTime: e.target.value }))}
              style={{ width: '100%' }}
            />
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Exit Time</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FiClock style={{ color: 'var(--primary)' }} />
            <input 
              type="time" 
              value={endTime}
              onChange={(e) => setBookingState(prev => ({ ...prev, endTime: e.target.value }))}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </div>

      {errorMsg && (
        <div style={{ color: 'var(--error)', marginBottom: '1rem', fontSize: '0.9rem', textAlign: 'center' }}>
          {errorMsg}
        </div>
      )}

      <div style={{ marginTop: 'auto', background: 'var(--bg-surface)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: 'var(--card-shadow)', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <FiDollarSign size={24} style={{ color: 'var(--accent)' }}/>
          <span style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{estimatedCost}</span>
          <span style={{ color: 'var(--text-secondary)', alignSelf: 'flex-end', paddingBottom: '0.3rem' }}>PKR</span>
        </div>
        
        <button 
          className="btn" 
          onClick={handleNext}
          disabled={estimatedCost === 0 || !!(errorMsg && errorMsg !== 'Minimum booking duration is 1 hour.')}
        >
          Choose Your Spot
        </button>
      </div>

    </motion.div>
  );
}
