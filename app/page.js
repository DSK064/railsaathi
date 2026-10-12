"use client";

import { useState, useEffect, useRef, Fragment } from "react";
import { 
  Train, 
  Search, 
  FileText, 
  MapPin, 
  Calendar, 
  Clock, 
  AlertCircle, 
  ChevronRight, 
  ChevronDown,
  ArrowUpDown,
  ArrowLeftRight,
  Users,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Send,
  Sparkles,
  ShieldCheck,
  PlusCircle,
  Info,
  Layers,
  ArrowRight
} from "lucide-react";
import { STATIONS } from "./data/stations";


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
    const [year, month, day] = str.split("-").map(Number);
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

const getSuggestionsForValue = (val) => {
  if (!val || val.trim().length === 0) return [];
  let query = val.toLowerCase().trim();

  // If query contains a hyphen (from selected format "CODE - Name"), extract the code/name to search
  if (query.includes(" - ")) {
    const parts = query.split(" - ");
    query = (parts[0] || "").trim() || (parts[1] || "").trim();
  }

  // Find standard matching stations
  const matched = STATIONS.filter(s => 
    s.code.toLowerCase().includes(query) || 
    s.name.toLowerCase().includes(query) ||
    s.city.toLowerCase().includes(query)
  );

  // Group matched stations by city to see if there are cities with multiple matching stations
  const cityGroups = {};
  matched.forEach(s => {
    if (s.city) {
      if (!cityGroups[s.city]) cityGroups[s.city] = [];
      cityGroups[s.city].push(s);
    }
  });

  const virtualSuggestions = [];
  
  // For each city that has matched, find ALL stations in the entire database belonging to that city
  Object.keys(cityGroups).forEach(cityName => {
    const allCityStations = STATIONS.filter(s => s.city.toLowerCase() === cityName.toLowerCase());
    if (allCityStations.length > 1) {
      const codes = allCityStations.map(s => s.code).join(",");
      if (!virtualSuggestions.some(v => v.city.toLowerCase() === cityName.toLowerCase())) {
        virtualSuggestions.push({
          code: codes,
          name: `All ${cityName} Stations`,
          city: cityName,
          isAll: true
        });
      }
    }
  });

  const standardSuggestions = matched.slice(0, 6);
  return [...virtualSuggestions, ...standardSuggestions];
};

// Premium Custom Icon: walking traveler pulling suitcase + train front silhouette
const TravelerTrainIcon = ({ className, size = 20 }) => (
  <svg 
    viewBox="0 0 32 24" 
    width={size} 
    height={size} 
    className={className}
    fill="none" 
    stroke="currentColor" 
    strokeWidth="1.8" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    style={{ display: "inline-block", verticalAlign: "middle" }}
  >
    {/* Passenger walking with suitcase (left) */}
    <g transform="translate(1, 2)">
      {/* Head */}
      <circle cx="4" cy="3.5" r="1.2" />
      {/* Torso/Body */}
      <path d="M4,4.7 L2.5,9.5 M2.5,9.5 L1,15.5 M2.5,9.5 L4.5,15.5" />
      {/* Arm pulling bag */}
      <path d="M4,6.2 L6.5,10.2 L8.5,9.2" />
      {/* Arm swinging forward */}
      <path d="M4,6.2 L2,8.5" />
      {/* Suitcase */}
      <rect x="7" y="9.2" width="3.2" height="4.8" rx="0.5" transform="rotate(-15 7 9.2)" />
      <path d="M9,9.2 L9.3,6.8" transform="rotate(-15 7 9.2)" />
      {/* Wheels */}
      <circle cx="8" cy="15" r="0.5" fill="currentColor" />
    </g>
    {/* Train front view (right) */}
    <g transform="translate(15, 1)">
      <rect x="1" y="2" width="13" height="16" rx="3" />
      {/* Windshield */}
      <line x1="2.5" y1="6" x2="12.5" y2="6" />
      <line x1="7.5" y1="2" x2="7.5" y2="6" />
      {/* Tracks underneath */}
      <line x1="0" y1="20" x2="15" y2="20" />
      <line x1="2.5" y1="20" x2="0.5" y2="22.5" />
      <line x1="12.5" y1="20" x2="14.5" y2="22.5" />
      {/* Lights */}
      <circle cx="4.2" cy="14.5" r="0.8" fill="currentColor" />
      <circle cx="10.8" cy="14.5" r="0.8" fill="currentColor" />
    </g>
  </svg>
);

// Helper to parse coach positions
const parseCoachPosition = (coachStr) => {
  if (!coachStr) return [];
  // Split by comma if present, otherwise by spaces
  const delimiter = coachStr.includes(',') ? ',' : /\s+/;
  return coachStr.split(delimiter)
    .map(c => c.trim())
    .filter(Boolean)
    .map(c => {
      if (c.includes(':')) {
        const [type, label] = c.split(':');
        return { type: type || 'GS', label: label || type };
      }
      
      // Smart type guessing based on standard Indian Railways coach naming conventions
      let type = c;
      let label = c;
      const cUpper = c.toUpperCase();
      if (cUpper.startsWith('S') && !isNaN(cUpper.slice(1)) && cUpper !== 'SL') {
        type = 'SL';
      } else if ((cUpper.startsWith('B') || cUpper.startsWith('A') || cUpper.startsWith('M') || cUpper.startsWith('H')) && !isNaN(cUpper.slice(1))) {
        type = 'AC';
      } else if (cUpper.startsWith('GS') || cUpper.startsWith('GEN') || cUpper.startsWith('UR')) {
        type = 'GS';
      } else if (cUpper === 'ENG' || cUpper === 'EN' || cUpper === 'LOCO' || cUpper === 'DHNE') {
        type = 'En';
      }
      return { type, label };
    });
};


export default function Home() {
  const [activeTab, setActiveTab] = useState("search");
  const [viewMode, setViewMode] = useState("ranked");
  
  // Loading & Error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Tab 1: Trains Search & Availability
  const [searchFrom, setSearchFrom] = useState("");
  const [searchFromText, setSearchFromText] = useState("");
  const [searchTo, setSearchTo] = useState("");
  const [searchToText, setSearchToText] = useState("");
  const [searchDate, setSearchDate] = useState("");
  const [searchToDate, setSearchToDate] = useState("");
  const [searchResults, setSearchResults] = useState(null);
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

  const plans = searchResults ? generateJourneyPlans(searchResults, searchDate) : [];
  const availableQuotas = Array.from(new Set(plans.map(p => p.quota))).filter(Boolean);
  const availableClasses = Array.from(new Set(plans.map(p => p.class))).filter(Boolean).sort();
  
  // Tab 2: PNR Status
  const [pnrNumber, setPnrNumber] = useState("");
  const [pnrResults, setPnrResults] = useState(null);
  
  // Tab 3: Live Running Status
  const [liveTrainNo, setLiveTrainNo] = useState("");
  const [liveDate, setLiveDate] = useState("");
  const [liveResults, setLiveResults] = useState(null);
  
  // Tab 4: Train Schedule
  const [scheduleTrainNo, setScheduleTrainNo] = useState("");
  const [scheduleResults, setScheduleResults] = useState(null);
  const [expandedScheduleStns, setExpandedScheduleStns] = useState({});

  // Tab 5: Seat Swap (Travel Together)
  const [swapSubMode, setSwapSubMode] = useState("browse"); // "browse" | "create"
  const [swapsList, setSwapsList] = useState([]);
  const [mySwapIds, setMySwapIds] = useState([]);
  const [swapFilterTrain, setSwapFilterTrain] = useState("");
  const [swapFilterDate, setSwapFilterDate] = useState("");
  const [swapFilterClass, setSwapFilterClass] = useState("ALL");
  const [swapFilterCoach, setSwapFilterCoach] = useState("");
  const [swapStatusFilter, setSwapStatusFilter] = useState("ALL"); // "ALL" | "OPEN" | "MATCHED" | "MINE"

  // Create Swap Request Form State
  const [swapEntryMode, setSwapEntryMode] = useState("pnr"); // "pnr" | "manual"
  const [swapPnrInput, setSwapPnrInput] = useState("");
  const [swapPnrLoading, setSwapPnrLoading] = useState(false);
  const [swapPnrPassengers, setSwapPnrPassengers] = useState([]);
  const [swapPnrVerified, setSwapPnrVerified] = useState(false);
  const [swapMaskedPnr, setSwapMaskedPnr] = useState("");
  const [swapSuccessBanner, setSwapSuccessBanner] = useState("");

  const [swapPassengerName, setSwapPassengerName] = useState("");
  const [swapTrainNo, setSwapTrainNo] = useState("");
  const [swapTrainName, setSwapTrainName] = useState("");
  const [swapDoj, setSwapDoj] = useState(""); // yyyy-mm-dd or dd-mm-yyyy
  const [swapFromStn, setSwapFromStn] = useState("");
  const [swapToStn, setSwapToStn] = useState("");
  const [swapTravelClass, setSwapTravelClass] = useState("3A");
  const [swapCurrentCoach, setSwapCurrentCoach] = useState("");
  const [swapCurrentBerth, setSwapCurrentBerth] = useState("");
  const [swapCurrentBerthType, setSwapCurrentBerthType] = useState("LB");
  const [swapTargetCoach, setSwapTargetCoach] = useState("");
  const [swapTargetBerthType, setSwapTargetBerthType] = useState("ANY");
  const [swapFamilyCoach, setSwapFamilyCoach] = useState("");
  const [swapFamilyBerths, setSwapFamilyBerths] = useState("");
  const [swapReasonCategory, setSwapReasonCategory] = useState("FAMILY_SPLIT");
  const [swapNote, setSwapNote] = useState("");

  // Offer & In-App Chat State
  const [activeOfferSwapId, setActiveOfferSwapId] = useState(null);
  const [offerResponderName, setOfferResponderName] = useState("");
  const [offerCoach, setOfferCoach] = useState("");
  const [offerBerth, setOfferBerth] = useState("");
  const [offerBerthType, setOfferBerthType] = useState("UB");
  const [offerMessage, setOfferMessage] = useState("");
  const [expandedChatSwapIds, setExpandedChatSwapIds] = useState({ "swap-seed-1": true });
  const [chatInputs, setChatInputs] = useState({});
  const [chatSenderNames, setChatSenderNames] = useState({});
  const [chatSenderRoles, setChatSenderRoles] = useState({});

  const REASON_OPTIONS = [
    { id: "FAMILY_SPLIT", label: "👨‍👩‍👧‍👦 Family / Friends Split Across Coaches" },
    { id: "SENIOR_CITIZEN", label: "👴 Senior Citizen Needs Lower Berth" },
    { id: "MEDICAL_INFANT", label: "🤱 Traveling with Infant / Medical Need" },
    { id: "BERTH_PREF", label: "🪟 Berth / Same-Bay Preference" }
  ];

  const toggleIntermediate = (stnCode) => {
    setExpandedScheduleStns(prev => ({
      ...prev,
      [stnCode]: !prev[stnCode]
    }));
  };

  const handleLoadDemoPnr = () => {
    setPnrResults({
      TrainNo: "12626",
      TrainName: "Kerala Express",
      Doj: "28-06-2026",
      BookingDate: "10-05-2026",
      Quota: "GN",
      From: "NDLS",
      To: "TVC",
      BoardingPoint: "NDLS",
      ReservationUpto: "TVC",
      Class: "3A",
      ChartPrepared: false,
      BoardingStationName: "New Delhi",
      ReservationUptoName: "Trivandrum Central",
      PassengerCount: 2,
      PassengerStatus: [
        { Number: 1, BookingStatus: "CNF/B4/12/LB", CurrentStatus: "CNF", Coach: "B4", Berth: 12, BerthType: "LB", Prediction: "100%", ConfirmTktStatus: "Confirmed" },
        { Number: 2, BookingStatus: "CNF/B2/19/LB", CurrentStatus: "CNF", Coach: "B2", Berth: 19, BerthType: "LB", Prediction: "100%", ConfirmTktStatus: "Confirmed" }
      ],
      DepartureTime: "20:10",
      ArrivalTime: "21:50",
      Duration: "49:40",
      ExpectedPlatformNo: "3",
      BookingFare: "2850",
      TicketFare: "2850",
      CoachPosition: ",En:,GS:,GS:A2,2A:A1,2A:B4,3A:B3,3A:B2,3A:B1,3A:M2,3E:M1,3E:S6,SL:,PC:S5,SL:S4,SL:S3,SL:S2,SL:S1,SL:,GS:,GS:",
      Rating: 3.8,
      FoodRating: 3.6,
      PunctualityRating: 3.9,
      CleanlinessRating: 3.9,
      SourceName: "New Delhi",
      DestinationName: "Trivandrum Central",
      HasPantry: true
    });
    setError(null);
  };

  // Autocomplete suggestions states
  const [fromSuggestions, setFromSuggestions] = useState([]);
  const [toSuggestions, setToSuggestions] = useState([]);
  const [showFrom, setShowFrom] = useState(false);
  const [showTo, setShowTo] = useState(false);

  const hasResults = 
    (activeTab === "search" && searchResults) ||
    (activeTab === "pnr" && pnrResults) ||
    (activeTab === "status" && liveResults) ||
    (activeTab === "schedule" && scheduleResults) ||
    activeTab === "swap";

  const tabOptions = [
    { id: "search", label: "Search Trains", icon: <Search size={18} /> },
    { id: "pnr", label: "PNR Status", icon: <FileText size={18} /> },
    { id: "status", label: "Live Running", icon: <MapPin size={18} /> },
    { id: "schedule", label: "Train Schedule", icon: <Clock size={18} /> },
    { id: "swap", label: "Seat Swap (Travel Together)", icon: <ArrowLeftRight size={18} />, featured: true }
  ];

  const activeOption = tabOptions.find(opt => opt.id === activeTab) || tabOptions[0];

  const handleFromChange = (val) => {
    setSearchFromText(val);
    setSearchFrom(val.toUpperCase());
    if (val.trim().length > 0) {
      const filtered = getSuggestionsForValue(val);
      setFromSuggestions(filtered);
      setShowFrom(true);
    } else {
      setFromSuggestions([]);
      setShowFrom(false);
    }
  };

  const handleToChange = (val) => {
    setSearchToText(val);
    setSearchTo(val.toUpperCase());
    if (val.trim().length > 0) {
      const filtered = getSuggestionsForValue(val);
      setToSuggestions(filtered);
      setShowTo(true);
    } else {
      setToSuggestions([]);
      setShowTo(false);
    }
  };


  // Date formatter (yyyy-mm-dd to dd-mm-yyyy)
  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    return `${day}-${month}-${year}`;
  };

  // Switch stations
  const handleSwapStations = () => {
    const tempCode = searchFrom;
    const tempText = searchFromText;
    setSearchFrom(searchTo);
    setSearchFromText(searchToText);
    setSearchTo(tempCode);
    setSearchToText(tempText);
  };

  // Fetch API handlers
  const handleSearchTrains = async (e) => {
    e.preventDefault();
    if (!searchFrom || !searchTo || !searchDate) {
      setError("Please fill in all search fields");
      return;
    }

    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    if (isMobile) {
      let resultsUrl = `/results?src=${searchFrom}&dest=${searchTo}&doj=${formatDate(searchDate)}`;
      if (searchToDate) {
        resultsUrl += `&endDate=${formatDate(searchToDate)}`;
      }
      window.open(resultsUrl, '_blank');
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
    setViewMode("ranked");
    setQuotaFilter("ALL");
    setClassFilter("ALL");
    setRouteFilter("ALL");
    setSelectedJourneyDate(formatDate(searchDate));

    // Transaction ID to prevent race conditions
    searchIdRef.current += 1;
    const currentSearchId = searchIdRef.current;

    // Helper to fetch a single date
    const fetchSingleDate = async (dateStr) => {
      const url = `/api/trains?src=${searchFrom}&dest=${searchTo}&doj=${dateStr}&endDate=${dateStr}`;
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

    try {
      if (searchToDate) {
        // Range search
        const d1 = new Date(searchDate);
        const d2 = new Date(searchToDate);
        d1.setHours(0,0,0,0);
        d2.setHours(0,0,0,0);
        
        if (d2 < d1) {
          setError("To Date cannot be before From Date.");
          setLoading(false);
          return;
        }
        
        const diffTime = Math.abs(d2 - d1);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        
        if (diffDays > 60) {
          setError("Please select a date range of 60 days or less.");
          setLoading(false);
          return;
        }

        const datesRange = getDatesInRange(formatDate(searchDate), formatDate(searchToDate));
        setTargetDates(datesRange);
        setLoadingStatus(`Loading ${datesRange.length} dates progressively...`);

        // Load base date first
        const baseDoj = formatDate(searchDate);
        setLoadingStatus(`Connecting to IRCTC for ${baseDoj}...`);
        await loadBatch([baseDoj]);
        
        // Hide global screen loading spinner since the first results are ready
        setLoading(false);

        // Load remaining dates in parallel background
        const remainingDates = datesRange.filter(d => d !== baseDoj);
        if (remainingDates.length > 0) {
          loadBatch(remainingDates);
        }

      } else {
        // Single Date Search (Weekly lookup progressively)
        const baseDoj = formatDate(searchDate);
        setTargetDates([baseDoj]);
        setLoadingStatus(`Checking availability for ${baseDoj}...`);
        
        // 1. Fetch exact date first
        const seatsFoundOnBaseDoj = await loadBatch([baseDoj]);
        setLoading(false); // Hide the screen spinner

        if (seatsFoundOnBaseDoj) {
          return;
        }

        // 2. Fetch remaining days of Week 1
        const week1Rest = getWeekDates(baseDoj, 0).filter(d => d !== baseDoj);
        setTargetDates(prev => [...prev, ...week1Rest]);
        setLoadingStatus(`No seats found on ${baseDoj}. Searching remaining Week 1 dates...`);
        const seatsFoundInWeek1 = await loadBatch(week1Rest);
        
        if (seatsFoundInWeek1) {
          return;
        }

        // 3. Search Week 2, 3, 4 sequentially until seats are found
        for (let w = 1; w < 4; w++) {
          if (currentSearchId !== searchIdRef.current) return;
          setSearchedWeeks(w + 1);
          
          const weekDates = getWeekDates(baseDoj, w);
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

  const handleCheckPNR = async (e) => {
    e.preventDefault();
    if (pnrNumber.length !== 10) {
      setError("Please enter a valid 10-digit PNR number");
      return;
    }
    setLoading(true);
    setError(null);
    setPnrResults(null);

    try {
      const res = await fetch(`/api/pnr?pnr=${pnrNumber}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setPnrResults(data);
      }
    } catch (err) {
      setError("Failed to query PNR status.");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckLiveStatus = async (e) => {
    e.preventDefault();
    if (!liveTrainNo || !liveDate) {
      setError("Please fill in both Train Number and Date fields");
      return;
    }
    setLoading(true);
    setError(null);
    setLiveResults(null);

    const formattedDate = formatDate(liveDate);
    try {
      const res = await fetch(`/api/status?trainNo=${liveTrainNo}&doj=${formattedDate}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setLiveResults(data);
      }
    } catch (err) {
      setError("Failed to fetch running status.");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckSchedule = async (e) => {
    e.preventDefault();
    if (!scheduleTrainNo) {
      setError("Please enter a Train Number");
      return;
    }
    setLoading(true);
    setError(null);
    setScheduleResults(null);

    // Get today's date in dd-mm-yyyy for schedules
    const today = new Date();
    const formattedDate = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;

    try {
      const res = await fetch(`/api/schedule?trainNo=${scheduleTrainNo}&date=${formattedDate}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setScheduleResults(data);
      }
    } catch (err) {
      setError("Failed to fetch train schedule.");
    } finally {
      setLoading(false);
    }
  };

  // ================= SEAT SWAP HANDLERS =================
  const fetchSwaps = async () => {
    try {
      const res = await fetch("/api/swaps");
      const data = await res.json();
      if (data.swaps) {
        setSwapsList(data.swaps);
      }
    } catch (err) {
      console.error("Failed to fetch swap requests:", err);
    }
  };

  useEffect(() => {
    fetchSwaps();
    try {
      const savedMyIds = JSON.parse(localStorage.getItem("railsaathi_my_swaps") || "[]");
      if (Array.isArray(savedMyIds)) setMySwapIds(savedMyIds);
    } catch (e) {
      // ignore localStorage read errors
    }
  }, []);

  const populateSwapFormFromPnrData = (pnrData, rawPnrStr = "") => {
    if (!pnrData) return;
    setSwapTrainNo(pnrData.TrainNo || "");
    setSwapTrainName(pnrData.TrainName || "");
    if (pnrData.Doj) {
      // Convert dd-mm-yyyy to yyyy-mm-dd for date input
      const parts = pnrData.Doj.split("-");
      if (parts.length === 3 && parts[0].length === 2) {
        setSwapDoj(`${parts[2]}-${parts[1]}-${parts[0]}`);
      } else {
        setSwapDoj(pnrData.Doj);
      }
    }
    setSwapFromStn(pnrData.BoardingPoint || pnrData.From || "");
    setSwapToStn(pnrData.ReservationUpto || pnrData.To || "");
    if (pnrData.Class) setSwapTravelClass(pnrData.Class);

    const pList = pnrData.PassengerStatus || pnrData.passengerList || [];
    setSwapPnrPassengers(pList);
    setSwapPnrVerified(true);
    const cleanPnr = String(rawPnrStr || "4829103821");
    setSwapMaskedPnr(cleanPnr.length === 10 ? `${cleanPnr.slice(0, 4)}****${cleanPnr.slice(8)}` : "PNR-Verified");

    if (pList.length > 0) {
      const firstPax = pList[0];
      const coach = firstPax.Coach || (firstPax.BookingStatus?.split("/")[1]) || "B4";
      const berth = firstPax.Berth || (firstPax.BookingStatus?.split("/")[2]) || "12";
      const bType = firstPax.BerthType || (firstPax.BookingStatus?.split("/")[3]) || "LB";
      setSwapCurrentCoach(String(coach).toUpperCase());
      setSwapCurrentBerth(String(berth));
      if (["LB", "MB", "UB", "SL", "SU", "WS", "AS"].includes(String(bType).toUpperCase())) {
        setSwapCurrentBerthType(String(bType).toUpperCase());
      }
      // If there's a second passenger in a different coach, pre-fill targetCoach & familyContext!
      if (pList.length > 1) {
        const secondPax = pList[1];
        const secondCoach = secondPax.Coach || (secondPax.BookingStatus?.split("/")[1]) || "";
        const secondBerth = secondPax.Berth || (secondPax.BookingStatus?.split("/")[2]) || "";
        if (secondCoach && secondCoach !== coach) {
          setSwapTargetCoach(String(secondCoach).toUpperCase());
          setSwapFamilyCoach(String(secondCoach).toUpperCase());
          if (secondBerth) setSwapFamilyBerths(String(secondBerth));
          setSwapReasonCategory("FAMILY_SPLIT");
          setSwapNote(`Family member is allotted Coach ${secondCoach} Berth #${secondBerth}. Looking to swap my ${coach} Berth #${berth} so we can travel together in the same coach.`);
        }
      }
    }
  };

  const handleFetchPnrForSwap = async () => {
    if (swapPnrInput.length !== 10) {
      setError("Please enter a valid 10-digit PNR number to auto-fill journey details, or click 'Load Sample Split-Coach PNR'.");
      return;
    }
    setSwapPnrLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pnr?pnr=${swapPnrInput}`);
      const data = await res.json();
      if (data.error || data.Error) {
        setError(`PNR Status: ${data.error || data.Error}. You can click 'Load Sample Split-Coach PNR' below or switch to Manual Entry.`);
      } else {
        populateSwapFormFromPnrData(data, swapPnrInput);
      }
    } catch (err) {
      setError("Could not reach PNR service. Please try 'Load Sample Split-Coach PNR' or Manual Entry.");
    } finally {
      setSwapPnrLoading(false);
    }
  };

  const handleLoadSampleSplitPnrForSwap = () => {
    setError(null);
    const demoData = {
      TrainNo: "12626",
      TrainName: "Kerala Express",
      Doj: "28-06-2026",
      From: "NDLS",
      To: "TVC",
      BoardingPoint: "NDLS",
      ReservationUpto: "TVC",
      Class: "3A",
      PassengerStatus: [
        { Number: 1, BookingStatus: "CNF/B4/12/LB", CurrentStatus: "CNF", Coach: "B4", Berth: 12, BerthType: "LB" },
        { Number: 2, BookingStatus: "CNF/B2/19/LB", CurrentStatus: "CNF", Coach: "B2", Berth: 19, BerthType: "LB" }
      ]
    };
    setSwapPnrInput("4829104512");
    populateSwapFormFromPnrData(demoData, "4829104512");
  };

  const handleJumpToSwapFromPnrTab = () => {
    if (pnrResults) {
      populateSwapFormFromPnrData(pnrResults, pnrNumber || "4829104512");
    }
    setActiveTab("swap");
    setSwapSubMode("create");
    setError(null);
  };

  const handleAutoFetchTrainInfoForSwap = async () => {
    if (!swapTrainNo || swapTrainNo.length < 4) return;
    try {
      const today = new Date();
      const formattedDate = `${String(today.getDate()).padStart(2, "0")}-${String(today.getMonth() + 1).padStart(2, "0")}-${today.getFullYear()}`;
      const res = await fetch(`/api/schedule?trainNo=${swapTrainNo}&date=${formattedDate}`);
      const data = await res.json();
      if (data && data.TrainName) {
        setSwapTrainName(data.TrainName);
        if (!swapFromStn && data.SourceCode) setSwapFromStn(data.SourceCode);
        if (!swapToStn && data.DestinationCode) setSwapToStn(data.DestinationCode);
      }
    } catch (err) {
      // silent fallback
    }
  };

  const handleCreateSwapRequest = async (e) => {
    e.preventDefault();
    setError(null);
    setSwapSuccessBanner("");

    if (!swapPassengerName || !swapTrainNo || !swapDoj || !swapCurrentCoach || !swapCurrentBerth) {
      setError("Please fill in Passenger Name, Train Number, Journey Date, Current Coach, and Current Berth.");
      return;
    }

    const formattedDoj = swapDoj.includes("-") && swapDoj.split("-")[0].length === 4
      ? formatDate(swapDoj)
      : swapDoj;

    const reasonObj = REASON_OPTIONS.find(r => r.id === swapReasonCategory) || REASON_OPTIONS[0];

    try {
      const res = await fetch("/api/swaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE_SWAP",
          passengerName: swapPassengerName,
          pnrVerified: swapPnrVerified,
          maskedPnr: swapMaskedPnr || null,
          trainNo: swapTrainNo,
          trainName: swapTrainName || `Train #${swapTrainNo}`,
          doj: formattedDoj,
          fromStn: swapFromStn || "ORIGIN",
          toStn: swapToStn || "DEST",
          travelClass: swapTravelClass,
          currentCoach: swapCurrentCoach,
          currentBerth: swapCurrentBerth,
          currentBerthType: swapCurrentBerthType,
          targetCoach: swapTargetCoach || "ANY",
          targetBerthType: swapTargetBerthType || "ANY",
          familyContextCoach: swapFamilyCoach,
          familyContextBerths: swapFamilyBerths,
          reasonCategory: swapReasonCategory,
          reasonLabel: reasonObj.label.replace(/^[^\s]+\s/, ""),
          note: swapNote
        })
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      if (data.swaps) setSwapsList(data.swaps);
      if (data.swap?.id) {
        const updatedMyIds = [data.swap.id, ...mySwapIds];
        setMySwapIds(updatedMyIds);
        try {
          localStorage.setItem("railsaathi_my_swaps", JSON.stringify(updatedMyIds));
        } catch (err) {}
        setExpandedChatSwapIds(prev => ({ ...prev, [data.swap.id]: true }));
      }
      setSwapSuccessBanner(`Seat Swap Request posted for ${swapTrainNo} (${swapCurrentCoach} #${swapCurrentBerth} ➔ ${swapTargetCoach || "Any Coach"})!`);
      setSwapSubMode("browse");
    } catch (err) {
      setError("Failed to post swap request. Please try again.");
    }
  };

  const handleSendSwapOffer = async (e, swapId) => {
    e.preventDefault();
    setError(null);
    if (!offerResponderName || !offerCoach || !offerBerth) {
      setError("Please enter your Name, Coach, and Berth Number to propose a swap.");
      return;
    }
    try {
      const res = await fetch("/api/swaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SEND_OFFER",
          swapId,
          responderName: offerResponderName,
          offeredCoach: offerCoach,
          offeredBerth: offerBerth,
          offeredBerthType: offerBerthType,
          message: offerMessage
        })
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      if (data.swaps) setSwapsList(data.swaps);
      setActiveOfferSwapId(null);
      setOfferCoach("");
      setOfferBerth("");
      setOfferMessage("");
      setExpandedChatSwapIds(prev => ({ ...prev, [swapId]: true }));
    } catch (err) {
      setError("Failed to send swap proposal.");
    }
  };

  const handleRespondSwapOffer = async (swapId, offerId, decision) => {
    setError(null);
    try {
      const res = await fetch("/api/swaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RESPOND_OFFER",
          swapId,
          offerId,
          decision
        })
      });
      const data = await res.json();
      if (data.swaps) setSwapsList(data.swaps);
      setExpandedChatSwapIds(prev => ({ ...prev, [swapId]: true }));
    } catch (err) {
      setError("Failed to update offer status.");
    }
  };

  const handleSendSwapChatMessage = async (e, swap) => {
    e.preventDefault();
    const text = (chatInputs[swap.id] || "").trim();
    if (!text) return;
    const role = chatSenderRoles[swap.id] || (mySwapIds.includes(swap.id) ? "REQUESTER" : "RESPONDER");
    const defaultName = role === "REQUESTER"
      ? swap.passengerName
      : (swap.offers?.[0]?.responderName || "Co-Passenger");
    const senderName = (chatSenderNames[swap.id] || defaultName).trim();

    try {
      const res = await fetch("/api/swaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SEND_MESSAGE",
          swapId: swap.id,
          senderName,
          senderRole: role,
          text
        })
      });
      const data = await res.json();
      if (data.swaps) setSwapsList(data.swaps);
      setChatInputs(prev => ({ ...prev, [swap.id]: "" }));
    } catch (err) {
      setError("Failed to send message.");
    }
  };

  const handleQuickCorridorSelect = (fromCode, fromLabel, toCode, toLabel) => {
    setActiveTab("search");
    setSearchFrom(fromCode);
    setSearchFromText(`${fromCode} - ${fromLabel}`);
    setSearchTo(toCode);
    setSearchToText(`${toCode} - ${toLabel}`);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const dd = String(tomorrow.getDate()).padStart(2, "0");
    const dateIso = `${yyyy}-${mm}-${dd}`;
    setSearchDate(dateIso);
    setSearchToDate(dateIso);
  };

  return (
    <>
      {/* Sticky Modern SaaS Application Navbar */}
      <nav className="top-navbar">
        <div className="top-navbar-inner">
          <div className="brand-cluster" onClick={() => setActiveTab("search")}>
            <div className="logo-icon">
              <Train size={22} />
            </div>
            <div className="brand-text-group">
              <div className="logo-text">
                RailSaathi
                <span className="brand-tag-pill">2.0 PRO</span>
              </div>
              <span className="brand-subtext">Indian Railways Intelligence &amp; Seat Swap Hub</span>
            </div>
          </div>

          {/* Primary Segmented Navigation Dock (Desktop) */}
          <div className="nav-tabs-dock">
            {tabOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`nav-tab-item ${opt.featured ? "swap-nav-tab" : ""} ${activeTab === opt.id ? "active" : ""}`}
                onClick={() => {
                  setActiveTab(opt.id);
                  setError(null);
                }}
              >
                {opt.icon}
                <span>{opt.id === "swap" ? "Seat Swap Hub" : opt.label}</span>
                {opt.featured && <span className="swap-new-badge">LIVE</span>}
              </button>
            ))}
          </div>

          {/* Right Status & Quick Action Cluster */}
          <div className="nav-status-cluster">
            <div className="live-network-pill">
              <span className="live-network-dot"></span>
              <span>IRCTC / NTES Live</span>
            </div>
          </div>
        </div>
      </nav>

      <div className="app-container">
        {/* Dynamic Command Hero Banner */}
        <div className="workspace-hero-strip">
          <div>
            <div className="hero-strip-title">
              {activeOption.icon}
              <span>
                {activeTab === "search" && "Smart Train Search & 28-Day Seat Discovery"}
                {activeTab === "pnr" && "Real-Time PNR Confirmation Analytics & Coach Layout"}
                {activeTab === "status" && "Live GPS Train Running Radar & Delay Tracker"}
                {activeTab === "schedule" && "Complete Train Timetable, Rake & Intermediate Halts"}
                {activeTab === "swap" && "Family Seat Swap & Berth Exchange Marketplace"}
              </span>
            </div>
            <p className="hero-strip-subtitle">
              {activeTab === "search" && "Automatically expands within 100 km and scans up to 4 weeks ahead to find confirmed GN & Tatkal seats."}
              {activeTab === "pnr" && "Inspect passenger-wise confirmation probability, platform numbers, ratings, and interactive coach positions."}
              {activeTab === "status" && "Track real-time station arrivals, departures, halt durations, and live delay minutes across India."}
              {activeTab === "schedule" && "Explore full route stops, locomotive direction, coach composition, and passing intermediate stations."}
              {activeTab === "swap" && "Separated from family across coaches or need a lower berth? Swap seats with verified co-passengers via private in-app chat."}
            </p>
          </div>

          <div className="hero-quick-stats">
            <div className="hero-stat-pill">
              <span className="hero-stat-val">100 KM</span>
              <span className="hero-stat-lbl">Geo-Station Radar</span>
            </div>
            <div className="hero-stat-pill">
              <span className="hero-stat-val">{swapsList.length} Active</span>
              <span className="hero-stat-lbl">Live Seat Swaps</span>
            </div>
            <div className="hero-stat-pill">
              <span className="hero-stat-val">GN + TQ</span>
              <span className="hero-stat-lbl">Dual Quota Engine</span>
            </div>
          </div>
        </div>

        {/* Main Workspace Split Layout */}
        <main className="dashboard-card">
          <div className="dashboard-split-layout">
            <div className="layout-left-panel">
              {/* Mobile/Tablet Service Selector Chips */}
              <div className="service-selector-container">
                <div className="service-selector-chips">
                  {tabOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={`service-chip-btn ${opt.featured ? 'swap-featured-chip' : ''} ${activeTab === opt.id ? 'active' : ''}`}
                      onClick={() => {
                        setActiveTab(opt.id);
                        setError(null);
                      }}
                    >
                      {opt.icon}
                      <span>{opt.label}</span>
                      {opt.featured && <span className="swap-new-badge">New</span>}
                    </button>
                  ))}
                </div>
              </div>

              <div className="left-panel-header">
                <div className="left-panel-title">
                  {activeOption.icon}
                  <span>{activeOption.label} Controls</span>
                </div>
                <span className="brand-tag-pill">Instant</span>
              </div>

          {/* Tab Content Panels */}
          <section>
          {/* TAB 1: SEARCH TRAINS */}
          {activeTab === "search" && (
            <form onSubmit={handleSearchTrains}>
              <div className="form-grid">
                <div className="stations-container-unified">
                  <div className="station-input-row form-group-rel">
                    <div className="station-icon-wrapper">
                      <TravelerTrainIcon size={22} />
                    </div>
                    <div className="station-field-wrapper">
                      <input 
                        type="text" 
                        placeholder="From Station" 
                        className="station-input-clean"
                        value={searchFromText}
                        onChange={(e) => handleFromChange(e.target.value)}
                        onBlur={() => {
                          setTimeout(() => {
                            setShowFrom(false);
                            // Auto-format if valid code is entered
                            const match = STATIONS.find(s => s.code.toUpperCase() === searchFrom.toUpperCase());
                            if (match) {
                              setSearchFromText(`${match.code} - ${match.name}`);
                            }
                          }, 200);
                        }}
                        onFocus={(e) => {
                          e.target.select();
                          if (searchFromText.length > 0) setShowFrom(true);
                        }}
                        required
                        autoComplete="off"
                      />
                    </div>
                    {showFrom && fromSuggestions.length > 0 && (
                      <div className="suggestions-dropdown">
                        {fromSuggestions.map((stn) => (
                          <div 
                            key={stn.code} 
                            className="suggestion-item"
                            onMouseDown={() => {
                              setSearchFromText(stn.isAll ? stn.name : `${stn.code} - ${stn.name}`);
                              setSearchFrom(stn.code);
                              setShowFrom(false);
                            }}
                          >
                            <span className="suggestion-name" style={stn.isAll ? { fontWeight: "bold", color: "var(--accent-purple)" } : {}}>
                              {stn.name}
                            </span>
                            <span className="suggestion-code" style={stn.isAll ? { background: "var(--accent-glow)", color: "var(--accent-purple)", padding: "2px 6px", borderRadius: "4px", fontWeight: "bold" } : {}}>
                              {stn.isAll ? "ALL" : stn.code}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="stations-divider-line">
                    <button 
                      type="button" 
                      onClick={handleSwapStations}
                      className="swap-btn-circular"
                      title="Swap Stations"
                    >
                      <ArrowUpDown size={16} className="swap-icon-rotate" />
                    </button>
                  </div>

                  <div className="station-input-row form-group-rel">
                    <div className="station-icon-wrapper">
                      <TravelerTrainIcon size={22} />
                    </div>
                    <div className="station-field-wrapper">
                      <input 
                        type="text" 
                        placeholder="To Station" 
                        className="station-input-clean"
                        value={searchToText}
                        onChange={(e) => handleToChange(e.target.value)}
                        onBlur={() => {
                          setTimeout(() => {
                            setShowTo(false);
                            // Auto-format if valid code is entered
                            const match = STATIONS.find(s => s.code.toUpperCase() === searchTo.toUpperCase());
                            if (match) {
                              setSearchToText(`${match.code} - ${match.name}`);
                            }
                          }, 200);
                        }}
                        onFocus={(e) => {
                          e.target.select();
                          if (searchToText.length > 0) setShowTo(true);
                        }}
                        required
                        autoComplete="off"
                      />
                    </div>
                    {showTo && toSuggestions.length > 0 && (
                      <div className="suggestions-dropdown">
                        {toSuggestions.map((stn) => (
                          <div 
                            key={stn.code} 
                            className="suggestion-item"
                            onMouseDown={() => {
                              setSearchToText(stn.isAll ? stn.name : `${stn.code} - ${stn.name}`);
                              setSearchTo(stn.code);
                              setShowTo(false);
                            }}
                          >
                            <span className="suggestion-name" style={stn.isAll ? { fontWeight: "bold", color: "var(--accent-purple)" } : {}}>
                              {stn.name}
                            </span>
                            <span className="suggestion-code" style={stn.isAll ? { background: "var(--accent-glow)", color: "var(--accent-purple)", padding: "2px 6px", borderRadius: "4px", fontWeight: "bold" } : {}}>
                              {stn.isAll ? "ALL" : stn.code}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="date-range-container">
                  <div className="form-group">
                    <label className="form-label">From Date</label>
                    <input 
                      type="date" 
                      className="form-input"
                      value={searchDate}
                      onChange={(e) => {
                        setSearchDate(e.target.value);
                        if (!searchToDate || searchToDate < e.target.value) {
                          setSearchToDate(e.target.value);
                        }
                      }}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">To Date</label>
                    <input 
                      type="date" 
                      className="form-input"
                      value={searchToDate}
                      onChange={(e) => setSearchToDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>



              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="submit" className="btn-search">
                  <Search size={18} /> Find Trains & Seats
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: PNR STATUS */}
          {activeTab === "pnr" && (
            <form onSubmit={handleCheckPNR}>
              <div className="form-grid">
                <div className="form-group" style={{ gridColumn: "span 2" }}>
                  <label className="form-label">10-Digit PNR Number</label>
                  <input 
                    type="text" 
                    placeholder="Enter PNR number..." 
                    className="form-input"
                    maxLength={10}
                    value={pnrNumber}
                    onChange={(e) => setPnrNumber(e.target.value.replace(/\D/g, ""))}
                    required
                  />
                </div>
                <button type="submit" className="btn-search">
                  <FileText size={18} /> Check Status
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: LIVE STATUS */}
          {activeTab === "status" && (
            <form onSubmit={handleCheckLiveStatus}>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Train Number</label>
                  <input 
                    type="text" 
                    placeholder="E.g. 12626" 
                    className="form-input"
                    maxLength={5}
                    value={liveTrainNo}
                    onChange={(e) => setLiveTrainNo(e.target.value.replace(/\D/g, ""))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Journey Start Date (from origin)</label>
                  <input 
                    type="date" 
                    className="form-input"
                    value={liveDate}
                    onChange={(e) => setLiveDate(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="btn-search">
                  <MapPin size={18} /> Locate Train
                </button>
              </div>
            </form>
          )}

          {/* TAB 4: TRAIN SCHEDULE */}
          {activeTab === "schedule" && (
            <form onSubmit={handleCheckSchedule}>
              <div className="form-grid">
                <div className="form-group" style={{ gridColumn: "span 2" }}>
                  <label className="form-label">Train Number</label>
                  <input 
                    type="text" 
                    placeholder="E.g. 12625" 
                    className="form-input"
                    maxLength={5}
                    value={scheduleTrainNo}
                    onChange={(e) => setScheduleTrainNo(e.target.value.replace(/\D/g, ""))}
                    required
                  />
                </div>
                <button type="submit" className="btn-search">
                  <Clock size={18} /> Get Timetable
                </button>
              </div>
            </form>
          )}

          {/* TAB 5: SEAT SWAP (TRAVEL TOGETHER) */}
          {activeTab === "swap" && (
            <div>
              {/* Sub-mode switcher: Browse vs Raise Request */}
              <div className="swap-subnav">
                <button
                  type="button"
                  className={`swap-subnav-btn ${swapSubMode === "browse" ? "active" : ""}`}
                  onClick={() => {
                    setSwapSubMode("browse");
                    setError(null);
                  }}
                >
                  <Search size={15} /> Find Swaps
                </button>
                <button
                  type="button"
                  className={`swap-subnav-btn ${swapSubMode === "create" ? "active" : ""}`}
                  onClick={() => {
                    setSwapSubMode("create");
                    setError(null);
                  }}
                >
                  <PlusCircle size={15} /> Raise Request
                </button>
              </div>

              {swapSubMode === "browse" ? (
                <div>
                  <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: "14px", lineHeight: 1.5 }}>
                    Filter co-passengers on your train who are looking to swap seats so families can sit together or seniors can get a lower berth.
                  </div>
                  <div className="form-grid" style={{ gap: "12px", marginBottom: "14px" }}>
                    <div className="form-group" style={{ gridColumn: "span 2" }}>
                      <label className="form-label">Filter by Train Number</label>
                      <input
                        type="text"
                        placeholder="E.g. 12626, 12724, 12952 (or leave blank)"
                        className="form-input"
                        style={{ padding: "10px 12px", fontSize: "0.9rem" }}
                        value={swapFilterTrain}
                        onChange={(e) => setSwapFilterTrain(e.target.value.replace(/\D/g, ""))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Class</label>
                      <select
                        className="form-input"
                        style={{ padding: "10px 12px", fontSize: "0.9rem" }}
                        value={swapFilterClass}
                        onChange={(e) => setSwapFilterClass(e.target.value)}
                      >
                        <option value="ALL">All Classes</option>
                        <option value="1A">1A</option>
                        <option value="2A">2A</option>
                        <option value="3A">3A</option>
                        <option value="3E">3E</option>
                        <option value="SL">SL</option>
                        <option value="CC">CC</option>
                        <option value="2S">2S</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Your Coach</label>
                      <input
                        type="text"
                        placeholder="E.g. B2, A1"
                        className="form-input"
                        style={{ padding: "10px 12px", fontSize: "0.9rem" }}
                        value={swapFilterCoach}
                        onChange={(e) => setSwapFilterCoach(e.target.value.toUpperCase())}
                      />
                    </div>
                    <div className="form-group" style={{ gridColumn: "span 2" }}>
                      <label className="form-label">Journey Date (Optional)</label>
                      <input
                        type="date"
                        className="form-input"
                        style={{ padding: "10px 12px", fontSize: "0.9rem" }}
                        value={swapFilterDate}
                        onChange={(e) => setSwapFilterDate(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Quick Train Filter Chips */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "16px" }}>
                    <span style={{ fontSize: "0.72rem", fontWeight: "700", color: "var(--text-muted)", width: "100%" }}>Quick Filter Trains:</span>
                    {[
                      { code: "", label: "All Trains" },
                      { code: "12626", label: "12626 Kerala Exp" },
                      { code: "12724", label: "12724 Telangana Exp" },
                      { code: "12952", label: "12952 Rajdhani" }
                    ].map(chip => (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() => setSwapFilterTrain(chip.code)}
                        style={{
                          fontSize: "0.73rem",
                          fontWeight: "700",
                          padding: "4px 10px",
                          borderRadius: "999px",
                          border: "1px solid var(--glass-border)",
                          background: swapFilterTrain === chip.code ? "var(--accent-purple)" : "var(--bg-tertiary)",
                          color: swapFilterTrain === chip.code ? "#ffffff" : "var(--text-secondary)",
                          cursor: "pointer"
                        }}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="btn-search"
                    onClick={() => setSwapSubMode("create")}
                  >
                    <PlusCircle size={18} /> Raise New Seat Swap Request
                  </button>
                </div>
              ) : (
                <form onSubmit={handleCreateSwapRequest}>
                  {/* Entry Mode Toggle: Auto-Fill from PNR vs Manual Entry */}
                  <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
                    <button
                      type="button"
                      onClick={() => setSwapEntryMode("pnr")}
                      style={{
                        flex: 1,
                        padding: "7px 8px",
                        fontSize: "0.75rem",
                        fontWeight: "700",
                        borderRadius: "8px",
                        border: swapEntryMode === "pnr" ? "1px solid var(--accent-purple)" : "1px solid var(--glass-border)",
                        background: swapEntryMode === "pnr" ? "var(--accent-glow)" : "var(--bg-secondary)",
                        color: swapEntryMode === "pnr" ? "var(--accent-purple)" : "var(--text-secondary)",
                        cursor: "pointer"
                      }}
                    >
                      ✨ Auto-Fill via PNR
                    </button>
                    <button
                      type="button"
                      onClick={() => setSwapEntryMode("manual")}
                      style={{
                        flex: 1,
                        padding: "7px 8px",
                        fontSize: "0.75rem",
                        fontWeight: "700",
                        borderRadius: "8px",
                        border: swapEntryMode === "manual" ? "1px solid var(--accent-purple)" : "1px solid var(--glass-border)",
                        background: swapEntryMode === "manual" ? "var(--accent-glow)" : "var(--bg-secondary)",
                        color: swapEntryMode === "manual" ? "var(--accent-purple)" : "var(--text-secondary)",
                        cursor: "pointer"
                      }}
                    >
                      ✍️ Manual Entry
                    </button>
                  </div>

                  {/* PNR Auto-Fill Box */}
                  {swapEntryMode === "pnr" && (
                    <div className="swap-autofill-box">
                      <label className="form-label" style={{ display: "block", marginBottom: "6px", color: "var(--accent-purple)" }}>
                        10-Digit PNR Auto-Import
                      </label>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <input
                          type="text"
                          maxLength={10}
                          placeholder="Enter 10-digit PNR..."
                          className="form-input"
                          style={{ padding: "8px 10px", fontSize: "0.88rem", flex: 1 }}
                          value={swapPnrInput}
                          onChange={(e) => setSwapPnrInput(e.target.value.replace(/\D/g, ""))}
                        />
                        <button
                          type="button"
                          onClick={handleFetchPnrForSwap}
                          disabled={swapPnrLoading}
                          style={{
                            background: "var(--accent-gradient)",
                            color: "#fff",
                            border: "none",
                            borderRadius: "8px",
                            padding: "8px 12px",
                            fontSize: "0.8rem",
                            fontWeight: "700",
                            cursor: "pointer",
                            whiteSpace: "nowrap"
                          }}
                        >
                          {swapPnrLoading ? "Fetching..." : "Fetch PNR"}
                        </button>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px", flexWrap: "wrap", gap: "6px" }}>
                        <button
                          type="button"
                          onClick={handleLoadSampleSplitPnrForSwap}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--accent-purple)",
                            fontSize: "0.75rem",
                            fontWeight: "700",
                            textDecoration: "underline",
                            cursor: "pointer"
                          }}
                        >
                          Try Sample Split-Coach Family PNR
                        </button>
                        {swapPnrVerified && (
                          <span className="swap-verified-pill">
                            <ShieldCheck size={12} /> PNR Verified ({swapMaskedPnr})
                          </span>
                        )}
                      </div>

                      {swapPnrPassengers.length > 0 && (
                        <div style={{ marginTop: "10px", borderTop: "1px dashed rgba(124, 58, 237, 0.25)", paddingTop: "8px" }}>
                          <span style={{ fontSize: "0.72rem", fontWeight: "700", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
                            Select Passenger Seat to Swap:
                          </span>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                            {swapPnrPassengers.map((pax, idx) => {
                              const c = pax.Coach || (pax.BookingStatus?.split("/")[1]) || "B4";
                              const b = pax.Berth || (pax.BookingStatus?.split("/")[2]) || (idx + 12);
                              const bt = pax.BerthType || (pax.BookingStatus?.split("/")[3]) || "LB";
                              const isSelected = swapCurrentCoach === String(c).toUpperCase() && swapCurrentBerth === String(b);
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => {
                                    setSwapCurrentCoach(String(c).toUpperCase());
                                    setSwapCurrentBerth(String(b));
                                    setSwapCurrentBerthType(String(bt).toUpperCase());
                                  }}
                                  style={{
                                    padding: "4px 8px",
                                    fontSize: "0.73rem",
                                    fontWeight: "700",
                                    borderRadius: "6px",
                                    border: isSelected ? "1px solid var(--accent-purple)" : "1px solid var(--glass-border)",
                                    background: isSelected ? "var(--accent-purple)" : "#ffffff",
                                    color: isSelected ? "#ffffff" : "var(--text-primary)",
                                    cursor: "pointer"
                                  }}
                                >
                                  Pax {pax.Number || idx + 1}: {c} #{b} ({bt})
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Journey & Seat Swap Form Fields */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div className="form-group">
                      <label className="form-label">Your Name *</label>
                      <input
                        type="text"
                        placeholder="E.g. Sai Kumar / Arjun M."
                        className="form-input"
                        style={{ padding: "9px 12px", fontSize: "0.9rem" }}
                        value={swapPassengerName}
                        onChange={(e) => setSwapPassengerName(e.target.value)}
                        required
                      />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: "8px" }}>
                      <div className="form-group">
                        <label className="form-label">Train No *</label>
                        <input
                          type="text"
                          maxLength={5}
                          placeholder="12626"
                          className="form-input"
                          style={{ padding: "9px 10px", fontSize: "0.9rem" }}
                          value={swapTrainNo}
                          onChange={(e) => setSwapTrainNo(e.target.value.replace(/\D/g, ""))}
                          onBlur={handleAutoFetchTrainInfoForSwap}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Train Name</label>
                        <input
                          type="text"
                          placeholder="Kerala Express"
                          className="form-input"
                          style={{ padding: "9px 10px", fontSize: "0.9rem" }}
                          value={swapTrainName}
                          onChange={(e) => setSwapTrainName(e.target.value)}
                        />
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "8px" }}>
                      <div className="form-group">
                        <label className="form-label">Journey Date *</label>
                        <input
                          type="date"
                          className="form-input"
                          style={{ padding: "9px 10px", fontSize: "0.85rem" }}
                          value={swapDoj}
                          onChange={(e) => setSwapDoj(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Class *</label>
                        <select
                          className="form-input"
                          style={{ padding: "9px 10px", fontSize: "0.88rem" }}
                          value={swapTravelClass}
                          onChange={(e) => setSwapTravelClass(e.target.value)}
                        >
                          <option value="1A">1A</option>
                          <option value="2A">2A</option>
                          <option value="3A">3A</option>
                          <option value="3E">3E</option>
                          <option value="SL">SL</option>
                          <option value="CC">CC</option>
                          <option value="2S">2S</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      <div className="form-group">
                        <label className="form-label">Boarding Stn</label>
                        <input
                          type="text"
                          placeholder="NDLS"
                          className="form-input"
                          style={{ padding: "9px 10px", fontSize: "0.88rem" }}
                          value={swapFromStn}
                          onChange={(e) => setSwapFromStn(e.target.value.toUpperCase())}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Destination Stn</label>
                        <input
                          type="text"
                          placeholder="TVC"
                          className="form-input"
                          style={{ padding: "9px 10px", fontSize: "0.88rem" }}
                          value={swapToStn}
                          onChange={(e) => setSwapToStn(e.target.value.toUpperCase())}
                        />
                      </div>
                    </div>

                    {/* Current Seat Box */}
                    <div style={{ background: "var(--bg-tertiary)", padding: "10px", borderRadius: "10px", border: "1px solid var(--glass-border)" }}>
                      <div style={{ fontSize: "0.75rem", fontWeight: "800", color: "var(--text-primary)", textTransform: "uppercase", marginBottom: "6px" }}>
                        1. Your Current Allotted Seat
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
                        <div>
                          <label className="form-label" style={{ fontSize: "0.68rem" }}>Coach *</label>
                          <input
                            type="text"
                            placeholder="B4"
                            className="form-input"
                            style={{ padding: "7px 8px", fontSize: "0.85rem", width: "100%" }}
                            value={swapCurrentCoach}
                            onChange={(e) => setSwapCurrentCoach(e.target.value.toUpperCase())}
                            required
                          />
                        </div>
                        <div>
                          <label className="form-label" style={{ fontSize: "0.68rem" }}>Berth # *</label>
                          <input
                            type="text"
                            placeholder="12"
                            className="form-input"
                            style={{ padding: "7px 8px", fontSize: "0.85rem", width: "100%" }}
                            value={swapCurrentBerth}
                            onChange={(e) => setSwapCurrentBerth(e.target.value.replace(/\D/g, ""))}
                            required
                          />
                        </div>
                        <div>
                          <label className="form-label" style={{ fontSize: "0.68rem" }}>Type</label>
                          <select
                            className="form-input"
                            style={{ padding: "7px 6px", fontSize: "0.85rem", width: "100%" }}
                            value={swapCurrentBerthType}
                            onChange={(e) => setSwapCurrentBerthType(e.target.value)}
                          >
                            <option value="LB">LB</option>
                            <option value="MB">MB</option>
                            <option value="UB">UB</option>
                            <option value="SL">SL</option>
                            <option value="SU">SU</option>
                            <option value="WS">WS</option>
                            <option value="AS">AS</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Desired Target Seat Box */}
                    <div style={{ background: "rgba(124, 58, 237, 0.04)", padding: "10px", borderRadius: "10px", border: "1px solid rgba(124, 58, 237, 0.2)" }}>
                      <div style={{ fontSize: "0.75rem", fontWeight: "800", color: "var(--accent-purple)", textTransform: "uppercase", marginBottom: "6px" }}>
                        2. Seat You Want to Swap For
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "6px" }}>
                        <div>
                          <label className="form-label" style={{ fontSize: "0.68rem" }}>Target Coach</label>
                          <input
                            type="text"
                            placeholder="B2 (or ANY)"
                            className="form-input"
                            style={{ padding: "7px 8px", fontSize: "0.85rem", width: "100%" }}
                            value={swapTargetCoach}
                            onChange={(e) => setSwapTargetCoach(e.target.value.toUpperCase())}
                          />
                        </div>
                        <div>
                          <label className="form-label" style={{ fontSize: "0.68rem" }}>Preferred Berth</label>
                          <select
                            className="form-input"
                            style={{ padding: "7px 6px", fontSize: "0.85rem", width: "100%" }}
                            value={swapTargetBerthType}
                            onChange={(e) => setSwapTargetBerthType(e.target.value)}
                          >
                            <option value="ANY">Any Berth</option>
                            <option value="LB">Lower (LB)</option>
                            <option value="SL">Side Lower (SL)</option>
                            <option value="LB/SL">LB or SL</option>
                            <option value="MB/UB">MB / UB</option>
                            <option value="WS">Window (WS)</option>
                          </select>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                        <div>
                          <label className="form-label" style={{ fontSize: "0.68rem" }}>Family Coach</label>
                          <input
                            type="text"
                            placeholder="E.g. B2"
                            className="form-input"
                            style={{ padding: "7px 8px", fontSize: "0.82rem", width: "100%" }}
                            value={swapFamilyCoach}
                            onChange={(e) => setSwapFamilyCoach(e.target.value.toUpperCase())}
                          />
                        </div>
                        <div>
                          <label className="form-label" style={{ fontSize: "0.68rem" }}>Family Berth(s)</label>
                          <input
                            type="text"
                            placeholder="E.g. 19, 20"
                            className="form-input"
                            style={{ padding: "7px 8px", fontSize: "0.82rem", width: "100%" }}
                            value={swapFamilyBerths}
                            onChange={(e) => setSwapFamilyBerths(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Reason for Swap</label>
                      <select
                        className="form-input"
                        style={{ padding: "9px 10px", fontSize: "0.85rem" }}
                        value={swapReasonCategory}
                        onChange={(e) => setSwapReasonCategory(e.target.value)}
                      >
                        {REASON_OPTIONS.map(r => (
                          <option key={r.id} value={r.id}>{r.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Note for Co-Passengers</label>
                      <textarea
                        rows={2}
                        placeholder="E.g. Traveling with family in B2 #19, 20. Happy to offer my B4 Lower Berth (#12) for any berth in B2!"
                        className="form-input"
                        style={{ padding: "9px 10px", fontSize: "0.85rem", resize: "vertical" }}
                        value={swapNote}
                        onChange={(e) => setSwapNote(e.target.value)}
                      />
                    </div>

                    <button type="submit" className="btn-search" style={{ marginTop: "4px" }}>
                      <ArrowLeftRight size={18} /> Post Seat Swap Request
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </section>
      </div>

      <div className="layout-right-panel">

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
        <section className="results-section">
          {/* TRAIN SEARCH RESULTS */}
          {activeTab === "search" && searchResults && (
            <div>
              <div className="results-header">
                <h3 className="results-title" style={{ fontSize: "1.15rem" }}>
                  Search Results: {searchFrom} ➔ {searchTo} {searchToDate && searchDate !== searchToDate ? `(${formatDate(searchDate)} to ${formatDate(searchToDate)})` : `(${formatDate(searchDate)})`}
                </h3>
              </div>

              {/* Dynamic Filters Bar */}
              {availableQuotas.length > 0 && (
                <div className="filters-container">
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
                          No available seats found for General or Tatkal quotas within {searchResults.searchedWeeks * 7} days from your selected date.
                          <br />
                          <span style={{ fontSize: "0.85rem", opacity: 0.7, display: "inline-block", marginTop: "8px" }}>Try changing the search date or selected stations.</span>
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

                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px dashed var(--glass-border)", paddingTop: "6px", marginTop: "4px", gap: "10px", flexWrap: "wrap" }}>
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
                      return <p className="empty-message">No trains found matching the filters within {searchResults.searchedWeeks * 7} days.</p>;
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
                    const userFromDate = formatDate(searchDate);
                    const userToDate = searchToDate ? formatDate(searchToDate) : "";
                    const uniqueDatesList = targetDates.length > 0 ? [...targetDates] : matchedRawTrains.map(t => t.journeyDate);
                    if (userFromDate && !uniqueDatesList.includes(userFromDate)) {
                      uniqueDatesList.push(userFromDate);
                    }
                    if (userToDate && !uniqueDatesList.includes(userToDate)) {
                      uniqueDatesList.push(userToDate);
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
            </div>
          )}

          {/* PNR LOOKUP RESULTS */}
          {activeTab === "pnr" && pnrResults && (
            <div>
              {/* Check if PNR has returned an error or flushed status */}
              {pnrResults.Error ? (
                <div className="pnr-error-banner" style={{ background: "rgba(220, 38, 38, 0.05)", border: "1px solid rgba(220, 38, 38, 0.2)", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "12px", alignItems: "center", textAlign: "center" }}>
                  <AlertCircle size={36} style={{ color: "var(--danger)" }} />
                  <div style={{ fontWeight: "700", fontSize: "1.1rem" }}>PNR Status: {pnrResults.Error}</div>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", maxWidth: "500px" }}>
                    This PNR has been flushed from the active database or is not yet generated. This is common for past journeys, newly cancelled tickets, or invalid numbers.
                  </p>
                  <button 
                    type="button" 
                    onClick={handleLoadDemoPnr}
                    className="btn-search"
                    style={{ alignSelf: "center", height: "auto", padding: "10px 20px", fontSize: "0.9rem", marginTop: "8px" }}
                  >
                    Load Demo PNR Details
                  </button>
                </div>
              ) : (
                <div className="pnr-container">
                  <div className="pnr-header-card">
                    <div className="pnr-main-status">
                      <span className="pnr-main-label">Charting Status</span>
                      <span className="pnr-main-value">
                        {pnrResults.ChartPrepared ? "Chart Prepared" : "Chart Not Prepared"}
                      </span>
                    </div>
                    <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
                      <div>
                        <span className="pnr-main-label">Train Details</span>
                        <div style={{ fontSize: "1.2rem", fontWeight: "700" }}>
                          {pnrResults.TrainNo} - {pnrResults.TrainName}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleJumpToSwapFromPnrTab}
                        style={{
                          background: "rgba(255, 255, 255, 0.2)",
                          border: "1px solid rgba(255, 255, 255, 0.45)",
                          color: "#ffffff",
                          padding: "6px 12px",
                          borderRadius: "8px",
                          fontSize: "0.78rem",
                          fontWeight: "700",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px"
                        }}
                      >
                        <ArrowLeftRight size={14} /> Request Seat Swap for this PNR
                      </button>
                    </div>
                  </div>

                  <div className="pnr-main-info-grid">
                    <div className="pnr-details-card">
                      <h4 style={{ marginBottom: "12px", borderBottom: "1px solid var(--glass-border)", paddingBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                        <Info size={16} style={{ color: "var(--accent-purple)" }} /> Journey Details
                      </h4>
                      <p style={{ display: "flex", justifyContent: "space-between", margin: "8px 0" }}>
                        <span className="station-label">From:</span>
                        <strong>{pnrResults.SourceName || pnrResults.BoardingStationName} ({pnrResults.BoardingPoint || pnrResults.From})</strong>
                      </p>
                      <p style={{ display: "flex", justifyContent: "space-between", margin: "8px 0" }}>
                        <span className="station-label">To:</span>
                        <strong>{pnrResults.DestinationName || pnrResults.ReservationUptoName} ({pnrResults.ReservationUpto || pnrResults.To})</strong>
                      </p>
                      <p style={{ display: "flex", justifyContent: "space-between", margin: "8px 0" }}>
                        <span className="station-label">Date of Journey:</span>
                        <strong>{pnrResults.Doj}</strong>
                      </p>
                      <p style={{ display: "flex", justifyContent: "space-between", margin: "8px 0" }}>
                        <span className="station-label">Class & Quota:</span>
                        <strong>{pnrResults.Class} ({pnrResults.Quota || "GN"})</strong>
                      </p>
                      {pnrResults.ExpectedPlatformNo && (
                        <p style={{ display: "flex", justifyContent: "space-between", margin: "8px 0" }}>
                          <span className="station-label">Expected Platform:</span>
                          <strong style={{ color: "var(--success)" }}>Platform {pnrResults.ExpectedPlatformNo}</strong>
                        </p>
                      )}
                      {pnrResults.Duration && (
                        <p style={{ display: "flex", justifyContent: "space-between", margin: "8px 0" }}>
                          <span className="station-label">Duration:</span>
                          <strong>{pnrResults.Duration}</strong>
                        </p>
                      )}
                    </div>

                    <div className="pnr-details-card">
                      <h4 style={{ marginBottom: "12px", borderBottom: "1px solid var(--glass-border)", paddingBottom: "6px" }}>Passenger Status details</h4>
                      
                      {/* Desktop Table View */}
                      <div className="pnr-desktop-table" style={{ width: "100%", overflowX: "auto" }}>
                        <table className="pnr-table">
                          <thead>
                            <tr>
                              <th>Passenger</th>
                              <th>Booking Status</th>
                              <th>Current Status</th>
                              <th>Prediction</th>
                              <th>Seat/Berth Info</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(pnrResults.PassengerStatus || pnrResults.passengerList)?.map((passenger, index) => {
                              const isCnf = passenger.CurrentStatus?.includes("CNF") || passenger.CurrentStatus === "CNF";
                              let statusClass = "status-waitlist";
                              if (isCnf) {
                                statusClass = "status-available";
                              } else if (passenger.CurrentStatus?.includes("RAC")) {
                                statusClass = "status-waitlist";
                              }
                              
                              let predColor = "var(--text-secondary)";
                              const confirmStatus = passenger.ConfirmTktStatus?.toUpperCase();
                              const predictionText = passenger.Prediction?.toUpperCase();
                              if (confirmStatus === "CONFIRM" || confirmStatus === "CONFIRMED" || predictionText === "AVAILABLE" || predictionText === "100%") {
                                predColor = "var(--success)";
                              } else if (confirmStatus === "PROBABLE" || confirmStatus === "RAC") {
                                predColor = "var(--warning)";
                              } else if (confirmStatus === "LOW CHANCE" || confirmStatus === "UNAVAILABLE") {
                                predColor = "var(--danger)";
                              }

                              return (
                                <tr key={index}>
                                  <td>Passenger {passenger.Number || (index + 1)}</td>
                                  <td><strong>{passenger.BookingStatus}</strong></td>
                                  <td className={statusClass}>
                                    <strong>{passenger.CurrentStatus}</strong>
                                  </td>
                                  <td style={{ color: predColor, fontWeight: "600" }}>
                                    {passenger.Prediction || "--"} 
                                    {passenger.ConfirmTktStatus && <span style={{ fontSize: "0.75rem", display: "block", fontWeight: "normal", opacity: 0.8 }}>({passenger.ConfirmTktStatus})</span>}
                                  </td>
                                  <td>
                                    {passenger.Coach ? `Coach: ${passenger.Coach}` : ""} 
                                    {passenger.Berth ? ` Berth: ${passenger.Berth}` : ""}
                                    {(!passenger.Coach && !passenger.Berth) ? "--" : ""}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Cards View */}
                      <div className="pnr-mobile-cards">
                        {(pnrResults.PassengerStatus || pnrResults.passengerList)?.map((passenger, index) => {
                          const isCnf = passenger.CurrentStatus?.includes("CNF") || passenger.CurrentStatus === "CNF";
                          let statusClass = "status-waitlist";
                          if (isCnf) {
                            statusClass = "status-available";
                          } else if (passenger.CurrentStatus?.includes("RAC")) {
                            statusClass = "status-waitlist";
                          }
                          
                          let predColor = "var(--text-secondary)";
                          const confirmStatus = passenger.ConfirmTktStatus?.toUpperCase();
                          const predictionText = passenger.Prediction?.toUpperCase();
                          if (confirmStatus === "CONFIRM" || confirmStatus === "CONFIRMED" || predictionText === "AVAILABLE" || predictionText === "100%") {
                            predColor = "var(--success)";
                          } else if (confirmStatus === "PROBABLE" || confirmStatus === "RAC") {
                            predColor = "var(--warning)";
                          } else if (confirmStatus === "LOW CHANCE" || confirmStatus === "UNAVAILABLE") {
                            predColor = "var(--danger)";
                          }

                          return (
                            <div key={index} className="pnr-passenger-card">
                              <div className="pnr-passenger-header">
                                <span className="passenger-num">Passenger {passenger.Number || (index + 1)}</span>
                                {passenger.Coach && (
                                  <span className="passenger-seat-badge">
                                    {passenger.Coach} / Berth {passenger.Berth}
                                  </span>
                                )}
                              </div>
                              <div className="pnr-passenger-body">
                                <div className="pnr-passenger-row">
                                  <span className="pnr-row-label">Booking Status</span>
                                  <span className="pnr-row-val" style={{ fontWeight: "700" }}>{passenger.BookingStatus}</span>
                                </div>
                                <div className="pnr-passenger-row">
                                  <span className="pnr-row-label">Current Status</span>
                                  <span className={`pnr-row-val ${statusClass}`} style={{ fontWeight: "700" }}>{passenger.CurrentStatus}</span>
                                </div>
                                <div className="pnr-passenger-row">
                                  <span className="pnr-row-label">Prediction</span>
                                  <span className="pnr-row-val" style={{ color: predColor, fontWeight: "600" }}>
                                    {passenger.Prediction || "--"}
                                    {passenger.ConfirmTktStatus && <span style={{ fontSize: "0.75rem", display: "inline-block", marginLeft: "4px", fontWeight: "normal", opacity: 0.8 }}>({passenger.ConfirmTktStatus})</span>}
                                  </span>
                                </div>
                                {passenger.Coach && (
                                  <div className="pnr-passenger-row">
                                    <span className="pnr-row-label">Seat / Berth Info</span>
                                    <span className="pnr-row-val">Coach: {passenger.Coach} | Berth: {passenger.Berth}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Coach Position Visualizer */}
                  {pnrResults.CoachPosition && (
                    <div className="pnr-details-card" style={{ marginTop: "8px" }}>
                      <h4 style={{ marginBottom: "12px", borderBottom: "1px solid var(--glass-border)", paddingBottom: "6px" }}>Coach Position Layout</h4>
                      <div className="coach-scroll-container" style={{ overflowX: "auto", padding: "10px 0" }}>
                        <div style={{ display: "flex", gap: "8px", alignItems: "flex-end", minWidth: "max-content" }}>
                          {(() => {
                            const coaches = parseCoachPosition(pnrResults.CoachPosition).reverse();
                            return coaches.map((coach, idx) => {
                              let typeClass = "coach-gen";
                              const tUpper = coach.type.toUpperCase();
                              if (tUpper === "EN" || tUpper === "ENGINE" || tUpper === "LOCO" || tUpper === "DHNE") {
                                const isRightHalf = idx >= coaches.length / 2;
                                typeClass = `coach-engine ${isRightHalf ? 'coach-engine-right' : 'coach-engine-left'}`;
                              }
                              else if (tUpper === "AC" || tUpper.includes("3A") || tUpper.includes("2A") || tUpper.includes("1A") || tUpper.includes("3E")) typeClass = "coach-ac";
                              else if (tUpper === "SL" || tUpper.includes("SLEEPER")) typeClass = "coach-sleeper";
                              else if (tUpper === "PC" || tUpper === "PANTRY") typeClass = "coach-pantry";

                              return (
                                <div key={idx} className={`coach-box ${typeClass}`}>
                                  <div style={{ fontSize: "0.8rem", fontWeight: "700" }}>{coach.label}</div>
                                  <div style={{ fontSize: "0.6rem", opacity: 0.8 }}>{coach.type}</div>
                                  <div className="coach-wheels" style={{ display: "flex", justifyContent: "space-between", width: "80%", position: "absolute", bottom: "-4px" }}>
                                    <span style={{ width: "6px", height: "6px", background: "#334155", borderRadius: "50%" }}></span>
                                    <span style={{ width: "6px", height: "6px", background: "#334155", borderRadius: "50%" }}></span>
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Ratings & Pantry Details */}
                  {(pnrResults.Rating > 0 || pnrResults.HasPantry) && (
                    <div className="pnr-details-grid" style={{ marginTop: "8px" }}>
                      {pnrResults.Rating > 0 && (
                        <div className="pnr-details-card">
                          <h4 style={{ marginBottom: "12px", borderBottom: "1px solid var(--glass-border)", paddingBottom: "6px" }}>Train Passenger Ratings</h4>
                          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            <div>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "2px" }}>
                                <span>Overall Punctuality</span>
                                <strong>{pnrResults.PunctualityRating || pnrResults.Rating}/5</strong>
                              </div>
                              <div style={{ height: "6px", background: "var(--bg-tertiary)", borderRadius: "3px", overflow: "hidden" }}>
                                <div style={{ width: `${((pnrResults.PunctualityRating || pnrResults.Rating) / 5) * 100}%`, height: "100%", background: "var(--accent-purple)" }}></div>
                              </div>
                            </div>
                            <div>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "2px" }}>
                                <span>Cleanliness</span>
                                <strong>{pnrResults.CleanlinessRating || pnrResults.Rating}/5</strong>
                              </div>
                              <div style={{ height: "6px", background: "var(--bg-tertiary)", borderRadius: "3px", overflow: "hidden" }}>
                                <div style={{ width: `${((pnrResults.CleanlinessRating || pnrResults.Rating) / 5) * 100}%`, height: "100%", background: "var(--accent-blue)" }}></div>
                              </div>
                            </div>
                            <div>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "2px" }}>
                                <span>Food Quality</span>
                                <strong>{pnrResults.FoodRating || pnrResults.Rating}/5</strong>
                              </div>
                              <div style={{ height: "6px", background: "var(--bg-tertiary)", borderRadius: "3px", overflow: "hidden" }}>
                                <div style={{ width: `${((pnrResults.FoodRating || pnrResults.Rating) / 5) * 100}%`, height: "100%", background: "var(--warning)" }}></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div className="pnr-details-card" style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", gap: "8px" }}>
                        <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>Pantry Car Carried?</span>
                        <div style={{
                          fontSize: "1.4rem",
                          fontWeight: "800",
                          color: pnrResults.HasPantry ? "var(--success)" : "var(--danger)",
                          background: pnrResults.HasPantry ? "var(--success-bg)" : "var(--danger-bg)",
                          padding: "6px 16px",
                          borderRadius: "20px",
                          border: `1px solid ${pnrResults.HasPantry ? "var(--success)" : "var(--danger)"}`
                        }}>
                          {pnrResults.HasPantry ? "Yes, Available" : "No Pantry Car"}
                        </div>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Pantry car details from train configuration</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* LIVE RUNNING STATUS RESULTS */}
          {activeTab === "status" && liveResults && (
            <div>
              {/* Check if train running data is found */}
              {liveResults.Error || liveResults.stations?.length === 0 ? (
                <div className="pnr-error-banner" style={{ background: "rgba(220, 38, 38, 0.05)", border: "1px solid rgba(220, 38, 38, 0.2)", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "12px", alignItems: "center", textAlign: "center" }}>
                  <AlertCircle size={36} style={{ color: "var(--danger)" }} />
                  <div style={{ fontWeight: "700", fontSize: "1.1rem" }}>Running Status: {liveResults.Error || "Data not available"}</div>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", maxWidth: "500px" }}>
                    We couldn't retrieve the live running status for this train. Please make sure the train number is correct and it is running today.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="pnr-header-card" style={{ background: "var(--bg-tertiary)", border: "1px solid var(--glass-border)", color: "var(--text-primary)" }}>
                    <div className="pnr-main-status">
                      <span className="pnr-main-label" style={{ color: "var(--text-secondary)" }}>Live Train Location</span>
                      <span className="pnr-main-value" style={{ fontSize: "1.35rem", display: "flex", alignItems: "center", gap: "8px" }}>
                        <span className="pulse-dot" style={{ display: "inline-block", width: "10px", height: "10px", background: "var(--accent-purple)", borderRadius: "50%", boxShadow: "0 0 8px var(--accent-purple)" }}></span>
                        {liveResults.curStnName || "Departed from Origin"}
                      </span>
                      {liveResults.lastUpdated && (
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Last Updated: {liveResults.lastUpdated}</span>
                      )}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span className="pnr-main-label" style={{ color: "var(--text-secondary)" }}>Delay Status</span>
                      <div className={liveResults.totalLateMins === 0 ? "status-available" : "status-waitlist"} style={{ fontSize: "1.2rem", fontWeight: "700", display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                        <span>{liveResults.totalLateMins === 0 ? "On Time" : `Late by ${liveResults.totalLateMins} mins`}</span>
                        {liveResults.distanceCovered !== undefined && (
                          <span style={{ fontSize: "0.75rem", fontWeight: "normal", color: "var(--text-secondary)" }}>Covered: {liveResults.distanceCovered} km</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Station vertical timeline */}
                  <div className="timeline-container" style={{ marginTop: "24px" }}>
                    <div className="timeline-line" style={{ left: "15px" }}></div>
                    {liveResults.stations?.map((stn, index) => {
                      const isPassed = stn.travelled || stn.dep;
                      const isActive = stn.arr && !stn.dep;
                      const isUpcoming = !stn.arr && !stn.travelled;
                      
                      let nodeStyle = {
                        width: "12px",
                        height: "12px",
                        left: "-25px",
                        borderWidth: "3px",
                        borderColor: "#94a3b8"
                      };
                      if (isActive) {
                        nodeStyle = {
                          width: "16px",
                          height: "16px",
                          left: "-27px",
                          borderColor: "var(--accent-purple)",
                          background: "#ffffff",
                          boxShadow: "0 0 10px var(--accent-purple)"
                        };
                      } else if (isPassed) {
                        nodeStyle = {
                          width: "12px",
                          height: "12px",
                          left: "-25px",
                          borderColor: "var(--success)",
                          background: "var(--success)"
                        };
                      }

                      return (
                        <div 
                          key={index}
                          className={`timeline-item ${isActive ? "active" : ""} ${isPassed ? "passed" : ""}`}
                          style={{
                            gridTemplateColumns: "1.5fr 1fr 1.2fr",
                            paddingBottom: "20px",
                            paddingLeft: "12px",
                            opacity: isUpcoming ? 0.6 : 1
                          }}
                        >
                          <div className="timeline-node" style={nodeStyle}></div>
                          
                          <div className="station-details">
                            <span className="station-name" style={{ fontSize: "0.95rem", display: "flex", flexDirection: "column" }}>
                              <strong>{stn.stnCodeName}</strong>
                              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: "normal" }}>Code: {stn.stnCode} | Dist: {stn.distance} km</span>
                            </span>
                            
                            {/* Halt and Platform Info */}
                            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "2px" }}>
                              {stn.haltMinutes > 0 && (
                                <span style={{ fontSize: "0.7rem", background: "var(--bg-tertiary)", padding: "1px 6px", borderRadius: "4px", color: "var(--text-secondary)", fontWeight: "600" }}>
                                  Halt: {stn.haltMinutes} mins
                                </span>
                              )}
                              {stn.ExpectedPlatformNo && stn.ExpectedPlatformNo !== "0" && (
                                <span style={{ fontSize: "0.7rem", background: "var(--success-bg)", padding: "1px 6px", borderRadius: "4px", color: "var(--success)", fontWeight: "700" }}>
                                  PF: {stn.ExpectedPlatformNo}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="station-times" style={{ fontSize: "0.85rem" }}>
                            <div style={{ fontWeight: "600", color: "var(--text-secondary)" }}>Arrival</div>
                            <div>
                              {stn.schArrTime ? (
                                <span>
                                  {stn.schArrTime}
                                  {stn.delayArr > 0 && (
                                    <span style={{ color: "var(--danger)", fontWeight: "600", marginLeft: "4px", fontSize: "0.75rem" }}>
                                      ➔ {stn.actArr} (+{stn.delayArr}m)
                                    </span>
                                  )}
                                  {stn.delayArr === 0 && stn.actArr && (
                                    <span style={{ color: "var(--success)", fontWeight: "600", marginLeft: "4px", fontSize: "0.75rem" }}>
                                      (On Time)
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Origin</span>
                              )}
                            </div>
                          </div>

                          <div className="station-times" style={{ textAlign: "right", fontSize: "0.85rem" }}>
                            <div style={{ fontWeight: "600", color: "var(--text-secondary)" }}>Departure</div>
                            <div>
                              {stn.schDepTime ? (
                                <span>
                                  {stn.schDepTime}
                                  {stn.delayDep > 0 && (
                                    <span style={{ color: "var(--danger)", fontWeight: "600", marginLeft: "4px", fontSize: "0.75rem" }}>
                                      ➔ {stn.actDep} (+{stn.delayDep}m)
                                    </span>
                                  )}
                                  {stn.delayDep === 0 && stn.actDep && (
                                    <span style={{ color: "var(--success)", fontWeight: "600", marginLeft: "4px", fontSize: "0.75rem" }}>
                                      (On Time)
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Destination</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TRAIN ROUTE/SCHEDULE RESULTS */}
          {activeTab === "schedule" && scheduleResults && (
            <div>
              {scheduleResults.ErrorMsg || scheduleResults.Schedule?.length === 0 ? (
                <div className="pnr-error-banner" style={{ background: "rgba(220, 38, 38, 0.05)", border: "1px solid rgba(220, 38, 38, 0.2)", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "12px", alignItems: "center", textAlign: "center" }}>
                  <AlertCircle size={36} style={{ color: "var(--danger)" }} />
                  <div style={{ fontWeight: "700", fontSize: "1.1rem" }}>Schedule Status: {scheduleResults.ErrorMsg || "Data not available"}</div>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", maxWidth: "500px" }}>
                    We couldn't retrieve the timetable for this train. Please make sure the train number is correct.
                  </p>
                </div>
              ) : (
                <div className="pnr-container">
                  <div className="pnr-header-card" style={{ background: "var(--bg-secondary)", border: "1px solid var(--glass-border)", color: "var(--text-primary)" }}>
                    <div>
                      <span className="pnr-main-label" style={{ color: "var(--text-secondary)" }}>Train Timetable</span>
                      <div style={{ fontSize: "1.3rem", fontWeight: "800", color: "var(--text-primary)" }}>
                        {scheduleResults.TrainNo} - {scheduleResults.TrainName}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                        Runs From: <strong>{scheduleResults.Source} ➔ {scheduleResults.Destination}</strong> | Duration: {scheduleResults.TotalDuration || "--"}
                      </div>
                    </div>
                    {scheduleResults.DaysOfRun && (
                      <div style={{ textAlign: "right" }}>
                        <span className="pnr-main-label" style={{ color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>Running Days</span>
                        <div style={{ display: "flex", gap: "4px" }}>
                          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
                            const isRunning = scheduleResults.DaysOfRun[day] || scheduleResults.DaysOfRun[day.slice(0, 3)];
                            return (
                              <span 
                                key={day} 
                                style={{
                                  width: "28px",
                                  height: "28px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: "0.7rem",
                                  fontWeight: "700",
                                  borderRadius: "50%",
                                  background: isRunning ? "var(--accent-purple)" : "var(--bg-tertiary)",
                                  color: isRunning ? "#ffffff" : "var(--text-muted)",
                                  border: "1px solid var(--glass-border)"
                                }}
                              >
                                {day[0]}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Ratings & Coach Position Visualizer */}
                  <div className="pnr-details-grid">
                    {scheduleResults.Rating > 0 && (
                      <div className="pnr-details-card">
                        <h4 style={{ marginBottom: "12px", borderBottom: "1px solid var(--glass-border)", paddingBottom: "6px" }}>Punctuality & Ratings</h4>
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "2px" }}>
                              <span>Punctuality Rating</span>
                              <strong>{scheduleResults.PunctualityRating || scheduleResults.Rating}/5</strong>
                            </div>
                            <div style={{ height: "6px", background: "var(--bg-tertiary)", borderRadius: "3px", overflow: "hidden" }}>
                              <div style={{ width: `${((scheduleResults.PunctualityRating || scheduleResults.Rating) / 5) * 100}%`, height: "100%", background: "var(--success)" }}></div>
                            </div>
                          </div>
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "2px" }}>
                              <span>Cleanliness</span>
                              <strong>{scheduleResults.CleanlinessRating || scheduleResults.Rating}/5</strong>
                            </div>
                            <div style={{ height: "6px", background: "var(--bg-tertiary)", borderRadius: "3px", overflow: "hidden" }}>
                              <div style={{ width: `${((scheduleResults.CleanlinessRating || scheduleResults.Rating) / 5) * 100}%`, height: "100%", background: "var(--accent-purple)" }}></div>
                            </div>
                          </div>
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "2px" }}>
                              <span>Food Quality</span>
                              <strong>{scheduleResults.FoodRating || scheduleResults.Rating}/5</strong>
                            </div>
                            <div style={{ height: "6px", background: "var(--bg-tertiary)", borderRadius: "3px", overflow: "hidden" }}>
                              <div style={{ width: `${((scheduleResults.FoodRating || scheduleResults.Rating) / 5) * 100}%`, height: "100%", background: "var(--warning)" }}></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="pnr-details-card" style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: "10px" }}>
                      <div>
                        <span className="station-label">Available Classes:</span>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                          {scheduleResults.Classes?.map((cls) => (
                            <span key={cls} style={{
                              fontSize: "0.75rem",
                              fontWeight: "700",
                              background: "var(--accent-glow)",
                              color: "var(--accent-purple)",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              border: "1px solid rgba(124, 58, 237, 0.2)"
                            }}>{cls}</span>
                          ))}
                        </div>
                      </div>
                      
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--glass-border)", paddingTop: "8px" }}>
                        <span className="station-label">Pantry Car?</span>
                        <span style={{
                          fontSize: "0.8rem",
                          fontWeight: "700",
                          color: scheduleResults.HasPantry ? "var(--success)" : "var(--danger)",
                          background: scheduleResults.HasPantry ? "var(--success-bg)" : "var(--danger-bg)",
                          padding: "2px 10px",
                          borderRadius: "10px",
                          border: `1px solid ${scheduleResults.HasPantry ? "var(--success)" : "var(--danger)"}`
                        }}>
                          {scheduleResults.HasPantry ? "Available" : "Not Available"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Coach Position Visualizer */}
                  {scheduleResults.CoachPosition && (
                    <div className="pnr-details-card">
                      <h4 style={{ marginBottom: "12px", borderBottom: "1px solid var(--glass-border)", paddingBottom: "6px" }}>Coach Position Layout</h4>
                      <div className="coach-scroll-container" style={{ overflowX: "auto", padding: "10px 0" }}>
                        <div style={{ display: "flex", gap: "8px", alignItems: "flex-end", minWidth: "max-content" }}>
                          {(() => {
                            const coaches = parseCoachPosition(scheduleResults.CoachPosition).reverse();
                            return coaches.map((coach, idx) => {
                              let typeClass = "coach-gen";
                              const tUpper = coach.type.toUpperCase();
                              if (tUpper === "EN" || tUpper === "ENGINE" || tUpper === "LOCO" || tUpper === "DHNE") {
                                const isRightHalf = idx >= coaches.length / 2;
                                typeClass = `coach-engine ${isRightHalf ? 'coach-engine-right' : 'coach-engine-left'}`;
                              }
                              else if (tUpper === "AC" || tUpper.includes("3A") || tUpper.includes("2A") || tUpper.includes("1A") || tUpper.includes("3E")) typeClass = "coach-ac";
                              else if (tUpper === "SL" || tUpper.includes("SLEEPER")) typeClass = "coach-sleeper";
                              else if (tUpper === "PC" || tUpper === "PANTRY") typeClass = "coach-pantry";

                              return (
                                <div key={idx} className={`coach-box ${typeClass}`}>
                                  <div style={{ fontSize: "0.8rem", fontWeight: "700" }}>{coach.label}</div>
                                  <div style={{ fontSize: "0.6rem", opacity: 0.8 }}>{coach.type}</div>
                                  <div className="coach-wheels" style={{ display: "flex", justifyContent: "space-between", width: "80%", position: "absolute", bottom: "-4px" }}>
                                    <span style={{ width: "6px", height: "6px", background: "#334155", borderRadius: "50%" }}></span>
                                    <span style={{ width: "6px", height: "6px", background: "#334155", borderRadius: "50%" }}></span>
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Timetable List Table */}
                  <div className="pnr-details-card" style={{ overflowX: "auto" }}>
                    <table className="pnr-table">
                      <thead>
                        <tr>
                          <th>Halt</th>
                          <th>Station Details</th>
                          <th>Arrival</th>
                          <th>Departure</th>
                          <th>Halt Time</th>
                          <th>Distance</th>
                          <th>Platform</th>
                          <th>Intermediate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scheduleResults.Schedule?.map((stn, index) => {
                          const hasIntermediates = stn.intermediateStations && stn.intermediateStations.length > 0;
                          const isExpanded = !!expandedScheduleStns[stn.StationCode];
                          
                          return (
                            <Fragment key={stn.StationCode}>
                              <tr>
                                <td>{stn.StopNumber || stn.stopNumberDisplay || (index + 1)}</td>
                                <td>
                                  <strong>{stn.StationName}</strong> ({stn.StationCode})
                                </td>
                                <td>{stn.ArrivalTime || "Origin"}</td>
                                <td>{stn.DepartureTime || "Destination"}</td>
                                <td>{stn.HaltMinutes && parseInt(stn.HaltMinutes) > 0 ? `${stn.HaltMinutes} mins` : "--"}</td>
                                <td>{stn.Distance} km</td>
                                <td>{stn.ExpectedPlatformNo && stn.ExpectedPlatformNo !== "0" ? `PF: ${stn.ExpectedPlatformNo}` : "--"}</td>
                                <td>
                                  {hasIntermediates ? (
                                    <button 
                                      type="button" 
                                      className="btn-toggle-minor"
                                      onClick={() => toggleIntermediate(stn.StationCode)}
                                      style={{
                                        background: isExpanded ? "var(--accent-purple)" : "var(--accent-glow)",
                                        color: isExpanded ? "#ffffff" : "var(--accent-purple)",
                                        border: "1px solid rgba(124, 58, 237, 0.2)",
                                        borderRadius: "4px",
                                        padding: "2px 6px",
                                        fontSize: "0.7rem",
                                        fontWeight: "600",
                                        cursor: "pointer"
                                      }}
                                    >
                                      {isExpanded ? "Hide" : `Show (${stn.intermediateStations.length})`}
                                    </button>
                                  ) : "--"}
                                </td>
                              </tr>
                              
                              {/* Render Expanded Intermediate Stations */}
                              {hasIntermediates && isExpanded && (
                                <tr>
                                  <td colSpan={8} style={{ padding: "0 0 12px 0", background: "rgba(124, 58, 237, 0.01)" }}>
                                    <div style={{
                                      marginLeft: "30px",
                                      borderLeft: "2px dashed var(--accent-purple)",
                                      paddingLeft: "15px",
                                      marginTop: "4px",
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: "6px"
                                    }}>
                                      <div style={{ fontSize: "0.75rem", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Intermediate Stations (Passed without halting)</div>
                                      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "10px", fontSize: "0.8rem", color: "var(--text-secondary)", background: "var(--bg-tertiary)", padding: "6px 12px", borderRadius: "6px", fontWeight: "600" }}>
                                        <span>Station</span>
                                        <span>Arrival</span>
                                        <span>Departure</span>
                                        <span>Distance</span>
                                      </div>
                                      {stn.intermediateStations.map((istn, iidx) => (
                                        <div key={iidx} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "10px", fontSize: "0.8rem", padding: "4px 12px", borderBottom: "1px solid rgba(148, 163, 184, 0.08)" }}>
                                          <span><strong>{istn.StationName}</strong> ({istn.StationCode})</span>
                                          <span>{istn.ArrivalTime || "--:--"}</span>
                                          <span>{istn.DepartureTime || "--:--"}</span>
                                          <span>{istn.Distance} km</span>
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: SEAT SWAP MARKETPLACE & IN-APP COORDINATION */}
          {activeTab === "swap" && (
            <div>
              {swapSuccessBanner && (
                <div style={{
                  background: "var(--success-bg)",
                  border: "1px solid var(--success)",
                  color: "var(--success)",
                  padding: "12px 16px",
                  borderRadius: "12px",
                  marginBottom: "16px",
                  fontWeight: "700",
                  fontSize: "0.9rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "10px"
                }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <CheckCircle2 size={18} /> {swapSuccessBanner}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSwapSuccessBanner("")}
                    style={{ background: "transparent", border: "none", color: "var(--success)", cursor: "pointer", fontWeight: "800" }}
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Header & Status Filter Bar */}
              <div className="results-header" style={{ flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <h3 className="results-title" style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "1.2rem" }}>
                    <Users size={22} style={{ color: "var(--accent-purple)" }} />
                    Live Seat Swap Board — Travel Together with Family
                  </h3>
                  <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                    Propose a mutual seat swap, approve co-passenger offers, and coordinate via in-app messages (no phone number sharing required).
                  </p>
                </div>

                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {[
                    { id: "ALL", label: `All (${swapsList.length})` },
                    { id: "OPEN", label: `Open (${swapsList.filter(s => s.status === "OPEN").length})` },
                    { id: "MATCHED", label: `Matched (${swapsList.filter(s => s.status === "MATCHED").length})` },
                    { id: "MINE", label: `My Requests (${mySwapIds.length})` }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSwapStatusFilter(tab.id)}
                      style={{
                        padding: "6px 12px",
                        fontSize: "0.76rem",
                        fontWeight: "700",
                        borderRadius: "999px",
                        border: swapStatusFilter === tab.id ? "none" : "1px solid var(--glass-border)",
                        background: swapStatusFilter === tab.id ? "var(--accent-gradient)" : "var(--bg-secondary)",
                        color: swapStatusFilter === tab.id ? "#ffffff" : "var(--text-secondary)",
                        cursor: "pointer"
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {(() => {
                const formattedFilterDate = swapFilterDate ? formatDate(swapFilterDate) : "";
                const filteredSwaps = swapsList.filter(s => {
                  if (swapStatusFilter === "OPEN" && s.status !== "OPEN") return false;
                  if (swapStatusFilter === "MATCHED" && s.status !== "MATCHED") return false;
                  if (swapStatusFilter === "MINE" && !mySwapIds.includes(s.id)) return false;
                  if (swapFilterTrain && !s.trainNo.includes(swapFilterTrain.trim())) return false;
                  if (formattedFilterDate && s.doj !== formattedFilterDate) return false;
                  if (swapFilterClass !== "ALL" && s.travelClass.toUpperCase() !== swapFilterClass.toUpperCase()) return false;
                  if (swapFilterCoach) {
                    const qCoach = swapFilterCoach.trim().toUpperCase();
                    const matchesCurrent = s.currentCoach.toUpperCase().includes(qCoach);
                    const matchesTarget = s.targetCoach.toUpperCase().includes(qCoach) || s.targetCoach === "ANY";
                    if (!matchesCurrent && !matchesTarget) return false;
                  }
                  return true;
                });

                if (filteredSwaps.length === 0) {
                  return (
                    <div className="welcome-placeholder" style={{ padding: "36px 20px" }}>
                      <ArrowLeftRight size={40} style={{ color: "var(--accent-purple)", marginBottom: "10px" }} />
                      <h4 style={{ fontSize: "1.1rem", fontWeight: "700", color: "var(--text-primary)", marginBottom: "6px" }}>
                        No Seat Swap Requests Match Your Filters
                      </h4>
                      <p style={{ fontSize: "0.86rem", marginBottom: "14px" }}>
                        Be the first on your train to post a Seat Swap request so co-passengers in your family&apos;s coach can swap with you!
                      </p>
                      <button
                        type="button"
                        className="btn-book-now"
                        onClick={() => setSwapSubMode("create")}
                      >
                        + Raise Seat Swap Request
                      </button>
                    </div>
                  );
                }

                return (
                  <div>
                    {filteredSwaps.map((swap) => {
                      const isMine = mySwapIds.includes(swap.id);
                      const isMatched = swap.status === "MATCHED";
                      const isMutualCoachHighlight =
                        swapFilterCoach &&
                        (swap.targetCoach.toUpperCase() === swapFilterCoach.trim().toUpperCase() ||
                          swap.currentCoach.toUpperCase() === swapFilterCoach.trim().toUpperCase());
                      const isChatOpen = !!expandedChatSwapIds[swap.id];
                      const offersCount = (swap.offers || []).length;
                      const messagesCount = (swap.messages || []).length;
                      const approvedOffer = (swap.offers || []).find(o => o.status === "APPROVED");

                      return (
                        <div
                          key={swap.id}
                          className={`swap-card ${isMatched ? "swap-card-matched" : ""} ${isMutualCoachHighlight ? "swap-card-mutual" : ""}`}
                        >
                          {/* Top Row: Train Info + Status Badges */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px" }}>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                <span className="train-number-badge">{swap.trainNo}</span>
                                <span className="train-name-text">{swap.trainName}</span>
                                <span className="quota-badge date-badge" style={{ fontSize: "0.7rem", padding: "2px 7px" }}>
                                  {swap.doj}
                                </span>
                                <span className="quota-badge quota-gn" style={{ fontSize: "0.7rem", padding: "2px 7px" }}>
                                  {swap.fromStn} ➔ {swap.toStn} • {swap.travelClass}
                                </span>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "6px" }}>
                                <span style={{ fontSize: "0.82rem", fontWeight: "700", color: "var(--text-primary)" }}>
                                  Passenger: {swap.passengerName}
                                </span>
                                {isMine && (
                                  <span style={{
                                    fontSize: "0.68rem",
                                    fontWeight: "800",
                                    padding: "2px 8px",
                                    borderRadius: "999px",
                                    background: "var(--accent-glow)",
                                    color: "var(--accent-purple)"
                                  }}>
                                    Your Request
                                  </span>
                                )}
                                {swap.pnrVerified && (
                                  <span className="swap-verified-pill">
                                    <ShieldCheck size={12} /> PNR Verified {swap.maskedPnr ? `(${swap.maskedPnr})` : ""}
                                  </span>
                                )}
                                <span className="swap-reason-pill">
                                  {swap.reasonLabel || "Family Split Across Coaches"}
                                </span>
                              </div>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              {isMutualCoachHighlight && !isMatched && (
                                <span style={{
                                  fontSize: "0.7rem",
                                  fontWeight: "800",
                                  background: "#fef3c7",
                                  color: "#b45309",
                                  border: "1px solid #f59e0b",
                                  padding: "3px 8px",
                                  borderRadius: "999px",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px"
                                }}>
                                  <Sparkles size={12} /> Coach Match
                                </span>
                              )}
                              <span style={{
                                fontSize: "0.72rem",
                                fontWeight: "800",
                                padding: "4px 10px",
                                borderRadius: "999px",
                                textTransform: "uppercase",
                                background: isMatched ? "var(--success-bg)" : "rgba(124, 58, 237, 0.1)",
                                color: isMatched ? "var(--success)" : "var(--accent-purple)",
                                border: `1px solid ${isMatched ? "var(--success)" : "rgba(124, 58, 237, 0.25)"}`
                              }}>
                                {isMatched ? "✓ Swap Matched" : "● Open for Swap"}
                              </span>
                            </div>
                          </div>

                          {/* Visual Seat Exchange Grid */}
                          <div className="swap-exchange-grid">
                            <div className="swap-seat-box">
                              <span className="swap-seat-role">Offering Current Seat</span>
                              <div className="swap-seat-main">
                                <span>Coach {swap.currentCoach} • Berth #{swap.currentBerth}</span>
                                <span className="swap-berth-tag">{swap.currentBerthType}</span>
                              </div>
                              <span style={{ fontSize: "0.74rem", color: "var(--text-secondary)" }}>
                                Confirmed in {swap.travelClass}
                              </span>
                            </div>

                            <div className="swap-arrow-circle" title="Mutual Seat Exchange">
                              <ArrowLeftRight size={17} />
                            </div>

                            <div className="swap-seat-box target-box">
                              <span className="swap-seat-role">Looking For Seat In</span>
                              <div className="swap-seat-main">
                                <span>
                                  {swap.targetCoach === "ANY" ? "Any Coach" : `Coach ${swap.targetCoach}`}
                                </span>
                                <span className="swap-berth-tag">
                                  {swap.targetBerthType === "ANY" ? "Any Berth" : swap.targetBerthType}
                                </span>
                              </div>
                              {swap.familyContextCoach && (
                                <span style={{ fontSize: "0.74rem", color: "var(--accent-purple)", fontWeight: "700" }}>
                                  Family in Coach {swap.familyContextCoach} {swap.familyContextBerths ? `(Berth #${swap.familyContextBerths})` : ""}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Passenger Note */}
                          {swap.note && (
                            <div style={{
                              fontSize: "0.84rem",
                              color: "var(--text-secondary)",
                              background: "rgba(148, 163, 184, 0.07)",
                              padding: "8px 12px",
                              borderRadius: "8px",
                              borderLeft: "3px solid var(--accent-blue)"
                            }}>
                              &ldquo;{swap.note}&rdquo;
                            </div>
                          )}

                          {/* Matched Banner if Approved */}
                          {isMatched && approvedOffer && (
                            <div style={{
                              background: "var(--success-bg)",
                              border: "1px solid rgba(22, 163, 74, 0.35)",
                              borderRadius: "10px",
                              padding: "10px 12px",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              flexWrap: "wrap",
                              gap: "8px"
                            }}>
                              <div style={{ fontSize: "0.83rem", color: "var(--success)", fontWeight: "700" }}>
                                🎉 Swap Confirmed: <strong>{swap.passengerName}</strong> ({swap.currentCoach} #{swap.currentBerth}) ⇄ <strong>{approvedOffer.responderName}</strong> ({approvedOffer.offeredCoach} #{approvedOffer.offeredBerth} {approvedOffer.offeredBerthType})
                              </div>
                              <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", fontWeight: "600" }}>
                                Tip: Inform the TTE onboard after switching seats.
                              </span>
                            </div>
                          )}

                          {/* Action Bar */}
                          <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            borderTop: "1px dashed var(--glass-border)",
                            paddingTop: "10px",
                            flexWrap: "wrap",
                            gap: "8px"
                          }}>
                            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                              {!isMatched && (
                                <button
                                  type="button"
                                  className="btn-book-now"
                                  onClick={() => {
                                    setActiveOfferSwapId(activeOfferSwapId === swap.id ? null : swap.id);
                                    if (swap.targetCoach && swap.targetCoach !== "ANY") {
                                      setOfferCoach(swap.targetCoach);
                                    }
                                  }}
                                >
                                  <ArrowLeftRight size={14} style={{ marginRight: "5px" }} />
                                  {activeOfferSwapId === swap.id ? "Close Offer Form" : "Offer to Swap Seat"}
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedChatSwapIds(prev => ({ ...prev, [swap.id]: !prev[swap.id] }))
                                }
                                style={{
                                  background: isChatOpen ? "var(--accent-glow)" : "var(--bg-tertiary)",
                                  color: isChatOpen ? "var(--accent-purple)" : "var(--text-secondary)",
                                  border: "1px solid var(--glass-border)",
                                  padding: "6px 12px",
                                  borderRadius: "8px",
                                  fontSize: "0.78rem",
                                  fontWeight: "700",
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "6px"
                                }}
                              >
                                <MessageSquare size={14} />
                                Proposals ({offersCount}) & In-App Chat ({messagesCount})
                              </button>
                            </div>

                            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                              In-App Approval & Messaging Only • Safe & Private
                            </span>
                          </div>

                          {/* Inline Offer Proposal Form Drawer */}
                          {activeOfferSwapId === swap.id && !isMatched && (
                            <form onSubmit={(e) => handleSendSwapOffer(e, swap.id)} className="swap-offer-drawer">
                              <div style={{ fontSize: "0.82rem", fontWeight: "800", color: "var(--accent-purple)", marginBottom: "8px" }}>
                                Propose Your Seat to {swap.passengerName}
                              </div>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "8px", marginBottom: "8px" }}>
                                <div>
                                  <label className="form-label" style={{ fontSize: "0.68rem" }}>Your Name *</label>
                                  <input
                                    type="text"
                                    placeholder="E.g. Priya K."
                                    className="form-input"
                                    style={{ padding: "7px 9px", fontSize: "0.84rem", width: "100%" }}
                                    value={offerResponderName}
                                    onChange={(e) => setOfferResponderName(e.target.value)}
                                    required
                                  />
                                </div>
                                <div>
                                  <label className="form-label" style={{ fontSize: "0.68rem" }}>Your Coach *</label>
                                  <input
                                    type="text"
                                    placeholder={swap.targetCoach !== "ANY" ? swap.targetCoach : "B2"}
                                    className="form-input"
                                    style={{ padding: "7px 9px", fontSize: "0.84rem", width: "100%" }}
                                    value={offerCoach}
                                    onChange={(e) => setOfferCoach(e.target.value.toUpperCase())}
                                    required
                                  />
                                </div>
                                <div>
                                  <label className="form-label" style={{ fontSize: "0.68rem" }}>Your Berth # *</label>
                                  <input
                                    type="text"
                                    placeholder="21"
                                    className="form-input"
                                    style={{ padding: "7px 9px", fontSize: "0.84rem", width: "100%" }}
                                    value={offerBerth}
                                    onChange={(e) => setOfferBerth(e.target.value.replace(/\D/g, ""))}
                                    required
                                  />
                                </div>
                                <div>
                                  <label className="form-label" style={{ fontSize: "0.68rem" }}>Berth Type</label>
                                  <select
                                    className="form-input"
                                    style={{ padding: "7px 8px", fontSize: "0.84rem", width: "100%" }}
                                    value={offerBerthType}
                                    onChange={(e) => setOfferBerthType(e.target.value)}
                                  >
                                    <option value="LB">LB</option>
                                    <option value="MB">MB</option>
                                    <option value="UB">UB</option>
                                    <option value="SL">SL</option>
                                    <option value="SU">SU</option>
                                    <option value="WS">WS</option>
                                  </select>
                                </div>
                              </div>
                              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                <input
                                  type="text"
                                  placeholder="Message (e.g. I am in B2 #21 near your family and happy to take your B4 seat!)"
                                  className="form-input"
                                  style={{ padding: "8px 10px", fontSize: "0.84rem", flex: 1 }}
                                  value={offerMessage}
                                  onChange={(e) => setOfferMessage(e.target.value)}
                                />
                                <button type="submit" className="btn-book-now" style={{ padding: "8px 14px" }}>
                                  Send Proposal
                                </button>
                              </div>
                            </form>
                          )}

                          {/* Expandable Proposals & In-App Chat Thread */}
                          {isChatOpen && (
                            <div className="swap-chat-box">
                              {/* 1. Swap Offers / Proposals List */}
                              <div>
                                <div style={{ fontSize: "0.75rem", fontWeight: "800", textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: "6px" }}>
                                  Swap Proposals ({offersCount})
                                </div>
                                {offersCount === 0 ? (
                                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                                    No swap proposals yet. Click &ldquo;Offer to Swap Seat&rdquo; above to propose a swap!
                                  </div>
                                ) : (
                                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                    {swap.offers.map((offer) => (
                                      <div
                                        key={offer.id}
                                        style={{
                                          background: "#ffffff",
                                          border: "1px solid var(--glass-border)",
                                          borderRadius: "8px",
                                          padding: "8px 12px",
                                          display: "flex",
                                          justifyContent: "space-between",
                                          alignItems: "center",
                                          flexWrap: "wrap",
                                          gap: "8px"
                                        }}
                                      >
                                        <div>
                                          <div style={{ fontSize: "0.84rem", fontWeight: "700", color: "var(--text-primary)" }}>
                                            {offer.responderName} offers <strong>Coach {offer.offeredCoach} • Berth #{offer.offeredBerth} ({offer.offeredBerthType})</strong>
                                          </div>
                                          {offer.message && (
                                            <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                                              &ldquo;{offer.message}&rdquo;
                                            </div>
                                          )}
                                        </div>

                                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                          {offer.status === "PENDING" && !isMatched ? (
                                            <>
                                              <button
                                                type="button"
                                                onClick={() => handleRespondSwapOffer(swap.id, offer.id, "APPROVED")}
                                                style={{
                                                  background: "var(--success)",
                                                  color: "#ffffff",
                                                  border: "none",
                                                  borderRadius: "6px",
                                                  padding: "5px 10px",
                                                  fontSize: "0.74rem",
                                                  fontWeight: "700",
                                                  cursor: "pointer",
                                                  display: "inline-flex",
                                                  alignItems: "center",
                                                  gap: "4px"
                                                }}
                                                title="Approve this seat swap proposal"
                                              >
                                                <CheckCircle2 size={13} /> Approve Swap
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleRespondSwapOffer(swap.id, offer.id, "DECLINED")}
                                                style={{
                                                  background: "var(--danger-bg)",
                                                  color: "var(--danger)",
                                                  border: "1px solid rgba(220, 38, 38, 0.3)",
                                                  borderRadius: "6px",
                                                  padding: "5px 10px",
                                                  fontSize: "0.74rem",
                                                  fontWeight: "700",
                                                  cursor: "pointer",
                                                  display: "inline-flex",
                                                  alignItems: "center",
                                                  gap: "4px"
                                                }}
                                              >
                                                <XCircle size={13} /> Decline
                                              </button>
                                            </>
                                          ) : (
                                            <span style={{
                                              fontSize: "0.72rem",
                                              fontWeight: "800",
                                              padding: "3px 8px",
                                              borderRadius: "6px",
                                              background: offer.status === "APPROVED" ? "var(--success-bg)" : "var(--bg-tertiary)",
                                              color: offer.status === "APPROVED" ? "var(--success)" : "var(--text-muted)"
                                            }}>
                                              {offer.status === "APPROVED" ? "✓ Approved" : "Declined"}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* 2. In-App Messages Thread */}
                              <div style={{ borderTop: "1px solid var(--glass-border)", paddingTop: "8px" }}>
                                <div style={{ fontSize: "0.75rem", fontWeight: "800", textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: "6px" }}>
                                  In-App Co-Passenger Coordination Chat
                                </div>

                                {messagesCount > 0 && (
                                  <div className="swap-messages-list" style={{ marginBottom: "8px" }}>
                                    {swap.messages.map((msg) => (
                                      <div
                                        key={msg.id}
                                        className={`swap-msg-bubble ${msg.senderRole === "REQUESTER" ? "msg-requester" : "msg-responder"}`}
                                      >
                                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", marginBottom: "2px" }}>
                                          <strong style={{ color: msg.senderRole === "REQUESTER" ? "var(--accent-purple)" : "var(--accent-blue)" }}>
                                            {msg.senderName} ({msg.senderRole === "REQUESTER" ? "Requester" : "Co-Passenger"})
                                          </strong>
                                        </div>
                                        <div style={{ color: "var(--text-primary)" }}>{msg.text}</div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                <form
                                  onSubmit={(e) => handleSendSwapChatMessage(e, swap)}
                                  style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}
                                >
                                  <select
                                    className="form-input"
                                    style={{ padding: "6px 8px", fontSize: "0.76rem", width: "130px" }}
                                    value={chatSenderRoles[swap.id] || (isMine ? "REQUESTER" : "RESPONDER")}
                                    onChange={(e) =>
                                      setChatSenderRoles(prev => ({ ...prev, [swap.id]: e.target.value }))
                                    }
                                  >
                                    <option value="RESPONDER">As Co-Passenger</option>
                                    <option value="REQUESTER">As {swap.passengerName}</option>
                                  </select>
                                  <input
                                    type="text"
                                    placeholder="Your Name (optional)"
                                    className="form-input"
                                    style={{ padding: "6px 8px", fontSize: "0.78rem", width: "130px" }}
                                    value={chatSenderNames[swap.id] || ""}
                                    onChange={(e) =>
                                      setChatSenderNames(prev => ({ ...prev, [swap.id]: e.target.value }))
                                    }
                                  />
                                  <input
                                    type="text"
                                    placeholder="Write an in-app message to coordinate boarding & seat switch..."
                                    className="form-input"
                                    style={{ padding: "6px 10px", fontSize: "0.82rem", flex: 1, minWidth: "180px" }}
                                    value={chatInputs[swap.id] || ""}
                                    onChange={(e) =>
                                      setChatInputs(prev => ({ ...prev, [swap.id]: e.target.value }))
                                    }
                                  />
                                  <button
                                    type="submit"
                                    className="btn-book-now"
                                    style={{ padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                                  >
                                    <Send size={13} /> Send
                                  </button>
                                </form>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}
        </section>

        {!loading && !error && !hasResults && (
          <div className="bento-command-grid">
            {/* Bento Card 1: Popular High-Demand Railway Corridors */}
            <div className="bento-card bento-span-7">
              <div>
                <div className="bento-card-header" style={{ marginBottom: "8px" }}>
                  <span style={{ fontSize: "0.96rem", fontWeight: "800", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                    <Sparkles size={18} style={{ color: "var(--accent-indigo)" }} />
                    1-Click Popular Corridors
                  </span>
                  <span className="bento-badge">Smart Seat Radar</span>
                </div>
                <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: "14px" }}>
                  Select a popular corridor below to pre-fill stations and scan direct + nearby 100 km stations for confirmed General &amp; Tatkal seats.
                </p>

                <div className="corridor-grid">
                  {[
                    { fromCode: "NDLS", fromName: "New Delhi", toCode: "MMCT", toName: "Mumbai Central" },
                    { fromCode: "SBC", fromName: "KSR Bengaluru", toCode: "MAS", toName: "MGR Chennai Ctrl" },
                    { fromCode: "SC", fromName: "Secunderabad Jn", toCode: "VSKP", toName: "Visakhapatnam" },
                    { fromCode: "HWH", fromName: "Howrah Jn", toCode: "NDLS", toName: "New Delhi" }
                  ].map((c, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="corridor-pill-btn"
                      onClick={() => handleQuickCorridorSelect(c.fromCode, c.fromName, c.toCode, c.toName)}
                    >
                      <div>
                        <div className="corridor-codes">{c.fromCode} ➔ {c.toCode}</div>
                        <div className="corridor-names">{c.fromName} to {c.toName}</div>
                      </div>
                      <ArrowRight size={15} style={{ color: "var(--accent-indigo)" }} />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Bento Card 2: Live Family Seat Swap Spotlight */}
            <div className="bento-card bento-span-5" style={{ background: "linear-gradient(135deg, rgba(79, 70, 229, 0.04), rgba(124, 58, 237, 0.09))", borderColor: "rgba(79, 70, 229, 0.22)" }}>
              <div>
                <div className="bento-card-header" style={{ marginBottom: "8px" }}>
                  <span style={{ fontSize: "0.96rem", fontWeight: "800", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                    <ArrowLeftRight size={18} style={{ color: "var(--accent-purple)" }} />
                    Family Seat Swap Hub
                  </span>
                  <span className="swap-new-badge">LIVE</span>
                </div>
                <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: "12px" }}>
                  Got seats in different coaches from your family or need a lower berth for a senior citizen? Exchange seats with co-passengers on the same train.
                </p>

                {swapsList[0] && (
                  <div style={{ background: "#ffffff", borderRadius: "10px", padding: "10px 12px", border: "1px solid var(--glass-border)", marginBottom: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <span className="train-number-badge" style={{ fontSize: "0.7rem" }}>{swapsList[0].trainNo} {swapsList[0].trainName}</span>
                      <span className="swap-verified-pill">PNR Verified</span>
                    </div>
                    <div style={{ fontSize: "0.82rem", fontWeight: "800", color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                      Coach {swapsList[0].currentCoach} #{swapsList[0].currentBerth} ({swapsList[0].currentBerthType}) ⇄ Coach {swapsList[0].targetCoach}
                    </div>
                    <div style={{ fontSize: "0.73rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                      {swapsList[0].passengerName} • {swapsList[0].reasonLabel}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className="btn-book-now"
                  style={{ flex: 1, padding: "9px 12px" }}
                  onClick={() => {
                    setActiveTab("swap");
                    setSwapSubMode("browse");
                  }}
                >
                  Open Seat Swap Board ({swapsList.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("swap");
                    setSwapSubMode("create");
                  }}
                  style={{
                    background: "#ffffff",
                    border: "1px solid var(--glass-border-strong)",
                    color: "var(--accent-indigo)",
                    borderRadius: "9px",
                    padding: "9px 12px",
                    fontSize: "0.78rem",
                    fontWeight: "700",
                    cursor: "pointer"
                  }}
                >
                  + Raise Swap
                </button>
              </div>
            </div>

            {/* Bento Card 3: Instant Interactive Preview Strip */}
            <div className="bento-card bento-span-12">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <div style={{ fontSize: "0.92rem", fontWeight: "800", color: "var(--text-primary)" }}>
                    Explore RailSaathi Intelligence Modules
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    Test live PNR confirmation analytics, 3D-style coach rake layout, or split-family seat swap matching in one click.
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("pnr");
                      handleLoadDemoPnr();
                    }}
                    style={{
                      background: "#ffffff",
                      border: "1px solid var(--glass-border-strong)",
                      color: "var(--text-primary)",
                      borderRadius: "10px",
                      padding: "8px 14px",
                      fontSize: "0.8rem",
                      fontWeight: "700",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    <FileText size={15} style={{ color: "var(--accent-indigo)" }} /> Preview PNR &amp; Coach Layout
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("swap");
                      setSwapSubMode("create");
                      handleLoadSampleSplitPnrForSwap();
                    }}
                    style={{
                      background: "var(--accent-glow)",
                      border: "1px solid rgba(79, 70, 229, 0.25)",
                      color: "var(--accent-indigo)",
                      borderRadius: "10px",
                      padding: "8px 14px",
                      fontSize: "0.8rem",
                      fontWeight: "700",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    <Sparkles size={15} /> Try Split-Coach PNR Auto-Fill
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  </main>
      </div>
    </>
  );
}
