import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Search, BookOpen, CreditCard, Users, Settings, Shield, HelpCircle } from "lucide-react";

const categories = [
  { id: 'account', label: 'Account', icon: Users, color: 'text-blue-500' },
  { id: 'payments', label: 'Payments', icon: CreditCard, color: 'text-green-500' },
  { id: 'contests', label: 'Contests', icon: BookOpen, color: 'text-purple-500' },
  { id: 'technical', label: 'Technical', icon: Settings, color: 'text-orange-500' },
  { id: 'compliance', label: 'Compliance', icon: Shield, color: 'text-red-500' },
  { id: 'general', label: 'General', icon: HelpCircle, color: 'text-gray-500' },
];

export default function HelpCenter() {
  const [searchQuery, setSearchQuery] = useState("");
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchArticles();
  }, [searchQuery]);

  const fetchArticles = async () => {
    const params: any = {};
    if (searchQuery) {
      params.query = searchQuery;
    }

    const { data } = await supabase.functions.invoke('help-articles', {
      body: params
    });

    if (data?.articles) {
      setArticles(data.articles);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <Breadcrumbs items={[{ label: 'Support', path: '/support/help-center' }, { label: 'Help Center' }]} />
        
        <div className="space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold">How can we help?</h1>
            <div className="max-w-2xl mx-auto relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search for articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 text-lg"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => {
              const Icon = category.icon;
              const categoryArticles = articles.filter(a => a.category === category.id);
              
              return (
                <Card key={category.id} className="hover:border-primary transition-colors">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Icon className={`h-5 w-5 ${category.color}`} />
                      {category.label}
                      {categoryArticles.length > 0 && (
                        <Badge variant="secondary" className="ml-auto">
                          {categoryArticles.length}
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  {categoryArticles.length > 0 && (
                    <CardContent>
                      <ul className="space-y-2">
                        {categoryArticles.slice(0, 3).map((article) => (
                          <li key={article.id}>
                            <Link
                              to={`/support/article/${article.slug}`}
                              className="text-sm text-primary hover:underline"
                            >
                              {article.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>

          {!loading && articles.length === 0 && (
            <Card className="text-center py-12">
              <CardContent>
                <p className="text-muted-foreground">No articles found matching your search.</p>
                <Link to="/support/contact" className="text-primary hover:underline mt-2 inline-block">
                  Contact Support →
                </Link>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Still need help?</CardTitle>
            </CardHeader>
            <CardContent>
              <Link to="/support/contact">
                <button className="text-primary hover:underline">
                  Contact our support team →
                </button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}