import { useState } from 'react';
import { motion } from 'framer-motion';
import { FiSearch, FiMapPin, FiTrendingUp } from 'react-icons/fi';
import { ZONES } from '../mockData';

const variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.2 } }
};

export default function Dashboard({ setBookingState, navigate }) {
  const [search, setSearch] = useState('');

  const filteredZones = ZONES.filter(z => z.name.toLowerCase().includes(search.toLowerCase()));

  const handleZoneSelect = (zone) => {
    setBookingState(prev => ({ ...prev, selectedZone: zone }));
    navigate('booking');
  };

  return (
    <motion.div 
      className="screen-container"
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Find a Spot</h1>
        <p>Where are you parking today?</p>
      </div>

      <div style={{ 
        display: 'flex', alignItems: 'center', background: 'var(--bg-surface)', 
        padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)',
        marginBottom: '1.5rem'
      }}>
        <FiSearch style={{ color: 'var(--text-secondary)', marginRight: '0.5rem' }} />
        <input 
          type="text" 
          placeholder="Search zones..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ border: 'none', background: 'transparent', outline: 'none', color: 'var(--text-primary)', width: '100%', fontSize: '1rem' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {filteredZones.map(zone => {
          const occupancyRate = zone.occupiedSpots / zone.totalCapacity;
          const isHighDemand = occupancyRate > 0.8;
          
          return (
            <motion.div 
              key={zone.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleZoneSelect(zone)}
              style={{
                background: 'var(--glass-bg)',
                backdropFilter: 'blur(10px)',
                padding: '1rem',
                borderRadius: '16px',
                border: '1px solid var(--border-color)',
                boxShadow: 'var(--card-shadow)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ background: 'var(--primary)', color: '#fff', padding: '0.5rem', borderRadius: '8px' }}>
                    <FiMapPin />
                  </div>
                  <h3 style={{ fontSize: '1.1rem', margin: 0 }}>{zone.name}</h3>
                </div>
                {isHighDemand && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--warning)', fontSize: '0.8rem', fontWeight: 'bold' }}>
                    <FiTrendingUp /> SURGE
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Occupancy: <strong>{Math.round(occupancyRate * 100)}%</strong>
                </div>
                <div style={{ background: isHighDemand ? 'var(--warning)' : 'var(--slot-available)', padding: '0.25rem 0.5rem', borderRadius: '4px', color: '#fff', fontSize: '0.8rem', fontWeight: '600' }}>
                  {zone.totalCapacity - zone.occupiedSpots} Spots Left
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
