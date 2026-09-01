/*
# PackCheck India — Core Schema

## Overview
Creates the database tables for PackCheck India, a product label compliance
inspection tool. Each user can create inspections, upload label images, run
OCR-based compliance analysis, and save results.

## New Tables

### inspections
Stores each inspection record with product details and overall compliance status.
- `id` (uuid, PK)
- `user_id` (uuid, FK → auth.users, defaults to auth.uid())
- `product_name` (text, not null)
- `product_category` (text, nullable)
- `brand_name` (text, nullable)
- `batch_number` (text, nullable)
- `status` (text: 'draft' | 'analyzed' | 'saved', default 'draft')
- `compliance_score` (integer, nullable — 0 to 100)
- `compliance_status` (text: 'passed' | 'failed' | 'review', nullable)
- `summary` (text, nullable — overall notes)
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

### label_images
Stores metadata for each uploaded label image, including OCR-extracted text.
- `id` (uuid, PK)
- `inspection_id` (uuid, FK → inspections, ON DELETE CASCADE)
- `storage_path` (text — path in Supabase Storage)
- `file_name` (text)
- `ocr_text` (text, nullable — raw text extracted by OCR)
- `ocr_confidence` (real, nullable)
- `created_at` (timestamptz, default now())

### compliance_results
Stores per-declaration compliance check results for each inspection.
- `id` (uuid, PK)
- `inspection_id` (uuid, FK → inspections, ON DELETE CASCADE)
- `declaration_type` (text — one of: 'manufacturer', 'net_quantity', 'mrp', 'date_manufacture', 'consumer_care')
- `status` (text: 'present' | 'missing' | 'review')
- `extracted_value` (text, nullable — what was found on the label)
- `notes` (text, nullable)
- `created_at` (timestamptz, default now())

## Security
- RLS enabled on all tables.
- Owner-scoped CRUD: each authenticated user can only access inspections they own.
- label_images and compliance_results are scoped through their parent inspection's owner.
- Storage bucket 'label-images' created for image uploads.

## Important Notes
1. `user_id` on inspections defaults to `auth.uid()` so client inserts omitting it still succeed.
2. Child tables (label_images, compliance_results) are scoped via EXISTS check against inspections.owner.
3. All policies use `auth.uid()` — never `current_user`.
*/

-- ============================================================
-- inspections table
-- ============================================================
CREATE TABLE IF NOT EXISTS inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  product_category text,
  brand_name text,
  batch_number text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'analyzed', 'saved')),
  compliance_score integer,
  compliance_status text CHECK (compliance_status IN ('passed', 'failed', 'review')),
  summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_inspections" ON inspections;
CREATE POLICY "select_own_inspections" ON inspections FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_inspections" ON inspections;
CREATE POLICY "insert_own_inspections" ON inspections FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_inspections" ON inspections;
CREATE POLICY "update_own_inspections" ON inspections FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_inspections" ON inspections;
CREATE POLICY "delete_own_inspections" ON inspections FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- label_images table
-- ============================================================
CREATE TABLE IF NOT EXISTS label_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  ocr_text text,
  ocr_confidence real,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE label_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_label_images" ON label_images;
CREATE POLICY "select_own_label_images" ON label_images FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM inspections WHERE inspections.id = label_images.inspection_id AND inspections.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_label_images" ON label_images;
CREATE POLICY "insert_own_label_images" ON label_images FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM inspections WHERE inspections.id = label_images.inspection_id AND inspections.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_label_images" ON label_images;
CREATE POLICY "update_own_label_images" ON label_images FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM inspections WHERE inspections.id = label_images.inspection_id AND inspections.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM inspections WHERE inspections.id = label_images.inspection_id AND inspections.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_label_images" ON label_images;
CREATE POLICY "delete_own_label_images" ON label_images FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM inspections WHERE inspections.id = label_images.inspection_id AND inspections.user_id = auth.uid())
  );

-- ============================================================
-- compliance_results table
-- ============================================================
CREATE TABLE IF NOT EXISTS compliance_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  declaration_type text NOT NULL CHECK (declaration_type IN ('manufacturer', 'net_quantity', 'mrp', 'date_manufacture', 'consumer_care')),
  status text NOT NULL CHECK (status IN ('present', 'missing', 'review')),
  extracted_value text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE compliance_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_compliance_results" ON compliance_results;
CREATE POLICY "select_own_compliance_results" ON compliance_results FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM inspections WHERE inspections.id = compliance_results.inspection_id AND inspections.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_compliance_results" ON compliance_results;
CREATE POLICY "insert_own_compliance_results" ON compliance_results FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM inspections WHERE inspections.id = compliance_results.inspection_id AND inspections.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_compliance_results" ON compliance_results;
CREATE POLICY "update_own_compliance_results" ON compliance_results FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM inspections WHERE inspections.id = compliance_results.inspection_id AND inspections.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM inspections WHERE inspections.id = compliance_results.inspection_id AND inspections.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_compliance_results" ON compliance_results;
CREATE POLICY "delete_own_compliance_results" ON compliance_results FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM inspections WHERE inspections.id = compliance_results.inspection_id AND inspections.user_id = auth.uid())
  );

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_inspections_user_id ON inspections(user_id);
CREATE INDEX IF NOT EXISTS idx_label_images_inspection_id ON label_images(inspection_id);
CREATE INDEX IF NOT EXISTS idx_compliance_results_inspection_id ON compliance_results(inspection_id);

-- ============================================================
-- Storage bucket for label images
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('label-images', 'label-images', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: users can only manage their own folder
DROP POLICY IF EXISTS "Users can upload own label images" ON storage.objects;
CREATE POLICY "Users can upload own label images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'label-images' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can read own label images" ON storage.objects;
CREATE POLICY "Users can read own label images" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'label-images' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can delete own label images" ON storage.objects;
CREATE POLICY "Users can delete own label images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'label-images' AND (storage.foldername(name))[1] = auth.uid()::text);
