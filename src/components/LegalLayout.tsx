import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { Breadcrumbs } from "./Breadcrumbs";
import { cn } from "@/lib/utils";
import { FileText, Shield, Users, BookOpen } from "lucide-react";

interface LegalLayoutProps {
  children: ReactNode;
  breadcrumbs: Array<{ label: string; path?: string }>;
}

const legalLinks = [
  { path: '/legal', label: 'Legal Hub', icon: BookOpen },
  { path: '/legal/terms', label: 'Terms of Use', icon: FileText },
  { path: '/legal/privacy', label: 'Privacy Policy', icon: Shield },
  { path: '/legal/responsible-play', label: 'Responsible Play', icon: Users },
];

export const LegalLayout = ({ children, breadcrumbs }: LegalLayoutProps) => {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <Breadcrumbs items={breadcrumbs} />
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <aside className="lg:col-span-1">
            <nav className="sticky top-24 space-y-1 bg-card p-4 rounded-lg border">
              <h3 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">
                Navigation
              </h3>
              {legalLinks.map((link) => {
                const Icon = link.icon;
                const isActive = location.pathname === link.path;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground font-medium"
                        : "hover:bg-muted text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </aside>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {children}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};