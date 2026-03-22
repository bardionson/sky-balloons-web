'use client'

interface Props {
  cid: string
  alt: string
  className?: string
}

export default function IpfsImage({ cid, alt, className }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- IPFS gateways cannot be statically whitelisted; onError fallback requires plain <img>
    <img
      src={`https://gateway.lighthouse.storage/ipfs/${cid}`}
      alt={alt}
      className={className}
      onError={(e) => {
        const img = e.currentTarget
        if (!img.src.includes('ipfs.io')) {
          img.src = `https://ipfs.io/ipfs/${cid}`
        }
      }}
    />
  )
}
