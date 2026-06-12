import { useState } from 'react';
import { Pencil, Trash2, X } from 'lucide-react';
import './Sizes.css';

export default function Sizes() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const toggleModal = () => setIsModalOpen(!isModalOpen);

  return (
    <>
      <section className="space-y-6 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <h2 className="brand-font text-xl font-bold text-[#800020]">Sizes & Measurements</h2>
          <button 
            onClick={toggleModal}
            className="px-6 py-2 bg-[#800020] text-white text-xs font-bold rounded-lg uppercase tracking-widest hover:bg-[#6b001a] transition-colors shadow-sm"
          >
            Add New Size
          </button>
        </div>
        
        <div className="glass-card rounded-2xl overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-[#FAF8F6] text-[10px] uppercase font-bold text-gray-400 border-b border-[#D4AF37]/10">
              <tr>
                <th className="px-6 py-4">Size Name</th>
                <th className="px-6 py-4">Chest (")</th>
                <th className="px-6 py-4">Length (")</th>
                <th className="px-6 py-4">Width (")</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-[#D4AF37]/5 bg-white">
              <tr className="hover:bg-[#FAF8F6]/50 transition-colors">
                <td className="px-6 py-4 font-bold text-[#4A3F35]">Blouse S (36)</td>
                <td className="px-6 py-4 text-gray-600 font-mono">36"</td>
                <td className="px-6 py-4 text-gray-600 font-mono">14.5"</td>
                <td className="px-6 py-4 text-gray-600 font-mono">8"</td>
                <td className="px-6 py-4 text-right space-x-3">
                  <button className="text-gray-400 hover:text-[#D4AF37] transition-colors"><Pencil className="w-4 h-4 inline" /></button>
                  <button className="text-gray-400 hover:text-[#800020] transition-colors"><Trash2 className="w-4 h-4 inline" /></button>
                </td>
              </tr>
              <tr className="hover:bg-[#FAF8F6]/50 transition-colors">
                <td className="px-6 py-4 font-bold text-[#4A3F35]">Blouse M (38)</td>
                <td className="px-6 py-4 text-gray-600 font-mono">38"</td>
                <td className="px-6 py-4 text-gray-600 font-mono">15"</td>
                <td className="px-6 py-4 text-gray-600 font-mono">8.5"</td>
                <td className="px-6 py-4 text-right space-x-3">
                  <button className="text-gray-400 hover:text-[#D4AF37] transition-colors"><Pencil className="w-4 h-4 inline" /></button>
                  <button className="text-gray-400 hover:text-[#800020] transition-colors"><Trash2 className="w-4 h-4 inline" /></button>
                </td>
              </tr>
              <tr className="hover:bg-[#FAF8F6]/50 transition-colors">
                <td className="px-6 py-4 font-bold text-[#4A3F35]">Blouse L (40)</td>
                <td className="px-6 py-4 text-gray-600 font-mono">40"</td>
                <td className="px-6 py-4 text-gray-600 font-mono">15.5"</td>
                <td className="px-6 py-4 text-gray-600 font-mono">9"</td>
                <td className="px-6 py-4 text-right space-x-3">
                  <button className="text-gray-400 hover:text-[#D4AF37] transition-colors"><Pencil className="w-4 h-4 inline" /></button>
                  <button className="text-gray-400 hover:text-[#800020] transition-colors"><Trash2 className="w-4 h-4 inline" /></button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Add Size Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            className="modal-overlay absolute inset-0 bg-[#4A3F35]/40 backdrop-blur-sm" 
            onClick={toggleModal}
          ></div>
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-[#D4AF37]/10 flex justify-between items-center bg-[#FDFCFB]">
              <h3 className="brand-font text-xl font-bold text-[#800020]">New Measurement Entry</h3>
              <button 
                onClick={toggleModal}
                className="text-gray-400 hover:text-[#800020] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-5 bg-white">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">Size Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Blouse L (40)" 
                  className="w-full bg-[#FAF8F6] border border-[#D4AF37]/20 rounded-lg p-3 text-sm focus:border-[#D4AF37] outline-none text-[#4A3F35] transition-colors"
                />
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">Chest (")</label>
                  <input 
                    type="number" 
                    className="w-full bg-[#FAF8F6] border border-[#D4AF37]/20 rounded-lg p-3 text-sm focus:border-[#D4AF37] outline-none text-[#4A3F35] transition-colors font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">Length (")</label>
                  <input 
                    type="number" 
                    className="w-full bg-[#FAF8F6] border border-[#D4AF37]/20 rounded-lg p-3 text-sm focus:border-[#D4AF37] outline-none text-[#4A3F35] transition-colors font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase text-gray-400 tracking-widest">Width (")</label>
                  <input 
                    type="number" 
                    className="w-full bg-[#FAF8F6] border border-[#D4AF37]/20 rounded-lg p-3 text-sm focus:border-[#D4AF37] outline-none text-[#4A3F35] transition-colors font-mono"
                  />
                </div>
              </div>
            </div>
            
            <div className="p-6 bg-[#FAF8F6] border-t border-[#D4AF37]/10 flex justify-end gap-3">
              <button 
                onClick={toggleModal} 
                className="px-6 py-2 border border-[#800020]/20 text-[#800020] font-bold text-xs uppercase tracking-widest rounded-lg hover:bg-[#800020]/5 transition-colors"
              >
                Cancel
              </button>
              <button 
                className="px-6 py-2 bg-[#800020] text-white font-bold text-xs uppercase tracking-widest rounded-lg hover:bg-[#6b001a] transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
              >
                Save Size
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
