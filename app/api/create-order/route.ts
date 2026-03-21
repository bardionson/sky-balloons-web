import { NextRequest, NextResponse } from "next/server";
import { buildMetadataUri, BalloonParams } from "@/lib/metadata";
import { createOrder } from "@/lib/crossmint";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, params } = body as { email: string; params: BalloonParams };

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    const uri = buildMetadataUri(params);
    const { orderId, clientSecret } = await createOrder({ recipientEmail: email, uri });

    return NextResponse.json({ orderId, clientSecret });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("create-order error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
