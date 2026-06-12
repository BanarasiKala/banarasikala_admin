import { Camera, Mail, Phone, MapPin, Shield, Key } from 'lucide-react';

export default function Profile() {
  return (
    <section className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="brand-font text-xl font-bold text-[#800020]">Admin Profile</h2>
        <button className="px-6 py-2 bg-[#800020] text-white text-xs font-bold rounded-lg uppercase tracking-widest hover:bg-[#6b001a] transition-colors shadow-sm">
          Save Changes
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column - Avatar & Quick Info */}
        <div className="space-y-6">
          <div className="glass-card rounded-2xl p-6 flex flex-col items-center text-center shadow-sm">
            <div className="relative mb-4 group cursor-pointer">
              <div className="w-28 h-28 rounded-full bg-[#FAF8F6] border-4 border-white shadow-md overflow-hidden flex items-center justify-center relative">
                <img src="https://ui-avatars.com/api/?name=Admin+User&background=800020&color=fff&size=150" alt="Admin" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
            <h3 className="font-bold text-lg text-[#4A3F35]">Master Admin</h3>
            <p className="text-xs text-[#D4AF37] font-bold uppercase tracking-widest mt-1">Super Administrator</p>
            <p className="text-xs text-gray-500 mt-2">admin@banaraskala.com</p>
            
            <div className="w-full border-t border-[#D4AF37]/10 mt-6 pt-6 flex justify-around">
              <div className="text-center">
                <p className="text-lg font-bold text-[#800020]">24</p>
                <p className="text-[9px] uppercase tracking-wider text-gray-400 font-bold mt-1">Actions Today</p>
              </div>
              <div className="text-center border-l border-[#D4AF37]/10 pl-6">
                <p className="text-lg font-bold text-[#800020]">100%</p>
                <p className="text-[9px] uppercase tracking-wider text-gray-400 font-bold mt-1">Access Level</p>
              </div>
            </div>
          </div>
          
          <div className="glass-card rounded-2xl p-6 shadow-sm">
            <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4 pb-2 border-b border-[#D4AF37]/10">Security Details</h4>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Shield className="w-4 h-4 text-green-600" />
                <div>
                  <p className="text-xs font-bold text-[#4A3F35]">Two-Factor Authentication</p>
                  <p className="text-[10px] text-gray-500">Enabled via SMS</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Key className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs font-bold text-[#4A3F35]">Last Password Change</p>
                  <p className="text-[10px] text-gray-500">45 days ago</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Form */}
        <div className="md:col-span-2 space-y-6">
          <div className="glass-card rounded-2xl p-8 shadow-sm">
            <h3 className="brand-font text-lg font-bold text-[#800020] mb-6">Personal Information</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">First Name</label>
                <input 
                  type="text" 
                  defaultValue="Master"
                  className="w-full bg-[#FAF8F6] border border-[#D4AF37]/20 rounded-lg p-3 text-sm focus:border-[#D4AF37] outline-none text-[#4A3F35] transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">Last Name</label>
                <input 
                  type="text" 
                  defaultValue="Admin"
                  className="w-full bg-[#FAF8F6] border border-[#D4AF37]/20 rounded-lg p-3 text-sm focus:border-[#D4AF37] outline-none text-[#4A3F35] transition-colors"
                />
              </div>
              
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-gray-400" />
                  </div>
                  <input 
                    type="email" 
                    defaultValue="admin@banaraskala.com"
                    className="w-full bg-[#FAF8F6] border border-[#D4AF37]/20 rounded-lg py-3 pl-10 pr-4 text-sm focus:border-[#D4AF37] outline-none text-[#4A3F35] transition-colors"
                  />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">Phone Number</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="h-4 w-4 text-gray-400" />
                  </div>
                  <input 
                    type="tel" 
                    defaultValue="+91 98765 43210"
                    className="w-full bg-[#FAF8F6] border border-[#D4AF37]/20 rounded-lg py-3 pl-10 pr-4 text-sm focus:border-[#D4AF37] outline-none text-[#4A3F35] transition-colors"
                  />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">Location</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MapPin className="h-4 w-4 text-gray-400" />
                  </div>
                  <input 
                    type="text" 
                    defaultValue="Varanasi, India"
                    className="w-full bg-[#FAF8F6] border border-[#D4AF37]/20 rounded-lg py-3 pl-10 pr-4 text-sm focus:border-[#D4AF37] outline-none text-[#4A3F35] transition-colors"
                  />
                </div>
              </div>
            </div>
            
            <hr className="my-8 border-[#D4AF37]/10" />
            
            <h3 className="brand-font text-lg font-bold text-[#800020] mb-6">Change Password</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">Current Password</label>
                <input 
                  type="password" 
                  placeholder="••••••••"
                  className="w-full bg-[#FAF8F6] border border-[#D4AF37]/20 rounded-lg p-3 text-sm focus:border-[#D4AF37] outline-none text-[#4A3F35] transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">New Password</label>
                <input 
                  type="password" 
                  placeholder="••••••••"
                  className="w-full bg-[#FAF8F6] border border-[#D4AF37]/20 rounded-lg p-3 text-sm focus:border-[#D4AF37] outline-none text-[#4A3F35] transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">Confirm Password</label>
                <input 
                  type="password" 
                  placeholder="••••••••"
                  className="w-full bg-[#FAF8F6] border border-[#D4AF37]/20 rounded-lg p-3 text-sm focus:border-[#D4AF37] outline-none text-[#4A3F35] transition-colors"
                />
              </div>
            </div>
            
          </div>
        </div>
      </div>
    </section>
  );
}
