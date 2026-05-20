import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { LogIn, UserPlus, Car, ShieldCheck, Mail, Lock, User, Sparkles, Phone } from 'lucide-react';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const { login, register } = useAppContext();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '', email: '', password: '', phone: '', vehiclePlate: '', vehicleType: 'v2', referralCode: ''
  });
  const [error, setError] = useState('');

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (isLogin) {
      const result = await login(formData.email, formData.password);
      if (result === true) {
        navigate('/dashboard');
      } else {
        setError(typeof result === 'string' ? result : 'Verification failed. Invalid email or password.');
      }
    } else {
      if (!formData.name || !formData.email || !formData.password || !formData.phone || !formData.vehiclePlate) {
        setError('Fields missing. Please complete all required entries.');
        return;
      }
      
      const phoneRegex = /^\d{11}$/;
      if (!phoneRegex.test(formData.phone)) {
        setError('Phone number must be exactly 11 digits (e.g., 03001234567).');
        return;
      }

      const plateRegex = /^[A-Za-z]{3}-\d{3}$/;
      if (!plateRegex.test(formData.vehiclePlate)) {
        setError('Vehicle plate must be exactly 7 characters in format ABC-123.');
        return;
      }

      const result = await register(formData);
      if (result === true) {
        navigate('/dashboard');
      } else {
        setError(typeof result === 'string' ? result : 'Registration failed. Email or Plate might already exist.');
      }
    }
  };

  return (
    <div className="min-h-screen w-full flex overflow-hidden relative font-sans" style={{ backgroundColor: '#F4F2F5' }}>
      {/* Dark mode background override */}
      <style>{`.dark .auth-page-bg { background-color: #0f172a !important; }`}</style>
      
      {/* Aesthetic Background Elements */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <motion.div 
            animate={{ scale: [1, 1.1, 1], x: [0, 20, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-[10%] -right-[10%] w-[60%] h-[60%] rounded-full blur-[120px]"
            style={{ backgroundColor: 'rgba(194, 106, 90, 0.05)' }}
        />
        <motion.div 
            animate={{ scale: [1, 1.2, 1], x: [0, -30, 0] }}
            transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -bottom-[10%] -left-[10%] w-[50%] h-[50%] rounded-full blur-[100px]"
            style={{ backgroundColor: 'rgba(194, 122, 107, 0.05)' }}
        />
      </div>

      <div className="flex w-full z-10 items-center justify-center p-4 auth-page-bg dark:bg-v3-slate">

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-0 overflow-hidden backdrop-blur-3xl rounded-[3.5rem] shadow-aesthetic lg:h-[850px]"
          style={{ backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: '1px', borderColor: '#E8E2EA' }}
        >
          {/* Visual Showcase (Left) */}
          <div className="hidden lg:flex flex-col justify-between p-20 relative group" style={{ backgroundColor: '#C26A5A' }}>
            <div className="dark:hidden absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
            <div className="dark:block hidden absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-8 bg-black/10 w-fit px-4 py-2 rounded-full backdrop-blur-md">
                 <Sparkles className="text-v3-gold" size={16}/>
                 <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Next-Gen Interface</span>
              </div>
              <h2 className="text-7xl font-black font-display tracking-tighter text-white leading-[0.85] mb-8">Smart<br/>Parking.</h2>
              <p className="text-xl font-bold text-white/70 max-w-sm leading-snug">Pakistan's premier digital space for architectural parking management.</p>
            </div>

            <div className="relative z-10 flex gap-4">
               <div className="p-6 bg-white/10 rounded-[2rem] border border-white/10 backdrop-blur-xl group-hover:bg-white/20 transition-all"><Car size={32} className="text-white"/></div>
               <div className="p-6 bg-white/10 rounded-[2rem] border border-white/10 backdrop-blur-xl group-hover:bg-white/20 transition-all"><ShieldCheck size={32} className="text-white"/></div>
            </div>
          </div>

          {/* User Input (Right) */}
          <div className="p-12 md:p-14 flex flex-col justify-center overflow-y-auto dark:bg-v3-slate/40">
            <div className="mb-8">
               <h1 className="text-5xl font-black font-display tracking-tight mb-3" style={{ color: '#2A282F' }}>
                 <span className="dark:text-white">{isLogin ? 'Log In.' : 'Register.'}</span>
               </h1>
               <p className="font-bold tracking-tight" style={{ color: '#6B6872' }}>
                 <span className="dark:text-gray-400">Access your parking dashboard.</span>
               </p>
            </div>

            {error && <motion.div initial={{y: -10, opacity:0}} animate={{y:0, opacity:1}} className="mb-6 p-4 rounded-2xl text-xs font-black text-center tracking-widest" style={{ backgroundColor: 'rgba(194, 122, 107, 0.1)', borderWidth: '1px', borderColor: 'rgba(194, 122, 107, 0.1)', color: '#C27A6B' }}>{error}</motion.div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <AnimatePresence mode="wait">
                {!isLogin && (
                  <motion.div initial={{opacity:0, height:0}} animate={{opacity:1, height:'auto'}} exit={{opacity:0, height:0}} className="space-y-4 overflow-hidden">
                    <LoginInput label="Full Name" name="name" icon={<User size={18}/>} value={formData.name} onChange={handleChange} required />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <LoginInput label="Phone Number" name="phone" icon={<Phone size={18}/>} value={formData.phone} onChange={handleChange} required />
                        <LoginInput label="Vehicle Plate Number" name="vehiclePlate" value={formData.vehiclePlate} onChange={handleChange} required />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest ml-2" style={{ color: '#7C7A85' }}>
                          <span className="dark:opacity-30 dark:text-white">Vehicle Category</span>
                        </label>
                        <select name="vehicleType" value={formData.vehicleType} onChange={handleChange} className="w-full p-5 rounded-[1.5rem] outline-none font-bold transition-all text-sm appearance-none cursor-pointer dark:bg-black/40 dark:border-transparent dark:focus:ring-v3-teal/10" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E0D9E2' }}>
                            <option value="v1">Two Wheeler (Bike)</option>
                            <option value="v2">Four Wheeler (Car)</option>
                            <option value="v3">Heavy (SUV)</option>
                        </select>
                    </div>

                    <LoginInput label="Referral Code (Optional)" name="referralCode" value={formData.referralCode} onChange={handleChange} />
                  </motion.div>
                )}
              </AnimatePresence>

              <LoginInput label="Email Address" type="email" name="email" icon={<Mail size={18}/>} value={formData.email} onChange={handleChange} required />
              <LoginInput label="Security Password" type="password" name="password" icon={<Lock size={18}/>} value={formData.password} onChange={handleChange} required />

              <button type="submit" className="w-full py-6 rounded-[2rem] text-white font-display font-black text-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 mt-8 dark:bg-v3-teal dark:text-v3-slate" style={{ backgroundColor: '#C26A5A', boxShadow: '0 20px 40px -10px rgba(194, 106, 90, 0.25)' }}>
                {isLogin ? <LogIn size={26}/> : <UserPlus size={26}/>}
                <span>{isLogin ? 'LOGIN' : 'REGISTER'}</span>
              </button>
            </form>

            <div className="mt-10 text-center">
               <button onClick={() => { setIsLogin(!isLogin); setError(''); }} className="text-xs font-black transition-colors tracking-widest leading-none pb-1 dark:hover:text-v3-teal dark:border-white/10" style={{ color: '#6B6872', borderBottom: '1px solid #E8E2EA' }}>
                 {isLogin ? "NEW USER? REGISTER HERE" : 'EXISTING USER? LOG IN'}
               </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function LoginInput({ label, icon, ...props }) {
  return (
    <div className="space-y-2 group">
      <label className="text-[10px] font-black uppercase tracking-widest ml-2 transition-colors leading-none" style={{ color: '#7C7A85' }}>
        <span className="dark:opacity-30 dark:text-white">{label}</span>
      </label>
      <div className="relative">
        {icon && <div className="absolute left-6 top-1/2 -translate-y-1/2 transition-all" style={{ color: '#B0ABB5' }}>{icon}</div>}
        <input {...props} className={`w-full p-5 ${icon?'pl-14':''} rounded-[1.5rem] outline-none text-sm font-bold transition-all dark:bg-black/40 dark:border-transparent dark:focus:bg-black/60 dark:focus:ring-v3-teal/10 dark:text-white`} 
          style={{ 
            backgroundColor: '#FFFFFF', 
            border: '1px solid #E0D9E2',
            color: '#2A282F',
          }}
          onFocus={(e) => { e.target.style.borderColor = '#C26A5A'; e.target.style.boxShadow = '0 0 0 4px rgba(194, 106, 90, 0.1)'; }}
          onBlur={(e) => { e.target.style.borderColor = '#E0D9E2'; e.target.style.boxShadow = 'none'; }}
        />
      </div>
    </div>
  );
}
