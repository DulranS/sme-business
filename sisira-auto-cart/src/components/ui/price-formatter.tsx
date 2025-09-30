
import React from 'react';

interface PriceFormatterProps {
  price: number;
  currency?: string;
  className?: string;
}

export function PriceFormatter({ 
  price, 
  currency = 'Rs.', 
  className 
}: PriceFormatterProps) {
  const formattedPrice = new Intl.NumberFormat('en-LK', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(price);

  return (
    <span className={className}>
      {currency} {formattedPrice}
    </span>
  );
}
