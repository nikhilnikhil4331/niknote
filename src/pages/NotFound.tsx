import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Home, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  useDocumentTitle({ title: 'Page Not Found — NikNote', description: 'The requested page is not available. Return to NikNote.' });

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="text-center max-w-md">
        {/* Handwritten-style 404 */}
        <div className="mb-6">
          <span 
            className="text-8xl sm:text-[120px] leading-none font-bold text-primary/80"
            style={{ fontFamily: "'Caveat', cursive", transform: 'rotate(-3deg)', display: 'inline-block' }}
          >
            404
          </span>
        </div>

        {/* Ink line divider */}
        <div className="w-32 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent mx-auto mb-6" />

        <h1 className="text-2xl font-bold text-foreground mb-2">Page Not Found</h1>
        <p className="text-muted-foreground mb-2">
          This page seems to have been scribbled away! 
        </p>
        <p className="text-lg mb-8" style={{ fontFamily: "'Caveat', cursive", color: 'hsl(var(--primary))' }}>
          Ye page kisi aur notebook mein hai ✍️
        </p>

        <div className="flex gap-3 justify-center">
          <Button
            onClick={() => navigate("/")}
            className="gap-2 rounded-xl"
          >
            <Home className="w-4 h-4" />
            Go Home
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/feedback")}
            className="gap-2 rounded-xl"
          >
            <Flag className="w-4 h-4" />
            Report broken link
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
