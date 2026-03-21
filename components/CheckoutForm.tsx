"use client";

import { useState, useEffect, useRef } from "react";
import { CrossmintProvider, CrossmintEmbeddedCheckout } from "@crossmint/client-sdk-react-ui";
import type { BalloonParams } from "@/lib/metadata";

interface Props {
  params: BalloonParams;
}

type Phase = "form" | "payment" | "processing" | "success" | "error";

export default function CheckoutForm({ params }: Props) {
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [tokenId, setTokenId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clientKey = process.env.NEXT_PUBLIC_CROSSMINT_CLIENT_KEY ?? "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPhase("processing");
    setErrorMsg(null);

    try {
      const res = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, params }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Order creation failed");

      setOrderId(data.orderId);
      setClientSecret(data.clientSecret ?? null);
      setPhase("payment");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      setPhase("error");
    }
  }

  // Poll order status once we have an orderId
  useEffect(() => {
    if (!orderId || phase === "success" || phase === "error") return;

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/order-status?orderId=${orderId}`);
        if (!res.ok) return;
        const order = await res.json();

        if (order.payment?.status === "completed" || order.phase === "completed") {
          clearInterval(pollRef.current!);
          const tid = order.lineItems?.[0]?.metadata?.tokenId ?? null;
          setTokenId(tid);
          setPhase("success");
        }
      } catch {
        // silent — keep polling
      }
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [orderId, phase]);

  // ── Form ──────────────────────────────────────────────────────────────────
  if (phase === "form") {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
        <label className="flex flex-col gap-1 text-sm text-white/80">
          Your email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-white placeholder-white/40 outline-none focus:border-white/50"
          />
        </label>
        <p className="text-xs text-white/50">
          Your NFT will be delivered to a Crossmint wallet linked to this email.
        </p>
        <button
          type="submit"
          className="rounded-lg bg-white px-6 py-3 font-semibold text-black hover:bg-white/90 transition-colors"
        >
          Mint this balloon
        </button>
      </form>
    );
  }

  // ── Processing spinner ─────────────────────────────────────────────────────
  if (phase === "processing") {
    return (
      <div className="flex flex-col items-center gap-3 text-white/70">
        <div className="h-8 w-8 rounded-full border-2 border-white/30 border-t-white animate-spin" />
        <p>Preparing your order…</p>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (phase === "error") {
    return (
      <div className="flex flex-col gap-3 text-center">
        <p className="text-red-400">{errorMsg}</p>
        <button
          onClick={() => { setPhase("form"); setErrorMsg(null); }}
          className="text-white/60 underline text-sm hover:text-white"
        >
          Try again
        </button>
      </div>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (phase === "success") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="text-4xl">🎈</div>
        <h2 className="text-xl font-semibold text-white">
          Balloon #{params.unitNumber} is yours!
        </h2>
        <p className="text-white/60 text-sm">
          {tokenId ? `Token ID: ${tokenId}` : "Minted on Sepolia."}
          {" "}Check your email for wallet access.
        </p>
        <a
          href={`https://sepolia.etherscan.io/address/${process.env.NEXT_PUBLIC_BALLOONS_NFT_ADDRESS}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/50 underline text-xs hover:text-white/80"
        >
          View contract on Etherscan
        </a>
      </div>
    );
  }

  // ── Payment UI (CrossmintEmbeddedCheckout) ────────────────────────────────
  if (phase === "payment" && orderId && clientSecret) {
    return (
      <div className="w-full max-w-md">
        <CrossmintProvider apiKey={clientKey}>
          <CrossmintEmbeddedCheckout
            orderId={orderId}
            clientSecret={clientSecret}
            payment={{
              crypto: { enabled: false },
              fiat: { enabled: true, allowedMethods: { card: true } },
              defaultMethod: "fiat",
              receiptEmail: email,
            }}
          />
        </CrossmintProvider>
      </div>
    );
  }

  // Waiting for clientSecret from poll (rare edge case)
  return (
    <div className="flex flex-col items-center gap-3 text-white/70">
      <div className="h-8 w-8 rounded-full border-2 border-white/30 border-t-white animate-spin" />
      <p>Loading payment…</p>
    </div>
  );
}
