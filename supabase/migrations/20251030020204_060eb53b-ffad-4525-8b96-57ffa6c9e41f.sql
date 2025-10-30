-- Insert initial CMS pages for legal documents

-- Terms of Use
INSERT INTO public.cms_pages (slug, title, body_md, version, published_at) VALUES (
'terms',
'Terms of Use',
'# Terms of Use

**Effective Date:** January 1, 2025  
**Version:** 1.0

## 1. Acceptance of Terms

By accessing or using RowFantasy ("the Platform"), you agree to be bound by these Terms of Use. If you do not agree, you may not use the Platform.

## 2. Eligibility & Age Requirements

### 2.1 Minimum Age
You must be at least **18 years old** (or the age of majority in your jurisdiction) to use the Platform. Some states may have higher age requirements.

### 2.2 Geographic Restrictions
The Platform is not available in all states. You must be physically located in a permitted state at the time of contest entry. See our [State Availability Map](/legal#state-map) for details.

### 2.3 Prohibited Users
You may not use the Platform if you are:
- An employee, contractor, or immediate family member of RowFantasy
- A professional rower competing in the events offered
- Located in a restricted or banned state
- Subject to self-exclusion or account suspension

## 3. Account Rules

### 3.1 Account Creation
- One account per person
- Accurate information required
- No sharing or selling of accounts
- You are responsible for account security

### 3.2 Identity Verification
We may require identity verification (KYC) before processing withdrawals. This may include:
- Government-issued photo ID
- Proof of address
- Social Security Number verification
- Additional documentation as needed

## 4. Contest Rules

### 4.1 Contest Structure
RowFantasy operates **skill-based contests** with:
- **Fixed prize pools** determined before entry
- **Head-to-head matchmaking** (no pooled entries)
- **Predetermined winners** based on actual regatta results
- No luck or chance elements

### 4.2 Picks & Scoring
- Select 2-4 crews per contest (as specified)
- Points awarded based on finish position
- Margin of victory/defeat affects tiebreakers
- Full scoring rules available in each contest

### 4.3 Contest Cancellation
If a regatta is cancelled or postponed:
- Entry fees are refunded to your wallet
- No prizes are awarded
- Contests may be rescheduled at our discretion

## 5. Fees & Payment Terms

### 5.1 Entry Fees
- Entry fees are charged at time of contest entry
- Entry fees are non-refundable once contest locks
- All fees are in USD

### 5.2 Payment Processing
- We use third-party payment processors
- Payment processing fees may apply
- Minimum deposit: $10
- Minimum withdrawal: $10

### 5.3 Taxes
- You are responsible for all applicable taxes
- We report winnings over $600 to the IRS (Form 1099-MISC)
- State tax rates may apply based on your location

## 6. Refunds, Voids & Chargebacks

### 6.1 Refund Policy
Entry fees are refunded only if:
- Contest is cancelled by RowFantasy
- Technical error prevents contest participation
- You withdraw before contest lock time

### 6.2 Voided Contests
Contests may be voided if:
- Regatta results are unavailable or disputed
- Scoring error affects outcomes
- Evidence of fraud or manipulation

### 6.3 Chargebacks
Unauthorized chargebacks may result in:
- Account suspension
- Collection efforts
- Legal action

## 7. Anti-Money Laundering (AML) & KYC

We comply with federal AML regulations:
- Identity verification required
- Suspicious activity monitoring
- Transaction reporting as required by law
- Cooperation with law enforcement

## 8. Prohibited Conduct

You may not:
- Use bots, scripts, or automated tools
- Collude with other users
- Exploit bugs or errors for gain
- Create multiple accounts
- Use VPNs or location spoofing
- Engage in abusive behavior

Violations may result in account termination and prize forfeiture.

## 9. Dispute Resolution & Arbitration

### 9.1 Informal Resolution
Contact support first to resolve disputes informally.

### 9.2 Binding Arbitration
Any dispute will be resolved through binding arbitration under AAA rules, not in court. You waive the right to a jury trial and class actions.

### 9.3 Exceptions
Small claims court and injunctive relief remain available.

## 10. Governing Law

These Terms are governed by the laws of the State of Delaware, without regard to conflict of law principles.

## 11. Modifications

We may modify these Terms at any time. Material changes require your acceptance before continued use.

## 12. Contact Information

**RowFantasy Support**  
Email: support@rowfantasy.com  
Hours: Monday-Friday, 9am-5pm ET

---

*By using RowFantasy, you acknowledge that you have read, understood, and agree to these Terms of Use.*',
1,
now()
);

-- Privacy Policy
INSERT INTO public.cms_pages (slug, title, body_md, version, published_at) VALUES (
'privacy',
'Privacy Policy',
'# Privacy Policy

**Effective Date:** January 1, 2025  
**Version:** 1.0

## 1. Introduction

RowFantasy ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information.

## 2. Information We Collect

### 2.1 Information You Provide
- **Account Information:** Name, email, username, password, date of birth
- **Identity Verification:** Government ID, SSN, proof of address
- **Payment Information:** Credit card, bank account details (stored by payment processors)
- **Profile Data:** State of residence, preferences, communication choices

### 2.2 Automatically Collected Information
- **Device Information:** IP address, browser type, device ID
- **Location Data:** GPS coordinates, IP-based geolocation
- **Usage Data:** Pages viewed, clicks, contest entries, time spent
- **Cookies:** Session cookies, analytics cookies, preference cookies

### 2.3 Information from Third Parties
- **Payment Processors:** Transaction status, verification results
- **KYC Providers:** Identity verification results
- **Analytics Services:** Aggregated usage patterns

## 3. How We Use Your Information

We use your information to:
- **Provide Services:** Process contest entries, calculate results, distribute prizes
- **Verify Identity:** Comply with KYC/AML requirements, prevent fraud
- **Communicate:** Send updates, respond to support requests
- **Improve Platform:** Analyze usage, develop new features
- **Legal Compliance:** Meet regulatory obligations, respond to legal requests
- **Security:** Detect fraud, protect against threats

## 4. Legal Basis for Processing

We process your information based on:
- **Contract Performance:** To provide services you requested
- **Legal Obligation:** To comply with laws and regulations
- **Legitimate Interests:** To improve services, prevent fraud
- **Consent:** Where required by law (you may withdraw consent)

## 5. Third-Party Processors

We share information with:

### 5.1 Payment Processors
- Stripe, PayPal, or other payment gateways
- Bank transaction processing
- Fraud detection services

### 5.2 KYC/Identity Verification
- Identity verification providers
- Age verification services
- Background check services

### 5.3 Analytics & Marketing
- Google Analytics (anonymized)
- Email service providers
- Customer support tools

### 5.4 Legal Requirements
- Law enforcement (when required)
- Regulatory agencies
- Tax authorities

## 6. Data Retention

We retain your information:
- **Active Accounts:** For duration of account plus 7 years
- **Closed Accounts:** 7 years from closure (legal requirement)
- **Financial Records:** 7 years (tax/audit requirements)
- **Communications:** 3 years from last interaction

You may request deletion earlier, subject to legal obligations.

## 7. Your Rights (CCPA/CPRA)

California residents have the right to:

### 7.1 Right to Know
Request what personal information we collected, used, and disclosed in the past 12 months.

### 7.2 Right to Delete
Request deletion of your personal information (subject to exceptions).

### 7.3 Right to Opt-Out
Opt-out of the "sale" of personal information (we do not sell your data).

### 7.4 Right to Non-Discrimination
We will not discriminate against you for exercising your rights.

### 7.5 How to Exercise Rights
Use the privacy request buttons on the Privacy Policy page or email privacy@rowfantasy.com.

## 8. Security Measures

We implement security measures including:
- Encryption in transit (TLS/SSL)
- Encryption at rest for sensitive data
- Access controls and authentication
- Regular security audits
- Employee training on data protection

## 9. Cookies & Tracking

### 9.1 Cookie Types
- **Functional:** Required for site operation (session management)
- **Analytics:** Help us understand usage patterns
- **Marketing:** Personalize your experience

### 9.2 Managing Cookies
You can control cookies through browser settings or our cookie preference center.

## 10. Children''s Privacy

Our Platform is not intended for users under 18. We do not knowingly collect information from children.

## 11. State-Specific Rights

### 11.1 California (CCPA/CPRA)
See Section 7 for California rights.

### 11.2 Virginia (VCDPA)
Virginia residents have similar rights to access, delete, and opt-out.

### 11.3 Other States
We comply with applicable state privacy laws.

## 12. International Users

The Platform is operated in the United States. By using the Platform, you consent to transfer of your information to the U.S.

## 13. Changes to This Policy

We may update this Privacy Policy. Material changes will be notified via email or platform notice.

## 14. Contact Us

**Privacy Questions:**  
Email: privacy@rowfantasy.com  
Mail: RowFantasy Privacy Team, [Address]

**Data Protection Officer:**  
Email: dpo@rowfantasy.com

---

*Last Updated: January 1, 2025*',
1,
now()
);

-- Responsible Play
INSERT INTO public.cms_pages (slug, title, body_md, version, published_at) VALUES (
'responsible-play',
'Responsible Play',
'# Responsible Play

**Our Commitment**

RowFantasy is committed to promoting responsible participation in skill-based contests. We provide tools and resources to help you stay in control.

## 1. Know the Risks

While RowFantasy offers skill-based contests (not gambling), it''s important to:
- Only participate with money you can afford to lose
- Understand that winning is not guaranteed
- Recognize warning signs of problematic behavior
- Take breaks and set limits

## 2. Setting Limits

### 2.1 Deposit Limits
Set daily, weekly, or monthly deposit limits to control spending. Limits take effect immediately and can only be increased after a 24-hour waiting period.

**How to Set:**
1. Go to Responsible Play page
2. Enter your desired monthly limit
3. Click "Update Limit"

### 2.2 Loss Limits (Optional)
Track your net losses and receive alerts when approaching your self-set thresholds.

### 2.3 Time Limits
Set reminders to take breaks after a certain amount of time.

## 3. Cooling-Off Periods

Take a short break from the Platform:
- **24 Hours:** Temporary pause on all activity
- **48 Hours:** Extended break
- **72 Hours:** Weekend break

During cooling-off, you cannot:
- Enter contests
- Make deposits
- Access contest lobbies

You can still:
- View your account
- Withdraw funds
- Contact support

## 4. Self-Exclusion

For a longer break, self-exclusion is available:

### 4.1 Duration Options
- **30 Days:** One month break
- **60 Days:** Two month break  
- **90 Days:** Three month break
- **Permanent:** Indefinite exclusion

### 4.2 What Happens
- Immediate account restriction
- No contest entries or deposits
- Email notifications disabled
- Cannot be reversed during exclusion period

### 4.3 How to Self-Exclude
1. Visit Responsible Play page
2. Select exclusion duration
3. Confirm your decision
4. Account is immediately restricted

**Important:** Self-exclusion cannot be undone. Contact support only after the exclusion period ends to reactivate.

## 5. Warning Signs

You may have a problem if you:
- ✗ Spend more than you can afford
- ✗ Chase losses by entering more contests
- ✗ Neglect work, family, or personal responsibilities
- ✗ Borrow money to play
- ✗ Feel anxious or irritable when not playing
- ✗ Lie to others about your contest participation

## 6. Reality Checks

Enable reality check reminders to be notified of time spent and money wagered at regular intervals.

## 7. Getting Help

If you need support, these organizations provide free, confidential assistance:

### National Resources

**National Council on Problem Gambling**  
Website: [ncpgambling.org](https://www.ncpgambling.org/)  
Phone: 1-800-522-4700 (24/7)  
Text: 1-800-522-4700  
Chat: Available on website

**Gamblers Anonymous**  
Website: [gamblersanonymous.org](https://www.gamblersanonymous.org/)  
Find local meetings and support groups

### State-Specific Resources

Many states offer additional resources. Visit your state''s problem gambling website or call the national hotline for local referrals.

## 8. For Family & Friends

If someone you know may have a problem:
- Express concern without judgment
- Provide information about resources
- Encourage them to seek help
- Set boundaries about financial support
- Visit [ncpgambling.org/help-treatment/family-and-friends/](https://www.ncpgambling.org/help-treatment/family-and-friends/)

## 9. Underage Prevention

- Platform restricted to users 18+ (or state minimum age)
- Age verification required
- Parents: Use device parental controls
- Report suspected underage use to support@rowfantasy.com

## 10. Our Policies

RowFantasy:
- ✓ Does not offer credit or loans
- ✓ Prohibits employees from playing
- ✓ Monitors for problem behavior patterns
- ✓ Provides immediate access to self-exclusion
- ✓ Supports responsible gaming initiatives

## 11. Account Closure

You can permanently close your account at any time by contacting support. Remaining funds will be withdrawn per our standard process.

## 12. Additional Resources

**SAMHSA National Helpline**  
1-800-662-4357 (24/7)  
Substance abuse and mental health services

**Crisis Text Line**  
Text "HELLO" to 741741  
Free 24/7 crisis support

---

**Need Help Now?**

If you or someone you know needs immediate assistance, contact:
- **National Problem Gambling Helpline:** 1-800-522-4700
- **Crisis Text Line:** Text "HELLO" to 741741

*RowFantasy is committed to your wellbeing. Please reach out if you need support.*',
1,
now()
);

-- Insert help articles
INSERT INTO public.help_articles (slug, title, body_md, category, tags, published_at) VALUES
(
'getting-started',
'Getting Started with RowFantasy',
'# Getting Started

Welcome to RowFantasy! This guide will help you get started.

## Create an Account
1. Click "Sign Up" in the top right
2. Enter your email, name, and create a password
3. Verify your email address
4. Complete your profile

## Make Your First Deposit
1. Go to your Profile page
2. Click "Add Funds"
3. Enter deposit amount (minimum $10)
4. Complete payment

## Enter Your First Contest
1. Browse available contests in the Lobby
2. Select a contest that interests you
3. Choose 2-4 crews based on contest rules
4. Confirm your entry

## How Scoring Works
- Points based on finish position
- Margin of victory affects tiebreakers
- Results posted after regatta completion
- Prizes distributed automatically

Questions? Contact support@rowfantasy.com',
'general',
ARRAY['beginner', 'account', 'contests'],
now()
),
(
'how-to-deposit',
'How to Add Funds to Your Wallet',
'# Adding Funds

Learn how to deposit money into your RowFantasy wallet.

## Deposit Methods
- Credit/Debit Card (Visa, Mastercard, Amex)
- Bank Account (ACH)
- PayPal (select states)

## Deposit Limits
- Minimum: $10
- Maximum: $2,500 per transaction
- Monthly limit: Set in Responsible Play settings

## How to Deposit
1. Log in to your account
2. Click "Add Funds" on Profile page
3. Enter amount
4. Select payment method
5. Complete payment securely

## Processing Time
- Cards: Instant
- ACH: 2-3 business days
- PayPal: Instant

## Troubleshooting
If your deposit fails:
- Verify card details are correct
- Check your bank balance
- Ensure you''re not exceeding limits
- Contact support if issues persist

## Security
All transactions are encrypted and secure. We never store full card details.',
'payments',
ARRAY['deposit', 'wallet', 'payment'],
now()
),
(
'how-to-withdraw',
'How to Withdraw Winnings',
'# Withdrawing Funds

Learn how to withdraw money from your RowFantasy wallet.

## Withdrawal Requirements
- Minimum withdrawal: $10
- Identity verification (KYC) must be completed
- Only withdraw to accounts in your name

## Withdrawal Methods
- Bank Account (ACH) - Recommended
- PayPal (select states)
- Check (for amounts over $500)

## How to Withdraw
1. Go to Profile page
2. Click "Withdraw Funds"
3. Enter amount
4. Select withdrawal method
5. Confirm details

## Processing Time
- ACH: 3-5 business days
- PayPal: 1-2 business days
- Check: 7-10 business days

## First-Time Withdrawals
Your first withdrawal requires identity verification:
- Upload government-issued photo ID
- Provide proof of address
- SSN verification

This is a one-time process for security and legal compliance.

## Troubleshooting
- Verify your identity is confirmed
- Check minimum withdrawal amount
- Ensure bank details are correct
- Contact support for assistance',
'payments',
ARRAY['withdrawal', 'wallet', 'kyc'],
now()
),
(
'contest-rules',
'Understanding Contest Rules',
'# Contest Rules

Learn how RowFantasy contests work.

## Contest Types
- **Head-to-Head:** Two players compete directly
- **Tiered Entry:** Multiple entry fee levels
- **Championship:** Larger prize pools, more entrants

## How to Play
1. Select 2-4 crews (per contest rules)
2. Each crew must be from a different division
3. Submit picks before contest lock time
4. Wait for regatta results

## Scoring System
Points awarded based on finish position:
- 1st Place: 100 points
- 2nd Place: 80 points
- 3rd Place: 60 points
- 4th Place: 40 points
- 5th+ Place: 20 points

## Tiebreakers
If scores are tied:
1. Margin of victory (combined)
2. Higher single crew finish
3. Entry timestamp (earlier wins)

## Winning
- Winners determined after official results
- Prizes credited to wallet automatically
- No action required

## Cancelled Events
If a regatta is cancelled:
- Entry fees refunded
- Contest voided
- No penalties

## Questions?
Each contest shows specific rules. Read carefully before entering.',
'contests',
ARRAY['rules', 'scoring', 'contests'],
now()
),
(
'state-eligibility',
'State Eligibility & Restrictions',
'# State Eligibility

RowFantasy is available in most U.S. states, but some have restrictions.

## How We Verify Your Location
- IP address detection
- GPS location (mobile)
- Required for contest entry

## State Categories

### Permitted States
Full access to all features.

### Regulated States
Available with specific license requirements. We display our license information for these states.

### Restricted States  
Some features may be limited based on state law.

### Banned States
Service not available. These states prohibit skill-based gaming contests.

## Checking Your State Status
1. Visit the Legal page
2. View state compliance banner
3. Check State Availability Map

## If You Travel
- Must be physically located in permitted state to enter contests
- Existing contest entries remain valid
- Cannot enter new contests from restricted states

## VPN & Location Spoofing
Using VPNs or location spoofing is strictly prohibited and will result in account termination.

## Questions About Your State?
Contact support@rowfantasy.com or visit /legal for detailed state information.',
'compliance',
ARRAY['states', 'location', 'eligibility'],
now()
),
(
'kyc-verification',
'Identity Verification (KYC)',
'# Identity Verification

Why we need to verify your identity and how it works.

## Why KYC is Required
- Federal AML (Anti-Money Laundering) laws
- Age verification (must be 18+)
- Fraud prevention
- State regulatory compliance

## When Verification is Needed
- First withdrawal request
- Cumulative winnings exceed $600
- Suspicious activity detected
- Random compliance checks

## Documents Required
1. **Government-Issued Photo ID**
   - Driver''s license
   - Passport
   - State ID card

2. **Proof of Address**
   - Utility bill (within 90 days)
   - Bank statement
   - Lease agreement

3. **Social Security Number**
   - For tax reporting (IRS requirement)

## How to Submit
1. Go to Profile → Verification
2. Upload clear photos of documents
3. Complete SSN verification
4. Submit for review

## Processing Time
- Usually 24-48 hours
- May take longer for complex cases
- You''ll receive email notification

## Security & Privacy
- All documents encrypted
- Stored securely per regulations
- Never shared except as required by law
- Deleted per our data retention policy

## Verification Failed?
- Ensure documents are clear and valid
- Check that information matches your account
- Contact support@rowfantasy.com for help

## Tax Reporting
If you win $600+ in a year, we''ll send you IRS Form 1099-MISC for tax purposes.',
'compliance',
ARRAY['kyc', 'verification', 'identity', 'taxes'],
now()
);