-- 1. Create the shared_items table
CREATE TABLE IF NOT EXISTS public.shared_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('text', 'link', 'image', 'video', 'audio', 'file')),
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
-- Users can view their own items
DROP POLICY IF EXISTS "Users can view their own items" ON public.shared_items;
CREATE POLICY "Users can view their own items" 
ON public.shared_items FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own items" ON public.shared_items;
CREATE POLICY "Users can insert their own items" 
ON public.shared_items FOR INSERT 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own items" ON public.shared_items;
CREATE POLICY "Users can update their own items" 
ON public.shared_items FOR UPDATE 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own items" ON public.shared_items;
CREATE POLICY "Users can delete their own items" 
ON public.shared_items FOR DELETE 
USING (auth.uid() = user_id);

-- 4. Create the Storage Bucket for files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('sharey_files', 'sharey_files', false)
ON CONFLICT (id) DO NOTHING;

-- 5. Create RLS Policies for Storage
DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
CREATE POLICY "Users can upload their own files" 
ON storage.objects FOR INSERT 
WITH CHECK (
    bucket_id = 'sharey_files' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can view their own files" ON storage.objects;
CREATE POLICY "Users can view their own files" 
ON storage.objects FOR SELECT 
USING (
    bucket_id = 'sharey_files' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
CREATE POLICY "Users can delete their own files" 
ON storage.objects FOR DELETE 
USING (
    bucket_id = 'sharey_files' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

-- 6. Collections Table
CREATE TABLE IF NOT EXISTS public.collections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own collections" ON public.collections;
CREATE POLICY "Users can view their own collections" ON public.collections FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own collections" ON public.collections;
CREATE POLICY "Users can insert their own collections" ON public.collections FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own collections" ON public.collections;
CREATE POLICY "Users can update their own collections" ON public.collections FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own collections" ON public.collections;
CREATE POLICY "Users can delete their own collections" ON public.collections FOR DELETE USING (auth.uid() = user_id);

-- Add collection_id to shared_items
ALTER TABLE public.shared_items ADD COLUMN IF NOT EXISTS collection_id UUID REFERENCES public.collections(id) ON DELETE SET NULL;

-- 7. Private Collections
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS pin TEXT;

CREATE OR REPLACE FUNCTION get_collection_data(p_collection_id UUID)
RETURNS JSON AS $$
DECLARE
    col_data JSON;
    items_data JSON;
BEGIN
    SELECT row_to_json(c) INTO col_data FROM public.collections c WHERE c.id = p_collection_id;
    IF col_data IS NULL THEN
        RETURN NULL;
    END IF;
    SELECT json_agg(row_to_json(i)) INTO items_data FROM public.shared_items i WHERE i.collection_id = p_collection_id;
    RETURN json_build_object('collection', col_data, 'items', COALESCE(items_data, '[]'::json));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Public Shared Item RPC Function
CREATE OR REPLACE FUNCTION get_shared_item_data(p_item_id UUID)
RETURNS JSON AS $$
DECLARE
    item_row JSON;
    col_row JSON;
BEGIN
    SELECT row_to_json(i) INTO item_row FROM public.shared_items i WHERE i.id = p_item_id;
    IF item_row IS NULL THEN
        RETURN NULL;
    END IF;
    IF (item_row->>'collection_id') IS NOT NULL THEN
        SELECT row_to_json(c) INTO col_row FROM public.collections c WHERE c.id = (item_row->>'collection_id')::UUID;
    END IF;
    RETURN json_build_object('item', item_row, 'collection', col_row);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_shared_item_data(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_collection_data(UUID) TO anon, authenticated;