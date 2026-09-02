// Stock level tracking and low stock alerts
import type { Product, Purchase, Sale } from "./types";

export interface StockLevel {
  productId: string;
  productName: string;
  currentStock: number;
  minStockLevel?: number;
  isLowStock: boolean;
  lastPurchaseDate?: string;
  lastSaleDate?: string;
}

export interface LowStockAlert {
  productId: string;
  productName: string;
  currentStock: number;
  minStockLevel: number;
  shortfall: number;
  suggestedOrderQty: number;
}

/**
 * Compute current stock level for a product from purchase and sale history
 * Stock = total purchases - total sales
 */
export function computeStockLevel(
  product: Product,
  purchases: Purchase[],
  sales: Sale[]
): StockLevel {
  const productPurchases = purchases.filter(p => p.productId === product.id);
  const productSales = sales.filter(s => s.productId === product.id);

  const totalPurchased = productPurchases.reduce((sum, p) => sum + p.qty, 0);
  const totalSold = productSales.reduce((sum, s) => sum + s.qty, 0);
  const currentStock = totalPurchased - totalSold;

  const lastPurchase = productPurchases.sort((a, b) => b.date.localeCompare(a.date))[0];
  const lastSale = productSales.sort((a, b) => b.date.localeCompare(a.date))[0];

  const isLowStock = product.minStockLevel !== undefined && currentStock < product.minStockLevel;

  return {
    productId: product.id,
    productName: product.name,
    currentStock,
    minStockLevel: product.minStockLevel,
    isLowStock,
    lastPurchaseDate: lastPurchase?.date,
    lastSaleDate: lastSale?.date,
  };
}

/**
 * Compute stock levels for all products
 */
export function computeAllStockLevels(
  products: Product[],
  purchases: Purchase[],
  sales: Sale[]
): StockLevel[] {
  return products
    .filter(p => p.type === "product" && p.active)
    .map(p => computeStockLevel(p, purchases, sales));
}

/**
 * Generate low stock alerts for products below their minimum level
 */
export function generateLowStockAlerts(
  stockLevels: StockLevel[]
): LowStockAlert[] {
  return stockLevels
    .filter(sl => sl.isLowStock && sl.minStockLevel !== undefined)
    .map(sl => ({
      productId: sl.productId,
      productName: sl.productName,
      currentStock: sl.currentStock,
      minStockLevel: sl.minStockLevel!,
      shortfall: sl.minStockLevel! - sl.currentStock,
      suggestedOrderQty: Math.max(sl.minStockLevel! * 2, sl.minStockLevel! - sl.currentStock + 10), // Suggest ordering enough to reach 2x min level or cover shortfall + buffer
    }));
}

/**
 * Update product stock level in Firestore (to be called from a scheduled job)
 */
export function updateProductStockLevels(
  db: any,
  businessId: string,
  stockLevels: StockLevel[]
): Promise<void> {
  const batch = db.batch();
  
  stockLevels.forEach(sl => {
    const ref = db.doc(`users/${businessId}/products/${sl.productId}`);
    batch.update(ref, { currentStock: sl.currentStock });
  });

  return batch.commit();
}
