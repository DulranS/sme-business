import { getAdminDb, requireAiContext } from "@/lib/firebaseAdmin";
import { generateAgingReport, getOverdueAlerts } from "@/lib/paymentAging";
import type { Sale, Purchase, ReceivablePayment, PayablePayment } from "@/lib/types";

export const runtime = "nodejs";
// This route reads the Authorization header (via requireAiContext) on every
// request — a value that can never exist at build time. Without this, Next
// tries to statically pre-render the GET handler and throws
// DYNAMIC_SERVER_USAGE ("couldn't be rendered statically because it used
// `request.headers`") instead of just treating it as dynamic
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const ctx = await requireAiContext(req);
    const { db, businessId } = ctx;

    // Fetch all relevant data
    const [salesSnap, purchasesSnap, receivablePaymentsSnap, payablePaymentsSnap] = await Promise.all([
      db.collection(`users/${businessId}/sales`).get(),
      db.collection(`users/${businessId}/purchases`).get(),
      db.collection(`users/${businessId}/receivablePayments`).get(),
      db.collection(`users/${businessId}/payablePayments`).get(),
    ]);

    const sales = salesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Sale[];
    const purchases = purchasesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Purchase[];
    const receivablePayments = receivablePaymentsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as ReceivablePayment[];
    const payablePayments = payablePaymentsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as PayablePayment[];

    // Generate aging report
    const report = generateAgingReport(sales, purchases, receivablePayments, payablePayments);

    // Get overdue alerts
    const overdueAlerts = getOverdueAlerts(report.receivables);

    return Response.json({
      ...report,
      overdueAlerts,
    });
  } catch (err) {
    console.error("Aging report error:", err);
    return Response.json({ error: "Failed to generate aging report" }, { status: 500 });
  }
}