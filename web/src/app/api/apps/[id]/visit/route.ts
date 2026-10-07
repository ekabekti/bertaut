import { recordVisit } from "@/lib/db";


export async function POST(_req: Request, ctx: RouteContext<"/api/apps/[id]/visit">) {
  const { id } = await ctx.params;
  try {
    const r = await recordVisit(id);
    return Response.json({ ok: true, visits: r.visits, total: r.total });
  } catch {
    return Response.json({ error: "Tidak ditemukan." }, { status: 404 });
  }
}
