-- 1. Create the shared_items table
CREATE TABLE public.shared_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('text', 'link', 'image', 'video', 'file')),
    content TEXT NOT NULL,
    file_name TEXT,
    file_url TEXT,
    file_size TEXT,
    mime_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.shared_items ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies for shared_items
-- Users can only view their own items
CREATE POLICY "Users can view their own items" 
ON public.shared_items FOR SELECT 
USING (auth.uid() = user_id);

-- Users can only insert their own items
CREATE POLICY "Users can insert their own items" 
ON public.shared_items FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can only update their own items
CREATE POLICY "Users can update their own items" 
ON public.shared_items FOR UPDATE 
USING (auth.uid() = user_id);

-- Users can only delete their own items
CREATE POLICY "Users can delete their own items" 
ON public.shared_items FOR DELETE 
USING (auth.uid() = user_id);

-- 4. Create the Storage Bucket for files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('sharey_files', 'sharey_files', false)
ON CONFLICT (id) DO NOTHING;

-- 5. Create RLS Policies for Storage
-- Users can only upload to their own folder (based on user_id)
CREATE POLICY "Users can upload their own files" 
ON storage.objects FOR INSERT 
WITH CHECK (
    bucket_id = 'sharey_files' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can only view their own files
CREATE POLICY "Users can view their own files" 
ON storage.objects FOR SELECT 
USING (
    bucket_id = 'sharey_files' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can only delete their own files
CREATE POLICY "Users can delete their own files" 
ON storage.objects FOR DELETE 
USING (
    bucket_id = 'sharey_files' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);
