/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  FileText, 
  User, 
  Briefcase, 
  MapPin, 
  Calendar, 
  Upload, 
  Eye, 
  Download, 
  ArrowLeft,
  CheckCircle2,
  Image as ImageIcon,
  Eraser,
  PenTool,
  LayoutDashboard,
  PlusCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import SignaturePad from 'signature_pad';
import Dashboard from './components/Dashboard';

interface FormData {
  nama: string;
  jawatan: string;
  unitBerkaitan: string;
  jenisTugas: string;
  tajuk: string;
  tarikhMula: string;
  tarikhAkhir: string;
  masaMula: string;
  masaAkhir: string;
  tempat: string;
  catatan: string;
}

const INITIAL_FORM_DATA: FormData = {
  nama: '',
  jawatan: '',
  unitBerkaitan: '',
  jenisTugas: '',
  tajuk: '',
  tarikhMula: '',
  tarikhAkhir: '',
  masaMula: '08:00 AM',
  masaAkhir: '05:00 PM',
  tempat: '',
  catatan: '',
};

const TIME_OPTIONS = [
  '06:00 AM', '06:30 AM', '07:00 AM', '07:30 AM', '08:00 AM', '08:30 AM', '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
  '12:00 PM', '12:30 PM', '01:00 PM', '01:30 PM', '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM', '05:00 PM', '05:30 PM',
  '06:00 PM', '06:30 PM', '07:00 PM', '07:30 PM', '08:00 PM', '08:30 PM', '09:00 PM', '09:30 PM', '10:00 PM', '10:30 PM', '11:00 PM'
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'form' | 'dashboard'>('form');
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);
  const [photos, setPhotos] = useState<string[]>([]);
  const [signature, setSignature] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signaturePadRef = useRef<SignaturePad | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);

  const sendToGoogleSheets = async (pdfBase64?: string, fileName?: string) => {
    const payload = {
      nama: formData.nama,
      jawatan: formData.jawatan,
      jenisTugas: formData.jenisTugas,
      unitBerkaitan: formData.unitBerkaitan,
      tajuk: formData.tajuk,
      tarikhMula: formData.tarikhMula,
      tarikhAkhir: formData.tarikhAkhir,
      masaMula: formData.masaMula,
      masaAkhir: formData.masaAkhir,
      tempat: formData.tempat,
      catatan: formData.catatan,
      pdfBase64,
      fileName
    };

    try {
      await fetch('/api/sheets/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.error('Failed to send to Google Sheets', err);
    }
  };

  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      signaturePadRef.current = new SignaturePad(canvas, {
        backgroundColor: 'rgba(255, 255, 255, 0)',
        penColor: '#003366'
      });

      signaturePadRef.current.addEventListener("beginStroke", () => {
        // Signature started
      });

      signaturePadRef.current.addEventListener("endStroke", () => {
        saveSignature();
      });

      // Handle resize
      const resizeCanvas = () => {
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        canvas.getContext("2d")?.scale(ratio, ratio);
        signaturePadRef.current?.clear(); 
      };

      window.addEventListener("resize", resizeCanvas);
      resizeCanvas();

      return () => {
        window.removeEventListener("resize", resizeCanvas);
        signaturePadRef.current?.off();
      };
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).slice(0, 4);
      const newPhotos: string[] = [];
      
      files.forEach((file: File) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            newPhotos.push(event.target.result as string);
            if (newPhotos.length === files.length) {
              setPhotos(newPhotos);
            }
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const clearSignature = () => {
    signaturePadRef.current?.clear();
    setSignature(null);
  };

  const saveSignature = () => {
    if (signaturePadRef.current && !signaturePadRef.current.isEmpty()) {
      setSignature(signaturePadRef.current.toDataURL('image/png'));
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const getDisplayDate = () => {
    const mula = formatDate(formData.tarikhMula);
    const akhir = formatDate(formData.tarikhAkhir);
    if (!mula) return '';
    return mula === akhir || !akhir ? mula : `${mula}-${akhir}`;
  };

  const handleGeneratePDF = async () => {
    const element = document.getElementById('pdf-render');
    if (!element) return;
    
    setIsGenerating(true);
    
    try {
      // Ensure images are loaded
      const images = element.getElementsByTagName('img');
      const imagePromises = Array.from(images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      });
      
      await Promise.all(imagePromises);
      // Small extra delay for rendering stability
      await new Promise(resolve => setTimeout(resolve, 500));

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: element.offsetWidth,
        height: element.offsetHeight
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      // Force exactly A4 dimensions (210x297) to prevent blank 2nd page
      pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
      const fileName = `Laporan_${formData.nama.replace(/\s+/g, '_')}_${formData.tarikhMula}.pdf`;
      
      // Get PDF as base64 string
      const pdfBase64 = pdf.output('datauristring').split(',')[1];
      
      pdf.save(fileName);
      await sendToGoogleSheets(pdfBase64, fileName);
      setShowPreview(false);
    } catch (error) {
      console.error('PDF Generation Error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const activityLines = formData.catatan.split('\n').filter(line => line.trim() !== '');

  return (
    <div className="min-h-screen bg-[#f0f2f5] py-8 px-4 font-sans text-slate-800">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation Tabs */}
        <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 w-fit mx-auto">
          <button 
            onClick={() => setActiveTab('form')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${
              activeTab === 'form' 
              ? 'bg-[#003366] text-white shadow-md' 
              : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            Laporan Baru
          </button>
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${
              activeTab === 'dashboard' 
              ? 'bg-[#003366] text-white shadow-md' 
              : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard Analisis
          </button>
        </div>

        {activeTab === 'form' ? (
          <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
            {/* Header */}
            <header className="bg-white border-b-4 border-[#003366] p-6 text-center">
              <img 
                src="https://i.postimg.cc/LXgM3jtY/1.jpg" 
                alt="SMK Sacred Heart Logo" 
                className="w-16 h-16 mx-auto mb-3 object-contain"
                referrerPolicy="no-referrer"
              />
              <h1 className="text-xl font-bold text-[#003366] uppercase tracking-tight">
                Sek. Men. Keb. Sacred Heart
              </h1>
              <p className="text-sm font-semibold text-slate-500 mt-1">
                SISTEM E-LAPORAN TUGAS RASMI
              </p>
            </header>

            {/* Form Body */}
            <div className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="flex items-center text-sm font-bold text-[#003366]">
                <User className="w-4 h-4 mr-2" />
                Nama
              </label>
              <input 
                id="nama"
                type="text"
                value={formData.nama}
                onChange={handleInputChange}
                placeholder="Contoh: ALI BIN AHMAD"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#003366] focus:border-transparent transition-all outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center text-sm font-bold text-[#003366]">
                <Briefcase className="w-4 h-4 mr-2" />
                Jawatan
              </label>
              <input 
                id="jawatan"
                type="text"
                value={formData.jawatan}
                onChange={handleInputChange}
                placeholder="Contoh: Ketua Panitia"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#003366] focus:border-transparent transition-all outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="flex items-center text-sm font-bold text-[#003366]">
                <FileText className="w-4 h-4 mr-2" />
                Jenis Tugas Rasmi
              </label>
              <select 
                id="jenisTugas"
                value={formData.jenisTugas}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#003366] focus:border-transparent transition-all outline-none appearance-none"
              >
                <option value="" disabled hidden>Sila pilih jenis tugas rasmi.</option>
                <option>MESYUARAT</option>
                <option>BENGKEL</option>
                <option>PROGRAM</option>
                <option>PERTANDINGAN</option>
                <option>LAIN-LAIN</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="flex items-center text-sm font-bold text-[#003366]">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Unit Berkaitan
              </label>
              <select 
                id="unitBerkaitan"
                value={formData.unitBerkaitan}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#003366] focus:border-transparent transition-all outline-none appearance-none"
              >
                <option value="" disabled hidden>Sila pilih unit yang berkaitan.</option>
                <option>AKADEMIK</option>
                <option>HAL EHWAL MURID</option>
                <option>KOKURIKULUM</option>
                <option>LAIN-LAIN</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center text-sm font-bold text-[#003366]">
              <FileText className="w-4 h-4 mr-2" />
              Tajuk Aktiviti
            </label>
            <input 
              id="tajuk"
              type="text"
              value={formData.tajuk}
              onChange={handleInputChange}
              placeholder="Masukkan tajuk penuh aktiviti"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#003366] focus:border-transparent transition-all outline-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="flex items-center text-sm font-bold text-[#003366]">
                <Calendar className="w-4 h-4 mr-2" />
                Tarikh Mula
              </label>
              <input 
                id="tarikhMula"
                type="date"
                value={formData.tarikhMula}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#003366] focus:border-transparent transition-all outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center text-sm font-bold text-[#003366]">
                <Calendar className="w-4 h-4 mr-2" />
                Tarikh Akhir
              </label>
              <input 
                id="tarikhAkhir"
                type="date"
                value={formData.tarikhAkhir}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#003366] focus:border-transparent transition-all outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="flex items-center text-sm font-bold text-[#003366]">
                <Calendar className="w-4 h-4 mr-2" />
                Masa Mula
              </label>
              <select 
                id="masaMula"
                value={formData.masaMula}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#003366] focus:border-transparent transition-all outline-none appearance-none"
              >
                {TIME_OPTIONS.map(time => <option key={time} value={time}>{time}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="flex items-center text-sm font-bold text-[#003366]">
                <Calendar className="w-4 h-4 mr-2" />
                Masa Akhir
              </label>
              <select 
                id="masaAkhir"
                value={formData.masaAkhir}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#003366] focus:border-transparent transition-all outline-none appearance-none"
              >
                {TIME_OPTIONS.map(time => <option key={time} value={time}>{time}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center text-sm font-bold text-[#003366]">
              <MapPin className="w-4 h-4 mr-2" />
              Tempat
            </label>
            <input 
              id="tempat"
              type="text"
              value={formData.tempat}
              onChange={handleInputChange}
              placeholder="Contoh: Bilik Mesyuarat / Dewan"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#003366] focus:border-transparent transition-all outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center text-sm font-bold text-[#003366]">
              <FileText className="w-4 h-4 mr-2" />
              Catatan Aktiviti
            </label>
            <textarea 
              id="catatan"
              rows={6}
              value={formData.catatan}
              onChange={handleInputChange}
              placeholder="Masukkan poin-poin aktiviti (Gunakan baris baru untuk setiap poin)"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#003366] focus:border-transparent transition-all outline-none resize-none"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center text-sm font-bold text-[#003366]">
              <Upload className="w-4 h-4 mr-2" />
              Muat Naik Gambar
            </label>
            <div className="relative group">
              <input 
                type="file"
                multiple
                accept="image/*"
                onChange={handlePhotoUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="w-full px-4 py-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center group-hover:bg-slate-100 transition-colors">
                <ImageIcon className="w-10 h-10 text-slate-300 mb-2" />
                <p className="text-sm text-[#003366] text-center font-bold">Sila klik untuk muat naik gambar. (Maksimum 4 keping gambar)</p>
              </div>
            </div>
            {photos.length > 0 && (
              <div className="flex gap-4 mt-4 overflow-x-auto pb-2">
                {photos.map((src, idx) => (
                  <div key={idx} className="relative flex-shrink-0">
                    <img 
                      src={src} 
                      alt={`Upload ${idx + 1}`} 
                      className="w-24 h-24 object-cover rounded-lg border-2 border-[#003366]"
                    />
                    <div className="absolute -top-2 -right-2 bg-[#003366] text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">
                      {idx + 1}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="flex items-center text-sm font-bold text-[#003366]">
              <PenTool className="w-4 h-4 mr-2" />
              Tandatangan
            </label>
            <div className="border-2 border-slate-200 rounded-xl bg-slate-50 overflow-hidden relative">
              <canvas 
                ref={canvasRef}
                className="w-full h-40 cursor-crosshair relative z-10"
                style={{ touchAction: 'none' }}
              />
              <div className="bg-slate-100 p-2 flex justify-end border-t border-slate-200 relative z-20">
                <button 
                  onClick={clearSignature}
                  className="flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 transition-colors px-3 py-1.5 rounded-lg hover:bg-rose-50"
                >
                  <Eraser className="w-3 h-3" />
                  PADAM / RESET
                </button>
              </div>
            </div>
          </div>

          <button 
            onClick={() => {
              const missingFields = [];
              if (!formData.nama) missingFields.push("Nama Guru");
              if (!formData.tajuk) missingFields.push("Tajuk Aktiviti");
              if (!formData.jenisTugas) missingFields.push("Jenis Tugas Rasmi");
              if (!formData.unitBerkaitan) missingFields.push("Unit Berkaitan");
              
              if (missingFields.length > 0) {
                alert(`Sila lengkapkan maklumat berikut: ${missingFields.join(", ")}`);
                return;
              }
              
              if (photos.length === 0) {
                alert("Sila muat naik sekurang-kurangnya 1 keping gambar sebagai lampiran.");
                return;
              }
              
              let currentSignature = signature;
              if (!currentSignature && signaturePadRef.current && !signaturePadRef.current.isEmpty()) {
                currentSignature = signaturePadRef.current.toDataURL('image/png');
                setSignature(currentSignature);
              }
              
              if (!currentSignature) {
                alert("Sila turunkan tandatangan anda pada ruangan Tandatangan.");
                return;
              }
              
              setShowPreview(true);
            }}
            className="w-full bg-[#003366] hover:bg-[#002244] text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 mt-4"
          >
            <Eye className="w-5 h-5" />
            SEMAK LAPORAN / PREVIEW
          </button>
          
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <p className="text-xs text-emerald-800 font-medium">
              Data akan dihantar secara automatik ke Google Sheets semasa muat turun.
            </p>
          </div>
        </div>
      </div>
    ) : (
      <Dashboard />
    )}
  </div>

      {/* Preview Modal */}
      <AnimatePresence>
        {showPreview && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h2 className="text-xl font-bold text-[#003366]">Semakan Laporan</h2>
                <button 
                  onClick={() => setShowPreview(false)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="space-y-3">
                  <div className="flex border-b border-slate-50 py-1.5">
                    <span className="w-32 font-bold text-slate-500 text-xs">Nama</span>
                    <span className="flex-1 text-sm font-semibold uppercase">: {formData.nama}</span>
                  </div>
                  <div className="flex border-b border-slate-50 py-1.5">
                    <span className="w-32 font-bold text-slate-500 text-xs">Jawatan</span>
                    <span className="flex-1 text-sm font-semibold uppercase">: {formData.jawatan}</span>
                  </div>
                  <div className="flex border-b border-slate-50 py-1.5">
                    <span className="w-32 font-bold text-slate-500 text-xs">Jenis Tugas</span>
                    <span className="flex-1 text-sm font-semibold uppercase">: {formData.jenisTugas}</span>
                  </div>
                  <div className="flex border-b border-slate-50 py-1.5">
                    <span className="w-32 font-bold text-slate-500 text-xs">Unit Berkaitan</span>
                    <span className="flex-1 text-sm font-semibold uppercase">: {formData.unitBerkaitan}</span>
                  </div>
                  <div className="flex border-b border-slate-50 py-1.5">
                    <span className="w-32 font-bold text-slate-500 text-xs">Tajuk Aktiviti</span>
                    <span className="flex-1 text-sm font-semibold uppercase">: {formData.tajuk}</span>
                  </div>
                  <div className="flex border-b border-slate-50 py-1.5">
                    <span className="w-32 font-bold text-slate-500 text-xs">Tarikh</span>
                    <span className="flex-1 text-sm font-semibold">: {getDisplayDate()}</span>
                  </div>
                  <div className="flex border-b border-slate-50 py-1.5">
                    <span className="w-32 font-bold text-slate-500 text-xs">Masa</span>
                    <span className="flex-1 text-sm font-semibold">: {formData.masaMula} - {formData.masaAkhir}</span>
                  </div>
                  <div className="flex border-b border-slate-50 py-1.5">
                    <span className="w-32 font-bold text-slate-500 text-xs">Tempat</span>
                    <span className="flex-1 text-sm font-semibold uppercase">: {formData.tempat}</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg">
                  <span className="block font-bold text-slate-500 text-xs mb-2">Ringkasan Aktiviti:</span>
                  <div className="text-sm text-slate-700 whitespace-pre-wrap">
                    {formData.catatan || <span className="italic text-slate-400">Tiada catatan</span>}
                  </div>
                </div>

                {photos.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-2">
                    {photos.map((src, idx) => (
                      <img 
                        key={idx} 
                        src={src} 
                        alt="Preview" 
                        className="w-full aspect-video object-cover rounded-lg border border-slate-200 shadow-sm"
                      />
                    ))}
                  </div>
                )}

                {signature && (
                  <div className="bg-slate-50 p-4 rounded-lg flex flex-col items-center">
                    <span className="block font-bold text-slate-500 text-xs mb-2 self-start">Tandatangan:</span>
                    <img 
                      src={signature} 
                      alt="Signature Preview" 
                      className="h-20 object-contain bg-white border border-slate-200 rounded p-1"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                  <button 
                    onClick={() => setShowPreview(false)}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="w-5 h-5" />
                    KEMBALI / EDIT
                  </button>
                  <button 
                    onClick={handleGeneratePDF}
                    disabled={isGenerating}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold py-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    {isGenerating ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Download className="w-5 h-5" />
                    )}
                    SAH & HANTAR LAPORAN
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PDF TEMPLATE (HIDDEN BUT ACCESSIBLE TO HTML2CANVAS) */}
      <div style={{ 
        position: 'absolute', 
        top: '-10000px', 
        left: '0',
        width: '210mm',
        height: '297mm',
        overflow: 'hidden',
        zIndex: -1
      }}>
        <div id="pdf-render" style={{ 
          width: '210mm', 
          height: '297mm', 
          background: 'white', 
          padding: '12mm 15mm', 
          boxSizing: 'border-box', 
          fontFamily: 'Arial, sans-serif',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#000'
        }}>
          {/* Main Content Area */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ textAlign: 'center', borderBottom: '2px solid black', paddingBottom: '8px', marginBottom: '12px' }}>
              <img 
                src="https://i.postimg.cc/LXgM3jtY/1.jpg" 
                alt="Logo" 
                style={{ width: '20mm', display: 'block', margin: '0 auto' }}
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
              />
              <h2 style={{ margin: '4px 0 0', fontSize: '16px', color: '#003366' }}>SEK. MEN. KEB. SACRED HEART</h2>
              <p style={{ margin: '1px 0 0', fontSize: '11px', fontWeight: 'bold' }}>KM3, JALAN BROTHER ALBINUS, 96000 SIBU, SARAWAK</p>
            </div>

            <div style={{ textAlign: 'center', marginBottom: '15px' }}>
              <h2 style={{ margin: '0', fontSize: '16px', textTransform: 'uppercase', textDecoration: 'underline' }}>LAPORAN TUGAS RASMI</h2>
              <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#555' }}>SISTEM E-LAPORAN DIGITAL SMK SACRED HEART</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px', fontSize: '16px', marginBottom: '15px' }}>
              <div style={{ display: 'flex', borderBottom: '0.5px solid #eee', padding: '4px 0', alignItems: 'baseline' }}>
                <span style={{ width: '30mm', fontWeight: 'bold', fontSize: '13px', flexShrink: 0 }}>NAMA</span>
                <span style={{ width: '3mm', fontWeight: 'bold', flexShrink: 0 }}>:</span>
                <span style={{ textTransform: 'uppercase', fontSize: '14px' }}>{formData.nama}</span>
              </div>
              <div style={{ display: 'flex', borderBottom: '0.5px solid #eee', padding: '4px 0', alignItems: 'baseline' }}>
                <span style={{ width: '30mm', fontWeight: 'bold', fontSize: '13px', flexShrink: 0 }}>JAWATAN</span>
                <span style={{ width: '3mm', fontWeight: 'bold', flexShrink: 0 }}>:</span>
                <span style={{ textTransform: 'uppercase', fontSize: '14px' }}>{formData.jawatan}</span>
              </div>
              <div style={{ display: 'flex', borderBottom: '0.5px solid #eee', padding: '4px 0', alignItems: 'baseline' }}>
                <span style={{ width: '30mm', fontWeight: 'bold', fontSize: '13px', flexShrink: 0 }}>JENIS TUGAS</span>
                <span style={{ width: '3mm', fontWeight: 'bold', flexShrink: 0 }}>:</span>
                <span style={{ textTransform: 'uppercase', fontSize: '14px' }}>{formData.jenisTugas}</span>
              </div>
              <div style={{ display: 'flex', borderBottom: '0.5px solid #eee', padding: '4px 0', alignItems: 'baseline' }}>
                <span style={{ width: '30mm', fontWeight: 'bold', fontSize: '13px', flexShrink: 0 }}>UNIT</span>
                <span style={{ width: '3mm', fontWeight: 'bold', flexShrink: 0 }}>:</span>
                <span style={{ textTransform: 'uppercase', fontSize: '14px' }}>{formData.unitBerkaitan}</span>
              </div>
              <div style={{ display: 'flex', borderBottom: '0.5px solid #eee', padding: '4px 0', alignItems: 'baseline' }}>
                <span style={{ width: '30mm', fontWeight: 'bold', fontSize: '13px', flexShrink: 0 }}>TEMPAT</span>
                <span style={{ width: '3mm', fontWeight: 'bold', flexShrink: 0 }}>:</span>
                <span style={{ textTransform: 'uppercase', fontSize: '14px' }}>{formData.tempat}</span>
              </div>
              <div style={{ display: 'flex', borderBottom: '0.5px solid #eee', padding: '4px 0', alignItems: 'baseline' }}>
                <span style={{ width: '30mm', fontWeight: 'bold', fontSize: '13px', flexShrink: 0 }}>TARIKH</span>
                <span style={{ width: '3mm', fontWeight: 'bold', flexShrink: 0 }}>:</span>
                <span style={{ textTransform: 'uppercase', fontSize: '14px' }}>{getDisplayDate().replace(' - ', '-')}</span>
              </div>
              <div style={{ display: 'flex', borderBottom: '0.5px solid #eee', padding: '4px 0', alignItems: 'baseline' }}>
                <span style={{ width: '30mm', fontWeight: 'bold', fontSize: '13px', flexShrink: 0 }}>MASA</span>
                <span style={{ width: '3mm', fontWeight: 'bold', flexShrink: 0 }}>:</span>
                <span style={{ textTransform: 'uppercase', fontSize: '14px' }}>{formData.masaMula}-{formData.masaAkhir}</span>
              </div>
            </div>

            <div style={{ fontWeight: 'bold', margin: '15px 0 8px', fontSize: '14px', background: '#f2f2f2', padding: '6px 10px', borderLeft: '5px solid #003366' }}>
              TAJUK AKTIVITI
            </div>
            <div style={{ fontSize: '16px', padding: '5px 10px', fontWeight: 'bold', textTransform: 'uppercase' }}>
              {formData.tajuk}
            </div>

            <div style={{ fontWeight: 'bold', margin: '20px 0 8px', fontSize: '14px', background: '#f2f2f2', padding: '6px 10px', borderLeft: '5px solid #003366' }}>
              RINGKASAN AKTIVITI
            </div>
            <div style={{ fontSize: '16px', lineHeight: '1.6', padding: '0 15px' }}>
              <ul style={{ margin: '0', paddingLeft: '20px' }}>
                {activityLines.map((line, idx) => (
                  <li key={idx} style={{ marginBottom: '5px' }}>{line}</li>
                ))}
              </ul>
            </div>

            <div style={{ fontWeight: 'bold', margin: '15px 0 8px', fontSize: '14px', background: '#f2f2f2', padding: '6px 10px', borderLeft: '5px solid #003366' }}>
              LAMPIRAN GAMBAR
            </div>
            <div style={{ 
              display: 'flex',
              flexWrap: 'nowrap',
              gap: '8px',
              justifyContent: 'center',
              marginTop: '5px',
              width: '100%'
            }}>
              {photos.map((src, idx) => {
                // Calculate size to fit in one row, max 75mm
                // Available width is ~180mm. 
                const maxAvailableWidth = 180;
                const gapTotal = (photos.length - 1) * 8;
                const calculatedSize = (maxAvailableWidth - gapTotal) / photos.length;
                const size = Math.min(75, calculatedSize) + 'mm';
                
                return (
                  <div key={idx} style={{ 
                    width: size, 
                    height: size, 
                    flexShrink: 0,
                    overflow: 'hidden', 
                    border: '1px solid #003366',
                    backgroundColor: '#f8fafc'
                  }}>
                    <img 
                      src={src} 
                      alt="Attachment" 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      crossOrigin="anonymous"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Signature */}
          <div style={{ marginTop: 'auto', borderTop: '1px solid #eee', paddingTop: '15px' }}>
            <div style={{ fontSize: '14px', marginBottom: '2mm' }}>Disediakan oleh,</div>
            {signature && (
              <div style={{ marginBottom: '-5mm', marginLeft: '5mm' }}>
                <img 
                  src={signature} 
                  alt="Signature" 
                  style={{ height: '20mm', objectFit: 'contain' }}
                  crossOrigin="anonymous"
                />
              </div>
            )}
            <div style={{ borderTop: '1px solid black', width: '70mm', paddingTop: '8px', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '16px' }}>
              {formData.nama}<br />
              <span style={{ fontWeight: 'normal', fontSize: '14px' }}>{formData.jawatan}</span><br />
              <span style={{ fontWeight: 'normal', fontSize: '14px' }}>Tarikh: {new Date().toLocaleDateString('en-GB')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
