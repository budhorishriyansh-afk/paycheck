export type DeclarationType =
  | 'manufacturer'
  | 'net_quantity'
  | 'mrp'
  | 'date_manufacture'
  | 'consumer_care';

export type ComplianceStatus = 'passed' | 'failed' | 'review';

export type InspectionStatus = 'draft' | 'analyzed' | 'saved';

export type DeclarationCheckStatus = 'present' | 'missing' | 'review';

export interface Inspection {
  id: string;
  user_id: string;
  product_name: string;
  product_category: string | null;
  brand_name: string | null;
  batch_number: string | null;
  status: InspectionStatus;
  compliance_score: number | null;
  compliance_status: ComplianceStatus | null;
  summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface LabelImage {
  id: string;
  inspection_id: string;
  storage_path: string;
  file_name: string;
  ocr_text: string | null;
  ocr_confidence: number | null;
  created_at: string;
}

export interface ComplianceResult {
  id: string;
  inspection_id: string;
  declaration_type: DeclarationType;
  status: DeclarationCheckStatus;
  extracted_value: string | null;
  notes: string | null;
  created_at: string;
}

export interface OcrResult {
  text: string;
  confidence: number;
  source: 'mock' | 'api';
}

export interface DeclarationCheckResult {
  declaration_type: DeclarationType;
  status: DeclarationCheckStatus;
  extracted_value: string | null;
  notes: string | null;
}

export interface ComplianceReport {
  score: number;
  overall_status: ComplianceStatus;
  results: DeclarationCheckResult[];
  violations: string[];
  summary: string;
}

export const DECLARATION_LABELS: Record<DeclarationType, string> = {
  manufacturer: 'Manufacturer / Packer / Importer Name & Address',
  net_quantity: 'Net Quantity',
  mrp: 'Maximum Retail Price (MRP)',
  date_manufacture: 'Date of Manufacture / Packing / Import',
  consumer_care: 'Consumer Care Details',
};

export const DECLARATION_KEYS: DeclarationType[] = [
  'manufacturer',
  'net_quantity',
  'mrp',
  'date_manufacture',
  'consumer_care',
];
