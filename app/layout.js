import "./globals.css";

export const metadata = {
  title: "RailSaathi | Smart Indian Railways & Seat Swap Hub",
  description: "Search trains between stations, check live running status, PNR predictions, smart seat availability, and swap seats with co-passengers to travel together with family.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
