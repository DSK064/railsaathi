import { NextResponse } from 'next/server';
import crypto from 'crypto';

function generateRandomHex(length = 32) {
  return crypto.randomBytes(length / 2).toString('hex');
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const pnr = searchParams.get('pnr');

  if (!pnr) {
    return NextResponse.json({ error: 'Missing PNR parameter' }, { status: 400 });
  }

  if (pnr.length !== 10 || isNaN(pnr)) {
    return NextResponse.json({ error: 'PNR must be a 10-digit number' }, { status: 400 });
  }

  const session = generateRandomHex(32);
  const url = `https://api.confirmtkt.com/api/pnr/status/${pnr}?session=${session}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Host': 'api.confirmtkt.com',
        'Connection': 'Keep-Alive',
        'User-Agent': 'okhttp/4.9.2',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: `ConfirmTkt PNR API returned status ${response.status}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching PNR:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
