# 🚆 RailSaathi 2.0 Pro — Smart Indian Railways & Family Seat Swap Hub

**RailSaathi** is a real-time Indian Railways intelligence, smart seat discovery, PNR analytics, and co-passenger **Family Seat Swap** platform built with **Next.js 16 (App Router)** and **React 19**.

---

## ✨ Key Capabilities

1. **🔍 Smart Train Search & 28-Day Seat Radar (`/api/trains`)**
   - Automatically expands single-station searches to nearby major stations within a **100 km Haversine radius**.
   - Progressively scans up to **4 weeks ahead** across both **General (`GN`)** and **Tatkal (`TQ`)** quotas to surface ranked, confirmed seat options.
   - Includes **City-Wide Station Autocomplete** (`All <City> Stations`) and 1-click Popular Corridors.

2. **⇄ Family Seat Swap & Berth Exchange Hub (`/api/swaps`)**
   - Helps families separated across different coaches or senior citizens allotted upper berths swap seats by mutual consent with co-passengers on the same train.
   - **✨ Auto-Fill via 10-Digit PNR** or **✍️ Manual Entry** (with automatic train name/route lookup).
   - **Private In-App Proposal Approval & Coordination Chat** — propose a seat, approve/decline swap offers, and coordinate onboard without exposing personal phone numbers.

3. **🎫 PNR Confirmation Analytics & 3D-Style Coach Rake Layout (`/api/pnr`)**
   - Real-time charting status, passenger-wise confirmation probability, platform numbers, punctuality/cleanliness/food ratings, and interactive coach position layout.
   - Includes a 1-click **"Request Seat Swap for this PNR"** shortcut.

4. **📍 Live GPS Train Running Status (`/api/status`)**
   - Real-time station timeline with current train location, delay minutes, distance covered, and platform numbers.

5. **🕒 Complete Train Timetable & Intermediate Halts (`/api/schedule`)**
   - Full route schedule, running days, coach composition, and expandable non-halting intermediate stations.

---

## 🚀 Getting Started Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
