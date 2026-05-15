import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiArrowLeft, FiCheckCircle } from 'react-icons/fi';
import { generateSlots } from '../mockData';

const variants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.2 } }
};

export default function SlotSelection({ bookingState, setBookingState, navigate }) {
  const [slots] = useState(() => generateSlots());
  const [showModal, setShowModal] = useState(false);

  // We can just rely on local selection to not modify global right away unless confirmed
  const selectedSlot = bookingState.selectedSlot;

  const handleSelect = (slot) => {
    if (slot.isOccupied) return;
    setBookingState(prev => ({ ...prev, selectedSlot: slot.id }));
  };

  const handleConfirm = () => {
    setShowModal(true);
    setTimeout(() => {
      setShowModal(false);
      // Reset flow
      setBookingState({
        selectedZone: null,
        vehicleType: 'v2',
        startTime: '10:00',
        endTime: '12:00',
        selectedSlot: null,
        totalPrice: 0,
      });
      navigate('dashboard');
    }, 2500);
  };

  return (
    <motion.div 
      className="screen-container"
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ position: 'relative' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem' }}>
        <button onClick={() => navigate('booking')} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '50%', padding: '0.5rem', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex' }}>
          <FiArrowLeft size={20} />
        </button>
        <h1 style={{ fontSize: '1.25rem', margin: 0 }}>Select Slot</h1>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
        Entrance ⬆️
      </div>

      {/* Grid Layout */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(2, 1fr)', 
        gap: '2rem', 
        background: 'var(--bg-surface)', 
        padding: '1.5rem', 
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--card-shadow)',
        marginBottom: '1.5rem'
      }}>
        {/* Left Row */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {slots.slice(0, 6).map(slot => (
            <SlotCard key={slot.id} slot={slot} isSelected={selectedSlot === slot.id} onClick={() => handleSelect(slot)} />
          ))}
        </div>
        
        {/* Right Row */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {slots.slice(6, 12).map(slot => (
            <SlotCard key={slot.id} slot={slot} isSelected={selectedSlot === slot.id} onClick={() => handleSelect(slot)} />
          ))}
        </div>
      </div>

      <div style={{ marginTop: 'auto' }}>
        <button 
          className="btn" 
          onClick={handleConfirm}
          disabled={!selectedSlot}
        >
          Confirm Booking
        </button>
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            style={{ 
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', 
              display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 
            }}
          >
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              style={{ background: 'var(--bg-surface)', padding: '2rem', borderRadius: '16px', textAlign: 'center', margin: '0 2rem' }}
            >
              <FiCheckCircle size={48} style={{ color: 'var(--accent)', marginBottom: '1rem' }} />
              <h2>Booking Confirmed!</h2>
              <p style={{ marginTop: '0.5rem' }}>Slot {selectedSlot} is reserved for you.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function SlotCard({ slot, isSelected, onClick }) {
  let bgColor = 'var(--slot-available)';
  let borderColor = 'var(--slot-available-border)';
  let cursor = 'pointer';
  let opacity = 1;
  let shadow = 'var(--slot-available-shadow)';

  if (slot.isOccupied) {
    bgColor = 'var(--slot-occupied)';
    borderColor = 'var(--slot-occupied-border)';
    cursor = 'not-allowed';
    opacity = 0.5;
    shadow = 'none';
  } else if (isSelected) {
    bgColor = 'var(--slot-selected)';
    borderColor = 'var(--slot-selected-border)';
    shadow = 'var(--slot-selected-shadow)';
  }

  return (
    <motion.div
      whileHover={!slot.isOccupied ? { scale: 1.05 } : {}}
      whileTap={!slot.isOccupied ? { scale: 0.95 } : {}}
      onClick={onClick}
      style={{
        height: '60px',
        background: bgColor,
        border: `2px solid ${borderColor}`,
        borderRadius: '8px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        cursor,
        opacity,
        fontWeight: 'bold',
        color: isSelected ? '#fff' : 'var(--text-primary)',
        boxShadow: shadow,
        transition: 'all 0.3s ease'
      }}
    >
      {slot.id}
    </motion.div>
  );
}
