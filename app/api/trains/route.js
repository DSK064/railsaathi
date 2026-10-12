import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { STATIONS } from '../../data/stations';
import stationsCoords from '../../data/stations_coords.json';

// Major stations across India for prioritizing nearby search expansion
const MAJOR_STATIONS = new Set([
  'SBC', 'YPR', 'KJM', 'BNC', 'WFD', 'MAS', 'MS', 'TBM', 'PER', 'NDLS', 'NZM', 'DLI', 
  'ANVT', 'DEC', 'CSTM', 'LTT', 'BDTS', 'DDR', 'BCT', 'MMCT', 'HWH', 'SDAH', 'KOAA', 
  'SHM', 'SC', 'HYB', 'KCG', 'BZA', 'VSKP', 'PNBE', 'PPTA', 'GKP', 'CNB', 'LKO', 
  'LJN', 'ALD', 'PRYJ', 'PUNE', 'ADI', 'ST', 'BRC', 'NGP', 'BPL', 'RKMP', 'HBJ', 
  'JBP', 'ET', 'BSB', 'MGS', 'DDU', 'GAYA', 'DNR', 'ASN', 'DHN', 'RNC', 'TATA', 
  'KGP', 'CTC', 'BBS', 'PURI', 'IPR', 'BSP', 'R', 'DURG', 'G', 'CDG', 'LDH', 
  'ASR', 'JAT', 'SVDK', 'KLK', 'HW', 'DDN', 'MUT', 'MTC', 'AGC', 'GWL', 'VGLJ', 
  'JHS', 'BINA', 'KOTA', 'JP', 'JU', 'BKN', 'AII', 'UDZ', 'RTM', 'GNC', 'BHUJ', 
  'VAPI', 'PBLR', 'LUR', 'NED', 'SUR', 'KWV', 'MRJ', 'KVR', 'RU', 'TPTY', 'GDR', 
  'NLR', 'OGL', 'TEL', 'GNT', 'RYP', 'WL', 'KZJ', 'PDPL', 'BPQ', 'SEGM', 'WR', 
  'SRC', 'BLS', 'KUR', 'PSA', 'CHE', 'SLO', 'RJY', 'TDD', 'EE', 'CLX', 'KVZ', 
  'SPE', 'CGL', 'VM', 'VRI', 'ALU', 'SRGM', 'TPJ', 'DG', 'MDU', 'VPT', 'CVP', 
  'TEN', 'NCJ', 'CAPE', 'ERN', 'ERS', 'AWY', 'TCR', 'SRR', 'CLT', 'CAN', 'KGQ', 
  'MAQ', 'MAO', 'KRMI', 'THVM', 'RN', 'CHI', 'PNVL', 'DR', 'KYN', 'IGP', 'NK', 
  'MMR', 'CSN', 'JL', 'BSL', 'BAU', 'KNW', 'KTE', 'MYR', 'STA', 'MKP', 'PCOI', 
  'DLN', 'BXR', 'ARA', 'PNC', 'FUT', 'BKP', 'MKA', 'HTZ', 'BRYA', 'LKR', 'KIUL', 
  'JMU', 'JAJ', 'JSME', 'MDP', 'CRJ', 'RNG', 'DGR', 'PAN', 'BWN', 'BDC'
]);

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function getNearbyStations(stationCode, maxDistanceKm = 100) {
  const baseCoords = stationsCoords[stationCode];
  if (!baseCoords) return [];
  const [lat1, lon1] = baseCoords;

  const stationMap = new Map(STATIONS.map(s => [s.code, s]));
  const baseStation = stationMap.get(stationCode);
  const baseCity = baseStation?.city?.toLowerCase();

  const list = [];
  for (const stn of STATIONS) {
    if (stn.code === stationCode) continue;
    const coords = stationsCoords[stn.code];
    if (!coords) continue;
    
    const dist = getDistance(lat1, lon1, coords[0], coords[1]);
    if (dist <= maxDistanceKm) {
      const isSameCity = baseCity && stn.city && stn.city.toLowerCase() === baseCity;
      const isMajor = MAJOR_STATIONS.has(stn.code);
      list.push({
        code: stn.code,
        name: stn.name,
        city: stn.city,
        distance: dist,
        isSameCity,
        isMajor
      });
    }
  }

  // Sort: Same city & Major first, then same city, then major, then by distance
  list.sort((a, b) => {
    if (a.isSameCity && a.isMajor && !(b.isSameCity && b.isMajor)) return -1;
    if (!(a.isSameCity && a.isMajor) && b.isSameCity && b.isMajor) return 1;
    if (a.isSameCity && !b.isSameCity) return -1;
    if (!a.isSameCity && b.isSameCity) return 1;
    if (a.isMajor && !b.isMajor) return -1;
    if (!a.isMajor && b.isMajor) return 1;
    return a.distance - b.distance;
  });

  return list;
}

function generateRandomHex(length = 32) {
  return crypto.randomBytes(length / 2).toString('hex');
}

async function fetchQuota(src, dest, doj, quota, session, token) {
  const url = new URL('https://securedapi.confirmtkt.com/api/platform/trainbooking/tatwnstns');
  url.searchParams.append('fromStnCode', src.toUpperCase());
  url.searchParams.append('destStnCode', dest.toUpperCase());
  url.searchParams.append('doj', doj);
  url.searchParams.append('quota', quota);
  url.searchParams.append('token', token);
  url.searchParams.append('androidid', '');
  url.searchParams.append('travelClassOrdering', 'ON,Ixigo');
  url.searchParams.append('appVersion', '397');
  url.searchParams.append('prevBookedTrains', 'OFF');
  url.searchParams.append('noChancePercentage', 'true');
  url.searchParams.append('getNearbyStation', 'true');
  url.searchParams.append('session', session);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Host': 'securedapi.confirmtkt.com',
      'Connection': 'Keep-Alive',
      'User-Agent': 'okhttp/4.9.2',
    },
    next: { revalidate: 60 } // Cache for 60 seconds
  });

  if (!response.ok) {
    throw new Error(`ConfirmTkt API returned status ${response.status} for quota ${quota}`);
  }

  return response.json();
}

async function fetchQuotaForCombinations(srcList, destList, dateStr, quota, session, token, origSrcList, origDestList) {
  const combinations = [];
  srcList.forEach(s => {
    destList.forEach(d => {
      combinations.push({ s, d });
    });
  });

  const results = await Promise.allSettled(
    combinations.map(async ({ s, d }) => {
      try {
        return await fetchQuota(s, d, dateStr, quota, session, token);
      } catch (err) {
        console.error(`Error fetching combination ${s} -> ${d} for date ${dateStr} (${quota}):`, err.message);
        return { trainBtwnStnsList: [], nearbyTrains: [] };
      }
    })
  );

  const mergedTrains = [];
  results.forEach(res => {
    if (res.status === 'fulfilled' && res.value) {
      const data = res.value;
      if (data.trainBtwnStnsList) mergedTrains.push(...data.trainBtwnStnsList);
      if (data.nearbyTrains) mergedTrains.push(...data.nearbyTrains);
    }
  });

  // Deduplicate and classify
  const uniqueTrainsMap = new Map();
  mergedTrains.forEach(t => {
    const isDirect = origSrcList.includes(t.fromStnCode) && origDestList.includes(t.toStnCode);
    
    let fromStnDistance = 0;
    let fromStnClosestSearchedCode = origSrcList[0];
    if (!origSrcList.includes(t.fromStnCode)) {
      let minDist = Infinity;
      const coords2 = stationsCoords[t.fromStnCode];
      if (coords2) {
        for (const s of origSrcList) {
          const coords1 = stationsCoords[s];
          if (coords1) {
            const dist = getDistance(coords1[0], coords1[1], coords2[0], coords2[1]);
            if (dist < minDist) {
              minDist = dist;
              fromStnClosestSearchedCode = s;
            }
          }
        }
      }
      fromStnDistance = minDist === Infinity ? 25.0 : parseFloat(minDist.toFixed(1));
    } else {
      fromStnClosestSearchedCode = t.fromStnCode;
    }

    let toStnDistance = 0;
    let toStnClosestSearchedCode = origDestList[0];
    if (!origDestList.includes(t.toStnCode)) {
      let minDist = Infinity;
      const coords2 = stationsCoords[t.toStnCode];
      if (coords2) {
        for (const d of origDestList) {
          const coords1 = stationsCoords[d];
          if (coords1) {
            const dist = getDistance(coords1[0], coords1[1], coords2[0], coords2[1]);
            if (dist < minDist) {
              minDist = dist;
              toStnClosestSearchedCode = d;
            }
          }
        }
      }
      toStnDistance = minDist === Infinity ? 25.0 : parseFloat(minDist.toFixed(1));
    } else {
      toStnClosestSearchedCode = t.toStnCode;
    }

    const totalOffset = fromStnDistance + toStnDistance;
    t.isDirect = isDirect;
    t.fromStnDistance = fromStnDistance;
    t.toStnDistance = toStnDistance;
    t.fromStnClosestSearchedCode = fromStnClosestSearchedCode;
    t.toStnClosestSearchedCode = toStnClosestSearchedCode;

    const existing = uniqueTrainsMap.get(t.trainNumber);
    if (!existing) {
      uniqueTrainsMap.set(t.trainNumber, t);
    } else {
      if (!existing.isDirect && t.isDirect) {
        uniqueTrainsMap.set(t.trainNumber, t);
      } else if (existing.isDirect && !t.isDirect) {
        // keep existing
      } else {
        const existingOffset = (existing.fromStnDistance || 0) + (existing.toStnDistance || 0);
        if (totalOffset < existingOffset) {
          uniqueTrainsMap.set(t.trainNumber, t);
        }
      }
    }
  });

  const trainBtwnStnsList = [];
  const nearbyTrains = [];
  for (const t of uniqueTrainsMap.values()) {
    if (t.isDirect) {
      trainBtwnStnsList.push(t);
    } else {
      nearbyTrains.push(t);
    }
  }

  return {
    trainBtwnStnsList,
    nearbyTrains
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const src = searchParams.get('src');
  const dest = searchParams.get('dest');
  const doj = searchParams.get('doj'); // format: dd-mm-yyyy

  if (!src || !dest || !doj) {
    return NextResponse.json({ error: 'Missing required parameters: src, dest, doj' }, { status: 400 });
  }

  const srcList = src.split(',');
  const destList = dest.split(',');

  const origSrcList = [...srcList];
  const origDestList = [...destList];
  const origSrc = srcList[0];
  const origDest = destList[0];

  let finalSrcList = [...srcList];
  let finalDestList = [...destList];

  // If it's a single-station lookup, auto-expand to nearby stations within 100km
  if (srcList.length === 1 && destList.length === 1) {
    const nearbySrc = getNearbyStations(origSrc, 100);
    const nearbyDest = getNearbyStations(origDest, 100);

    nearbySrc.forEach(stn => {
      if (finalSrcList.length < 3 && !finalSrcList.includes(stn.code)) {
        finalSrcList.push(stn.code);
      }
    });

    nearbyDest.forEach(stn => {
      if (finalDestList.length < 3 && !finalDestList.includes(stn.code)) {
        finalDestList.push(stn.code);
      }
    });
  }

  const session = generateRandomHex(32);
  const token = generateRandomHex(64);

  // Helper to parse dd-mm-yyyy to Date
  const parseDoj = (dojStr) => {
    const [day, month, year] = dojStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  // Helper to format Date to dd-mm-yyyy
  const formatDoj = (date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Helper to generate dates between startDate and endDate
  const getDatesInRange = (startDateStr, endDateStr) => {
    const start = parseDoj(startDateStr);
    const end = parseDoj(endDateStr);
    const dates = [];
    const current = new Date(start);
    current.setHours(0, 0, 0, 0);
    const normalizedEnd = new Date(end);
    normalizedEnd.setHours(0, 0, 0, 0);
    while (current <= normalizedEnd) {
      dates.push(formatDoj(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  // Helper to check if available seats exist in a list of trains
  const hasAvailableSeats = (trainsList, nearbyList) => {
    const checkAvailability = (t) => {
      const classes = t.avlClasses?.Array || t.avlClasses || [];
      return classes.some(c => {
        const cacheGN = t.avaiblitycache?.[c] || {};
        const statusGN = cacheGN.Availability || "";
        const isAvailableGN = statusGN.includes("AVAILABLE") && !statusGN.includes("NOT");

        const cacheTQ = t.avaiblitycacheTq?.[c] || {};
        const statusTQ = cacheTQ.Availability || "";
        const isAvailableTQ = statusTQ.includes("AVAILABLE") && !statusTQ.includes("NOT");

        return isAvailableGN || isAvailableTQ;
      });
    };

    return trainsList.some(checkAvailability) || nearbyList.some(checkAvailability);
  };

  // Get IST strings for today and tomorrow to check if Tatkal is open
  const getISTDateStrings = () => {
    const getDStr = (offset) => {
      const date = new Date(Date.now() + 5.5 * 60 * 60 * 1000 + offset * 24 * 60 * 60 * 1000);
      const day = String(date.getUTCDate()).padStart(2, '0');
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const year = date.getUTCFullYear();
      return `${day}-${month}-${year}`;
    };
    return {
      todayStr: getDStr(0),
      tomorrowStr: getDStr(1)
    };
  };

  const { todayStr, tomorrowStr } = getISTDateStrings();
  const endDate = searchParams.get('endDate');

  let combinedTrains = [];
  let combinedNearby = [];
  let searchedWeeks = 1;
  let foundSeats = false;

  try {
    if (endDate) {
      // 1. Range Search
      const dateRange = getDatesInRange(doj, endDate);
      if (dateRange.length > 60) {
        return NextResponse.json({ error: 'Date range must be 60 days or less.' }, { status: 400 });
      }

      console.log(`Searching range:`, dateRange);

      const results = await Promise.allSettled(
        dateRange.map(async (dateStr) => {
          const fetchTQ = (dateStr === todayStr || dateStr === tomorrowStr);
          
          let dataGN;
          try {
            dataGN = await fetchQuotaForCombinations(finalSrcList, finalDestList, dateStr, 'GN', session, token, origSrcList, origDestList);
          } catch (e) {
            console.error(`Error fetching GN for ${dateStr}:`, e.message);
            dataGN = { trainBtwnStnsList: [], nearbyTrains: [] };
          }

          let dataTQ = { trainBtwnStnsList: [], nearbyTrains: [] };
          if (fetchTQ) {
            try {
              dataTQ = await fetchQuotaForCombinations(finalSrcList, finalDestList, dateStr, 'TQ', session, token, origSrcList, origDestList);
            } catch (e) {
              console.warn(`Error fetching TQ for ${dateStr}:`, e.message);
            }
          }

          // Merge TQ cache into GN
          const tqMap = new Map();
          if (dataTQ.trainBtwnStnsList) {
            dataTQ.trainBtwnStnsList.forEach(t => {
              tqMap.set(t.trainNumber, t.avaiblitycache || {});
            });
          }

          if (dataGN.trainBtwnStnsList) {
            dataGN.trainBtwnStnsList.forEach(t => {
              t.avaiblitycacheTq = tqMap.get(t.trainNumber) || {};
              t.journeyDate = dateStr;
            });
          }

          const tqNearbyMap = new Map();
          if (dataTQ.nearbyTrains) {
            dataTQ.nearbyTrains.forEach(t => {
              tqNearbyMap.set(t.trainNumber, t.avaiblitycache || {});
            });
          }

          if (dataGN.nearbyTrains) {
            dataGN.nearbyTrains.forEach(t => {
              t.avaiblitycacheTq = tqNearbyMap.get(t.trainNumber) || {};
              t.journeyDate = dateStr;
            });
          }

          return dataGN;
        })
      );

      results.forEach((res) => {
        if (res.status === 'fulfilled') {
          const data = res.value;
          if (data.trainBtwnStnsList) combinedTrains.push(...data.trainBtwnStnsList);
          if (data.nearbyTrains) combinedNearby.push(...data.nearbyTrains);
        }
      });

      foundSeats = hasAvailableSeats(combinedTrains, combinedNearby);

    } else {
      // 2. Single Date Weekly Lookup
      let currentDoj = parseDoj(doj);
      for (let w = 0; w < 4; w++) {
        searchedWeeks = w + 1;
        const weekDates = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(currentDoj);
          d.setDate(currentDoj.getDate() + i);
          weekDates.push(formatDoj(d));
        }

        console.log(`Searching week ${searchedWeeks}:`, weekDates);

        // Perform fetches for the 7 dates in parallel
        const weekResults = await Promise.allSettled(
          weekDates.map(async (dateStr) => {
            const fetchTQ = (dateStr === todayStr || dateStr === tomorrowStr);
            
            let dataGN;
            try {
              dataGN = await fetchQuotaForCombinations(finalSrcList, finalDestList, dateStr, 'GN', session, token, origSrcList, origDestList);
            } catch (e) {
              console.error(`Error fetching GN for ${dateStr}:`, e.message);
              dataGN = { trainBtwnStnsList: [], nearbyTrains: [] };
            }

            let dataTQ = { trainBtwnStnsList: [], nearbyTrains: [] };
            if (fetchTQ) {
              try {
                dataTQ = await fetchQuotaForCombinations(finalSrcList, finalDestList, dateStr, 'TQ', session, token, origSrcList, origDestList);
              } catch (e) {
                console.warn(`Error fetching TQ for ${dateStr}:`, e.message);
              }
            }

            // Merge TQ cache into GN
            const tqMap = new Map();
            if (dataTQ.trainBtwnStnsList) {
              dataTQ.trainBtwnStnsList.forEach(t => {
                tqMap.set(t.trainNumber, t.avaiblitycache || {});
              });
            }

            if (dataGN.trainBtwnStnsList) {
              dataGN.trainBtwnStnsList.forEach(t => {
                t.avaiblitycacheTq = tqMap.get(t.trainNumber) || {};
                t.journeyDate = dateStr;
              });
            }

            const tqNearbyMap = new Map();
            if (dataTQ.nearbyTrains) {
              dataTQ.nearbyTrains.forEach(t => {
                tqNearbyMap.set(t.trainNumber, t.avaiblitycache || {});
              });
            }

            if (dataGN.nearbyTrains) {
              dataGN.nearbyTrains.forEach(t => {
                t.avaiblitycacheTq = tqNearbyMap.get(t.trainNumber) || {};
                t.journeyDate = dateStr;
              });
            }

            return dataGN;
          })
        );

        // Extract results from this week
        const weekTrains = [];
        const weekNearby = [];

        weekResults.forEach((res) => {
          if (res.status === 'fulfilled') {
            const data = res.value;
            if (data.trainBtwnStnsList) weekTrains.push(...data.trainBtwnStnsList);
            if (data.nearbyTrains) weekNearby.push(...data.nearbyTrains);
          }
        });

        // Accumulate
        combinedTrains.push(...weekTrains);
        combinedNearby.push(...weekNearby);

        // Check if available seats exist in this week's results
        if (hasAvailableSeats(weekTrains, weekNearby)) {
          foundSeats = true;
          break; // Stop fetching next weeks!
        }

        // Prepare currentDoj for next 7 days
        currentDoj.setDate(currentDoj.getDate() + 7);
      }
    }

    return NextResponse.json({
      trainBtwnStnsList: combinedTrains,
      nearbyTrains: combinedNearby,
      searchedWeeks,
      foundSeats
    });

  } catch (error) {
    console.error('Error fetching trains:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}

