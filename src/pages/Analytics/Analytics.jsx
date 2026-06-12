import { Download } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function Analytics() {
  const revenueData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Monthly Revenue (₹)',
        data: [120000, 190000, 150000, 250000, 220000, 310000],
        borderColor: '#D4AF37',
        backgroundColor: 'rgba(212, 175, 55, 0.1)',
        tension: 0.4,
        fill: true,
      },
    ],
  };

  const revenueOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
      x: { grid: { display: false } },
    },
  };

  const fabricData = {
    labels: ['Katan Silk', 'Organza', 'Georgette', 'Chiffon', 'Tussar'],
    datasets: [
      {
        label: 'Units Sold',
        data: [145, 110, 85, 60, 45],
        backgroundColor: '#800020',
        borderRadius: 4,
      },
    ],
  };

  const fabricOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
      x: { grid: { display: false } },
    },
  };

  return (
    <section className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h2 className="brand-font text-xl font-bold text-[#800020]">Sales Intelligence</h2>
        <button className="px-6 py-2 border border-[#800020]/20 text-[#800020] text-xs font-bold rounded-lg uppercase tracking-widest flex items-center gap-2 hover:bg-[#800020] hover:text-white transition-all shadow-sm">
          <Download className="w-4 h-4" /> Export PDF
        </button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Revenue Growth</h3>
            <span className="text-[#D4AF37] text-sm font-bold">+28.5%</span>
          </div>
          <div className="h-[250px] w-full">
            <Line data={revenueData} options={revenueOptions} />
          </div>
        </div>
        
        <div className="glass-card p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Sales by Fabric</h3>
          </div>
          <div className="h-[250px] w-full">
            <Bar data={fabricData} options={fabricOptions} />
          </div>
        </div>
      </div>
    </section>
  );
}
