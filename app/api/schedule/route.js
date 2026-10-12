import { NextResponse } from 'next/server';
import crypto from 'crypto';

function generateRandomHex(length = 32) {
  return crypto.randomBytes(length / 2).toString('hex');
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const trainNo = searchParams.get('trainNo');
  const date = searchParams.get('date'); // format: dd-mm-yyyy or yyyy-mm-dd (dd-mm-yyyy is standard for confirmtkt)

  if (!trainNo || !date) {
    return NextResponse.json({ error: 'Missing required parameters: trainNo, date' }, { status: 400 });
  }

  const session = generateRandomHex(32);

  const url = new URL('https://api.confirmtkt.com/api/trains/schedulewithintermediatestn');
  url.searchParams.append('trainNo', trainNo);
  url.searchParams.append('date', date);
  url.searchParams.append('locale', 'en');
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
      return NextResponse.json({ error: `ConfirmTkt Schedule API returned status ${response.status}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching schedule:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
