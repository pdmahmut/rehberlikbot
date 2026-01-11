"use client";

import React, { useState, useEffect } from 'react';
import { Bot, FileText, Settings, CheckCircle, Download, Sparkles, Zap, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MebbisExcelUpload from '@/components/mebbis/MebbisExcelUpload';
import MebbisRPDForm from '@/components/mebbis/MebbisRPDForm';
import MebbisScriptGenerator from '@/components/mebbis/MebbisScriptGenerator';
import type { MebbisExcelData, MebbisFormData, MebbisBulkFormData } from '@/types/mebbis';

type CurrentStep = 'upload' | 'form' | 'script';

interface EmbeddedData {
  [key: string]: Array<{ value: string; text: string }>;
}

export default function MebbisPage() {
  const [excelData, setExcelData] = useState<MebbisExcelData>({});
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [generatedScript, setGeneratedScript] = useState<MebbisFormData | null>(null);
  const [bulkData, setBulkData] = useState<MebbisBulkFormData>({ records: [], isBulkMode: false });
  const [currentStep, setCurrentStep] = useState<CurrentStep>('upload');
  const [isEmbeddedData, setIsEmbeddedData] = useState(true);

  // Load embedded data on component mount
  useEffect(() => {
    loadEmbeddedData();
  }, []);

  const loadEmbeddedData = async () => {
    try {
      const response = await fetch('/mebbis-data.json');
      const embeddedData: EmbeddedData = await response.json();
      
      const formattedData: MebbisExcelData = {};
      Object.keys(embeddedData).forEach(key => {
        if (Array.isArray(embeddedData[key])) {
          formattedData[key] = embeddedData[key];
        }
      });

      setExcelData(formattedData);
      setIsDataLoaded(true);
      setIsEmbeddedData(true);
      setCurrentStep('form');
    } catch (error) {
      console.error('Gömülü veriler yüklenemedi:', error);
    }
  };

  const handleDataLoaded = (data: MebbisExcelData) => {
    setExcelData(data);
    setIsDataLoaded(true);
    setIsEmbeddedData(false);
    setCurrentStep('form');
  };

  const switchToUpload = () => {
    setCurrentStep('upload');
    setIsEmbeddedData(false);
  };

  const handleGenerateScript = (formData: MebbisFormData) => {
    setGeneratedScript(formData);
    setBulkData({ records: [], isBulkMode: false });
    setCurrentStep('script');
  };

  const handleBulkGenerateScript = (bulkFormData: MebbisBulkFormData) => {
    setBulkData(bulkFormData);
    setGeneratedScript(null);
    setCurrentStep('script');
  };

  const resetProcess = () => {
    loadEmbeddedData();
    setBulkData({ records: [], isBulkMode: false });
    setGeneratedScript(null);
  };

  const goBackToForm = () => {
    setCurrentStep('form');
    setGeneratedScript(null);
    setBulkData({ records: [], isBulkMode: false });
  };

  const getProgressPercentage = () => {
    if (currentStep === 'upload') return 0;
    if (currentStep === 'form') return 50;
    return 100;
  };

  return (
    <div className="min-h-screen">
      {/* Hero Header */}
      <div className="relative overflow-hidden mb-8">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-500/10 via-indigo-500/10 to-purple-500/10 rounded-3xl" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiM5QzkyQUMiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-50 rounded-3xl" />
        
        <div className="relative px-6 py-8 sm:px-8 sm:py-10">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            {/* Title Section */}
            <div className="flex items-start gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-sky-400 to-indigo-600 rounded-2xl blur-lg opacity-40 animate-pulse" />
                <div className="relative p-4 bg-gradient-to-br from-sky-500 to-indigo-600 rounded-2xl shadow-xl">
                  <Bot className="h-8 w-8 text-white" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-sky-800 to-indigo-900 bg-clip-text text-transparent">
                    MEBBİS Entegrasyonu
                  </h1>
                  <span className="px-2 py-0.5 text-xs font-semibold bg-gradient-to-r from-sky-500 to-indigo-500 text-white rounded-full animate-pulse">
                    v2.0
                  </span>
                </div>
                <p className="text-gray-600 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  MEB RPD Sistemi için Gelişmiş Selenium Otomasyon Aracı
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              {isDataLoaded && (
                <>
                  {!isEmbeddedData && (
                    <Button 
                      variant="outline" 
                      onClick={resetProcess}
                      className="bg-white/80 backdrop-blur-sm border-gray-200 hover:bg-white hover:border-gray-300 transition-all duration-300 shadow-sm"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Varsayılan Veriler
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    onClick={switchToUpload}
                    className="bg-white/80 backdrop-blur-sm border-gray-200 hover:bg-white hover:border-gray-300 transition-all duration-300 shadow-sm"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Excel Yükle
                  </Button>
                  {currentStep === 'script' && (
                    <Button 
                      variant="outline" 
                      onClick={goBackToForm}
                      className="bg-white/80 backdrop-blur-sm border-gray-200 hover:bg-white hover:border-gray-300 transition-all duration-300 shadow-sm"
                    >
                      Forma Dön
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Desktop App Download Banner */}
          <div className="mt-6 p-4 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 rounded-2xl border border-emerald-200/50 backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    MEBBIS RPD Masaüstü Uygulaması
                    <span className="px-2 py-0.5 text-xs bg-emerald-100 text-emerald-700 rounded-full font-medium">YENİ</span>
                  </h3>
                  <p className="text-sm text-gray-600">Daha hızlı ve güvenilir otomasyon deneyimi için masaüstü uygulamasını indirin</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
                <a
                  href="/MEBBIS_RPD.exe"
                  download="MEBBIS_RPD.exe"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-medium rounded-xl shadow-lg hover:shadow-xl hover:from-emerald-600 hover:to-teal-700 transition-all duration-300 transform hover:scale-105"
                >
                  <Download className="h-4 w-4" />
                  Windows için İndir
                  <span className="text-xs opacity-75">(.exe)</span>
                </a>
                <a
                  href="/SeleniumBasic-2.0.9.0.zip"
                  download="SeleniumBasic-2.0.9.0.zip"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium rounded-xl shadow-lg hover:shadow-xl hover:from-amber-600 hover:to-orange-600 transition-all duration-300 transform hover:scale-105"
                >
                  <Shield className="h-4 w-4" />
                  SeleniumBasic İndir
                  <span className="text-xs opacity-75">(.zip)</span>
                </a>
                <a
                  href="https://googlechromelabs.github.io/chrome-for-testing/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium rounded-xl shadow-lg hover:shadow-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105"
                >
                  <Bot className="h-4 w-4" />
                  ChromeDriver İndir
                  <span className="text-xs opacity-75">(Web)</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modern Progress Bar */}
      <div className="mb-8 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Step Indicators */}
          <div className="flex justify-between items-start mb-4">
            {/* Step 1 */}
            <div className="flex flex-col items-center flex-1">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-500 shadow-lg z-10 ${
                currentStep === 'upload' 
                  ? 'border-sky-500 bg-white text-sky-600 ring-4 ring-sky-100 scale-110' 
                  : isDataLoaded 
                    ? 'border-emerald-500 bg-emerald-500 text-white' 
                    : 'border-gray-300 bg-white text-gray-400'
              }`}>
                {isDataLoaded && currentStep !== 'upload' ? <CheckCircle className="h-5 w-5" /> : '1'}
              </div>
              <span className={`mt-3 text-xs font-medium text-center transition-colors duration-300 ${
                currentStep === 'upload' ? 'text-sky-600' : isDataLoaded ? 'text-emerald-600' : 'text-gray-400'
              }`}>
                Veri Kaynağı
              </span>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center flex-1">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-500 shadow-lg z-10 ${
                currentStep === 'form' 
                  ? 'border-indigo-500 bg-white text-indigo-600 ring-4 ring-indigo-100 scale-110' 
                  : (generatedScript || bulkData.isBulkMode) 
                    ? 'border-emerald-500 bg-emerald-500 text-white' 
                    : 'border-gray-300 bg-white text-gray-400'
              }`}>
                {(generatedScript || bulkData.isBulkMode) && currentStep === 'script' ? <CheckCircle className="h-5 w-5" /> : '2'}
              </div>
              <span className={`mt-3 text-xs font-medium text-center transition-colors duration-300 ${
                currentStep === 'form' ? 'text-indigo-600' : (generatedScript || bulkData.isBulkMode) ? 'text-emerald-600' : 'text-gray-400'
              }`}>
                Form
              </span>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center flex-1">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-500 shadow-lg z-10 ${
                currentStep === 'script' 
                  ? 'border-purple-500 bg-white text-purple-600 ring-4 ring-purple-100 scale-110' 
                  : 'border-gray-300 bg-white text-gray-400'
              }`}>
                3
              </div>
              <span className={`mt-3 text-xs font-medium text-center transition-colors duration-300 ${
                currentStep === 'script' ? 'text-purple-600' : 'text-gray-400'
              }`}>
                Kod Oluştur
              </span>
            </div>
          </div>

          {/* Progress Bar - positioned behind circles */}
          <div className="relative -mt-[52px] px-[20%]">
            <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${getProgressPercentage()}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Features Banner */}
      <div className="mb-8 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-sky-50 to-sky-100/50 rounded-xl border border-sky-200/50">
            <div className="p-2 bg-sky-500 rounded-lg">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <div>
              <h4 className="font-medium text-gray-800 text-sm">Hızlı Otomasyon</h4>
              <p className="text-xs text-gray-500">Saniyeler içinde kod üretin</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-indigo-50 to-indigo-100/50 rounded-xl border border-indigo-200/50">
            <div className="p-2 bg-indigo-500 rounded-lg">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <div>
              <h4 className="font-medium text-gray-800 text-sm">Güvenli İşlem</h4>
              <p className="text-xs text-gray-500">Verileriniz güvende</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-xl border border-purple-200/50">
            <div className="p-2 bg-purple-500 rounded-lg">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <h4 className="font-medium text-gray-800 text-sm">Çoklu Kayıt</h4>
              <p className="text-xs text-gray-500">Toplu işlem desteği</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4">
        <div className="relative">
          {/* Decorative Elements */}
          <div className="absolute -top-4 -left-4 w-24 h-24 bg-gradient-to-br from-sky-400/20 to-indigo-400/20 rounded-full blur-2xl" />
          <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full blur-2xl" />
          
          <div className="relative">
            {currentStep === 'upload' && (
              <div className="animate-fadeIn">
                <MebbisExcelUpload
                  onDataLoaded={handleDataLoaded}
                  isDataLoaded={false}
                  isEmbeddedDataAvailable={true}
                  onUseEmbeddedData={loadEmbeddedData}
                />
              </div>
            )}

            {currentStep === 'form' && isDataLoaded && (
              <div className="animate-fadeIn">
                <MebbisRPDForm
                  excelData={excelData}
                  onGenerateScript={handleGenerateScript}
                  onBulkGenerateScript={handleBulkGenerateScript}
                />
              </div>
            )}

            {currentStep === 'script' && (generatedScript || bulkData.isBulkMode) && (
              <div className="animate-fadeIn">
                <MebbisScriptGenerator
                  formData={generatedScript}
                  bulkData={bulkData.isBulkMode ? bulkData : undefined}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="max-w-5xl mx-auto px-4 mt-12">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 shadow-2xl">
          <div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(0deg,transparent,black)]" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-sky-500/20 to-indigo-500/20 rounded-full blur-3xl" />
          
          <div className="relative flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-xl backdrop-blur-sm">
                <Bot className="h-6 w-6 text-sky-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">RPD Automation Tool</h3>
                <p className="text-sm text-slate-400">Excel Tabanlı MEB Sistemi Entegrasyonu</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-400">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                Sistem aktif
              </span>
              <span>•</span>
              <span>v2.0</span>
            </div>
          </div>
          
          <div className="relative mt-4 pt-4 border-t border-white/10 text-center text-sm text-slate-400">
            <p>Bu araç, Excel verilerini kullanarak MEB RPD sistemindeki form doldurma işlemlerini otomatikleştirmek için tasarlanmıştır.</p>
            <p className="text-xs mt-1 text-slate-500">Sistem değer kodlarını kullanarak Türkçe karakter sorunlarını önler.</p>
          </div>
        </div>
      </div>

      {/* Custom Styles */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out forwards;
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  );
}
