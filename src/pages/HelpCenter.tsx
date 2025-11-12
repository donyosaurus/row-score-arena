import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { Search, BookOpen, CreditCard, Users, Settings, Shield, HelpCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";

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
  const [expandedArticles, setExpandedArticles] = useState<Record<string, any>>({});

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

  const fetchArticleDetails = async (slug: string) => {
    if (expandedArticles[slug]) return; // Already fetched

    const { data } = await supabase.functions.invoke('help-articles', {
      body: { slug }
    });

    if (data?.article) {
      setExpandedArticles(prev => ({ ...prev, [slug]: data.article }));
    }
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
                      <Accordion type="single" collapsible className="w-full">
                        {categoryArticles.map((article) => (
                          <AccordionItem key={article.id} value={article.slug}>
                            <AccordionTrigger 
                              className="text-sm hover:no-underline"
                              onClick={() => fetchArticleDetails(article.slug)}
                            >
                              {article.title}
                            </AccordionTrigger>
                            <AccordionContent>
                              {expandedArticles[article.slug] ? (
                                <div className="prose prose-sm dark:prose-invert max-w-none">
                                  <ReactMarkdown>{expandedArticles[article.slug].body_md}</ReactMarkdown>
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground">Loading...</p>
                              )}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
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
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Can't find what you're looking for? Reach out to our support team.
              </p>
              <div className="flex flex-col gap-2">
                <Link to="/support/contact">
                  <button className="text-primary hover:underline text-sm">
                    Submit a support ticket →
                  </button>
                </Link>
                <p className="text-sm">
                  <strong>Email:</strong>{" "}
                  <a href="mailto:rowfantasy@gmail.com" className="text-primary hover:underline">
                    rowfantasy@gmail.com
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}