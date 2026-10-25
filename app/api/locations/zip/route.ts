import { lookupZip } from "@/lib/zip-location";
export async function GET(request: Request) {
  try {
    return Response.json(
      lookupZip(new URL(request.url).searchParams.get("zip") || ""),
      { headers: { "Cache-Control": "public, max-age=86400" } },
    );
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
