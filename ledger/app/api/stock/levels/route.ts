import { getAdminDb, requireAiContext } from "@/lib/firebaseAdmin";
import { computeAllStockLevels, generateLowStockAlerts } from "@/lib/stockTracking";
import type { Product, Purchase, Sale } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const ctx = await requireAiContext(req);
    const { db, businessId } = ctx;

    // Fetch all products, purchases, and sales
    const [productsSnap, purchasesSnap, salesSnap] = await Promise.all([
      db.collection(`users/${businessId}/products`).where("active", "==", true).get(),
      db.collection(`users/${businessId}/purchases`).get(),
      db.collection(`users/${businessId}/sales`).get(),
    ]);

    const products = productsSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Product);
    const purchases = purchasesSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Purchase);
    const sales = salesSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Sale);

    // Compute stock levels
    const stockLevels = computeAllStockLevels(products, purchases, sales);
    const lowStockAlerts = generateLowStockAlerts(stockLevels);

    // Update product stock levels in Firestore
    const batch = db.batch();
    stockLevels.forEach(sl => {
      const ref = db.doc(`users/${businessId}/products/${sl.productId}`);
      batch.update(ref, { currentStock: sl.currentStock });
    });
    await batch.commit();

    return Response.json({
      stockLevels,
      lowStockAlerts,
      totalProducts: products.length,
      lowStockCount: lowStockAlerts.length,
    });
  } catch (err) {
    console.error("Stock levels error:", err);
    return Response.json({ error: "Failed to compute stock levels" }, { status: 500 });
  }
}
