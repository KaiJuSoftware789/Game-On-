import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { lookupZip } from "@/lib/zip-location";
import { EVENT_RADII, parseLocalEvent } from "@/lib/local-events";
import { GAMES } from "@/lib/sessions";

const reply = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  try {
    const id = params.get("event"),
      mine = params.get("mine") === "1";
    if (id && !/^[0-9a-f-]{36}$/i.test(id))
      return reply({ error: "Invalid event link." }, 400);
    const location = id || mine ? null : lookupZip(params.get("zip") || "");
    const radius = Number(params.get("radius") || 25),
      offset = Number(params.get("offset") || 0);
    if (
      !EVENT_RADII.some((value) => value === radius) ||
      !Number.isInteger(offset) ||
      offset < 0 ||
      offset > 100000
    )
      return reply({ error: "Choose a valid search distance and page." }, 400);
    if (!hasSupabaseConfig())
      return reply({ available: false, location, events: [], total: 0 });
    const client = await createClient();
    const result = id
      ? await client.rpc("local_event_get", { p_id: id })
      : mine
        ? await client.rpc("local_events_mine")
        : await client.rpc("local_events_search", {
            p_latitude: location!.latitude,
            p_longitude: location!.longitude,
            p_radius: radius,
            p_kind: params.get("kind") || "",
            p_section: params.get("section") || "all",
            p_game: params.get("game") || "",
            p_offset: offset,
          });
    if (result.error)
      return reply(
        {
          available: true,
          location,
          events: [],
          total: 0,
          error: "Public events couldn't be loaded. Please try again.",
        },
        503,
      );
    return reply({ available: true, location, ...result.data });
  } catch {
    return reply(
      {
        error:
          "Check your ZIP code and try again. Use a five-digit U.S. ZIP from the location directory.",
      },
      400,
    );
  }
}
export async function POST(request: Request) {
  if (!hasSupabaseConfig())
    return reply(
      {
        error:
          "Public event publishing is coming soon. You can save and share an event link now.",
      },
      503,
    );
  const client = await createClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user)
    return reply({ error: "Sign in to publish an event." }, 401);
  try {
    const text = await request.text();
    if (text.length > 16000)
      return reply({ error: "This event is too large." }, 400);
    const body = JSON.parse(text);
    if (body.action === "cancel") {
      if (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id))
        return reply({ error: "Invalid event." }, 400);
      const { error } = await client.rpc("local_event_cancel", {
        p_id: body.id,
      });
      return error
        ? reply({ error: error.message }, 400)
        : reply({ cancelled: true });
    }
    const event = parseLocalEvent(body.event);
    // Never trust coordinates/city sent by a browser or copied invitation.
    event.location = lookupZip(event.location.zip);
    const official = GAMES.find((game) => game.id === event.game.id);
    if (official) event.game = { ...official };
    else if (!event.game.id.startsWith("custom-"))
      return reply({ error: "Choose a game from your library." }, 400);
    if (
      event.status !== "scheduled" ||
      Date.parse(event.startsAt) <= Date.now() ||
      Date.parse(event.startsAt) > Date.now() + 730 * 86400000
    )
      return reply(
        { error: "Choose a future event time within the next two years." },
        400,
      );
    const { data, error } = await client.rpc("local_event_publish", {
      p_event: event,
    });
    return error
      ? reply({ error: error.message }, 400)
      : reply({ event: data.event, owner: true, source: "public" });
  } catch (error) {
    return reply(
      {
        error:
          error instanceof Error
            ? error.message
            : "Please check the event details.",
      },
      400,
    );
  }
}
