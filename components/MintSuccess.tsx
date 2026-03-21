interface Props {
  tokenId: string | null
  txHash: string | null
  unitNumber: number
}

const NFT_ADDRESS = process.env.NEXT_PUBLIC_BALLOONS_NFT_ADDRESS ?? ''

export default function MintSuccess({ tokenId, txHash, unitNumber }: Props) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="text-5xl">🎈</div>
      <h2 className="text-xl font-semibold text-white">
        Balloon #{unitNumber} is yours!
      </h2>
      {tokenId && (
        <p className="text-white/60 text-sm">Token ID: {tokenId}</p>
      )}
      {txHash && (
        <a
          href={`https://sepolia.etherscan.io/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/50 underline text-xs hover:text-white/80"
        >
          View transaction on Etherscan ↗
        </a>
      )}
      <a
        href={`https://sepolia.etherscan.io/address/${NFT_ADDRESS}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-white/30 underline text-xs hover:text-white/60"
      >
        View contract ↗
      </a>
      <p className="text-white/40 text-sm mt-2">
        Check your email — Crossmint will send wallet access instructions.
      </p>
    </div>
  )
}
