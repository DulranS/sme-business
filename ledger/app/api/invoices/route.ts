import { getAdminDb, requireAiContext } from "@/lib/firebaseAdmin";
import { saleToInvoice, generateInvoiceHtml } from "@/lib/invoiceGenerator";
import type { Sale, Product, Settings } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const ctx = await requireAiContext(req);
    const { db, businessId } = ctx;

    const body = await req.json();
    const { saleId } = body;

    if (!saleId) {
      return Response.json({ error: "saleId is required" }, { status: 400 });
    }

    // Fetch sale and product
    const [saleSnap, productSnap, settingsSnap] = await Promise.all([
      db.doc(`users/${businessId}/sales/${saleId}`).get(),
      db.collection(`users/${businessId}/products`).get(),
      db.doc(`users/${businessId}/meta/settings`).get(),
    ]);

    if (!saleSnap.exists) {
      return Response.json({ error: "Sale not found" }, { status: 404 });
    }

    const sale = { id: saleSnap.id, ...saleSnap.data() } as Sale;
    const products = productSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Product[];
    const product = products.find(p => p.id === sale.productId);

    if (!product) {
      return Response.json({ error: "Product not found" }, { status: 404 });
    }

    const settings = settingsSnap.data() as Settings | undefined;
    const taxRate = settings?.taxRatePct || 0;

    // Get last invoice number
    const invoicesSnap = await db
      .collection(`users/${businessId}/invoices`)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();
    const lastInvoiceNumber = invoicesSnap.docs[0]?.data()?.invoiceNumber;

    // Generate invoice
    const invoice = saleToInvoice(sale, product, lastInvoiceNumber, taxRate);

    // Save invoice
    await db.doc(`users/${businessId}/invoices/${invoice.id}`).set(invoice);

    // Generate HTML
    const template = {
      businessName: settings?.businessName,
      businessAddress: settings?.businessAddress,
      businessPhone: settings?.businessPhone,
      logoUrl: settings?.logoUrl,
    };
    const html = generateInvoiceHtml(invoice, template);

    return Response.json({
      invoice,
      html,
    });
  } catch (err) {
    console.error("Invoice generation error:", err);
    return Response.json({ error: "Failed to generate invoice" }, { status: 500 });
  }
}
