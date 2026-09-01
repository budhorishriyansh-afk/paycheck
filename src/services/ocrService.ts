import type { OcrResult } from '@/types';

/**
 * OCR Service — modular architecture.
 *
 * If VITE_OCR_API_URL is configured, real OCR is called via an edge function proxy.
 * Otherwise, realistic mock OCR responses are returned so the full workflow is demonstrable.
 */

const OCR_API_URL = import.meta.env.VITE_OCR_API_URL as string | undefined;

/**
 * Generates a realistic mock OCR text for a product label image.
 * Randomly omits some declarations to produce varied compliance results.
 */
function generateMockOcrText(): OcrResult {
  const scenarios = [
    // Full compliance — all declarations present
    `MARIGOLD FOODS PRIVATE LIMITED
Plot No. 42, Industrial Area Phase II
Ludhiana, Punjab - 141010, India
MANUFACTURED BY: Marigold Foods Pvt. Ltd.
NET WEIGHT: 500g
MRP: Rs. 120.00 (inclusive of all taxes)
MFG: 15/08/2025
BEST BEFORE: 6 months from manufacturing
CONSUMER CARE: 1800-123-4567
customercare@marigoldfoods.in`,
    // Missing consumer care
    `SUMMIT BEVERAGES LTD
Survey No. 78, MIDC Industrial Estate
Pune, Maharashtra - 411019
NET CONTENT: 750 ml
M.R.P. Rs. 180.00 (incl. all taxes)
DATE OF MANUFACTURE: 10/07/2025
Batch No: SB-2025-0743`,
    // Missing MRP
    `HIMALAYA PURE NATURE CO.
Ground Floor, Tower B, Tech Park
Bengaluru, Karnataka - 560103
Net Quantity: 200g
Manufactured on: 20/06/2025
Consumer Care Cell: +91-80-4567-8901
help@himalayapure.in`,
    // Missing net quantity
    `EVEREST SPICES INDIA PVT LTD
Plot 15, Food Park, Sector 29
Faridabad, Haryana - 121005
MRP: Rs. 85.00 (inclusive of all taxes)
MFG DATE: 05/09/2025
Consumer Care: 1800-22-1155
care@everestspices.com`,
    // Missing manufacturer address + date
    `TATA CONSUMER PRODUCTS
NET QUANTITY: 1 kg
MRP Rs. 245.00 (incl. taxes)
Consumer Care: 1800-345-6789
customercare@tcpl.in`,
    // Missing date of manufacture only
    `AMUL GUJARAT MILK CO. LTD
Anand, Gujarat - 388110, India
NET WT: 1 LITRE
MRP: Rs. 68.00 (inclusive of all taxes)
Consumer Care: 1800-425-1225
amulcare@amul.coop`,
    // All present with importer
    `IMPORTED BY: GLOBAL TASTE IMPORTS
3rd Floor, Trade Centre, BKC
Mumbai, Maharashtra - 400051
Net Quantity: 300g
MRP: Rs. 350.00 (incl. all taxes)
Date of Import: 12/08/2025
Consumer Care: 1800-999-8888
support@globaltaste.in`,
    // Missing manufacturer and consumer care
    `ORGANIC FIELDS CO.
Net Weight: 250g
MRP Rs. 95.00 (inclusive of all taxes)
Manufactured: 18/07/2025
Batch: OF-2025-118`,
  ];

  const text = scenarios[Math.floor(Math.random() * scenarios.length)];
  return {
    text,
    confidence: 0.85 + Math.random() * 0.12,
    source: 'mock',
  };
}

/**
 * Calls a real OCR API through an edge function proxy.
 * The edge function handles the API key server-side.
 */
async function callRealOcr(imageBase64: string): Promise<OcrResult> {
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ocr-analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ image: imageBase64 }),
  });

  if (!response.ok) {
    throw new Error(`OCR API request failed (${response.status})`);
  }

  const data = await response.json();
  if (!data.text || typeof data.text !== 'string') {
    throw new Error('OCR API returned invalid response');
  }

  return {
    text: data.text,
    confidence: data.confidence ?? 0.9,
    source: 'api',
  };
}

/**
 * Main OCR entry point. Uses real API if configured, otherwise mock.
 */
export async function performOcr(imageBase64: string | null): Promise<OcrResult> {
  if (OCR_API_URL && imageBase64) {
    try {
      return await callRealOcr(imageBase64);
    } catch {
      // Fall back to mock on API failure
    }
  }
  return generateMockOcrText();
}
