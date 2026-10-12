import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

const getTodayFormatted = (offsetDays = 0) => {
  const date = new Date(Date.now() + 5.5 * 60 * 60 * 1000 + offsetDays * 24 * 60 * 60 * 1000);
  const d = String(date.getUTCDate()).padStart(2, '0');
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const y = date.getUTCFullYear();
  return `${d}-${m}-${y}`;
};

const SEED_SWAPS = [
  {
    id: 'swap-seed-1',
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    passengerName: 'Arjun Mehta',
    pnrVerified: true,
    maskedPnr: '4829****12',
    trainNo: '12626',
    trainName: 'Kerala Express',
    doj: '28-06-2026',
    fromStn: 'NDLS',
    toStn: 'TVC',
    travelClass: '3A',
    currentCoach: 'B4',
    currentBerth: '12',
    currentBerthType: 'LB',
    targetCoach: 'B2',
    targetBerthType: 'ANY',
    familyContextCoach: 'B2',
    familyContextBerths: '19, 20',
    reasonCategory: 'FAMILY_SPLIT',
    reasonLabel: 'Family Split Across Coaches',
    note: 'My wife and 5-year-old son are allotted B2 berths 19 & 20. I have a confirmed Lower Berth (12) in B4 and am happy to swap with any berth in B2 so we can travel together.',
    status: 'OPEN', // OPEN | MATCHED | CANCELLED
    matchedOfferId: null,
    offers: [
      {
        id: 'offer-seed-1',
        createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
        responderName: 'Suresh Nair',
        offeredCoach: 'B2',
        offeredBerth: '24',
        offeredBerthType: 'UB',
        message: 'Hi Arjun! I am traveling solo in B2 Berth 24 (Upper) from NDLS to ERN. I would really appreciate your B4 Lower Berth for my back pain. Let me know if we can swap!',
        status: 'PENDING' // PENDING | APPROVED | DECLINED
      }
    ],
    messages: [
      {
        id: 'msg-seed-1',
        senderName: 'Suresh Nair',
        senderRole: 'RESPONDER',
        text: 'Hi Arjun, I am in B2 Berth 24 (UB), right in the next bay from berths 19 & 20. Happy to switch after boarding at NDLS.',
        createdAt: new Date(Date.now() - 19 * 60 * 1000).toISOString()
      }
    ]
  },
  {
    id: 'swap-seed-2',
    createdAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
    passengerName: 'Kavitha Rao',
    pnrVerified: true,
    maskedPnr: '6194****87',
    trainNo: '12724',
    trainName: 'Telangana Express',
    doj: getTodayFormatted(1),
    fromStn: 'NDLS',
    toStn: 'HYB',
    travelClass: '2A',
    currentCoach: 'A1',
    currentBerth: '32',
    currentBerthType: 'UB',
    targetCoach: 'A1',
    targetBerthType: 'LB',
    familyContextCoach: 'A1',
    familyContextBerths: '31',
    reasonCategory: 'SENIOR_CITIZEN',
    reasonLabel: 'Senior Citizen Needs Lower Berth',
    note: 'Traveling with my 68-year-old mother who was allotted Upper Berth 32 in A1. Looking for a kind co-passenger in A1 or A2 willing to swap a Lower or Side Lower berth.',
    status: 'OPEN',
    matchedOfferId: null,
    offers: [],
    messages: []
  },
  {
    id: 'swap-seed-3',
    createdAt: new Date(Date.now() - 210 * 60 * 1000).toISOString(),
    passengerName: 'Rohan & Neha Sharma',
    pnrVerified: false,
    maskedPnr: null,
    trainNo: '12952',
    trainName: 'New Delhi - Mumbai Central Rajdhani',
    doj: getTodayFormatted(2),
    fromStn: 'NDLS',
    toStn: 'MMCT',
    travelClass: '3A',
    currentCoach: 'B7',
    currentBerth: '41',
    currentBerthType: 'SL',
    targetCoach: 'B3',
    targetBerthType: 'ANY',
    familyContextCoach: 'B3',
    familyContextBerths: '14',
    reasonCategory: 'FAMILY_SPLIT',
    reasonLabel: 'Family Split Across Coaches',
    note: 'Booked under two separate Tatkal PNRs. One ticket is in B3 (#14) and mine is Side Lower (#41) in B7. Offering my Side Lower in B7 for any seat in B3 (or vice versa into B7).',
    status: 'OPEN',
    matchedOfferId: null,
    offers: [],
    messages: []
  }
];

const STORAGE_FILE = path.join(os.tmpdir(), 'railsaathi_seat_swaps.json');

function loadSwaps() {
  if (globalThis.__RAILSAATHI_SWAPS__) {
    return globalThis.__RAILSAATHI_SWAPS__;
  }
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const raw = fs.readFileSync(STORAGE_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        globalThis.__RAILSAATHI_SWAPS__ = parsed;
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Could not read swap storage file:', err.message);
  }
  globalThis.__RAILSAATHI_SWAPS__ = JSON.parse(JSON.stringify(SEED_SWAPS));
  saveSwaps(globalThis.__RAILSAATHI_SWAPS__);
  return globalThis.__RAILSAATHI_SWAPS__;
}

function saveSwaps(swaps) {
  globalThis.__RAILSAATHI_SWAPS__ = swaps;
  try {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(swaps, null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not write swap storage file:', err.message);
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const trainNo = (searchParams.get('trainNo') || '').trim();
  const doj = (searchParams.get('doj') || '').trim();
  const travelClass = (searchParams.get('travelClass') || '').trim();

  let swaps = loadSwaps();

  if (trainNo) {
    swaps = swaps.filter(s => s.trainNo.includes(trainNo));
  }
  if (doj) {
    swaps = swaps.filter(s => s.doj === doj);
  }
  if (travelClass && travelClass !== 'ALL') {
    swaps = swaps.filter(s => s.travelClass.toUpperCase() === travelClass.toUpperCase());
  }

  return NextResponse.json({ swaps });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action } = body;
    const swaps = loadSwaps();

    // 1. Create a new seat swap request
    if (action === 'CREATE_SWAP') {
      const {
        passengerName,
        pnrVerified,
        maskedPnr,
        trainNo,
        trainName,
        doj,
        fromStn,
        toStn,
        travelClass,
        currentCoach,
        currentBerth,
        currentBerthType,
        targetCoach,
        targetBerthType,
        familyContextCoach,
        familyContextBerths,
        reasonCategory,
        reasonLabel,
        note
      } = body;

      if (!passengerName || !trainNo || !doj || !currentCoach || !currentBerth) {
        return NextResponse.json(
          { error: 'Missing required fields: Passenger Name, Train Number, Date, Current Coach, and Current Berth.' },
          { status: 400 }
        );
      }

      const newSwap = {
        id: `swap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date().toISOString(),
        passengerName: passengerName.trim(),
        pnrVerified: !!pnrVerified,
        maskedPnr: maskedPnr || null,
        trainNo: String(trainNo).trim(),
        trainName: (trainName || 'Express Train').trim(),
        doj: doj.trim(),
        fromStn: (fromStn || 'SRC').trim().toUpperCase(),
        toStn: (toStn || 'DEST').trim().toUpperCase(),
        travelClass: (travelClass || '3A').trim().toUpperCase(),
        currentCoach: String(currentCoach).trim().toUpperCase(),
        currentBerth: String(currentBerth).trim(),
        currentBerthType: (currentBerthType || 'LB').trim().toUpperCase(),
        targetCoach: (targetCoach || 'ANY').trim().toUpperCase(),
        targetBerthType: (targetBerthType || 'ANY').trim().toUpperCase(),
        familyContextCoach: (familyContextCoach || '').trim().toUpperCase(),
        familyContextBerths: (familyContextBerths || '').trim(),
        reasonCategory: reasonCategory || 'FAMILY_SPLIT',
        reasonLabel: reasonLabel || 'Family Split Across Coaches',
        note: (note || '').trim(),
        status: 'OPEN',
        matchedOfferId: null,
        offers: [],
        messages: []
      };

      swaps.unshift(newSwap);
      saveSwaps(swaps);
      return NextResponse.json({ swap: newSwap, swaps });
    }

    // 2. Submit an offer to swap seats on an existing request
    if (action === 'SEND_OFFER') {
      const { swapId, responderName, offeredCoach, offeredBerth, offeredBerthType, message } = body;
      const targetSwap = swaps.find(s => s.id === swapId);
      if (!targetSwap) {
        return NextResponse.json({ error: 'Swap request not found.' }, { status: 404 });
      }
      if (!responderName || !offeredCoach || !offeredBerth) {
        return NextResponse.json(
          { error: 'Please provide your Name, Current Coach, and Berth Number to propose a swap.' },
          { status: 400 }
        );
      }

      const newOffer = {
        id: `offer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date().toISOString(),
        responderName: responderName.trim(),
        offeredCoach: String(offeredCoach).trim().toUpperCase(),
        offeredBerth: String(offeredBerth).trim(),
        offeredBerthType: (offeredBerthType || 'LB').trim().toUpperCase(),
        message: (message || '').trim(),
        status: 'PENDING'
      };

      targetSwap.offers = targetSwap.offers || [];
      targetSwap.offers.push(newOffer);

      if (message && message.trim()) {
        targetSwap.messages = targetSwap.messages || [];
        targetSwap.messages.push({
          id: `msg-${Date.now()}`,
          senderName: responderName.trim(),
          senderRole: 'RESPONDER',
          text: message.trim(),
          createdAt: new Date().toISOString()
        });
      }

      saveSwaps(swaps);
      return NextResponse.json({ swap: targetSwap, swaps });
    }

    // 3. Approve or Decline an offer
    if (action === 'RESPOND_OFFER') {
      const { swapId, offerId, decision } = body; // decision: 'APPROVED' | 'DECLINED'
      const targetSwap = swaps.find(s => s.id === swapId);
      if (!targetSwap) {
        return NextResponse.json({ error: 'Swap request not found.' }, { status: 404 });
      }

      const offer = (targetSwap.offers || []).find(o => o.id === offerId);
      if (!offer) {
        return NextResponse.json({ error: 'Swap offer not found.' }, { status: 404 });
      }

      offer.status = decision;
      if (decision === 'APPROVED') {
        targetSwap.status = 'MATCHED';
        targetSwap.matchedOfferId = offer.id;
        // Mark other pending offers as declined
        targetSwap.offers.forEach(o => {
          if (o.id !== offer.id && o.status === 'PENDING') {
            o.status = 'DECLINED';
          }
        });
        targetSwap.messages = targetSwap.messages || [];
        targetSwap.messages.push({
          id: `msg-${Date.now()}`,
          senderName: targetSwap.passengerName,
          senderRole: 'REQUESTER',
          text: `✅ Approved swap offer from ${offer.responderName} (${targetSwap.currentCoach} #${targetSwap.currentBerth} ⇄ ${offer.offeredCoach} #${offer.offeredBerth}). Let's coordinate here and inform the TTE onboard!`,
          createdAt: new Date().toISOString()
        });
      }

      saveSwaps(swaps);
      return NextResponse.json({ swap: targetSwap, swaps });
    }

    // 4. Send an in-app chat message inside a swap thread
    if (action === 'SEND_MESSAGE') {
      const { swapId, senderName, senderRole, text } = body;
      const targetSwap = swaps.find(s => s.id === swapId);
      if (!targetSwap) {
        return NextResponse.json({ error: 'Swap request not found.' }, { status: 404 });
      }
      if (!text || !text.trim()) {
        return NextResponse.json({ error: 'Message text cannot be empty.' }, { status: 400 });
      }

      targetSwap.messages = targetSwap.messages || [];
      targetSwap.messages.push({
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        senderName: (senderName || 'Passenger').trim(),
        senderRole: senderRole || 'RESPONDER',
        text: text.trim(),
        createdAt: new Date().toISOString()
      });

      saveSwaps(swaps);
      return NextResponse.json({ swap: targetSwap, swaps });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Error in /api/swaps POST:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
