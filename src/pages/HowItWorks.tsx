import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const HowItWorks = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      
      <main className="flex-1 bg-background py-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">More Information</h1>
            <p className="text-xl text-muted-foreground">
              Everything you need to know about how our platform works
            </p>
          </div>

          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem value="deposits" className="border rounded-2xl px-6 bg-card">
              <AccordionTrigger className="text-xl font-semibold hover:no-underline py-6">
                Deposit and Withdrawals
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-6 text-base leading-relaxed">
                <p className="mb-4">
                  Add funds to your wallet securely using credit cards, debit cards, or ACH bank transfers. 
                  All transactions are processed through industry-leading payment providers with bank-level encryption.
                </p>
                <p className="mb-4">
                  <strong>Deposits:</strong> Instant credit to your account. Minimum deposit $10.
                </p>
                <p>
                  <strong>Withdrawals:</strong> Request anytime. Processing typically takes 3-5 business days. 
                  Minimum withdrawal $20. All withdrawals are subject to identity verification.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="matchmaking" className="border rounded-2xl px-6 bg-card">
              <AccordionTrigger className="text-xl font-semibold hover:no-underline py-6">
                Matchmaking
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-6 text-base leading-relaxed">
                <p className="mb-4">
                  Choose from two contest types:
                </p>
                <ul className="space-y-3 mb-4">
                  <li>
                    <strong>Head-to-Head (H2H):</strong> Compete against one other player. 
                    Winner takes the fixed prize. Fair matching based on entry time.
                  </li>
                  <li>
                    <strong>Small Field (Cap-N):</strong> Join contests with 3-20 players. 
                    Top performers win fixed prize tiers. Contest locks when full or at race start time.
                  </li>
                </ul>
                <p>
                  All contests display entry fee, prize amount, and lock time upfront. 
                  No hidden fees or changing payouts.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="skill-based" className="border rounded-2xl px-6 bg-card">
              <AccordionTrigger className="text-xl font-semibold hover:no-underline py-6">
                Skill-Based Competition
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-6 text-base leading-relaxed">
                <p className="mb-4">
                  rowfantasy contests are skill-based, not games of chance. Your rowing knowledge 
                  and analytical ability directly impact your success.
                </p>
                <p className="mb-4">
                  <strong>What makes it skill-based:</strong>
                </p>
                <ul className="space-y-2 mb-4">
                  <li>• Research crew lineups, recent performance, and racing conditions</li>
                  <li>• Analyze historical race data and head-to-head records</li>
                  <li>• Make informed predictions about winners and victory margins</li>
                  <li>• Precision matters - closest prediction to actual margin wins</li>
                </ul>
                <p>
                  Outcome is determined by your knowledge of the sport, not random chance or luck.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="rules" className="border rounded-2xl px-6 bg-card">
              <AccordionTrigger className="text-xl font-semibold hover:no-underline py-6">
                Rules and Scoring
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-6 text-base leading-relaxed">
                <p className="mb-4">
                  <strong>How to Play:</strong>
                </p>
                <ol className="space-y-3 mb-4 list-decimal list-inside">
                  <li>Select the crew you predict will win the race</li>
                  <li>Enter your predicted margin of victory in seconds (to hundredths)</li>
                  <li>Submit your pick before the contest locks</li>
                </ol>
                <p className="mb-4">
                  <strong>Scoring:</strong>
                </p>
                <ul className="space-y-2 mb-4">
                  <li>• You must correctly pick the winner to be eligible for prizes</li>
                  <li>• Among correct winner picks, closest margin prediction wins</li>
                  <li>• Margin calculated as time difference between 1st and 2nd place</li>
                  <li>• In case of ties, earliest entry timestamp wins</li>
                </ul>
                <p>
                  <strong>Voids & Refunds:</strong> If a race is canceled or results unavailable, 
                  contests automatically void and entry fees are refunded to your wallet.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default HowItWorks;
