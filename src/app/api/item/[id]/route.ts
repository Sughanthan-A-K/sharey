import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role if available for public fetch bypass, or fallback to anon key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseServer = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing item id' }, { status: 400 });
    }

    // 1. First attempt to fetch the item
    const { data: itemData, error: itemError } = await supabaseServer
      .from('shared_items')
      .select('*')
      .eq('id', id)
      .single();

    if (itemError || !itemData) {
      // Also try RPC if defined or return 404
      return NextResponse.json({ error: 'Item not found or has been removed' }, { status: 404 });
    }

    // 2. If item belongs to a collection, fetch the collection info
    let collectionData = null;
    if (itemData.collection_id) {
      const { data: col } = await supabaseServer
        .from('collections')
        .select('id, name, is_private, pin')
        .eq('id', itemData.collection_id)
        .single();
      collectionData = col || null;
    }

    return NextResponse.json({
      item: itemData,
      collection: collectionData
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
