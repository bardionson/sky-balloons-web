'use client'

import { ThirdwebProvider } from 'thirdweb/react'

export default function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThirdwebProvider>
      {children}
    </ThirdwebProvider>
  )
}
