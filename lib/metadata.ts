export interface BalloonParams {
  uniqueName: string;
  unitNumber: number;
  seed: number;
  /** Pre-formatted: e.g. "16/03/2026 14:32 CET" */
  timestamp: string;
  /** 0 = Portrait, 1 = Landscape */
  orientation: 0 | 1;
  /** Integer × 100 — e.g. 75 → "0.75", -150 → "-1.50" */
  imagination: number;
  /** IPFS CID for the artwork */
  cid: string;
  eventName: string;
  /** e.g. "Artist Proof" */
  type: string;
  /** e.g. "1920x1080" */
  pixelDimensions: string;
}

function formatImagination(imagination: number): string {
  const val = imagination / 100;
  const sign = val < 0 ? "-" : "";
  const abs = Math.abs(val);
  return `${sign}${abs.toFixed(2)}`;
}

/**
 * Assemble the NFT metadata JSON from genetic parameters and return a
 * data:application/json;base64,... string suitable for passing as `_uri`
 * to BalloonsNFT.mint().
 */
export function buildMetadataUri(params: BalloonParams): string {
  const metadata = {
    name: `Balloons in the Sky #${params.unitNumber} \u2014 ${params.uniqueName}`,
    description: "Balloons in the Sky by B\u00e5rd Ionson & Jennifer Ionson",
    image: `ipfs://${params.cid}`,
    license: "CC BY-NC 4.0",
    attributes: [
      { trait_type: "Unit Number", value: params.unitNumber },
      { trait_type: "Seed", value: params.seed },
      { trait_type: "Orientation", value: params.orientation === 0 ? "Portrait" : "Landscape" },
      { trait_type: "Imagination", value: formatImagination(params.imagination) },
      { trait_type: "Event", value: params.eventName },
      { trait_type: "Timestamp", value: params.timestamp },
      { trait_type: "Type", value: params.type },
      { trait_type: "Pixel Dimensions", value: params.pixelDimensions },
    ],
  };

  const json = JSON.stringify(metadata);
  const base64 = Buffer.from(json).toString("base64");
  return `data:application/json;base64,${base64}`;
}

/** Parse BalloonParams from URL search params. Returns null if required fields are missing. */
export function paramsFromSearchParams(
  sp: Record<string, string | string[] | undefined>
): BalloonParams | null {
  const get = (key: string): string | undefined => {
    const v = sp[key];
    return Array.isArray(v) ? v[0] : v;
  };

  const uniqueName = get("uniqueName");
  const cid = get("cid");
  const unitNumber = get("unitNumber");
  const seed = get("seed");
  const timestamp = get("timestamp");
  const orientation = get("orientation");
  const imagination = get("imagination");
  const eventName = get("eventName");

  if (!uniqueName || !cid || !unitNumber || !seed || !timestamp || !orientation || !imagination || !eventName) {
    return null;
  }

  return {
    uniqueName,
    cid,
    unitNumber: parseInt(unitNumber, 10),
    seed: parseInt(seed, 10),
    timestamp,
    orientation: (parseInt(orientation, 10) as 0 | 1),
    imagination: parseInt(imagination, 10),
    eventName,
    type: get("type") ?? "Standard",
    pixelDimensions: get("pixelDimensions") ?? "1920x1080",
  };
}
