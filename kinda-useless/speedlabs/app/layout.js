import "./globals.css";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Set the Title of the Tab */}
        <title>SpeedLabs | Effortless Car Sales and Marketing</title>

        {/* Add a Meta Description for SEO */}
        <meta
          name="description"
          content="Discover effortless car sales and marketing solutions with SpeedLabs. Sell or buy cars seamlessly with professional photography, videography, and dedicated support."
        />

        {/* Add a Favicon */}
        <link rel="icon" href="/images/12.png" />

        {/* Add Meta Tags for Mobile Responsiveness */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        {/* Add Open Graph Tags for Social Sharing */}
        <meta
          property="og:title"
          content="SpeedLabs | Effortless Car Sales and Marketing"
        />
        <meta
          property="og:description"
          content="Discover effortless car sales and marketing solutions with SpeedLabs. Professional photography, videography, and dedicated support tailored for you."
        />
        <meta property="og:image" content="/og-image.png" />
        <meta property="og:url" content="https://speedlabs.vercel.app/" />
        <meta property="og:type" content="website" />
      </head>
      <body>{children}</body>
    </html>
  );
}
