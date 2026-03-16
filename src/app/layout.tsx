import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Social Content Engine',
  description: 'Automated social media content engine',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
