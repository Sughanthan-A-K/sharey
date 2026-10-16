import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

    // 1. Try RPC function first (handles SECURITY DEFINER regardless of anon vs service role)
    const { data: rpcData, error: rpcError } = await supabaseServer.rpc('get_shared_item_data', {
      p_item_id: id
    });

    if (!rpcError && rpcData && rpcData.item) {
      return NextResponse.json({
        item: rpcData.item,
        collection: rpcData.collection || null
      });
    }

    // 2. Fallback to direct table query (works if SERVICE_ROLE_KEY is configured)
    const { data: itemData, error: itemError } = await supabaseServer
      .from('shared_items')
      .select('*')
      .eq('id', id)
      .single();

    if (itemError || !itemData) {
      return NextResponse.json({ error: 'Item not found or has been removed' }, { status: 404 });
    }

    // If item belongs to a collection, fetch the collection info
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
