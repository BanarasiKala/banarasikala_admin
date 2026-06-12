import { useState } from 'react';
import { AlertTriangle, Plus, Minus } from 'lucide-react';
import './Inventory.css';

export default function Inventory() {
  // State for the stock adjustment matrix
  const [stockAdjustment, setStockAdjustment] = useState(0);

  const increment = () => setStockAdjustment(prev => prev + 1);
  const decrement = () => setStockAdjustment(prev => prev - 1);

  return (
    <section className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h2 className="brand-font text-xl font-bold text-[#800020]">Inventory & Stock Tracking</h2>
      </div>
      
      {/* Low Stock Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-red-50 border border-red-100 p-5 rounded-xl flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-red-500 tracking-wider">Critical Low Stock</p>
            <h4 className="text-sm font-bold text-[#4A3F35] mt-0.5">Organza Ivory Moon</h4>
            <p className="text-xs text-red-600 font-medium mt-1">Remaining: 8 units</p>
          </div>
        </div>
        
        <div className="bg-red-50 border border-red-100 p-5 rounded-xl flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-red-500 tracking-wider">Critical Low Stock</p>
            <h4 className="text-sm font-bold text-[#4A3F35] mt-0.5">Georgette Gold Jaal</h4>
            <p className="text-xs text-red-600 font-medium mt-1">Remaining: 3 units</p>
          </div>
        </div>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-5 border-b border-[#D4AF37]/10 bg-[#FAF8F6]/80 flex justify-between items-center">
          <h3 className="text-sm font-bold text-[#4A3F35] uppercase tracking-widest">Stock Adjustment Matrix</h3>
        </div>
        
        <table className="w-full text-left">
          <thead className="bg-white text-[10px] uppercase font-bold text-gray-400 border-b border-[#D4AF37]/10">
            <tr>
              <th className="px-6 py-4">Product Name</th>
              <th className="px-6 py-4">Current Stock</th>
              <th className="px-6 py-4">Reorder Level</th>
              <th className="px-6 py-4 text-center">Adjustment</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-xs divide-y divide-[#D4AF37]/5 bg-[#FAF8F6]/20">
            <tr className="hover:bg-[#FAF8F6] transition-colors">
              <td className="px-6 py-5 font-bold text-[#4A3F35]">Royal Crimson Katan Silk</td>
              <td className="px-6 py-5">
                <span className="bg-green-50 text-green-700 px-2.5 py-1 rounded font-bold border border-green-100 tracking-wider">12 Units</span>
              </td>
              <td className="px-6 py-5">
                <input 
                  type="number" 
                  defaultValue="10" 
                  className="w-16 bg-white border border-[#D4AF37]/20 rounded px-2 py-1.5 text-center text-[#4A3F35] focus:border-[#D4AF37] outline-none font-mono"
                />
              </td>
              <td className="px-6 py-5 text-center">
                <div className="flex items-center justify-center gap-4">
                  <button 
                    onClick={decrement}
                    className="w-7 h-7 bg-red-50 text-red-600 rounded-md flex items-center justify-center hover:bg-red-100 transition-colors border border-red-100"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className={`font-bold font-mono w-6 text-center ${stockAdjustment > 0 ? 'text-green-600' : stockAdjustment < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                    {stockAdjustment > 0 ? `+${stockAdjustment}` : stockAdjustment}
                  </span>
                  <button 
                    onClick={increment}
                    className="w-7 h-7 bg-green-50 text-green-600 rounded-md flex items-center justify-center hover:bg-green-100 transition-colors border border-green-100"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </td>
              <td className="px-6 py-5 text-right">
                <button className="px-5 py-2 bg-[#800020] text-white text-[10px] font-bold uppercase tracking-wider rounded shadow-sm hover:bg-[#6b001a] hover:shadow transition-all">
                  Update
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
