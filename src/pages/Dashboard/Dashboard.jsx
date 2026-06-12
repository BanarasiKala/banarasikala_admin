import { Users, Box, TrendingUp, IndianRupee, Eye, TrendingDown } from 'lucide-react';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, 
  Title, Tooltip, Legend, ArcElement, Filler
} from 'chart.js';
import './Dashboard.css';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, 
  Title, Tooltip, Legend, ArcElement, Filler
);

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    y: { border: { display: false }, grid: { color: 'rgba(0,0,0,0.03)' }, ticks: { font: { size: 9 } } },
    x: { border: { display: false }, grid: { display: false }, ticks: { font: { size: 9 } } }
  }
};

export default function Dashboard() {
  const revenueData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [{
      label: 'Revenue (₹)',
      data: [1200000, 1900000, 1500000, 2500000, 2200000, 2850000],
      borderColor: '#D4AF37',
      backgroundColor: 'rgba(212, 175, 55, 0.05)',
      fill: true, tension: 0.4, borderWidth: 3,
      pointBackgroundColor: '#800020', pointRadius: 4
    }]
  };

  const collectionData = {
    labels: ['Bridal', 'Festival', 'Casual', 'Fusion'],
    datasets: [{
      data: [45, 30, 15, 10],
      backgroundColor: ['#800020', '#D4AF37', '#4A3F35', '#FAF8F6'],
      borderWidth: 0
    }]
  };

  const donutOptions = {
    ...chartOptions,
    cutout: '75%',
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 8, font: { size: 9 } } } }
  };

  return (
    <section className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-card p-5 rounded-xl">
            <div className="flex justify-between items-center mb-3">
                <div className="p-2 bg-[#D4AF37]/10 rounded-lg text-[#D4AF37]">
                    <Users className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-green-600 flex items-center gap-0.5">+12% <TrendingUp className="w-3 h-3" /></span>
            </div>
            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Total Users</p>
            <h3 className="text-2xl font-extrabold text-[#4A3F35] tracking-tight">2,456</h3>
        </div>
        <div className="glass-card p-5 rounded-xl">
            <div className="flex justify-between items-center mb-3">
                <div className="p-2 bg-[#800020]/10 rounded-lg text-[#800020]">
                    <Box className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-green-600 flex items-center gap-0.5">+8% <TrendingUp className="w-3 h-3" /></span>
            </div>
            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Total Orders</p>
            <h3 className="text-2xl font-extrabold text-[#4A3F35] tracking-tight">1,204</h3>
        </div>
        <div className="glass-card p-5 rounded-xl">
            <div className="flex justify-between items-center mb-3">
                <div className="p-2 bg-green-50 rounded-lg text-green-600">
                    <IndianRupee className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-green-600 flex items-center gap-0.5">+24% <TrendingUp className="w-3 h-3" /></span>
            </div>
            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Revenue</p>
            <h3 className="text-2xl font-extrabold text-[#4A3F35] tracking-tight">₹28.5L</h3>
        </div>
        <div className="glass-card p-5 rounded-xl">
            <div className="flex justify-between items-center mb-3">
                <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                    <Eye className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-red-600 flex items-center gap-0.5">-3% <TrendingDown className="w-3 h-3" /></span>
            </div>
            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Website Visits</p>
            <h3 className="text-2xl font-extrabold text-[#4A3F35] tracking-tight">45.2K</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="glass-card p-8 rounded-[2rem] bg-[#FDFCFB] border-[#D4AF37]/20">
              <div className="flex items-center justify-between mb-8">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-[#4A3F35] flex items-center gap-2">
                      <span className="w-1.5 h-6 bg-[#D4AF37] rounded-full"></span>
                      Revenue Analytics
                  </h3>
                  <select className="text-[10px] border border-[#D4AF37]/20 rounded px-2 py-1 outline-none bg-white">
                      <option>Monthly</option>
                      <option>Weekly</option>
                  </select>
              </div>
              <div className="h-[200px]">
                <Line data={revenueData} options={chartOptions} />
              </div>
          </div>
          <div className="glass-card p-8 rounded-[2rem] bg-[#FDFCFB] border-[#D4AF37]/20">
              <div className="flex items-center justify-between mb-8">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-[#4A3F35] flex items-center gap-2">
                      <span className="w-1.5 h-6 bg-[#800020] rounded-full"></span>
                      Collection Mix
                  </h3>
              </div>
              <div className="flex items-center justify-center min-h-[200px]">
                  <Doughnut data={collectionData} options={donutOptions} />
              </div>
          </div>
      </div>
    </section>
  );
}
