import { Search, Pencil, Ban, Trash2 } from 'lucide-react';
import './Users.css';

export default function Users() {
  return (
    <section className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h2 className="brand-font text-xl font-bold text-[#800020]">User Directory</h2>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search users..." 
              className="pl-10 pr-4 py-2 bg-white border border-[#D4AF37]/20 rounded-lg text-sm outline-none focus:border-[#D4AF37]" 
            />
          </div>
          <button className="px-4 py-2 bg-[#FAF8F6] border border-[#D4AF37]/20 text-[#4A3F35] text-xs font-bold rounded-lg uppercase tracking-widest hover:bg-[#D4AF37]/10 transition-colors">
            Filters
          </button>
        </div>
      </div>
      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-[#FAF8F6] text-[10px] uppercase font-bold text-gray-400">
            <tr>
              <th className="px-6 py-3">ID</th>
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3">Joined</th>
              <th className="px-6 py-3 text-center">Orders</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-xs divide-y divide-[#D4AF37]/5">
            <tr className="hover:bg-[#FAF8F6]/50 transition-colors">
              <td className="px-6 py-4 font-mono">#USR-201</td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#D4AF37]/10 flex items-center justify-center font-bold text-[#D4AF37]">PS</div>
                  <div>
                    <p className="font-bold text-[#4A3F35]">Priya Singh</p>
                    <p className="text-[10px] text-gray-500">priya@example.com</p>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 text-gray-600">12 Oct, 2023</td>
              <td className="px-6 py-4 text-center font-bold text-[#4A3F35]">14</td>
              <td className="px-6 py-4">
                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-[9px] font-bold uppercase tracking-wider border border-green-200">Active</span>
              </td>
              <td className="px-6 py-4 text-right space-x-3">
                <button className="text-gray-400 hover:text-[#D4AF37] transition-colors"><Pencil className="w-4 h-4 inline" /></button>
                <button className="text-gray-400 hover:text-[#800020] transition-colors"><Ban className="w-4 h-4 inline" /></button>
                <button className="text-gray-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4 inline" /></button>
              </td>
            </tr>
            <tr className="hover:bg-[#FAF8F6]/50 transition-colors">
              <td className="px-6 py-4 font-mono">#USR-202</td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#800020]/10 flex items-center justify-center font-bold text-[#800020]">RV</div>
                  <div>
                    <p className="font-bold text-[#4A3F35]">Rahul Varma</p>
                    <p className="text-[10px] text-gray-500">rahul.v@example.com</p>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 text-gray-600">15 Oct, 2023</td>
              <td className="px-6 py-4 text-center font-bold text-[#4A3F35]">3</td>
              <td className="px-6 py-4">
                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[9px] font-bold uppercase tracking-wider border border-gray-200">Inactive</span>
              </td>
              <td className="px-6 py-4 text-right space-x-3">
                <button className="text-gray-400 hover:text-[#D4AF37] transition-colors"><Pencil className="w-4 h-4 inline" /></button>
                <button className="text-gray-400 hover:text-[#800020] transition-colors"><Ban className="w-4 h-4 inline" /></button>
                <button className="text-gray-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4 inline" /></button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
