import { Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProductQuantitySelectorProps {
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  disabled: boolean;
  maxQuantity: number;
}

export function ProductQuantitySelector({ 
  quantity, 
  onIncrement, 
  onDecrement, 
  disabled, 
  maxQuantity
}: ProductQuantitySelectorProps) {
  return (
    <div className="flex items-center">
      <Button 
        variant="outline" 
        size="icon" 
        className="h-10 w-10 rounded-r-none"
        onClick={onDecrement}
        disabled={disabled || quantity <= 0}
      >
        <Minus className="h-4 w-4" />
      </Button>
      <div className="h-10 w-16 flex items-center justify-center border-y border-input">
        {quantity}
      </div>
      <Button 
        variant="outline" 
        size="icon" 
        className="h-10 w-10 rounded-l-none"
        onClick={onIncrement}
        disabled={disabled || quantity >= maxQuantity}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
