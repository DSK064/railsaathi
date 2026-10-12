import { NextResponse } from 'next/server';
import crypto from 'crypto';

function generateRandomHex(length = 32) {
  return crypto.randomBytes(length / 2).toString('hex');
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const trainNo = searchParams.get('trainNo');
  const doj = searchParams.get('doj'); // format: dd-mm-yyyy
  const locale = searchParams.get('locale') || 'en';

  if (!trainNo || !doj) {
    return NextResponse.json({ error: 'Missing required parameters: trainNo, doj' }, { status: 400 });
  }

  const session = generateRandomHex(32);

  const url = new URL('https://api.confirmtkt.com/api/trains/livestatusall');
  url.searchParams.append('trainno', trainNo);
  url.searchParams.append('doj', doj);
  url.searchParams.append('locale', locale);
  url.searchParams.append('session', session);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Host': 'api.confirmtkt.com',
        'Connection': 'Keep-Alive',
        'User-Agent': 'okhttp/4.9.2',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: `ConfirmTkt Live Status API returned status ${response.status}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching live status:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
