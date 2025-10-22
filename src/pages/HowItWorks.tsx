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
            <h1 className="text-4xl md:text-5xl font-bold mb-4">How to Play</h1>
            <p className="text-xl text-muted-foreground">
              Everything you need to know to compete in fantasy rowing contests
            </p>
          </div>

          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem value="fantasy-contests" className="border rounded-2xl px-6 bg-card">
              <AccordionTrigger className="text-xl font-semibold hover:no-underline py-6">
                Fantasy Contests
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-6 text-base leading-relaxed">
                <p className="mb-4">
                  <strong>Legality of Skill-Based Fantasy Contests:</strong>
                </p>
                <p className="mb-4">
                  RowFantasy operates as a legal skill-based fantasy sports platform under provisions that distinguish games of skill from games of chance. Fantasy sports contests are recognized under federal law and in most states as skill-based competitions, exempt from gambling regulations, because the outcome is determined predominantly by participants' knowledge, analysis, and judgment rather than luck or random chance.
                </p>
                <p className="mb-4">
                  <strong>What Makes Fantasy Rowing Skill-Based:</strong>
                </p>
                <ul className="space-y-2 mb-4">
                  <li>• Requires research of crew lineups, historical performance data, and racing conditions</li>
                  <li>• Demands analytical ability to predict race outcomes and victory margins</li>
                  <li>• Success depends on knowledge of the sport, not random events</li>
                  <li>• Statistical analysis and informed decision-making determine results</li>
                </ul>
                <p className="mb-4">
                  <strong>Two-Crew Minimum Requirement:</strong>
                </p>
                <p>
                  To qualify as a fantasy contest under skill-based provisions, competitions must require participants to make multiple selections demonstrating analytical skill across different entries. This is why all RowFantasy contests require users to draft at least 2 crews. This multi-selection requirement ensures that success depends on comprehensive knowledge and strategic thinking rather than a single lucky guess, maintaining the contest's classification as a skill-based competition.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="how-to-play" className="border rounded-2xl px-6 bg-card">
              <AccordionTrigger className="text-xl font-semibold hover:no-underline py-6">
                How to Play
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-6 text-base leading-relaxed">
                <p className="mb-4">
                  <strong>1. Contest Selection:</strong>
                </p>
                <p className="mb-4">
                  Browse available regattas from the Contests lobby. Each regatta offers multiple entry tiers with different entry fees and prize structures. Choose from Head-to-Head (H2H) contests where you compete against one opponent, or 5-Person contests for small field competition. Entry tiers range from $10 to $100 with corresponding prize payouts.
                </p>
                <p className="mb-4">
                  <strong>2. Drafting Your Lineups:</strong>
                </p>
                <p className="mb-4">
                  After selecting your entry tier, you must draft at least 2 crews from the competing teams in the regatta. For each crew selection, predict the winner and enter your predicted margin of victory in seconds (to hundredths of a second). Your predictions should be based on crew performance history, current form, racing conditions, and head-to-head records.
                </p>
                <p className="mb-4">
                  <strong>3. Time Margins and Lock Times:</strong>
                </p>
                <p className="mb-4">
                  Victory margins are calculated as the time difference between 1st and 2nd place finishers in each race. Precision matters - the closer your predicted margin to the actual result, the better your score. All entries must be submitted before the contest lock time, which is typically at the scheduled race start. Once locked, no changes can be made to your lineup.
                </p>
                <p className="mb-4">
                  <strong>4. Scoring System:</strong>
                </p>
                <ul className="space-y-2 mb-4">
                  <li>• You must correctly predict the winning crew to be eligible for prizes</li>
                  <li>• Among participants who picked the correct winner, the closest margin prediction wins</li>
                  <li>• If multiple participants have identical predictions, the earliest entry timestamp wins</li>
                  <li>• Scoring is applied across all your drafted crews for an aggregate score</li>
                </ul>
                <p className="mb-4">
                  <strong>5. Contest Outcomes:</strong>
                </p>
                <p className="mb-4">
                  Results are determined after official race results are posted. In Head-to-Head contests, the winner takes the full prize amount. In 5-Person contests, top finishers split the prize pool according to the tier structure. Prizes are automatically credited to your wallet and available for withdrawal or entry into new contests.
                </p>
                <p>
                  <strong>Voids & Refunds:</strong> If a race is canceled, postponed significantly, or results are unavailable, contests automatically void and entry fees are refunded to your wallet within 24 hours.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="deposits" className="border rounded-2xl px-6 bg-card">
              <AccordionTrigger className="text-xl font-semibold hover:no-underline py-6">
                Deposits and Withdrawals
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
                    <strong>5-Person Contests:</strong> Join small field contests with 5 total participants. 
                    Top finishers win according to prize tier structure. Contest locks when full or at race start time.
                  </li>
                </ul>
                <p>
                  All contests display entry fee, prize amount, and lock time upfront. 
                  No hidden fees or changing payouts.
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
