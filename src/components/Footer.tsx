import { Link } from "react-router-dom";
import { Waves } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="bg-primary text-primary-foreground mt-auto">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="bg-accent rounded-lg p-1">
                <Waves className="h-5 w-5 text-accent-foreground" />
              </div>
              <span className="text-lg font-heading font-bold">RowFantasy</span>
            </div>
            <p className="text-sm text-white/60">
              Skill-based rowing contests. Fixed prizes. No pools.
            </p>
          </div>

          <div>
            <h3 className="font-heading font-semibold mb-4">Platform</h3>
            <ul className="space-y-2">
              <li><Link to="/lobby" className="text-sm text-white/60 hover:text-white transition-smooth">Contests</Link></li>
              <li><Link to="/support/help-center" className="text-sm text-white/60 hover:text-white transition-smooth">Help Center</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-heading font-semibold mb-4">Legal</h3>
            <ul className="space-y-2">
              <li><Link to="/legal/terms" className="text-sm text-white/60 hover:text-white transition-smooth">Terms of Use</Link></li>
              <li><Link to="/legal/privacy" className="text-sm text-white/60 hover:text-white transition-smooth">Privacy Policy</Link></li>
              <li><Link to="/legal/responsible-play" className="text-sm text-white/60 hover:text-white transition-smooth">Responsible Play</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-heading font-semibold mb-4">Support</h3>
            <ul className="space-y-2">
              <li><Link to="/support/help-center" className="text-sm text-white/60 hover:text-white transition-smooth">Help Center</Link></li>
              <li><Link to="/support/contact" className="text-sm text-white/60 hover:text-white transition-smooth">Contact Us</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-8 pt-8 text-center">
          <p className="text-sm text-white/50">
            © {new Date().getFullYear()} RowFantasy. Age 18+. Skill-based contests. Fixed prizes, no pooling.
            <Link to="/legal" className="ml-1 underline hover:text-white/80 transition-smooth">
              State restrictions apply.
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
};
