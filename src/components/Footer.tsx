import { Link } from "react-router-dom";
import { Waves } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="border-t border-border bg-card mt-auto">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Waves className="h-6 w-6 text-accent" />
              <span className="text-xl font-bold text-primary">RowFantasy</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Skill-based rowing contests. Fixed prizes. No pools.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-4 text-foreground">Platform</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/lobby" className="text-sm text-muted-foreground hover:text-foreground transition-base">
                  Contests
                </Link>
              </li>
              <li>
                <Link to="/support/help-center" className="text-sm text-muted-foreground hover:text-foreground transition-base">
                  Help Center
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4 text-foreground">Legal</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/legal/terms" className="text-sm text-muted-foreground hover:text-foreground transition-base">
                  Terms of Use
                </Link>
              </li>
              <li>
                <Link to="/legal/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-base">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/legal/responsible-play" className="text-sm text-muted-foreground hover:text-foreground transition-base">
                  Responsible Play
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4 text-foreground">Support</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/support/help-center" className="text-sm text-muted-foreground hover:text-foreground transition-base">
                  Help Center
                </Link>
              </li>
              <li>
                <Link to="/support/contact" className="text-sm text-muted-foreground hover:text-foreground transition-base">
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-8 pt-8 text-center">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} RowFantasy. Age 18+. Skill-based contests. Fixed prizes, no pooling.
            <Link to="/legal" className="ml-1 underline hover:text-foreground transition-base">
              State restrictions apply.
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
};
