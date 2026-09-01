import { useState, useCallback } from 'react';
import {
  ArrowLeft,
  Package,
  Upload,
  Scan,
  Save,
  Check,
  X,
  AlertTriangle,
  Loader2,
  FileText,
  ImageIcon,
  ChevronRight,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { supabase, STORAGE_BUCKET } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { performOcr } from '@/services/ocrService';
import { runComplianceCheck } from '@/services/complianceEngine';
import {
  type ComplianceReport,
  type DeclarationType,
  type OcrResult,
  type LabelImage,
  DECLARATION_LABELS,
  DECLARATION_KEYS,
} from '@/types';

interface InspectionWorkflowProps {
  onComplete: () => void;
  onBack: () => void;
}

type Step = 'details' | 'upload' | 'analyzing' | 'results';

interface ProductDetails {
  productName: string;
  brandName: string;
  category: string;
  batchNumber: string;
}

interface UploadedImage {
  file: File;
  previewUrl: string;
  base64: string | null;
}

const categories = [
  'Food & Beverages',
  'Cosmetics & Personal Care',
  'Pharmaceuticals',
  'Household Products',
  'Electronics',
  'Textiles',
  'Toys',
  'Other',
];

export default function InspectionWorkflow({ onComplete, onBack }: InspectionWorkflowProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('details');
  const [details, setDetails] = useState<ProductDetails>({
    productName: '',
    brandName: '',
    category: '',
    batchNumber: '',
  });
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [ocrResults, setOcrResults] = useState<OcrResult[]>([]);
  const [combinedOcrText, setCombinedOcrText] = useState('');
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [inspectionId, setInspectionId] = useState<string | null>(null);

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!details.productName.trim()) return;
    setStep('upload');
  };

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const newImages: UploadedImage[] = files.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      base64: null,
    }));

    // Pre-load base64 for OCR
    newImages.forEach((img) => {
      const reader = new FileReader();
      reader.onload = () => {
        img.base64 = (reader.result as string).split(',')[1] ?? null;
      };
      reader.readAsDataURL(img.file);
    });

    setImages((prev) => [...prev, ...newImages]);
  }, []);

  const removeImage = (index: number) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleAnalyze = async () => {
    if (images.length === 0) return;
    setStep('analyzing');
    setError(null);

    try {
      const results: OcrResult[] = [];
      for (const img of images) {
        const result = await performOcr(img.base64);
        results.push(result);
      }

      setOcrResults(results);
      const combined = results.map((r) => r.text).join('\n\n---\n\n');
      setCombinedOcrText(combined);

      const complianceReport = runComplianceCheck(combined);
      setReport(complianceReport);
      setStep('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed. Please try again.');
      setStep('upload');
    }
  };

  const handleSave = async () => {
    if (!user || !report) return;
    setSaving(true);
    setError(null);

    try {
      // 1. Create inspection record
      const { data: inspData, error: inspError } = await supabase
        .from('inspections')
        .insert({
          product_name: details.productName,
          brand_name: details.brandName || null,
          product_category: details.category || null,
          batch_number: details.batchNumber || null,
          status: 'saved',
          compliance_score: report.score,
          compliance_status: report.overall_status,
          summary: report.summary,
        })
        .select('id')
        .single();

      if (inspError || !inspData) throw new Error(inspError?.message ?? 'Failed to create inspection');
      const newInspectionId = inspData.id;
      setInspectionId(newInspectionId);

      // 2. Upload images to storage and create label_images records
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const fileExt = img.file.name.split('.').pop() ?? 'jpg';
        const fileName = `${newInspectionId}/${Date.now()}_${i}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(fileName, img.file);

        if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`);

        const { error: imgRecordError } = await supabase.from('label_images').insert({
          inspection_id: newInspectionId,
          storage_path: fileName,
          file_name: img.file.name,
          ocr_text: ocrResults[i]?.text ?? null,
          ocr_confidence: ocrResults[i]?.confidence ?? null,
        });

        if (imgRecordError) throw new Error(imgRecordError.message);
      }

      // 3. Save compliance results
      const complianceRows = report.results.map((r) => ({
        inspection_id: newInspectionId,
        declaration_type: r.declaration_type,
        status: r.status,
        extracted_value: r.extracted_value,
        notes: r.notes,
      }));

      const { error: compError } = await supabase.from('compliance_results').insert(complianceRows);
      if (compError) throw new Error(compError.message);

      // Cleanup preview URLs
      images.forEach((img) => URL.revokeObjectURL(img.previewUrl));

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save inspection');
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h1 className="text-lg font-bold text-slate-800">New Inspection</h1>
          <StepIndicator step={step} />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="mb-4 flex items-start gap-2 p-3.5 rounded-xl bg-red-50 border border-red-100">
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Step 1: Product Details */}
        {step === 'details' && (
          <div className="bg-white rounded-2xl border border-slate-100 p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center">
                <Package className="w-5.5 h-5.5 text-blue-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Product Details</h2>
                <p className="text-sm text-slate-400">Enter the product information for this inspection</p>
              </div>
            </div>

            <form onSubmit={handleDetailsSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={details.productName}
                  onChange={(e) => setDetails({ ...details, productName: e.target.value })}
                  placeholder="e.g. Marigold Mixed Fruit Jam"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Brand Name</label>
                  <input
                    type="text"
                    value={details.brandName}
                    onChange={(e) => setDetails({ ...details, brandName: e.target.value })}
                    placeholder="e.g. Marigold"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Batch Number</label>
                  <input
                    type="text"
                    value={details.batchNumber}
                    onChange={(e) => setDetails({ ...details, batchNumber: e.target.value })}
                    placeholder="e.g. MG-2025-0842"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Product Category</label>
                <select
                  value={details.category}
                  onChange={(e) => setDetails({ ...details, category: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all bg-white"
                >
                  <option value="">Select a category</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={!details.productName.trim()}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-semibold shadow-md shadow-emerald-200 hover:shadow-lg hover:-translate-y-px transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                Continue to Upload
                <ChevronRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* Step 2: Upload Images */}
        {step === 'upload' && (
          <div className="bg-white rounded-2xl border border-slate-100 p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 rounded-xl bg-violet-50 flex items-center justify-center">
                <Upload className="w-5.5 h-5.5 text-violet-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Upload Label Images</h2>
                <p className="text-sm text-slate-400">Upload photos of the product label for OCR analysis</p>
              </div>
            </div>

            {/* Upload zone */}
            <label className="block w-full mb-4 cursor-pointer">
              <div className="border-2 border-dashed border-slate-200 hover:border-emerald-400 rounded-2xl p-8 text-center transition-all hover:bg-emerald-50/30">
                <ImageIcon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-600">Click to select label images</p>
                <p className="text-xs text-slate-400 mt-0.5">PNG, JPG, WEBP — multiple images supported</p>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            </label>

            {/* Image previews */}
            {images.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                {images.map((img, index) => (
                  <div key={index} className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-square">
                    <img src={img.previewUrl} alt={`Label ${index + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeImage(index)}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep('details')}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleAnalyze}
                disabled={images.length === 0}
                className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-semibold shadow-md shadow-emerald-200 hover:shadow-lg hover:-translate-y-px transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Scan className="w-4 h-4" />
                Analyze {images.length > 0 ? `(${images.length} image${images.length > 1 ? 's' : ''})` : ''}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Analyzing */}
        {step === 'analyzing' && (
          <div className="bg-white rounded-2xl border border-slate-100 p-8 sm:p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-50 mb-4">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            </div>
            <h2 className="text-lg font-bold text-slate-800 mb-1.5">Analyzing Label Images</h2>
            <p className="text-sm text-slate-400 max-w-sm mx-auto">
              Running OCR text extraction and applying compliance rules against mandatory declarations...
            </p>
            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Processing {images.length} image{images.length > 1 ? 's' : ''}</span>
            </div>
          </div>
        )}

        {/* Step 4: Results */}
        {step === 'results' && report && (
          <ResultsView
            report={report}
            ocrText={combinedOcrText}
            productDetails={details}
            ocrSources={ocrResults.map((r) => r.source)}
            saving={saving}
            onSave={handleSave}
            onBack={() => setStep('upload')}
          />
        )}
      </main>
    </div>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const steps: { key: Step; label: string; icon: typeof Package }[] = [
    { key: 'details', label: 'Details', icon: Package },
    { key: 'upload', label: 'Upload', icon: Upload },
    { key: 'analyzing', label: 'Analyze', icon: Scan },
    { key: 'results', label: 'Results', icon: FileText },
  ];
  const currentIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="hidden sm:flex items-center gap-1.5 ml-auto">
      {steps.map((s, i) => {
        const Icon = s.icon;
        const active = i === currentIndex;
        const done = i < currentIndex;
        return (
          <div key={s.key} className="flex items-center gap-1.5">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                active ? 'bg-emerald-50 text-emerald-700' : done ? 'text-slate-400' : 'text-slate-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {s.label}
            </div>
            {i < steps.length - 1 && <div className="w-3 h-px bg-slate-200" />}
          </div>
        );
      })}
    </div>
  );
}

function ResultsView({
  report,
  ocrText,
  productDetails,
  ocrSources,
  saving,
  onSave,
  onBack,
}: {
  report: ComplianceReport;
  ocrText: string;
  productDetails: ProductDetails;
  ocrSources: string[];
  saving: boolean;
  onSave: () => void;
  onBack: () => void;
}) {
  const overallConfig = {
    passed: { icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Compliant', gradient: 'from-emerald-500 to-teal-600' },
    failed: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200', label: 'Non-Compliant', gradient: 'from-red-500 to-rose-600' },
    review: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200', label: 'Needs Review', gradient: 'from-amber-500 to-orange-600' },
  };

  const cfg = overallConfig[report.overall_status];
  const OverallIcon = cfg.icon;

  return (
    <div className="space-y-5">
      {/* Score Card */}
      <div className={`rounded-2xl border ${cfg.border} ${cfg.bg} p-6`}>
        <div className="flex items-center gap-4 mb-4">
          <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${cfg.gradient} flex items-center justify-center shadow-lg`}>
            <OverallIcon className="w-7 h-7 text-white" strokeWidth={2.2} />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-slate-800">{cfg.label}</h2>
            <p className="text-sm text-slate-500">{productDetails.productName}</p>
          </div>
          <div className="text-right">
            <p className={`text-3xl font-bold ${cfg.color}`}>{report.score}<span className="text-lg">%</span></p>
            <p className="text-xs text-slate-400">Compliance Score</p>
          </div>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">{report.summary}</p>
        {ocrSources.includes('mock') && (
          <p className="text-xs text-slate-400 mt-2 italic">
            Note: Using simulated OCR (no OCR API configured). Results are for demonstration.
          </p>
        )}
      </div>

      {/* Declaration Results */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
          Mandatory Declaration Checks
        </h3>
        <div className="space-y-3">
          {DECLARATION_KEYS.map((key) => {
            const result = report.results.find((r) => r.declaration_type === key);
            if (!result) return null;
            return <DeclarationRow key={key} type={key} result={result} />;
          })}
        </div>
      </div>

      {/* Violations */}
      {report.violations.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Detected Violations ({report.violations.length})
          </h3>
          <div className="space-y-2">
            {report.violations.map((v, i) => (
              <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 border border-red-100">
                <XCircle className="w-4.5 h-4.5 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700 capitalize">{v}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* OCR Text Preview */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Extracted Label Text (OCR)
        </h3>
        <pre className="text-sm text-slate-600 bg-slate-50 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto">
          {ocrText}
        </pre>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          disabled={saving}
          className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
        >
          Back
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="flex-1 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-semibold shadow-md shadow-emerald-200 hover:shadow-lg hover:-translate-y-px transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Inspection
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function DeclarationRow({
  type,
  result,
}: {
  type: DeclarationType;
  result: { status: string; extracted_value: string | null; notes: string | null };
}) {
  const statusConfig = {
    present: { icon: Check, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Present' },
    missing: { icon: X, color: 'text-red-500', bg: 'bg-red-50', label: 'Missing' },
    review: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50', label: 'Review' },
  };
  const cfg = statusConfig[result.status as keyof typeof statusConfig] ?? statusConfig.missing;
  const Icon = cfg.icon;

  return (
    <div className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
      <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
        <Icon className={`w-4 h-4 ${cfg.color}`} strokeWidth={2.5} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-700">{DECLARATION_LABELS[type]}</p>
          <span className={`text-xs font-medium ${cfg.color} shrink-0`}>{cfg.label}</span>
        </div>
        {result.extracted_value && (
          <p className="text-sm text-slate-500 mt-0.5 truncate">{result.extracted_value}</p>
        )}
        {result.notes && !result.extracted_value && (
          <p className="text-sm text-slate-400 mt-0.5">{result.notes}</p>
        )}
      </div>
    </div>
  );
}
