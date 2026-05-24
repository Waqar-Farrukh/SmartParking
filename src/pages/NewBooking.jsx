import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Clock, CalendarDays, MapPin, Car, ChevronRight } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';

const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemAnim = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  show: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 20 } }
};

export default function NewBooking() {
  const { currentUser, vehicleTypes, spots, bookSpot, theme, API_BASE } = useAppContext();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [vehicle, setVehicle] = useState(currentUser?.vehicle_type_id === 1 ? 'v1' : (currentUser?.vehicle_type_id === 2 ? 'v2' : 'v3'));
  const [entryTime, setEntryTime] = useState('');
  const [exitTime, setExitTime] = useState('');
  const [selectedZone, setSelectedZone] = useState('A');
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [discountCode, setDiscountCode] = useState('');

  const [estimatedCost, setEstimatedCost] = useState(0);
  const [hourlyRate, setHourlyRate] = useState(0);
  const [baseHourlyRate, setBaseHourlyRate] = useState(0);
  const [isSurge, setIsSurge] = useState(false);
  const [occupancyPercent, setOccupancyPercent] = useState(0);
  const [zoneSurge, setZoneSurge] = useState({});
  const [errorMsg, setErrorMsg] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [discountStatus, setDiscountStatus] = useState(null); // 'valid' or 'invalid'
  const [toast, setToast] = useState(null);

  const isDark = theme === 'dark';

  useEffect(() => {
    if (!entryTime || !exitTime) {
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      setEntryTime(now.toISOString().slice(0, 16));

      const later = new Date(now.getTime() + 2 * 3600000);
      setExitTime(later.toISOString().slice(0, 16));
    }
  }, [entryTime, exitTime]);

  const zoneSpots = spots.filter(s => s.zone === selectedZone);

  const toApiTime = (localValue) => {
    if (!localValue) return '';
    return new Date(localValue).toISOString();
  };

  useEffect(() => {
    if (!entryTime || !exitTime || !currentUser?.id) return;

    const start = new Date(entryTime);
    const end = new Date(exitTime);
    const diffHours = (end - start) / 3600000;

    if (diffHours <= 0) {
      setErrorMsg('Exit time must be after Entry time.');
      setEstimatedCost(0);
      return;
    }
    if (diffHours < 1) {
      setErrorMsg('Minimum duration is 1 hour.');
    } else if (diffHours > 4) {
      setErrorMsg('Maximum booking duration is 4 hours.');
      setEstimatedCost(0);
      return;
    } else {
      setErrorMsg('');
    }

    let cancelled = false;

    const loadZoneFlags = async () => {
      try {
        const res = await fetch(`${API_BASE}/parking/zone-pricing`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
          body: JSON.stringify({
            userId: currentUser.id,
            startTime: toApiTime(entryTime),
            endTime: toApiTime(exitTime),
          }),
        });
        const data = await res.json();
        if (!cancelled && data.status === 'success' && data.zones) {
          const flags = {};
          for (const [z, q] of Object.entries(data.zones)) {
            if (q && !q.error) flags[z] = q.isSurge;
          }
          setZoneSurge(flags);
        }
      } catch (e) {
        console.error('zone-pricing:', e);
      }
    };

    const loadQuote = async () => {
      try {
        const body = {
          userId: currentUser.id,
          startTime: toApiTime(entryTime),
          endTime: toApiTime(exitTime),
          zone: selectedZone,
        };
        if (selectedSpot) body.spotId = selectedSpot;

        const res = await fetch(`${API_BASE}/parking/price-quote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (cancelled) return;

        if (data.status === 'success') {
          setEstimatedCost(Math.ceil(data.price));
          setHourlyRate(data.rate);
          setBaseHourlyRate(data.baseRate);
          setIsSurge(!!data.isSurge);
          setOccupancyPercent(data.occupancyPercent ?? 0);
          if (data.message) setErrorMsg('');
        } else {
          setErrorMsg(data.message || 'Could not calculate price.');
          setEstimatedCost(0);
        }
      } catch (e) {
        console.error('price-quote:', e);
        if (!cancelled) setErrorMsg('Could not reach pricing service. Is the API running?');
      }
    };

    loadZoneFlags();
    loadQuote();

    return () => { cancelled = true; };
  }, [entryTime, exitTime, vehicle, selectedZone, selectedSpot, currentUser?.id, API_BASE]);

  const finalPrice = Math.max(0, estimatedCost - appliedDiscount);

  const validateCode = async () => {
    if (!discountCode.trim()) {
      setAppliedDiscount(0);
      setDiscountStatus(null);
      return true;
    }
    try {
      const res = await fetch(`${API_BASE}/parking/validate-discount`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ code: discountCode.trim(), userId: currentUser.id })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setAppliedDiscount(data.amountOff);
        setDiscountStatus('valid');
        return true;
      }
      setAppliedDiscount(0);
      setDiscountStatus('invalid');
      return false;
    } catch (e) {
      setAppliedDiscount(0);
      setDiscountStatus('invalid');
      return false;
    }
  };

  const handleNextStep = async () => {
    if (step === 1 && estimatedCost > 0 && !errorMsg) setStep(2);
    if (step === 2 && selectedSpot) {
      if (discountCode.trim()) await validateCode();
      setStep(3);
    }
  };

  const handleConfirm = async () => {
    if (discountCode.trim()) {
      const valid = await validateCode();
      if (!valid) {
        setToast('Discount code is invalid or already used.');
        setTimeout(() => setToast(null), 4000);
        return;
      }
    }

    const result = await bookSpot({
      userId: currentUser.id,
      spotId: selectedSpot,
      startTime: new Date(entryTime).toISOString(),
      endTime: new Date(exitTime).toISOString(),
      discountCode: discountCode.trim() || undefined,
      estimatedPrice: finalPrice
    });

    if (result?.success) {
      const charged = result.price ?? finalPrice;
      const msg = appliedDiscount > 0
        ? `Discount code applied! ${appliedDiscount} PKR off. Amount charged: ${charged} PKR. Spot reserved!`
        : `Spot reserved! Amount charged: ${charged} PKR.`;
      setToast(msg);
      setTimeout(() => { navigate('/my-bookings'); }, 2500);
    } else {
      setToast('Booking failed. Please try again.');
      setTimeout(() => setToast(null), 3000);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-6xl mx-auto space-y-10 pb-36 font-sans">

      <AnimatePresence>
      {toast && (
         <motion.div initial={{ y: -100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -100, opacity: 0 }} className="fixed top-12 left-1/2 -translate-x-1/2 bg-v3-emerald text-white px-12 py-6 rounded-[2rem] shadow-2xl z-50 font-display font-black text-2xl flex items-center gap-4">
           <CheckCircle2 size={36} /> {toast}
         </motion.div>
      )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row items-end justify-between gap-8 mb-16">
        <div className="animate-fade-up">
          <h1 className="text-7xl font-black font-display tracking-tight dark:text-white leading-[0.85] mb-4" style={{ color: isDark ? '' : '#2C2A29' }}>Book.<br/><span className="dark:text-v3-teal" style={{ color: isDark ? '' : '#C26A5A' }}>Your Space.</span></h1>
          <p className="font-bold ml-2 dark:text-gray-400" style={{ color: isDark ? '' : '#A39B93' }}>Secure digital access to the grid.</p>
        </div>
        <div className="flex bg-white dark:bg-black/20 p-3 rounded-full gap-3 shadow-aesthetic border border-gray-100 dark:border-white/5">
            {[1, 2, 3].map(i => (
                <div key={i} className={`h-4 rounded-full transition-all duration-700 ${step >= i ? 'bg-v3-indigo dark:bg-v3-teal w-20' : 'bg-gray-100 dark:bg-white/5 w-4'}`} style={{ backgroundColor: (!isDark && step >= i) ? '#C26A5A' : '' }} />
            ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
      {step === 1 && (
        <motion.div key="step1" variants={itemAnim} initial="hidden" animate="show" exit={{ opacity: 0, y: -20 }} className="glass-panel rounded-[3.5rem] p-12 md:p-16 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-v3-indigo/5 dark:bg-v3-teal/5 rounded-full blur-3xl -mr-40 -mt-40"></div>

          <h2 className="text-3xl font-black font-display mb-12 flex items-center gap-4 dark:text-v3-teal tracking-tight" style={{ color: isDark ? '' : '#C26A5A' }}><Clock size={32}/> 01. Time & Vehicle Identity</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16 px-2">
            {vehicleTypes.map(v => (
                <motion.button
                  whileHover={(vehicle === v.id) ? { scale: 1.05 } : {}}
                  whileTap={(vehicle === v.id) ? { scale: 0.95 } : {}}
                  key={v.id}
                  disabled={vehicle !== v.id}
                  onClick={() => setVehicle(v.id)}
                  className={`p-10 rounded-[2.5rem] border-2 transition-all flex flex-col items-center justify-center gap-4 ${vehicle === v.id ? 'shadow-2xl scale-110 z-10' : 'opacity-20 grayscale cursor-not-allowed'}`}
                  style={{
                    backgroundColor: vehicle === v.id ? (isDark ? 'rgba(0, 206, 209, 0.05)' : 'rgba(194, 106, 90, 0.05)') : 'transparent',
                    borderColor: vehicle === v.id ? (isDark ? '#00ced1' : '#C26A5A') : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)')
                  }}
                >
                    <Car size={48} strokeWidth={2.5} className={vehicle === v.id ? (isDark ? 'text-v3-teal' : 'text-v3-indigo') : ''}/>
                    <span className="text-2xl font-black font-display dark:text-white" style={{ color: isDark ? '' : '#2C2A29' }}>{v.name}</span>
                    <span className="text-xs font-black uppercase tracking-widest opacity-60" style={{ color: isDark ? '' : '#6B6259' }}>{v.baseRate} PKR/hr</span>
                    {vehicle !== v.id && <span className="text-[10px] font-black text-v3-ruby uppercase mt-1">Not Registered</span>}
                </motion.button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-[0.3em] opacity-30 ml-4 leading-none dark:text-white flex items-center gap-2" style={{ color: isDark ? '' : '#A39B93' }}>
                <CalendarDays size={14} className="dark:text-v3-teal" style={{ color: isDark ? '' : '#C26A5A' }} /> Access Starts
              </label>
              <input type="datetime-local" value={entryTime} onChange={e => setEntryTime(e.target.value)} className="premium-input font-display text-2xl !p-8" />
            </div>
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-[0.3em] opacity-30 ml-4 leading-none dark:text-white flex items-center gap-2" style={{ color: isDark ? '' : '#A39B93' }}>
                <CalendarDays size={14} className="dark:text-v3-teal" style={{ color: isDark ? '' : '#C26A5A' }} /> Access Ends
              </label>
              <input type="datetime-local" value={exitTime} onChange={e => setExitTime(e.target.value)} className="premium-input font-display text-2xl !p-8" />
            </div>
          </div>

          {isSurge && !errorMsg && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} className="mt-8 text-v3-ruby font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 bg-v3-ruby/5 p-5 rounded-3xl border border-v3-ruby/20">
              <AlertCircle size={18}/> Zone {selectedZone} surge active — {occupancyPercent}% booked for your time window (+20% rate)
            </motion.div>
          )}

          {errorMsg && <motion.div initial={{opacity:0}} animate={{opacity:1}} className="mt-10 text-v3-ruby font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 bg-v3-ruby/5 p-6 rounded-3xl border border-v3-ruby/10 animate-pulse"><AlertCircle/> {errorMsg}</motion.div>}
        </motion.div>
      )}

      {step === 2 && (
        <motion.div key="step2" variants={itemAnim} initial="hidden" animate="show" exit={{ opacity: 0, y: -20 }} className="glass-panel rounded-[3.5rem] p-12 md:p-16">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8 mb-14">
            <h2 className="text-3xl font-black font-display flex items-center gap-4 text-v3-emerald tracking-tight"><MapPin size={32}/> 02. Digital Matrix</h2>
            <div className="flex bg-gray-100 dark:bg-black/40 p-2 rounded-3xl border border-black/5 dark:border-white/5">
              {['A','B','C'].map(floor => (
                <button key={floor} onClick={() => { setSelectedZone(floor); setSelectedSpot(null); }} className={`px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex flex-col items-center gap-1 ${selectedZone === floor ? 'bg-white dark:bg-v3-slate shadow-aesthetic dark:shadow-2xl text-v3-indigo dark:text-v3-teal scale-105' : 'opacity-30'}`} style={{ color: (!isDark && selectedZone === floor) ? '#C26A5A' : '' }}>
                  <span>Zone {floor}</span>
                  {zoneSurge[floor] && <span className="text-[9px] text-v3-ruby font-black">SURGE</span>}
                </button>
              ))}
            </div>
          </div>

          {isSurge && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} className="mb-8 text-v3-ruby font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 bg-v3-ruby/5 p-5 rounded-3xl border border-v3-ruby/20">
              <AlertCircle size={18}/> Dynamic surge for Zone {selectedZone}: {occupancyPercent}% of active spots booked in your time window — rate {hourlyRate} PKR/hr (+20%)
            </motion.div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {zoneSpots.map(s => {
                const isSelected = selectedSpot === s.id;
                const isActive = s.status === 'occupied';
                const isReserved = s.status === 'reserved';
                const isBlocked = isActive || isReserved;
                const isUnavailable = s.status === 'unavailable';
                const displayId = s.id.includes('-') ? s.id.split('-')[1] : s.id;

                return (
                    <motion.button
                      whileHover={(!isBlocked && !isUnavailable) ? { scale: 1.05 } : {}}
                      whileTap={(!isBlocked && !isUnavailable) ? { scale: 0.95 } : {}}
                      key={s.id}
                      disabled={isBlocked || isUnavailable}
                      onClick={() => setSelectedSpot(s.id)}
                      className={`group relative p-8 rounded-[2rem] flex flex-col items-center justify-center gap-3 aspect-square transition-all ${
                        isActive
                        ? 'bg-v3-ruby text-white shadow-[0_10px_30px_rgba(225,29,72,0.3)]'
                        : isReserved
                          ? 'bg-amber-500 text-white shadow-[0_10px_30px_rgba(245,158,11,0.3)]'
                        : isUnavailable
                          ? 'bg-blue-500 text-white shadow-[0_10px_30px_rgba(59,130,246,0.3)]'
                          : isSelected
                            ? 'bg-v3-teal text-v3-slate scale-110 shadow-vibrant z-20 font-black ring-4 ring-white dark:ring-v3-slate ring-offset-4 ring-offset-v3-teal'
                            : 'bg-white dark:bg-white/5 border border-black/[0.05] dark:border-white/5 text-gray-400 font-bold hover:bg-gray-50 dark:hover:bg-white/10'
                      }`}
                    >
                      <Car size={36} strokeWidth={2.5} className="opacity-60 group-hover:opacity-100 transition-opacity"/>
                      <span className="text-2xl font-black font-display leading-none mt-1">{displayId}</span>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">
                        {isActive ? 'Occupied' : isReserved ? 'Booked' : isUnavailable ? 'Offline' : 'Free'}
                      </span>
                    </motion.button>
                );
            })}
          </div>
        </motion.div>
      )}

      {step === 3 && (
        <motion.div key="step3" variants={itemAnim} initial="hidden" animate="show" exit={{ opacity: 0, scale: 0.95 }} className="glass-panel rounded-[3.5rem] p-12 md:p-20 space-y-12">
          <div className="text-center">
             <h2 className="text-5xl font-black font-display tracking-tight dark:text-white mb-4" style={{ color: isDark ? '' : '#2C2A29' }}>Verification.</h2>
             <p className="text-sm font-bold opacity-30 uppercase tracking-[0.3em]" style={{ color: isDark ? '' : '#A39B93' }}>Ensure all parameters are accurate.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-12">
            <div className="space-y-8">
                <div className="bg-gray-50/50 dark:bg-black/30 p-10 rounded-[2.5rem] border border-black/5 dark:border-white/5 relative overflow-hidden group">
                   <div className="flex justify-between items-center opacity-30 font-black uppercase text-[10px] tracking-[0.3em] mb-4" style={{ color: isDark ? '' : '#A39B93' }}><span>Target Location</span> <span>Identifier</span></div>
                   <div className="flex justify-between items-center text-5xl font-black font-display tracking-tighter dark:text-v3-teal" style={{ color: isDark ? '' : '#C26A5A' }}><span>Zone {selectedZone}</span> <span>{selectedSpot}</span></div>
                   <div className="mt-10 pt-10 border-t border-black/5 dark:border-white/5 space-y-4">
                      <div className="flex justify-between items-center">
                         <span className="text-xs font-black uppercase tracking-widest opacity-30" style={{ color: isDark ? '' : '#A39B93' }}>Vehicle Authority</span>
                         <span className="text-sm font-black dark:text-white uppercase" style={{ color: isDark ? '' : '#2C2A29' }}>{vehicleTypes.find(v=>v.id===vehicle)?.name}</span>
                      </div>
                       <div className="flex justify-between items-center">
                          <span className="text-xs font-black uppercase tracking-widest opacity-30" style={{ color: isDark ? '' : '#A39B93' }}>Matrix Billing</span>
                          <span className="text-2xl font-black dark:text-white text-right" style={{ color: isDark ? '' : '#2C2A29' }}>
                            {finalPrice} <span className="text-xs opacity-30">PKR</span>
                            {isSurge && (
                              <span className="block text-[10px] text-v3-ruby mt-1 font-black uppercase tracking-widest">
                                Surge rate: {hourlyRate} PKR/hr (base {baseHourlyRate})
                              </span>
                            )}
                            {appliedDiscount > 0 && (
                              <span className="block text-[10px] text-v3-emerald mt-1 font-black uppercase tracking-widest">
                                Was {estimatedCost} PKR — {appliedDiscount} PKR discount applied
                              </span>
                            )}
                          </span>
                       </div>
                   </div>
                </div>
            </div>

            <div className="flex flex-col justify-center space-y-10">
                {discountStatus === 'valid' && appliedDiscount > 0 && (
                  <div className="p-6 rounded-2xl bg-v3-emerald/10 border border-v3-emerald/30 text-center">
                    <p className="text-sm font-black uppercase tracking-widest text-v3-emerald">Discount code valid and applied</p>
                    <p className="text-lg font-display font-black dark:text-white mt-2" style={{ color: isDark ? '' : '#2C2A29' }}>
                      {appliedDiscount} PKR deducted — you pay {finalPrice} PKR
                    </p>
                  </div>
                )}
                <div className="space-y-4">
                    <div className="flex justify-between items-center ml-6">
                        <label className="text-[10px] font-black opacity-30 uppercase tracking-[0.4em]" style={{ color: isDark ? '' : '#A39B93' }}>Discount Code (Optional)</label>
                        {discountStatus === 'valid' && <span className="text-[10px] text-v3-emerald font-black uppercase tracking-widest">Valid & Applied</span>}
                        {discountStatus === 'invalid' && <span className="text-[10px] text-v3-ruby font-black uppercase tracking-widest">Invalid Code</span>}
                    </div>
                    <input 
                      value={discountCode} 
                      onChange={e => { setDiscountCode(e.target.value); setDiscountStatus(null); setAppliedDiscount(0); }} 
                      onBlur={validateCode}
                      placeholder="ENTER CODE" 
                      className={`w-full p-10 rounded-[2.5rem] bg-gray-50/50 dark:bg-black/40 border-2 font-display font-black text-4xl text-center tracking-[0.2em] focus:bg-white dark:focus:bg-black transition-all ${
                        discountStatus === 'valid' ? 'border-v3-emerald/50' : 
                        discountStatus === 'invalid' ? 'border-v3-ruby/50' : 'border-transparent'
                      }`} 
                    />
                </div>

                <button onClick={handleConfirm} className="w-full py-10 rounded-[3rem] bg-v3-indigo dark:bg-v3-teal text-white dark:text-v3-slate font-display font-black text-3xl shadow-vibrant hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-6 group" style={{ backgroundColor: isDark ? '' : '#C26A5A' }}>
                   <span>SECURE SPACE</span>
                   <ChevronRight size={40} className="group-hover:translate-x-2 transition-transform" />
                </button>
            </div>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {(step === 1 || step === 2) && (
        <motion.div initial={{ y: 200, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="fixed bottom-12 left-0 right-0 px-8 z-40 lg:left-80">
           <div className="max-w-5xl mx-auto backdrop-blur-3xl border rounded-[3rem] p-8 flex justify-between items-center shadow-[0_30px_100px_rgba(0,0,0,0.2)]" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(44,42,41,0.9)', borderColor: isDark ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)' }}>
              <div className="ml-8">
                 <p className="text-[10px] font-black uppercase tracking-[0.4em] leading-none mb-3" style={{ color: isDark ? '#C26A5A' : '#00ced1' }}>Billing Projection</p>
                  <h3 className="text-5xl font-display font-black leading-none tracking-tighter" style={{ color: isDark ? '#2C2A29' : '#FFFFFF' }}>{finalPrice} <span className="text-sm opacity-40">PKR</span> {isSurge && <span className="text-sm text-v3-gold"> (SURGE +20%)</span>}</h3>
                  {hourlyRate > 0 && (
                    <p className="text-xs font-bold mt-2 opacity-70" style={{ color: isDark ? '#2C2A29' : '#FFFFFF' }}>
                      {hourlyRate} PKR/hr{isSurge ? ` (base ${baseHourlyRate})` : ''} · Zone {selectedZone} · {occupancyPercent}% full
                    </p>
                  )}
              </div>
              <button
                onClick={handleNextStep}
                disabled={!estimatedCost || (step === 2 && !selectedSpot)}
                className="px-16 py-8 font-display font-black text-2xl rounded-[2rem] hover:scale-105 disabled:opacity-20 disabled:hover:scale-100 transition-all shadow-2xl flex items-center gap-4"
                style={{ backgroundColor: isDark ? '#C26A5A' : '#00ced1', color: isDark ? '#FFFFFF' : '#2C2A29' }}
              >
                <span>{step === 1 ? 'LOCATE SPOT' : 'AUTHORIZE'}</span>
                <ChevronRight size={32}/>
              </button>
           </div>
        </motion.div>
      )}
    </motion.div>
  );
}
