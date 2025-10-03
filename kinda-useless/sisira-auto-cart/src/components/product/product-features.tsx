
import { Truck, Package, Shield } from 'lucide-react';

export function ProductFeatures() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className="flex items-center gap-2 p-3 border rounded-lg">
        <Truck className="h-5 w-5 text-muted-foreground" />
        <div className="text-sm">
          <p className="font-medium">Fast Delivery</p>
          <p className="text-muted-foreground">1-3 business days</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2 p-3 border rounded-lg">
        <Package className="h-5 w-5 text-muted-foreground" />
        <div className="text-sm">
          <p className="font-medium">Genuine Parts</p>
          <p className="text-muted-foreground">Quality guaranteed</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2 p-3 border rounded-lg">
        <Shield className="h-5 w-5 text-muted-foreground" />
        <div className="text-sm">
          <p className="font-medium">Warranty</p>
          <p className="text-muted-foreground">30-day warranty</p>
        </div>
      </div>
    </div>
  );
}
