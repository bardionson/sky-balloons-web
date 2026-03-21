const BASE_URL = "https://www.crossmint.com/api/2022-06-09";

export interface CrossmintOrder {
  orderId: string;
  phase: "quote" | "payment" | "delivery" | "completed";
  payment: {
    status: "not-started" | "awaiting-payment" | "processing" | "completed" | "failed";
    method?: string;
    currency?: string;
    preparation?: {
      clientSecret?: string;
    };
  };
  lineItems: Array<{
    status: string;
    metadata?: {
      tokenId?: string;
    };
  }>;
}

export async function createOrder(params: {
  recipientEmail: string;
  uri: string;
}): Promise<{ orderId: string; clientSecret: string | undefined }> {
  const collectionId = process.env.CROSSMINT_COLLECTION_ID;
  const serverKey = process.env.CROSSMINT_SERVER_KEY;

  if (!collectionId) throw new Error("CROSSMINT_COLLECTION_ID is not set");
  if (!serverKey) throw new Error("CROSSMINT_SERVER_KEY is not set");

  const body = {
    recipient: { email: params.recipientEmail },
    payment: { method: "stripe-payment-element", currency: "usd" },
    lineItems: [
      {
        collectionLocator: `crossmint:${collectionId}`,
        callData: {
          contractArguments: {
            _uri: params.uri,
          },
        },
      },
    ],
  };

  const res = await fetch(`${BASE_URL}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": serverKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Crossmint createOrder failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    orderId: data.orderId,
    clientSecret: data.payment?.preparation?.clientSecret,
  };
}

export async function getOrder(orderId: string): Promise<CrossmintOrder> {
  const serverKey = process.env.CROSSMINT_SERVER_KEY;
  if (!serverKey) throw new Error("CROSSMINT_SERVER_KEY is not set");

  const res = await fetch(`${BASE_URL}/orders/${orderId}`, {
    headers: { "X-API-KEY": serverKey },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Crossmint getOrder failed (${res.status})`);
  }

  return res.json();
}
