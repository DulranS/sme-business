import { requireAiContext } from "@/lib/firebaseAdmin";
import { aiErrorResponse } from "@/lib/apiError";

export const runtime = "nodejs";

export async function DELETE(req: Request) {
  try {
    const { db, businessId } = await requireAiContext(req);
    const { sessionId } = (await req.json()) as { sessionId: string };
    if (!sessionId) return Response.json({ error: "sessionId is required." }, { status: 400 });

    const messagesSnap = await db.collection(`users/${businessId}/aiChatSessions/${sessionId}/messages`).get();
    const batch = db.batch();
    messagesSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(db.doc(`users/${businessId}/aiChatSessions/${sessionId}`));
    await batch.commit();

    return Response.json({ ok: true });
  } catch (err) {
    return aiErrorResponse(err, "api/ai/sessions");
  }
}
