
interface ProductImageProps {
  imageUrl: string;
  name: string;
}

export function ProductImage({ imageUrl, name }: ProductImageProps) {
  return (
    <div className="bg-muted/30 rounded-lg overflow-hidden flex items-center justify-center p-4">
      <img 
        src={imageUrl} 
        alt={name}
        className="max-w-full max-h-[400px] object-contain" 
      />
    </div>
  );
}
