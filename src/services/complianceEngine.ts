import type {
  ComplianceReport,
  DeclarationCheckResult,
  DeclarationType,
  DeclarationCheckStatus,
} from '@/types';

/**
 * Compliance Rule Engine for PackCheck India.
 *
 * Checks whether mandatory declarations required under the Legal Metrology Act
 * (Packaged Commodities Rules) are present in OCR-extracted label text.
 *
 * Each declaration uses pattern-based matching with multiple synonyms and
 * variations commonly found on Indian product labels.
 */

interface DeclarationRule {
  type: DeclarationType;
  patterns: RegExp[];
  extractValue: (text: string, match: RegExpMatchArray) => string;
  description: string;
}

const rules: DeclarationRule[] = [
  {
    type: 'manufacturer',
    patterns: [
      /(?:manufactured\s+by|manufacturer|packed\s+by|imported\s+by|marketed\s+by)[\s:]+([^\n]{5,120})/i,
      /(?:mfg\s*by|mfr\.?)[\s:]+([^\n]{5,120})/i,
    ],
    extractValue: (_text, match) => match[1]?.trim() ?? '',
    description: 'Manufacturer/Packer/Importer name and address',
  },
  {
    type: 'net_quantity',
    patterns: [
      /(?:net\s+(?:weight|wt|content|quantity|mass|volume))[\s:]+([^\n]{2,40})/i,
      /(?:net\s*wt|net\s*qty)[\s.:]+([^\n]{2,40})/i,
      /\b(\d+(?:\.\d+)?\s*(?:g|gm|gram|kg|ml|l|litre|liter|mg|pcs|pieces|tablets|capsules))\b/i,
    ],
    extractValue: (_text, match) => match[1]?.trim() ?? match[0]?.trim() ?? '',
    description: 'Net Quantity',
  },
  {
    type: 'mrp',
    patterns: [
      /(?:mrp|m\.?r\.?p\.?|maximum\s+retail\s+price)[\s:.]*rs?\.?\s*([\d,.]+)/i,
      /(?:mrp|m\.?r\.?p\.?)[\s:]+(?:rs\.?|₹|inr)\s*([\d,.]+)/i,
      /(?:price|retail\s+price)[\s:.]*rs?\.?\s*([\d,.]+)/i,
    ],
    extractValue: (_text, match) => match[1]?.trim() ?? match[0]?.trim() ?? '',
    description: 'Maximum Retail Price',
  },
  {
    type: 'date_manufacture',
    patterns: [
      /(?:date\s+of\s+(?:manufacture|packing|import)|mfg(?:\s+date)?|manufactured\s+(?:on|date))[\s:]+([^\n]{4,40})/i,
      /(?:mfg|mfd|date\s+of\s+mfg)[\s:.]+([^\n]{4,40})/i,
      /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/,
    ],
    extractValue: (_text, match) => match[1]?.trim() ?? match[0]?.trim() ?? '',
    description: 'Date of Manufacture/Packing/Import',
  },
  {
    type: 'consumer_care',
    patterns: [
      /(?:consumer\s+care|customer\s+care|consumer\s+helpline|consumer\s+cell|toll\s+free|helpline)[\s:]+([^\n]{4,80})/i,
      /(?:consumer\s+care|customer\s+care)[\s:]+(\+?\d[\d\s\-]{6,20})/i,
      /\b(1800[\d\s\-]{3,12})\b/,
      /(?:care|support|help(?:line)?)\s*@\s*([^\n]{5,60})/i,
      /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,})\b/i,
    ],
    extractValue: (_text, match) => match[1]?.trim() ?? match[0]?.trim() ?? '',
    description: 'Consumer Care Details',
  },
];

function checkDeclaration(text: string, rule: DeclarationRule): DeclarationCheckResult {
  for (const pattern of rule.patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = rule.extractValue(text, match);
      if (value && value.length >= 2) {
        return {
          declaration_type: rule.type,
          status: 'present',
          extracted_value: value,
          notes: `Found: "${value}"`,
        };
      }
    }
  }

  return {
    declaration_type: rule.type,
    status: 'missing',
    extracted_value: null,
    notes: `Not detected on label — may require manual review`,
  };
}

export function runComplianceCheck(ocrText: string): ComplianceReport {
  const results: DeclarationCheckResult[] = rules.map((rule) =>
    checkDeclaration(ocrText, rule)
  );

  const presentCount = results.filter((r) => r.status === 'present').length;
  const missingCount = results.filter((r) => r.status === 'missing').length;
  const totalCount = results.length;

  const score = Math.round((presentCount / totalCount) * 100);

  let overallStatus: 'passed' | 'failed' | 'review';
  if (score === 100) {
    overallStatus = 'passed';
  } else if (score >= 60) {
    overallStatus = 'review';
  } else {
    overallStatus = 'failed';
  }

  const violations = results
    .filter((r) => r.status === 'missing')
    .map((r) => `${r.declaration_type.replace(/_/g, ' ')}: ${r.notes}`);

  const summary =
    violations.length === 0
      ? 'All mandatory declarations detected on the product label.'
      : `${violations.length} of ${totalCount} mandatory declarations missing or undetected. Manual review recommended for items requiring verification.`;

  return {
    score,
    overall_status: overallStatus,
    results,
    violations,
    summary,
  };
}
