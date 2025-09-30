
import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { MoveLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <MainLayout>
      <div className="container flex flex-col items-center justify-center py-20">
        <h1 className="text-9xl font-bold text-primary">404</h1>
        <h2 className="text-3xl font-bold mt-4 mb-2">Page Not Found</h2>
        <p className="text-muted-foreground text-center max-w-md mb-8">
          The page you are looking for doesn't exist or has been moved.
        </p>
        <Button asChild>
          <Link to="/">
            <MoveLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>
      </div>
    </MainLayout>
  );
}
