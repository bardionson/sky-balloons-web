'use client'

import { useActiveAccount } from 'thirdweb/react'
import { ARTIST_ADDRESS } from '@/lib/project-config'
import { useOwnerAddress } from '@/lib/hooks/useOwnerAddress'
import { ReactNode, useEffect, useState } from 'react'

export default function AccessControl({
  children,
  requiredRole
}: {
  children: ReactNode,
  requiredRole: 'artist' | 'owner'
}) {
  const account = useActiveAccount()
  const { ownerAddress, isBlocked } = useOwnerAddress()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) return null // Wait for client hydration to avoid mismatch

  const isDev = process.env.NODE_ENV === 'development'
  if (isDev) return <>{children}</>

  const address = account?.address?.toLowerCase()

  if (requiredRole === 'artist') {
    if (address !== ARTIST_ADDRESS) {
      return (
        <main className="min-h-screen bg-surface flex flex-col items-center justify-center p-8">
          <div className="bg-error_container/20 border border-error_container p-8 rounded-sm text-center max-w-md">
            <p className="font-mono text-error font-bold mb-4">[ ACCESS_DENIED ]</p>
            <p className="font-mono text-error/80 text-xs">
              Unrecognized signature. You do not have `ARTIST` clearance to view this directory.
            </p>
          </div>
        </main>
      )
    }
    return <>{children}</>
  }

  // requiredRole === 'owner'
  if (isBlocked) {
    return (
      <main className="min-h-screen bg-surface flex flex-col items-center justify-center p-8">
        <div className="bg-surface_container_highest border border-outline_variant/30 p-8 rounded-sm text-center max-w-md">
          <p className="font-mono text-on_surface_variant text-xs">[ DEED_LOOKUP_IN_PROGRESS ]</p>
          <p className="font-mono text-on_surface_variant/60 text-xs mt-2">
            RESOLVING_DEED_HOLDER_FROM_CHAIN
          </p>
        </div>
      </main>
    )
  }

  if (address !== ownerAddress) {
    return (
      <main className="min-h-screen bg-surface flex flex-col items-center justify-center p-8">
        <div className="bg-error_container/20 border border-error_container p-8 rounded-sm text-center max-w-md">
          <p className="font-mono text-error font-bold mb-4">[ ACCESS_DENIED ]</p>
          <p className="font-mono text-error/80 text-xs">
            Unrecognized signature. You do not have `OWNER` clearance to view this directory.
          </p>
        </div>
      </main>
    )
  }

  return <>{children}</>
}
