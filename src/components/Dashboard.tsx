import React, { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  Cell
} from 'recharts';
import { 
  Users, 
  FileCheck, 
  LayoutDashboard, 
  Calendar, 
  Filter,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { format, parseISO, getYear, getMonth } from 'date-fns';

const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRcRuotGWcsOe5VYCDYi7EEFbfL_JLHR4A8MB6pjfmoHAlDGQbLPzJFrtDjoUqpVLDOu435i6qsxCOi/pub?output=csv";

interface ReportData {
  timestamp: string;
  nama: string;
  jawatan: string;
  jenisTugas: string;
  unitBerkaitan: string;
  tajuk: string;
  tarikhMula: string;
  tarikhAkhir: string;
  masaMula: string;
  masaAkhir: string;
  tempat: string;
  catatan: string;
  pdfUrl: string;
}

const MONTHS = [
  'Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 
  'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'
];

export default function Dashboard() {
  const [data, setData] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>('Semua');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(CSV_URL);
      const csvText = await response.text();
      
      Papa.parse(csvText, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          // Skip header row if it exists
          const rows = results.data as string[][];
          const formattedData: ReportData[] = rows.slice(1).map(row => ({
            timestamp: row[0] || '',
            nama: row[1] || '',
            jawatan: row[2] || '',
            jenisTugas: row[3] || '',
            unitBerkaitan: row[4] || '',
            tajuk: row[5] || '',
            tarikhMula: row[6] || '',
            tarikhAkhir: row[7] || '',
            masaMula: row[8] || '',
            masaAkhir: row[9] || '',
            tempat: row[10] || '',
            catatan: row[11] || '',
            pdfUrl: row[12] || ''
          }));
          setData(formattedData);
          setLoading(false);
        },
        error: (err: any) => {
          setError('Gagal memproses data CSV');
          setLoading(false);
        }
      });
    } catch (err) {
      setError('Gagal memuat turun data');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const years = useMemo(() => {
    const yearsSet = new Set<string>();
    data.forEach(item => {
      if (item.tarikhMula) {
        try {
          const year = item.tarikhMula.split('-')[0];
          if (year && year.length === 4) yearsSet.add(year);
        } catch (e) {}
      }
    });
    return ['Semua', ...Array.from(yearsSet).sort((a, b) => b.localeCompare(a))];
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchesYear = selectedYear === 'Semua' || item.tarikhMula.startsWith(selectedYear);
      const matchesSearch = item.nama.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           item.tajuk.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesYear && matchesSearch;
    });
  }, [data, selectedYear, searchTerm]);

  const stats = useMemo(() => {
    const unitCounts: Record<string, number> = {};
    const taskCounts: Record<string, number> = {};
    
    filteredData.forEach(item => {
      const unit = item.unitBerkaitan || 'LAIN-LAIN';
      const task = item.jenisTugas || 'LAIN-LAIN';
      
      unitCounts[unit] = (unitCounts[unit] || 0) + 1;
      taskCounts[task] = (taskCounts[task] || 0) + 1;
    });

    return {
      total: filteredData.length,
      unitCounts,
      taskCounts
    };
  }, [filteredData]);

  const chartData = useMemo(() => {
    const counts: Record<string, number> = {};
    
    // Initialize months for the selected year or current year if 'Semua'
    const displayYear = selectedYear === 'Semua' ? new Date().getFullYear().toString() : selectedYear;
    
    MONTHS.forEach((_, index) => {
      counts[index] = 0;
    });

    filteredData.forEach(item => {
      if (item.tarikhMula) {
        const date = parseISO(item.tarikhMula);
        const year = getYear(date).toString();
        const month = getMonth(date);
        
        if (selectedYear === 'Semua' || year === selectedYear) {
          counts[month] = (counts[month] || 0) + 1;
        }
      }
    });

    return MONTHS.map((name, index) => ({
      name,
      jumlah: counts[index]
    }));
  }, [filteredData, selectedYear]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <RefreshCw className="w-10 h-10 text-[#003366] animate-spin" />
        <p className="text-slate-500 font-medium">Memuatkan data analisis...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4 text-center p-6">
        <div className="bg-rose-50 p-4 rounded-full">
          <LayoutDashboard className="w-12 h-12 text-rose-500" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">Ralat Memuatkan Data</h3>
        <p className="text-slate-500 max-w-xs">{error}</p>
        <button 
          onClick={fetchData}
          className="px-6 py-2 bg-[#003366] text-white rounded-lg font-bold hover:bg-[#002244] transition-all"
        >
          Cuba Lagi
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Filters & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-3">
          <div className="bg-[#003366]/10 p-2 rounded-lg">
            <Filter className="w-5 h-5 text-[#003366]" />
          </div>
          <select 
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm font-bold text-[#003366] focus:ring-2 focus:ring-[#003366] outline-none"
          >
            {years.map(year => <option key={year} value={year}>{year === 'Semua' ? 'Tahun: Semua' : `Tahun: ${year}`}</option>)}
          </select>
        </div>

        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Cari nama atau tajuk..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#003366] outline-none"
          />
        </div>

        <button 
          onClick={fetchData}
          className="flex items-center justify-center gap-2 px-4 py-2 text-[#003366] hover:bg-slate-50 rounded-lg transition-colors text-sm font-bold"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Scorecards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="bg-[#003366] p-4 rounded-2xl">
            <FileCheck className="w-8 h-8 text-white" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Jumlah Laporan</p>
            <h3 className="text-3xl font-black text-[#003366]">{stats.total}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Mengikut Unit
          </p>
          <div className="space-y-3">
            {Object.entries(stats.unitCounts).map(([unit, count]) => (
              <div key={unit} className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">{unit}</span>
                <div className="flex items-center gap-2 flex-1 mx-4">
                  <div className="h-1.5 bg-slate-100 rounded-full flex-1 overflow-hidden">
                    <div 
                      className="h-full bg-[#003366] rounded-full" 
                      style={{ width: `${(count / stats.total) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-black text-[#003366] w-6">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Jenis Tugas
          </p>
          <div className="space-y-3">
            {Object.entries(stats.taskCounts).map(([task, count]) => (
              <div key={task} className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">{task}</span>
                <div className="flex items-center gap-2 flex-1 mx-4">
                  <div className="h-1.5 bg-slate-100 rounded-full flex-1 overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full" 
                      style={{ width: `${(count / stats.total) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-black text-emerald-600 w-6">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#003366]">Jadual Laporan Dihantar</h3>
          <span className="text-xs font-bold text-slate-400 uppercase">Menunjukkan {filteredData.length} rekod</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Nama</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Jenis Tugas</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Unit</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Tajuk</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Tarikh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredData.length > 0 ? (
                filteredData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-800 uppercase">{item.nama}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 uppercase">
                        {item.jenisTugas}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-semibold text-slate-500 uppercase">{item.unitBerkaitan}</span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-600 line-clamp-1 font-medium">{item.tajuk}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-bold text-[#003366]">
                        {item.tarikhMula ? format(parseISO(item.tarikhMula), 'dd/MM/yyyy') : '-'}
                      </p>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                    Tiada rekod dijumpai
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-lg font-bold text-[#003366]">Analisis Bulanan ({selectedYear})</h3>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#003366] rounded-full" />
            <span className="text-xs font-bold text-slate-500 uppercase">Bilangan Laporan</span>
          </div>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
              />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ 
                  borderRadius: '12px', 
                  border: 'none', 
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                  padding: '12px'
                }}
                itemStyle={{ fontWeight: 700, color: '#003366' }}
              />
              <Bar 
                dataKey="jumlah" 
                fill="#003366" 
                radius={[6, 6, 0, 0]} 
                barSize={32}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.jumlah > 0 ? '#003366' : '#e2e8f0'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
