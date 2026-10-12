"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Train, ArrowLeft, AlertCircle, Info } from "lucide-react";

// Helper to calculate arrival date based on departure date, time, and duration
const calculateArrivalDate = (depDateStr, depTimeStr, durationStr) => {
  if (!depDateStr || !depTimeStr || !durationStr) return depDateStr || "";
  try {
    const [d, m, y] = depDateStr.split("-").map(Number);
    const [depH, depM] = depTimeStr.split(":").map(Number);
    
    const depDate = new Date(y, m - 1, d, depH, depM);
    
    let durH = 0;
    let durM = 0;
    if (durationStr.includes(":")) {
      const parts = durationStr.split(":");
      durH = parseInt(parts[0], 10) || 0;
      durM = parseInt(parts[1], 10) || 0;
    } else {
      const hMatch = durationStr.match(/(\d+)\s*h/i);
      const mMatch = durationStr.match(/(\d+)\s*m/i);
      if (hMatch) durH = parseInt(hMatch[1], 10);
      if (mMatch) durM = parseInt(mMatch[1], 10);
    }
    
    const arrDate = new Date(depDate.getTime() + (durH * 60 + durM) * 60 * 1000);
    const day = String(arrDate.getDate()).padStart(2, '0');
    const month = String(arrDate.getMonth() + 1).padStart(2, '0');
    const year = arrDate.getFullYear();
    return `${day}-${month}-${year}`;
  } catch (err) {
    return depDateStr;
  }
};

// Date formatter (yyyy-mm-dd to dd-mm-yyyy)
const formatDate = (dateStr) => {
  if (!dateStr) return "";
  if (dateStr.includes("-") && dateStr.split("-")[0].length === 4) {
    const [year, month, day] = dateStr.split("-");
    return `${day}-${month}-${year}`;
  }
  return dateStr;
};

const cleanAvailabilityStatus = (statusStr) => {
  if (!statusStr) return "";
  let clean = statusStr.replace("#", "").trim();
  clean = clean.replace(/AVAILABLE-0*(\d+)/i, 'AVAILABLE $1');
  return clean;
};

const getStatusType = (statusStr) => {
  if (!statusStr) return "unavailable";
  const status = statusStr.toUpperCase();
  if (status.includes("AVAILABLE") && !status.includes("NOT")) {
    return "available";
  }
  if (status.includes("WL") || status.includes("RAC")) {
    return "waitlist";
  }
  return "unavailable";
};

const parseAvailability = (statusStr) => {
  if (!statusStr) return { grade: 0, seats: 0 };
  const status = statusStr.toUpperCase();
  if (status.includes("AVAILABLE") && !status.includes("NOT")) {
    const match = statusStr.match(/AVAILABLE[- ]?0*(\d+)/i);
    const seats = match ? parseInt(match[1], 10) : 99;
    return {
      grade: seats > 10 ? 3 : 2,
      seats: seats
    };
  }
  if (status.includes("WL") || status.includes("RAC")) {
    const match = statusStr.match(/(?:WL|RAC)[- ]?0*(\d+)/i);
    const seats = match ? parseInt(match[1], 10) : 0;
    return { grade: 1, seats };
  }
  return { grade: 0, seats: 0 };
};

const getDateAvailability = (dStr, rawTrainsList) => {
  const trainsOnDate = rawTrainsList.filter(t => t.journeyDate === dStr);
  if (trainsOnDate.length === 0) return { text: "No Trains", type: "unavailable" };
  
  let bestGrade = -1;
  let bestSeats = 0;
  
  trainsOnDate.forEach(train => {
    const classes = train.avlClasses?.Array || train.avlClasses || [];
    classes.forEach(cls => {
      // General Quota
      const cacheGN = train.avaiblitycache?.[cls] || {};
      const statusGN = cacheGN.Availability || "";
      const { grade: gradeGN, seats: seatsGN } = parseAvailability(statusGN);
      if (gradeGN > bestGrade) {
        bestGrade = gradeGN;
        bestSeats = seatsGN;
      } else if (gradeGN === bestGrade && seatsGN > bestSeats) {
        bestSeats = seatsGN;
      }
      
      // Tatkal Quota
      const cacheTQ = train.avaiblitycacheTq?.[cls] || {};
      const statusTQ = cacheTQ.Availability || "";
      const { grade: gradeTQ, seats: seatsTQ } = parseAvailability(statusTQ);
      if (gradeTQ > bestGrade) {
        bestGrade = gradeTQ;
        bestSeats = seatsTQ;
      } else if (gradeTQ === bestGrade && seatsTQ > bestSeats) {
        bestSeats = seatsTQ;
      }
    });
  });
  
  if (bestGrade === 3) return { text: "Available", type: "available" };
  if (bestGrade === 2) return { text: `Few Seats (${bestSeats})`, type: "few-seats" };
  if (bestGrade === 1) return { text: "Waitlist", type: "waitlist" };
  return { text: "NA", type: "unavailable" };
};

// Helper to get 7 dates for a week starting from dojStr (format: dd-mm-yyyy) with weekOffset
const getWeekDates = (dojStr, weekOffset) => {
  const [d, m, y] = dojStr.split("-").map(Number);
  const startDate = new Date(y, m - 1, d);
  startDate.setDate(startDate.getDate() + weekOffset * 7);
  
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const nextDate = new Date(startDate);
    nextDate.setDate(startDate.getDate() + i);
    
    const day = String(nextDate.getDate()).padStart(2, '0');
    const month = String(nextDate.getMonth() + 1).padStart(2, '0');
    const year = nextDate.getFullYear();
    dates.push(`${day}-${month}-${year}`);
  }
  return dates;
};

// Helper to get all dates between startDateStr and endDateStr (format: dd-mm-yyyy)
const getDatesInRange = (startDateStr, endDateStr) => {
  const [sDay, sMonth, sYear] = startDateStr.split("-").map(Number);
  const [eDay, eMonth, eYear] = endDateStr.split("-").map(Number);
  const start = new Date(sYear, sMonth - 1, sDay);
  const end = new Date(eYear, eMonth - 1, eDay);
  
  const dates = [];
  const current = new Date(start);
  current.setHours(0,0,0,0);
  const targetEnd = new Date(end);
  targetEnd.setHours(0,0,0,0);
  
  while (current <= targetEnd) {
    const day = String(current.getDate()).padStart(2, '0');
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const year = current.getFullYear();
    dates.push(`${day}-${month}-${year}`);
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
  return (trainsList || []).some(checkAvailability) || (nearbyList || []).some(checkAvailability);
};

// Journey Planner logic: Categorizes and ranks options from best to least (only available seats)
const generateJourneyPlans = (data, searchDateStr) => {
  if (!data) return [];
  const plans = [];

  const parseDateStr = (str) => {
    if (!str) return new Date();
    const [day, month, year] = str.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  const parseInputDate = (str) => {
    if (!str) return new Date();
    let year, month, day;
    if (str.includes("-") && str.split("-")[0].length === 4) {
      [year, month, day] = str.split("-").map(Number);
    } else {
      [day, month, year] = str.split("-").map(Number);
    }
    return new Date(year, month - 1, day);
  };

  const getDayDiff = (d1Str, d2Str) => {
    const d1 = parseDateStr(d1Str);
    const d2 = parseInputDate(d2Str);
    const diff = Math.abs(d1 - d2);
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  // 1. Process Direct Trains
  const directTrains = data.trainBtwnStnsList || [];
  directTrains.forEach(t => {
    const classes = t.avlClasses?.Array || t.avlClasses || [];
    classes.forEach(c => {
      // General Quota
      const cacheGN = t.avaiblitycache?.[c] || {};
      const statusGN = cacheGN.Availability || "";
      const predictionGN = cacheGN.Prediction || "";
      const isAvailableGN = statusGN.includes("AVAILABLE") && !statusGN.includes("NOT");
      
      if (isAvailableGN) {
        plans.push({
          trainNo: t.trainNumber,
          trainName: t.trainName,
          from: t.fromStnCode,
          to: t.toStnCode,
          depTime: t.departureTime,
          arrTime: t.arrivalTime,
          duration: t.duration,
          class: c,
          status: statusGN,
          prediction: predictionGN,
          isDirect: true,
          fromStnDistance: t.fromStnDistance || 0,
          toStnDistance: t.toStnDistance || 0,
          fromStnClosestSearchedCode: t.fromStnClosestSearchedCode || t.fromStnCode,
          toStnClosestSearchedCode: t.toStnClosestSearchedCode || t.toStnCode,
          quota: "GN",
          quotaLabel: "GN",
          tier: 1,
          tierLabel: "Direct - Available",
          journeyDate: t.journeyDate,
          dayDiff: getDayDiff(t.journeyDate, searchDateStr),
          fare: cacheGN.Fare
        });
      }

      // Tatkal Quota
      const cacheTQ = t.avaiblitycacheTq?.[c] || {};
      const statusTQ = cacheTQ.Availability || "";
      const predictionTQ = cacheTQ.Prediction || "";
      const isAvailableTQ = statusTQ.includes("AVAILABLE") && !statusTQ.includes("NOT");

      if (isAvailableTQ) {
        plans.push({
          trainNo: t.trainNumber,
          trainName: t.trainName,
          from: t.fromStnCode,
          to: t.toStnCode,
          depTime: t.departureTime,
          arrTime: t.arrivalTime,
          duration: t.duration,
          class: c,
          status: statusTQ,
          prediction: predictionTQ,
          isDirect: true,
          fromStnDistance: t.fromStnDistance || 0,
          toStnDistance: t.toStnDistance || 0,
          fromStnClosestSearchedCode: t.fromStnClosestSearchedCode || t.fromStnCode,
          toStnClosestSearchedCode: t.toStnClosestSearchedCode || t.toStnCode,
          quota: "TQ",
          quotaLabel: "TQ",
          tier: 1,
          tierLabel: "Direct - Available",
          journeyDate: t.journeyDate,
          dayDiff: getDayDiff(t.journeyDate, searchDateStr),
          fare: cacheTQ.Fare
        });
      }
    });
  });

  // 2. Process Nearby Trains
  const nearbyTrains = data.nearbyTrains || [];
  nearbyTrains.forEach(t => {
    const classes = t.avlClasses?.Array || t.avlClasses || [];
    classes.forEach(c => {
      // General Quota
      const cacheGN = t.avaiblitycache?.[c] || {};
      const statusGN = cacheGN.Availability || "";
      const predictionGN = cacheGN.Prediction || "";
      const isAvailableGN = statusGN.includes("AVAILABLE") && !statusGN.includes("NOT");
      
      if (isAvailableGN) {
        plans.push({
          trainNo: t.trainNumber,
          trainName: t.trainName,
          from: t.fromStnCode,
          to: t.toStnCode,
          depTime: t.departureTime,
          arrTime: t.arrivalTime,
          duration: t.duration,
          class: c,
          status: statusGN,
          prediction: predictionGN,
          isDirect: false,
          fromStnDistance: t.fromStnDistance || 0,
          toStnDistance: t.toStnDistance || 0,
          fromStnClosestSearchedCode: t.fromStnClosestSearchedCode || t.fromStnCode,
          toStnClosestSearchedCode: t.toStnClosestSearchedCode || t.toStnCode,
          quota: "GN",
          quotaLabel: "GN",
          tier: 3,
          tierLabel: "Nearby Station - Available",
          journeyDate: t.journeyDate,
          dayDiff: getDayDiff(t.journeyDate, searchDateStr),
          fare: cacheGN.Fare
        });
      }

      // Tatkal Quota
      const cacheTQ = t.avaiblitycacheTq?.[c] || {};
      const statusTQ = cacheTQ.Availability || "";
      const predictionTQ = cacheTQ.Prediction || "";
      const isAvailableTQ = statusTQ.includes("AVAILABLE") && !statusTQ.includes("NOT");
      
      if (isAvailableTQ) {
        plans.push({
          trainNo: t.trainNumber,
          trainName: t.trainName,
          from: t.fromStnCode,
          to: t.toStnCode,
          depTime: t.departureTime,
          arrTime: t.arrivalTime,
          duration: t.duration,
          class: c,
          status: statusTQ,
          prediction: predictionTQ,
          isDirect: false,
          fromStnDistance: t.fromStnDistance || 0,
          toStnDistance: t.toStnDistance || 0,
          fromStnClosestSearchedCode: t.fromStnClosestSearchedCode || t.fromStnCode,
          toStnClosestSearchedCode: t.toStnClosestSearchedCode || t.toStnCode,
          quota: "TQ",
          quotaLabel: "TQ",
          tier: 3,
          tierLabel: "Nearby Station - Available",
          journeyDate: t.journeyDate,
          dayDiff: getDayDiff(t.journeyDate, searchDateStr),
          fare: cacheTQ.Fare
        });
      }
    });
  });

  // Helper to get number of available seats
  const getAvailableCount = (statusStr) => {
    const match = statusStr.match(/AVAILABLE-(\d+)/i);
    return match ? parseInt(match[1], 10) : 0;
  };

  // Sort plans:
  // 1. Tier (Direct Available first, then Nearby Available)
  // 2. Closeness to user-requested date (dayDiff ascending)
  // 3. Departure time ascending
  // 4. Train number ascending (group same train together)
  // 5. Available seat count descending
  return plans.sort((a, b) => {
    if (a.tier !== b.tier) {
      return a.tier - b.tier;
    }
    if (a.dayDiff !== b.dayDiff) {
      return a.dayDiff - b.dayDiff;
    }
    if (a.depTime !== b.depTime) {
      return (a.depTime || "").localeCompare(b.depTime || "");
    }
    if (a.trainNo !== b.trainNo) {
      return (a.trainNo || "").localeCompare(b.trainNo || "");
    }
    return getAvailableCount(b.status) - getAvailableCount(a.status);
  });
};

function ResultsContent() {
  const searchParams = useSearchParams();
  const src = searchParams.get("src");
  const dest = searchParams.get("dest");
  const doj = searchParams.get("doj"); // format: dd-mm-yyyy
  const endDate = searchParams.get("endDate"); // format: dd-mm-yyyy

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchResults, setSearchResults] = useState(null);
  const [viewMode, setViewMode] = useState("ranked");
  const [selectedJourneyDate, setSelectedJourneyDate] = useState("");
  const [quotaFilter, setQuotaFilter] = useState("ALL");
  const [classFilter, setClassFilter] = useState("ALL");
  const [routeFilter, setRouteFilter] = useState("ALL");

  // Progressive loading states
  const [loadedDates, setLoadedDates] = useState([]);
  const [targetDates, setTargetDates] = useState([]);
  const [loadingStatus, setLoadingStatus] = useState("");
  const [searchedWeeks, setSearchedWeeks] = useState(1);
  const searchIdRef = useRef(0);

  const plans = searchResults ? generateJourneyPlans(searchResults, doj) : [];
  const availableQuotas = Array.from(new Set(plans.map(p => p.quota))).filter(Boolean);
  const availableClasses = Array.from(new Set(plans.map(p => p.class))).filter(Boolean).sort();

  useEffect(() => {
    if (!src || !dest || !doj) {
      setError("Missing query parameters (src, dest, doj).");
      setLoading(false);
      return;
    }

    // Reset progressive states and start loading
    setLoading(true);
    setError(null);
    setSearchResults({ trainBtwnStnsList: [], nearbyTrains: [] });
    setLoadedDates([]);
    setTargetDates([]);
    setSearchedWeeks(1);
    setLoadingStatus("Initializing search...");
    setQuotaFilter("ALL");
    setClassFilter("ALL");
    setRouteFilter("ALL");
    setSelectedJourneyDate(doj);

    // Transaction ID to prevent race conditions
    searchIdRef.current += 1;
    const currentSearchId = searchIdRef.current;

    // Helper to fetch a single date
    const fetchSingleDate = async (dateStr) => {
      const url = `/api/trains?src=${src}&dest=${dest}&doj=${dateStr}&endDate=${dateStr}`;
      try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        return data;
      } catch (err) {
        console.error(`Error fetching data for date ${dateStr}:`, err.message);
        return { trainBtwnStnsList: [], nearbyTrains: [] };
      }
    };

    // Helper to load a batch of dates in parallel and merge progressively
    const loadBatch = async (batchDates) => {
      let seatsFound = false;
      const fetches = batchDates.map(async (dStr) => {
        const data = await fetchSingleDate(dStr);
        if (currentSearchId !== searchIdRef.current) return;

        // Check if available seats exist in this date's response
        if (hasAvailableSeats(data.trainBtwnStnsList, data.nearbyTrains)) {
          seatsFound = true;
        }

        // Merge results progressively
        setSearchResults(prev => {
          if (currentSearchId !== searchIdRef.current) return prev;
          
          const prevTrains = prev?.trainBtwnStnsList || [];
          const prevNearby = prev?.nearbyTrains || [];

          // Tag trains with journeyDate
          const taggedTrains = (data.trainBtwnStnsList || []).map(t => ({ ...t, journeyDate: dStr }));
          const taggedNearby = (data.nearbyTrains || []).map(t => ({ ...t, journeyDate: dStr }));

          // Append
          const mergedTrains = [...prevTrains, ...taggedTrains];
          const mergedNearby = [...prevNearby, ...taggedNearby];

          return {
            trainBtwnStnsList: mergedTrains,
            nearbyTrains: mergedNearby
          };
        });

        // Add to loaded dates list
        setLoadedDates(prev => {
          if (currentSearchId !== searchIdRef.current) return prev;
          return [...prev, dStr];
        });
      });

      await Promise.all(fetches);
      return seatsFound;
    };

    const fetchTrains = async () => {
      try {
        if (endDate) {
          // Range search
          const datesRange = getDatesInRange(doj, endDate);
          setTargetDates(datesRange);
          setLoadingStatus(`Loading ${datesRange.length} dates progressively...`);

          // Load base date first
          setLoadingStatus(`Connecting to IRCTC for ${doj}...`);
          await loadBatch([doj]);
          
          // Hide global screen loading spinner since the first results are ready
          setLoading(false);

          // Load remaining dates in parallel background
          const remainingDates = datesRange.filter(d => d !== doj);
          if (remainingDates.length > 0) {
            loadBatch(remainingDates);
          }

        } else {
          // Single Date Search (Weekly lookup progressively)
          setTargetDates([doj]);
          setLoadingStatus(`Checking availability for ${doj}...`);
          
          // 1. Fetch exact date first
          const seatsFoundOnBaseDoj = await loadBatch([doj]);
          setLoading(false); // Hide the screen spinner

          if (seatsFoundOnBaseDoj) {
            return;
          }

          // 2. Fetch remaining days of Week 1
          const week1Rest = getWeekDates(doj, 0).filter(d => d !== doj);
          setTargetDates(prev => [...prev, ...week1Rest]);
          setLoadingStatus(`No seats found on ${doj}. Searching remaining Week 1 dates...`);
          const seatsFoundInWeek1 = await loadBatch(week1Rest);
          
          if (seatsFoundInWeek1) {
            return;
          }

          // 3. Search Week 2, 3, 4 sequentially until seats are found
          for (let w = 1; w < 4; w++) {
            if (currentSearchId !== searchIdRef.current) return;
            setSearchedWeeks(w + 1);
            
            const weekDates = getWeekDates(doj, w);
            setTargetDates(prev => [...prev, ...weekDates]);
            setLoadingStatus(`No seats found in Week ${w}. Searching Week ${w + 1}...`);
            
            const seatsFoundInWeek = await loadBatch(weekDates);
            if (seatsFoundInWeek) {
              break;
            }
          }
        }
      } catch (err) {
        console.error(err);
        if (currentSearchId === searchIdRef.current) {
          setError("Failed to fetch train details. Please check your internet connection.");
          setLoading(false);
        }
      }
    };

    fetchTrains();
  }, [src, dest, doj, endDate]);

  const handleBackClick = () => {
    // If opened in a new tab, close it. Otherwise, go back.
    if (window.history.length > 1) {
      window.close();
      // Fallback if window.close is blocked by browser security
      setTimeout(() => {
        window.location.href = "/";
      }, 300);
    } else {
      window.close();
    }
  };

  return (
    <>
      <nav className="top-navbar">
        <div className="top-navbar-inner">
          <div className="brand-cluster" onClick={handleBackClick}>
            <div className="logo-icon">
              <Train size={20} />
            </div>
            <div className="brand-text-group">
              <div className="logo-text">
                RailSaathi
                <span className="brand-tag-pill">2.0 PRO</span>
              </div>
              <span className="brand-subtext">Indian Railways Intelligence &amp; Seat Swap Hub</span>
            </div>
          </div>
          <div className="nav-status-cluster">
            <div className="live-network-pill">
              <span className="live-network-dot"></span>
              <span>IRCTC / NTES Live</span>
            </div>
          </div>
        </div>
      </nav>

      <div className="app-container" style={{ maxWidth: "860px" }}>
        {/* Modern SaaS Results Header Banner */}
        <header className="workspace-hero-strip" style={{ padding: "16px 20px", marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <button 
              onClick={handleBackClick} 
              style={{ background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.22)", borderRadius: "10px", width: "38px", height: "38px", color: "#ffffff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <div style={{ fontSize: "0.7rem", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.6px", opacity: 0.8 }}>
                RailSaathi • Smart Seat Results
              </div>
              <h2 style={{ fontSize: "1.2rem", fontWeight: "800", color: "#ffffff", margin: 0, fontFamily: "var(--font-mono)" }}>
                {src} ➔ {dest}
              </h2>
              <span style={{ fontSize: "0.82rem", color: "rgba(226,232,240,0.85)" }}>
                {endDate && doj !== endDate ? `${doj} to ${endDate}` : doj}
              </span>
            </div>
          </div>
        </header>

      {/* Global Loading Spinner */}
      {loading && (
        <div className="loader-container">
          <div className="spinner"></div>
          <p className="subtitle">{loadingStatus || "Retrieving real-time data from Indian Railways network..."}</p>
        </div>
      )}

      {/* Global Error Display */}
      {error && (
        <div className="error-message">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* ================= RESULTS RENDERING ================= */}
      {!loading && !error && searchResults && (
        <section className="results-section" style={{ marginTop: 0 }}>

          {/* Dynamic Filters Bar */}
          {availableQuotas.length > 0 && (
            <div className="filters-container" style={{ marginBottom: "16px", padding: "10px 12px" }}>
              <div className="filter-group">
                <label className="filter-label">Quota</label>
                <select 
                  className="filter-select" 
                  value={quotaFilter}
                  onChange={(e) => setQuotaFilter(e.target.value)}
                >
                  <option value="ALL">All Quotas</option>
                  {availableQuotas.map(q => (
                    <option key={q} value={q}>{q}</option>
                  ))}
                </select>
              </div>
              
              <div className="filter-group">
                <label className="filter-label">Class</label>
                <select 
                  className="filter-select" 
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                >
                  <option value="ALL">All Classes</option>
                  {availableClasses.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label">Route</label>
                <select 
                  className="filter-select" 
                  value={routeFilter}
                  onChange={(e) => setRouteFilter(e.target.value)}
                >
                  <option value="ALL">All Routes</option>
                  <option value="DIRECT">Direct Only</option>
                  <option value="NEARBY">Nearby Only</option>
                </select>
              </div>
            </div>
          )}

          {/* View Mode Toggle: Smart Ranked vs All Trains */}
          <div className="plan-toggle-container">
            <button 
              type="button"
              className={`plan-toggle-btn ${viewMode === 'ranked' ? 'active' : ''}`}
              onClick={() => setViewMode('ranked')}
            >
              🧠 Smart Journey Plans
            </button>
            <button 
              type="button"
              className={`plan-toggle-btn ${viewMode === 'all' ? 'active' : ''}`}
              onClick={() => setViewMode('all')}
            >
              📋 All Trains List
            </button>
          </div>
          
          {viewMode === 'ranked' ? (
            <div>
              {(() => {
                const filteredPlans = plans.filter(p => {
                  const matchQuota = quotaFilter === "ALL" || p.quota === quotaFilter;
                  const matchClass = classFilter === "ALL" || p.class === classFilter;
                  const matchRoute = routeFilter === "ALL" || 
                    (routeFilter === "DIRECT" && p.isDirect) || 
                    (routeFilter === "NEARBY" && !p.isDirect);
                  return matchQuota && matchClass && matchRoute;
                });
                if (plans.length === 0) {
                  return (
                    <p className="empty-message">
                      No available seats found for General or Tatkal quotas in this date range.
                      <br />
                      <span style={{ fontSize: "0.85rem", opacity: 0.7, display: "inline-block", marginTop: "8px" }}>Try changing search parameters or dates.</span>
                    </p>
                  );
                }
                if (filteredPlans.length === 0) {
                  return (
                    <p className="empty-message">
                      No options match your selected filters.
                    </p>
                  );
                }
                return (
                  <div>
                    {filteredPlans.map((plan, index) => {
                      let statusClass = "status-waitlist";
                      if (plan.status.includes("AVAILABLE") && !plan.status.includes("NOT")) {
                        statusClass = "status-available";
                      } else if (plan.status.includes("REGRET") || plan.status.includes("NOT AVAILABLE")) {
                        statusClass = "status-danger";
                      }

                      return (
                        <div className={`plan-card-ranked tier-${plan.tier}-card`} key={`${plan.trainNo}-${plan.class}-${index}`}>
                          <div className="card-header-row">
                            <div className="card-title-group">
                              <div className="train-title-line">
                                <span className="plan-rank-badge">Option #{index + 1}</span>
                                <span className="train-number-badge">{plan.trainNo}</span>
                                <span className="train-name-text">{plan.trainName}</span>
                                <span className={`quota-badge quota-${plan.quota.toLowerCase()}`}>{plan.quotaLabel}</span>
                              </div>
                            </div>
                            <div className="card-meta-group">
                              <div className="class-price-container">
                                <span className="class-type-tag">{plan.class}</span>
                                {plan.fare && <span className="price-tag">₹{plan.fare}</span>}
                              </div>
                            </div>
                          </div>

                          <div className="plan-route-info" style={{ marginTop: "2px" }}>
                            <div className="time-info">
                              <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                                <span className="time-value" style={{ fontSize: "1.15rem", fontWeight: "700" }}>{plan.depTime}</span>
                                <span className="station-label" style={{ fontWeight: "700", color: "var(--text-primary)", fontSize: "0.8rem" }}>{plan.from}</span>
                              </div>
                              <div className="station-label" style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>
                                {plan.journeyDate}
                              </div>
                            </div>
                            
                            <div className="duration-info" style={{ flexGrow: 1, maxWidth: "120px" }}>
                              <span className="duration-value" style={{ fontSize: "0.75rem" }}>{plan.duration}</span>
                              <div className="duration-line" style={{ margin: "1px 0" }}></div>
                            </div>
                            
                            <div className="time-info" style={{ textAlign: "right" }}>
                              <div style={{ display: "flex", alignItems: "baseline", gap: "4px", justifyContent: "flex-end" }}>
                                <span className="station-label" style={{ fontWeight: "700", color: "var(--text-primary)", fontSize: "0.8rem" }}>{plan.to}</span>
                                <span className="time-value" style={{ fontSize: "1.15rem", fontWeight: "700" }}>{plan.arrTime}</span>
                              </div>
                              <div className="station-label" style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>
                                {calculateArrivalDate(plan.journeyDate, plan.depTime, plan.duration)}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px dashed var(--glass-border)", paddingTop: "6px", marginTop: "2px", gap: "10px", flexWrap: "wrap" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                              <div className={`class-availability ${statusClass}`} style={{ fontSize: "0.95rem", fontWeight: "700" }}>
                                {cleanAvailabilityStatus(plan.status)}
                              </div>
                              {plan.prediction && (
                                <div style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--text-secondary)" }}>
                                  Chance: {plan.prediction}
                                </div>
                              )}
                            </div>
                            <a 
                              href={`https://www.confirmtkt.com/rbooking/trains/from/${plan.from}/to/${plan.to}/${plan.journeyDate}?trainNo=${plan.trainNo}&class=${plan.class}&quota=${plan.quota}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-book-now"
                              title="Book Ticket on ConfirmTkt"
                            >
                              Book Now ➔
                            </a>
                          </div>

                          {!plan.isDirect && (
                            <div className="plan-station-alert" style={{ margin: "4px 0 0 0", padding: "4px 8px", fontSize: "0.75rem", borderRadius: "6px" }}>
                              <Info size={14} />
                              <span>
                                Boards/arrives nearby: <strong>{plan.from}</strong>
                                {plan.fromStnDistance > 0 && ` (${plan.fromStnDistance} km from ${plan.fromStnClosestSearchedCode})`}
                                <strong> ➔ {plan.to}</strong>
                                {plan.toStnDistance > 0 && ` (${plan.toStnDistance} km from ${plan.toStnClosestSearchedCode})`}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          ) : (
            <div>
              {(() => {
                const parseDate = (dStr) => {
                  const [d, m, y] = dStr.split("-").map(Number);
                  return new Date(y, m - 1, d);
                };

                const directList = (searchResults.trainBtwnStnsList || []).map(t => ({ ...t, isDirect: true }));
                const nearbyList = (searchResults.nearbyTrains || []).map(t => ({ ...t, isDirect: false }));
                const rawTrains = [...directList, ...nearbyList];

                // Filter all trains by availability and active filters first
                const availableTrains = rawTrains.map(train => {
                  // Apply Route/Type Filter
                  const matchRoute = routeFilter === "ALL" || 
                    (routeFilter === "DIRECT" && train.isDirect) || 
                    (routeFilter === "NEARBY" && !train.isDirect);
                  if (!matchRoute) return null;

                  const gnClasses = (train.avlClasses?.Array || train.avlClasses || []).filter(cls => {
                    const cache = train.avaiblitycache?.[cls] || {};
                    const availability = cache.Availability || "";
                    const matchClass = classFilter === "ALL" || cls === classFilter;
                    return availability && matchClass;
                  });

                  const tqClasses = (train.avlClasses?.Array || train.avlClasses || []).filter(cls => {
                    const cache = train.avaiblitycacheTq?.[cls] || {};
                    const availability = cache.Availability || "";
                    const matchClass = classFilter === "ALL" || cls === classFilter;
                    return availability && matchClass;
                  });

                  const hasGN = gnClasses.length > 0 && (quotaFilter === "ALL" || quotaFilter === "GN");
                  const hasTQ = tqClasses.length > 0 && (quotaFilter === "ALL" || quotaFilter === "TQ");

                  if (hasGN || hasTQ) {
                    return {
                      ...train,
                      filteredGNClasses: hasGN ? gnClasses : [],
                      filteredTQClasses: hasTQ ? tqClasses : []
                    };
                  }
                  return null;
                }).filter(Boolean);

                const matchedRawTrains = rawTrains.filter(train => {
                  return routeFilter === "ALL" || 
                    (routeFilter === "DIRECT" && train.isDirect) || 
                    (routeFilter === "NEARBY" && !train.isDirect);
                });

                if (matchedRawTrains.length === 0) {
                  return <p className="empty-message">No trains found matching the filters in this range.</p>;
                }

                // Sort by Date and Time ascending
                availableTrains.sort((a, b) => {
                  const dateA = parseDate(a.journeyDate);
                  const dateB = parseDate(b.journeyDate);
                  if (dateA.getTime() !== dateB.getTime()) {
                    return dateA - dateB;
                  }
                  return (a.departureTime || "").localeCompare(b.departureTime || "");
                });

                // Get unique dates that actually have matching trains, and make sure user's selected From Date (and To Date if present) are always included
                const uniqueDatesList = targetDates.length > 0 ? [...targetDates] : matchedRawTrains.map(t => t.journeyDate);
                if (doj && !uniqueDatesList.includes(doj)) {
                  uniqueDatesList.push(doj);
                }
                if (endDate && !uniqueDatesList.includes(endDate)) {
                  uniqueDatesList.push(endDate);
                }
                const uniqueDates = Array.from(new Set(uniqueDatesList)).filter(Boolean);
                uniqueDates.sort((a, b) => parseDate(a) - parseDate(b));

                // Fallback to the first date if selectedJourneyDate is not in the list of available dates
                const activeDate = (selectedJourneyDate && uniqueDates.includes(selectedJourneyDate))
                  ? selectedJourneyDate
                  : (uniqueDates.length > 0 ? uniqueDates[0] : "");

                const filteredTrains = availableTrains.filter(t => t.journeyDate === activeDate);

                return (
                  <div>
                    {uniqueDates.length > 0 && (
                      <div className="date-tabs-container">
                        {uniqueDates.map(dStr => {
                          const dateObj = parseDate(dStr);
                          const dayName = dateObj.toLocaleDateString("en-IN", { weekday: "short" });
                          const dayNum = dateObj.getDate();
                          const monthName = dateObj.toLocaleDateString("en-IN", { month: "short" });
                          const isSelected = activeDate === dStr;
                          
                          const isLoaded = loadedDates.includes(dStr);
                          const avail = isLoaded ? getDateAvailability(dStr, matchedRawTrains) : { text: "Loading...", type: "loading" };
                          
                          return (
                            <button
                              key={dStr}
                              type="button"
                              className={`date-tab ${isSelected ? "active" : ""} tab-status-${avail.type}`}
                              onClick={() => setSelectedJourneyDate(dStr)}
                            >
                              <span className="date-tab-day">{dayName}</span>
                              <span className="date-tab-num">{dayNum}</span>
                              <span className="date-tab-month">{monthName}</span>
                              <span className={`date-tab-status status-text-${avail.type}`}>
                                {avail.text}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {!loadedDates.includes(activeDate) ? (
                      <div className="loader-container" style={{ padding: "40px 0" }}>
                        <div className="spinner" style={{ width: "30px", height: "30px" }}></div>
                        <p className="subtitle" style={{ fontSize: "0.9rem" }}>Loading train availability for {activeDate}...</p>
                      </div>
                    ) : filteredTrains.length === 0 ? (
                      <p className="empty-message">No trains with available seats found on {activeDate}.</p>
                    ) : (
                      <div className="train-list">
                        {filteredTrains.map((train, tIndex) => {
                          const gnClasses = train.filteredGNClasses || [];
                          const tqClasses = train.filteredTQClasses || [];

                          return (
                        <div className="train-card" key={`${train.trainNumber}-${train.journeyDate}-${tIndex}`}>
                          <div className="train-card-header">
                            <div className="train-info" style={{ flex: "1 1 200px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "2px" }}>
                                <span className="train-number" style={{ background: "rgba(124, 58, 237, 0.08)", color: "var(--accent-purple)", padding: "2px 6px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: "700" }}>{train.trainNumber}</span>
                                <span className="quota-badge date-badge" style={{ fontSize: "0.7rem", padding: "2px 6px" }}>{train.journeyDate}</span>
                                <span className={`quota-badge ${train.isDirect ? 'quota-gn' : 'quota-tq'}`} style={{ fontSize: "0.7rem", padding: "2px 6px" }}>
                                  {train.isDirect ? 'Direct' : 'Nearby'}
                                </span>
                              </div>
                              <h4 className="train-name" style={{ margin: "2px 0", fontSize: "0.95rem", fontWeight: "700" }}>{train.trainName}</h4>
                                  <div className="running-days-container">
                                    {[
                                      { key: 'M', active: train.runningMon === 'Y' },
                                      { key: 'T', active: train.runningTue === 'Y' },
                                      { key: 'W', active: train.runningWed === 'Y' },
                                      { key: 'T', active: train.runningThu === 'Y' },
                                      { key: 'F', active: train.runningFri === 'Y' },
                                      { key: 'S', active: train.runningSat === 'Y' },
                                      { key: 'S', active: train.runningSun === 'Y' },
                                    ].map((day, idx) => (
                                      <span 
                                        key={idx} 
                                        className={`running-day-dot ${day.active ? 'active' : ''}`}
                                        title={`${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][idx]}: ${day.active ? 'Runs' : 'Does not run'}`}
                                      >
                                        {day.key}
                                      </span>
                                    ))}
                                  </div>
                            </div>
                            
                            <div className="plan-route-info" style={{ flex: "2 1 240px", marginTop: 0 }}>
                              <div className="time-info">
                                <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                                  <span className="time-value" style={{ fontSize: "1.15rem", fontWeight: "700" }}>{train.departureTime}</span>
                                  <span className="station-label" style={{ fontWeight: "700", color: "var(--text-primary)", fontSize: "0.8rem" }}>{train.fromStnCode}</span>
                                </div>
                                <span className="station-label" style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block" }}>{train.journeyDate}</span>
                                {train.fromStnDistance > 0 && (
                                  <span style={{ fontSize: "0.65rem", color: "var(--accent-orange)", fontWeight: "600", display: "block", marginTop: "2px" }}>
                                    ({train.fromStnDistance} km from {train.fromStnClosestSearchedCode})
                                  </span>
                                )}
                              </div>
                              
                              <div className="duration-info" style={{ flexGrow: 1, maxWidth: "120px" }}>
                                <span className="duration-value" style={{ fontSize: "0.75rem" }}>{train.duration}</span>
                                <div className="duration-line" style={{ margin: "1px 0" }}></div>
                              </div>
                              
                              <div className="time-info" style={{ textAlign: "right" }}>
                                <div style={{ display: "flex", alignItems: "baseline", gap: "4px", justifyContent: "flex-end" }}>
                                  <span className="station-label" style={{ fontWeight: "700", color: "var(--text-primary)", fontSize: "0.8rem" }}>{train.toStnCode}</span>
                                  <span className="time-value" style={{ fontSize: "1.15rem", fontWeight: "700" }}>{train.arrivalTime}</span>
                                </div>
                                <span className="station-label" style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "block" }}>{calculateArrivalDate(train.journeyDate, train.departureTime, train.duration)}</span>
                                {train.toStnDistance > 0 && (
                                  <span style={{ fontSize: "0.65rem", color: "var(--accent-orange)", fontWeight: "600", display: "block", marginTop: "2px" }}>
                                    ({train.toStnDistance} km from {train.toStnClosestSearchedCode})
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Class Availability Selection */}
                          <div className="quota-sections-container" style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px", gridColumn: "1 / -1" }}>
                            {/* General Quota Group */}
                            {gnClasses.length > 0 && (
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                                  <span className="quota-section-title" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: "700", color: "var(--text-secondary)" }}>GN</span>
                                  <div style={{ height: "1px", backgroundColor: "var(--glass-border)", flexGrow: 1 }}></div>
                                </div>
                                <div className="classes-container" style={{ display: "flex", flexWrap: "wrap", gap: "6px", borderTop: "none", paddingTop: 0, marginTop: 0 }}>
                                  {gnClasses.map((cls) => {
                                    const cache = train.avaiblitycache?.[cls] || {};
                                    const availability = cache.Availability || "";
                                    const prediction = cache.Prediction || "";
                                    
                                    return (
                                      <a 
                                        href={`https://www.confirmtkt.com/rbooking/trains/from/${train.fromStnCode}/to/${train.toStnCode}/${train.journeyDate}?trainNo=${train.trainNumber}&class=${cls}&quota=GN`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`class-chip status-${getStatusType(availability)}`} 
                                        key={`GN-${cls}`}
                                        style={{ textDecoration: "none" }}
                                        title="Click to Book Ticket on ConfirmTkt"
                                      >
                                        <div className="class-header">
                                          <span className="class-name-label">{cls}</span>
                                          {cache.Fare && <span className="class-fare-label">₹{cache.Fare}</span>}
                                        </div>
                                        <div className="class-availability">
                                          {cleanAvailabilityStatus(availability)}
                                        </div>
                                        {prediction && prediction !== "Available" && prediction !== "NOT AVAILABLE" && !prediction.includes("AVAILABLE") && (
                                          <div className="class-prediction-label">
                                            Chance: {prediction}
                                          </div>
                                        )}
                                      </a>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Tatkal Quota Group */}
                            {tqClasses.length > 0 && (
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                                  <span className="quota-section-title" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: "700", color: "#ff6e00" }}>TQ</span>
                                  <div style={{ height: "1px", backgroundColor: "rgba(255, 110, 0, 0.2)", flexGrow: 1 }}></div>
                                </div>
                                <div className="classes-container" style={{ display: "flex", flexWrap: "wrap", gap: "6px", borderTop: "none", paddingTop: 0, marginTop: 0 }}>
                                  {tqClasses.map((cls) => {
                                    const cache = train.avaiblitycacheTq?.[cls] || {};
                                    const availability = cache.Availability || "";
                                    const prediction = cache.Prediction || "";
                                    
                                    return (
                                      <a 
                                        href={`https://www.confirmtkt.com/rbooking/trains/from/${train.fromStnCode}/to/${train.toStnCode}/${train.journeyDate}?trainNo=${train.trainNumber}&class=${cls}&quota=TQ`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`class-chip status-${getStatusType(availability)}`} 
                                        key={`TQ-${cls}`}
                                        style={{ textDecoration: "none" }}
                                        title="Click to Book Ticket on ConfirmTkt"
                                      >
                                        <div className="class-header">
                                          <span className="class-name-label">{cls}</span>
                                          {cache.Fare && <span className="class-fare-label">₹{cache.Fare}</span>}
                                        </div>
                                        <div className="class-availability">
                                          {cleanAvailabilityStatus(availability)}
                                        </div>
                                        {prediction && prediction !== "Available" && prediction !== "NOT AVAILABLE" && !prediction.includes("AVAILABLE") && (
                                          <div className="class-prediction-label">
                                            Chance: {prediction}
                                          </div>
                                        )}
                                      </a>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
          )}
        </section>
      )}

        {/* Application Footer */}
        <footer className="app-footer">
          <div className="app-footer-inner">
            <div className="footer-brand-line">
              <span>Built by</span>
              <span className="footer-dsk-badge">DSK</span>
              <span className="footer-divider-dot">•</span>
              <span className="footer-app-title">RailSaathi 2.0</span>
            </div>
            <div className="footer-meta-links">
              <span>Indian Railways Intelligence &amp; Seat Swap Hub • © {new Date().getFullYear()} DSK</span>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={
      <div className="loader-container">
        <div className="spinner"></div>
        <p className="subtitle">Loading results content...</p>
      </div>
    }>
      <ResultsContent />
    </Suspense>
  );
}
