import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ShieldCheck,
  XCircle,
  AlertTriangle,
  Check,
  X,
  Loader2,
  Package,
  Calendar,
  Tag,
  Hash,
  FileText,
} from 'lucide-react';
import { supabase, STORAGE_BUCKET } from '@/lib/supabase';
import type {
  Inspection,
  LabelImage,
  ComplianceResult,
  DeclarationType,
  ComplianceStatus,
} from '@/types';
import { DECLARATION_LABELS } from '@/types';

interface InspectionDetailProps {
  inspectionId: string;
  onBack: () => void;
}

export default function InspectionDetail({ inspectionId, onBack }: InspectionDetailProps) {
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [images, setImages] = useState<LabelImage[]>([]);
  const [results, setResults] = useState<ComplianceResult[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [inspectionId]);

  const loadData = async () => {
    setLoading(true);

    const [{ data: insp }, { data: imgs }, { data: comps }] = await Promise.all([
      supabase.from('inspections').select('*').eq('id', inspectionId).maybeSingle(),
      supabase.from('label_images').select('*').eq('inspection_id', inspectionId),
      supabase.from('compliance_results').select('*').eq('inspection_id', inspectionId),
    ]);

    if (insp) setInspection(insp as Inspection);
    if (imgs) setImages(imgs as LabelImage[]);
    if (comps) setResults(comps as ComplianceResult[]);

    // Get signed URLs for images
    if (imgs && imgs.length > 0) {
      const urls: Record<string, string> = {};
      for (const img of imgs as LabelImage[]) {
        const { data } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(img.storage_path, 3600);
        if (data) urls[img.id] = data.signedUrl;
      }
      setImageUrls(urls);
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (!inspection) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 mb-4">Inspection not found.</p>
          <button onClick={onBack} className="text-emerald-600 font-semibold">Back to Dashboard</button>
        </div>
      </div>
    );
  }

  const overallConfig: Record<ComplianceStatus, { icon: typeof ShieldCheck; color: string; bg: string; border: string; label: string; gradient: string }> = {
    passed: { icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Compliant', gradient: 'from-emerald-500 to-teal-600' },
    failed: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200', label: 'Non-Compliant', gradient: 'from-red-500 to-rose-600' },
    review: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200', label: 'Needs Review', gradient: 'from-amber-500 to-orange-600' },
  };

  const cfg = inspection.compliance_status ? overallConfig[inspection.compliance_status] : null;
  const OverallIcon = cfg?.icon ?? ShieldCheck;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h1 className="text-lg font-bold text-slate-800 truncate">Inspection Details</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-5">
        {/* Score Card */}
        {cfg && (
          <div className={`rounded-2xl border ${cfg.border} ${cfg.bg} p-6`}>
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${cfg.gradient} flex items-center justify-center shadow-lg`}>
                <OverallIcon className="w-7 h-7 text-white" strokeWidth={2.2} />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-slate-800">{cfg.label}</h2>
                <p className="text-sm text-slate-500">{inspection.product_name}</p>
              </div>
              <div className="text-right">
                <p className={`text-3xl font-bold ${cfg.color}`}>{inspection.compliance_score}<span className="text-lg">%</span></p>
                <p className="text-xs text-slate-400">Compliance Score</p>
              </div>
            </div>
            {inspection.summary && (
              <p className="text-sm text-slate-600 leading-relaxed mt-3">{inspection.summary}</p>
            )}
          </div>
        )}

        {/* Product Info */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Product Information</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <InfoRow icon={Package} label="Product Name" value={inspection.product_name} />
            <InfoRow icon={Tag} label="Brand" value={inspection.brand_name} />
            <InfoRow icon={FileText} label="Category" value={inspection.product_category} />
            <InfoRow icon={Hash} label="Batch Number" value={inspection.batch_number} />
            <InfoRow icon={Calendar} label="Inspected On" value={new Date(inspection.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} />
          </div>
        </div>

        {/* Compliance Results */}
        {results.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
              Mandatory Declaration Checks
            </h3>
            <div className="space-y-3">
              {results.map((r) => {
                const statusCfg = {
                  present: { icon: Check, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Present' },
                  missing: { icon: X, color: 'text-red-500', bg: 'bg-red-50', label: 'Missing' },
                  review: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50', label: 'Review' },
                };
                const sc = statusCfg[r.status as keyof typeof statusCfg] ?? statusCfg.missing;
                const SIcon = sc.icon;
                return (
                  <div key={r.id} className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-100">
                    <div className={`w-8 h-8 rounded-lg ${sc.bg} flex items-center justify-center shrink-0`}>
                      <SIcon className={`w-4 h-4 ${sc.color}`} strokeWidth={2.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-700">
                          {DECLARATION_LABELS[r.declaration_type as DeclarationType]}
                        </p>
                        <span className={`text-xs font-medium ${sc.color} shrink-0`}>{sc.label}</span>
                      </div>
                      {r.extracted_value && (
                        <p className="text-sm text-slate-500 mt-0.5">{r.extracted_value}</p>
                      )}
                      {r.notes && !r.extracted_value && (
                        <p className="text-sm text-slate-400 mt-0.5">{r.notes}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Label Images */}
        {images.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
              Label Images ({images.length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {images.map((img) => (
                <div key={img.id} className="rounded-xl overflow-hidden border border-slate-200 aspect-square">
                  {imageUrls[img.id] ? (
                    <img src={imageUrls[img.id]} alt={img.file_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                      <FileText className="w-8 h-8 text-slate-300" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* OCR Text */}
            {images.some((i) => i.ocr_text) && (
              <div className="mt-4">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Extracted OCR Text</h4>
                <div className="space-y-3">
                  {images.filter((i) => i.ocr_text).map((img) => (
                    <pre key={img.id} className="text-sm text-slate-600 bg-slate-50 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">
                      {img.ocr_text}
                    </pre>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Package;
  label: string;
  value: string | null;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-slate-400" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-sm font-medium text-slate-700 truncate">{value ?? '—'}</p>
      </div>
    </div>
  );
}
