import { NextResponse } from 'next/server';
import { igdl } from 'btch-downloader';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    const data = await igdl(url);
    if (data && data.status && data.result && data.result.length > 0) {
      return NextResponse.json({ videoUrl: data.result[0].url, thumbnail: data.result[0].thumbnail });
    }
    return NextResponse.json({ error: 'No video found' }, { status: 404 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
