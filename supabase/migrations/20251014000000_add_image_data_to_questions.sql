-- Add image_data column to questions table to support image-based questions
ALTER TABLE public.questions 
ADD COLUMN image_data text;

-- Make text-based question fields optional for image-based questions
ALTER TABLE public.questions 
ALTER COLUMN question_text DROP NOT NULL,
ALTER COLUMN option_a DROP NOT NULL,
ALTER COLUMN option_b DROP NOT NULL,
ALTER COLUMN option_c DROP NOT NULL,
ALTER COLUMN option_d DROP NOT NULL;

-- Add check constraint to ensure either text-based or image-based question
ALTER TABLE public.questions 
ADD CONSTRAINT question_type_check 
CHECK (
  (question_text IS NOT NULL AND option_a IS NOT NULL AND option_b IS NOT NULL AND option_c IS NOT NULL AND option_d IS NOT NULL) 
  OR 
  (image_data IS NOT NULL)
);

-- Add comment to explain the new structure
COMMENT ON COLUMN public.questions.image_data IS 'Base64 encoded image data for image-based questions. When this is populated, text fields may be optional.';