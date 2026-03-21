import type { Metadata } from "next";
import CheckoutForm from "@/components/CheckoutForm";
import { paramsFromSearchParams } from "@/lib/metadata";

export const metadata: Metadata = {
  title: "Balloons in the Sky",
  description: "Mint your generative balloon NFT by Bård Ionson & Jennifer Ionson",
};

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

export default function Page({ searchParams }: PageProps) {
  const params = paramsFromSearchParams(searchParams);
  const cid = typeof searchParams.cid === "string" ? searchParams.cid : null;
  const ipfsGateway = cid ? `https://ipfs.io/ipfs/${cid}` : null;

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center px-4 py-16">
      {/* Header */}
      <div className="mb-8 text-center">
        <p className="text-white/40 text-xs tracking-widest uppercase mb-2">
          Bård Ionson &amp; Jennifer Ionson
        </p>
        <h1 className="text-3xl font-light text-white tracking-wide">
          Balloons in the Sky
        </h1>
      </div>

      {/* NFT Preview */}
      {ipfsGateway && (
        <div className="mb-8 rounded-xl overflow-hidden shadow-2xl max-w-xs w-full aspect-square bg-white/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ipfsGateway}
            alt={params ? `Balloon #${params.unitNumber} — ${params.uniqueName}` : "Balloon artwork"}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Metadata summary */}
      {params && (
        <div className="mb-8 text-center">
          <p className="text-white text-lg font-medium">
            #{params.unitNumber} &mdash; {params.uniqueName}
          </p>
          <p className="text-white/50 text-sm mt-1">{params.eventName} &middot; {params.timestamp}</p>
        </div>
      )}

      {/* No params state */}
      {!params && (
        <div className="mb-8 text-center max-w-xs">
          <p className="text-white/40 text-sm">
            This page is accessed via the installation QR code. No balloon parameters found in the URL.
          </p>
        </div>
      )}

      {/* Checkout form */}
      {params ? (
        <CheckoutForm params={params} />
      ) : (
        <p className="text-white/30 text-xs">Visit the installation to mint a balloon.</p>
      )}

      {/* Footer */}
      <footer className="mt-16 text-white/20 text-xs text-center">
        <p>Sepolia testnet &middot; Powered by Crossmint</p>
      </footer>
    </main>
  );
}
