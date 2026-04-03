'use client'

import { useActiveAccount } from 'thirdweb/react'
import { ARTIST_ADDRESS } from '@/lib/project-config'
import { ReactNode, useEffect, useState } from 'react'

export default function AccessControl({ 
  children, 
  requiredRole 
}: { 
  children: ReactNode, 
  requiredRole: 'artist' | 'owner' 
}) {
  const account = useActiveAccount()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) return null // Wait for client hydration to avoid mismatch

  // Bypass limits on localhost
  const isDev = process.env.NODE_ENV === 'development'
  const address = account?.address?.toLowerCase()
  
  const hasAccess = isDev || (requiredRole === 'artist'
    ? address === ARTIST_ADDRESS
    : false)

  if (!hasAccess) {
    return (
      <main className="min-h-screen bg-surface flex flex-col items-center justify-center p-8">
        <div className="bg-error_container/20 border border-error_container p-8 rounded-sm text-center max-w-md">
          <p className="font-mono text-error font-bold mb-4">[ ACCESS_DENIED ]</p>
          <p className="font-mono text-error/80 text-xs">
            Unrecognized signature. You do not have `{requiredRole.toUpperCase()}` clearance to view this directory.
          </p>
        </div>
      </main>
    )
  }

  return <>{children}</>
}
