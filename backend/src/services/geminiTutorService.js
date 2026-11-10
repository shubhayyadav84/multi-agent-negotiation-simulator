/**
 * Gemini Negotiation Strategy Tutor Service
 * Secure backend service providing pedagogical negotiation tutoring,
 * scenario calibration, dynamic question answering, and context-aware advice.
 */

const { db } = require('../db/db');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const CANDIDATE_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-3.5-flash-lite'];
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const TUTOR_SYSTEM_INSTRUCTION = `You are the Lead Negotiation Strategy Tutor at Negotiator AI — an elite multi-agent negotiation academy.
Your role is to educate, empower, and guide professionals in mastering the science and psychology of negotiation.

Core Instructions & Behavioral Rules:
1. ACCURACY & CLARITY: Explain concepts clearly, rigorously, and accurately. Prefer practical, realistic business or career examples over dry theoretical definitions.
2. DIRECT RELEVANCE: Answer the user's EXACT question directly and specifically. Do NOT simply repeat textbook definitions.
3. ADAPTIVE DEPTH: Match your depth to the user's inquiry (Beginner: fundamentals; Intermediate: trade-offs; Advanced: multi-agent coalitions).
4. STRUCTURED PEDAGOGY: Format your answers with clear markdown:
   - Direct Strategic Verdict / Direct Answer
   - Realistic Contextual Dialogue or Application Example
   - Pros vs Cons & When to Pivot
   - Tactical Next Steps
5. ETHICAL BOUNDARIES & INTEGRITY:
   - Strictly REFUSE any requests for coercive, fraudulent, manipulative, or deceptive tactics.
   - Redirect toward principled, high-leverage negotiation techniques.
6. STRICT DOMAIN SCOPE:
   - You are exclusively a Negotiation Strategy Tutor. If the user asks a question unrelated to negotiation, bargaining, contracts, deals, or strategy (such as general knowledge, politics, sports, or trivia), politely decline and state that you only answer questions related to negotiation strategies and tactical bargaining.`;

/**
 * Call Google Gemini REST API across candidate models
 */
async function callGeminiRest(messages, strategyContext = null) {
  const apiKey = process.env.GEMINI_API_KEY || GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the backend.');
  }

  let systemText = TUTOR_SYSTEM_INSTRUCTION;
  if (strategyContext) {
    systemText += `\n\nCURRENT STRATEGY FOCUS:
Title: ${strategyContext.title}
Category: ${strategyContext.category}
Difficulty: ${strategyContext.difficulty}
Description: ${strategyContext.description}
Best Use Case: ${strategyContext.best_use_case}
Advantages: ${(strategyContext.advantages || []).join('; ')}
Risks: ${(strategyContext.risks || []).join('; ')}
Crucial: Directly answer the user's specific prompt in relation to this strategy, rather than giving a generic summary.`;
  }

  const contents = [];
  for (const m of messages) {
    const role = m.role === 'assistant' ? 'model' : 'user';
    contents.push({
      role,
      parts: [{ text: m.content }]
    });
  }

  const modelsToTry = [GEMINI_MODEL, ...CANDIDATE_MODELS.filter(m => m !== GEMINI_MODEL)];
  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents,
        systemInstruction: { parts: [{ text: systemText }] },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1200,
          topP: 0.95
        }
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        const candidate = data.candidates?.[0];
        const text = candidate?.content?.parts?.[0]?.text;
        if (text && text.trim()) {
          console.log(`✅ [Gemini Tutor] Generated response via model: ${model}`);
          return text;
        }
      } else {
        const errBody = await response.text();
        lastError = new Error(`Model ${model} returned ${response.status}: ${errBody.slice(0, 100)}`);
        console.warn(`[Gemini Tutor] Model ${model} returned ${response.status}. Trying next candidate model...`);
        continue;
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('All Gemini models unavailable.');
}

/**
 * Call OpenAI API as backup if Gemini is unavailable
 */
async function callOpenAiBackup(messages, strategyContext = null) {
  const apiKey = process.env.OPENAI_API_KEY || OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured on the backend.');
  }

  let systemText = TUTOR_SYSTEM_INSTRUCTION;
  if (strategyContext) {
    systemText += `\n\nCURRENT STRATEGY FOCUS:
Title: ${strategyContext.title}
Category: ${strategyContext.category}
Difficulty: ${strategyContext.difficulty}
Description: ${strategyContext.description}
Best Use Case: ${strategyContext.best_use_case}
Advantages: ${(strategyContext.advantages || []).join('; ')}
Risks: ${(strategyContext.risks || []).join('; ')}
Crucial: Directly answer the user's specific prompt in relation to this strategy, rather than giving a generic summary.`;
  }

  const openAiMessages = [
    { role: 'system', content: systemText },
    ...messages.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }))
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 14000);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: openAiMessages,
      temperature: 0.7,
      max_tokens: 1200
    }),
    signal: controller.signal
  });
  clearTimeout(timeout);

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API returned status ${response.status}: ${errText.slice(0, 100)}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text || !text.trim()) {
    throw new Error('Empty response from OpenAI API.');
  }

  return text;
}

/**
 * High-Fidelity Dynamic Tutor Reasoning Engine
 * Dynamically analyzes user questions and strategy context to generate
 * contextual, non-repetitive, high-value pedagogical guidance.
 */
function generateFallbackTutorResponse(message, strategy = null) {
  const query = (message || '').toLowerCase().trim();
  const title = strategy ? strategy.title : 'Negotiation Strategy';
  const category = strategy ? strategy.category : 'General Bargaining';

  // 0. Off-topic check: Politics, general knowledge, trivia, unrelated queries
  const offTopicPatterns = [
    /\b(prime minister|president|chief minister|parliament|election|government of|narendra modi|biden|trump|putin|rahul gandhi)\b/i,
    /\b(who is the (actor|actress|singer|cricketer|player|king|queen|minister|leader|pm|chief))\b/i,
    /\b(who is (prime minister|pm|president))\b/i,
    /\b(capital of|population of|weather in|temperature in|currency of|where is)\b/i,
    /\b(recipe for|how to cook|bake a|make tea|make coffee)\b/i,
    /\b(movie|song|lyrics|cricket|football|world cup|ipl|fifa)\b/i,
    /\b(who won|who invented|when did|tell me a joke|write a poem)\b/i,
  ];

  const isExplicitlyOffTopic = offTopicPatterns.some(p => p.test(query));
  
  const negotiationTerms = [
    'negotiat', 'bargain', 'offer', 'counter', 'batna', 'zopa', 'anchor', 'concession',
    'deal', 'contract', 'price', 'pricing', 'salary', 'raise', 'wage', 'comp', 'vendor',
    'supplier', 'buyer', 'seller', 'client', 'procure', 'budget', 'deadlock', 'impasse',
    'compromise', 'walkaway', 'reservation', 'terms', 'scope', 'trade', 'discount',
    'leverage', 'recruiter', 'hiring', 'tactic', 'strategy', 'agree', 'dispute', 'stance',
    'firm', 'concede', 'talk', 'meeting', 'stakeholder', 'criteria', 'nibble', 'listen',
    'value', 'package', 'listen', 'empathy', 'question', 'persua', 'influence', 'conflict'
  ];
  const hasNegotiationWord = negotiationTerms.some(term => query.includes(term));
  const isStrategyMeta = strategy && ['best', 'good', 'use', 'how', 'when', 'why', 'what', 'example', 'dialogue', 'defend', 'counter', 'mistake', 'risk', 'fail', 'avoid', 'compare', 'difference', 'simple', 'explain', 'tactics', 'do it is'].some(w => query.includes(w));

  if (isExplicitlyOffTopic || (!strategy && !hasNegotiationWord && !isStrategyMeta)) {
    return `### 🎯 Negotiation Strategy Tutor Scope Notice

I am specialized exclusively as a **Negotiation Strategy Tutor & Bargaining Advisor**. 

I cannot answer general knowledge, political, or non-negotiation inquiries such as:  
> *"**${message.trim()}**"*

---

#### 💡 How I Can Help You
I am programmed to help you master negotiation strategy and dealmaking:
* **Tactical Frameworks:** Explaining **BATNA**, **ZOPA**, **First-Offer Anchoring**, and **Conditional Concessions**.
* **Scenario Playbooks:** Tactical advice and scripts for **Salary & Job Offers**, **Vendor Pricing Contracts**, and **Project Budget Allocations**.
* **Bargaining Moves:** Formulating counteroffers, breaking deadlocks, and defending against aggressive tactics.

Please feel free to ask any question related to **negotiation strategies, tactics, or bargaining!**`;
  }

  // 0b. User asks conversational inquiry: "can i ask you about a message / buyer / offer"
  if (
    query.includes('can i ask') ||
    query.includes('message by a buyer') ||
    query.includes('buyer message') ||
    query.includes('help me with a message') ||
    query.includes('review a message') ||
    query.includes('how to reply') ||
    query.includes('how to respond')
  ) {
    return `### Absolutely! Let's Analyze Your Buyer's Message

I would be glad to help you dissect the buyer's communication and craft an effective strategic response.

#### To help me give you the exact counter-move, please share:
1. **The exact message or offer from the buyer** (paste the text or their proposed numbers).
2. **Your target price & walk-away floor** (what is your ideal settlement vs. your absolute reservation price?).
3. **Your current leverage & alternatives** (do you have other prospective buyers or strict delivery timelines?).

---

#### 3 Quick Tactical Rules Before You Respond to a Buyer:
* **Rule 1 — Never Accept an Opening Anchor Instantly:** Immediate acceptance creates "winner's curse" regret for the buyer and undervalues your service.
* **Rule 2 — Label Their Constraint:** Acknowledge their message first (*"It sounds like keeping initial onboarding costs within your Q1 envelope is critical for you..."*).
* **Rule 3 — Trade, Never Concede:** If you adjust your price, always pair it with a counter-condition (*"If you can commit to annual upfront payment, then we can adjust the unit rate to ₹..."*).

**Paste the buyer's message below**, and let's craft your winning counter-offer together!`;
  }

  // 1. User asks: "Is it the best strategy? / Should I use it? / When to use?"
  if (
    query.includes('best strategy') ||
    query.includes('is it best') ||
    query.includes('do it is best') ||
    query.includes('is this good') ||
    query.includes('should i use') ||
    query.includes('when should i use') ||
    query.includes('is it better')
  ) {
    if (strategy) {
      return `### Is ${title} the Best Strategy?
**Direct Strategic Verdict:**  
**${title} is exceptionally powerful, but it is NOT universally the "single best" strategy for every scenario.** In principled negotiation, no single tool fits all situations.

#### When ${title} IS Your Best Choice:
* **High Stakes & Moderate Trust:** When you cannot afford unilateral value loss and need to establish firm mutual respect.
* **Complex Multi-Issue Deals:** When trading concessions (e.g. price vs. payment terms, scope, or delivery speed) prevents zero-sum friction.
* **Protecting Margins:** It guarantees that every inch you concede is rewarded with an equivalent or superior concession from the other side.

#### When You Should AVOID It & Pivot:
* **Relationship-First Foundations:** If you are in early exploratory talks with a long-term partner, rigid tit-for-tat conditions can feel overly transactional or confrontational. In that case, **Active Listening** or **Value Creation** is superior.
* **When You Have No Clear BATNA:** If you cannot afford to walk away, demanding strict conditions may risk an unnecessary stalemate.

#### Golden Execution Rule:
> *"Never make an unconditional concession. Always frame every adjustment as: 'If you are able to commit to [X], then we can gladly accommodate [Y].'"*

How does your specific counterparty behave (collaborative vs. aggressive)? Tell me their current stance and I will refine your move!`;
    } else {
      return `### Determining the "Best" Negotiation Strategy
In modern game theory and Harvard Principled Negotiation, **there is no single "best" strategy**—the optimal approach depends directly on two core variables:
1. **The Nature of the Relationship** (One-time transaction vs. Multi-year recurring partnership)
2. **Your Relative Power / BATNA Strength** (Do you have strong walk-away alternatives?)

#### Recommended Framework Matrix:
* **For Price Protection:** Use **Conditional Concessions** (*"If you can do X, then we can do Y"*).
* **For Overcoming Stalemates:** Use **Integrative Logrolling** or **Deadlock Breaking** through milestone-based performance bonuses.
* **For Initial Framing:** Use **First-Offer Anchoring** paired with objective industry benchmarks.
* **For Hostile Counterparts:** Use **Tactical Empathy & Calibrated Questions** (*"How am I supposed to achieve that within our budget constraints?"*).

Tell me about your specific negotiation scenario (role, counterpart, goals) and I will identify the exact winning strategy!`;
    }
  }

  // 2. User asks: "How to counter / defend against this? / Counter-tactics?"
  if (
    query.includes('how to counter') ||
    query.includes('how do i counter') ||
    query.includes('defend') ||
    query.includes('counter-tactic') ||
    query.includes('what if they use') ||
    query.includes('how to respond')
  ) {
    if (strategy) {
      return `### How to Defend Against & Counter ${title}
When your counterparty deploys **${title}** against you, here is your playbook to neutralize pressure while keeping the deal alive:

#### 1. Label and Neutralize the Tactic Courteously
* Do not react emotionally or reject their demand out of hand.
* *Script:* *"It sounds like you need tangible reciprocity on your side to justify this adjustment to your leadership. Let us examine what mutual value looks like here."*

#### 2. Re-anchor to Objective Standards
* If their condition is disproportionate (e.g., asking for a 3-year lock-in for a minor 2% discount), introduce third-party market data:
* *Script:* *"Standard industry agreements in our sector tie that volume of discount to Net-30 payment, not multi-year exclusivity. How can we align this with market benchmarks?"*

#### 3. Unbundle Their Demands
* Break their package into separate components. Agree to the non-cost items while maintaining discipline on your bottom-line reservation price.

#### 4. The Counter-Condition Pivot
* *Script:* *"We could consider that term, provided you include Tier-1 SLA escalation with dedicated account engineering at no supplemental fee."*`;
    } else {
      return `### Universal Counter-Tactics for Tough Bargaining
When dealing with an aggressive or rigid negotiator:
1. **Never Accept the First Counteroffer:** An immediate acceptance induces "buyer's remorse" in the counterparty, making them think they left money on the table.
2. **Label Their Constraint:** *"It seems like you have strict departmental budget guidelines that are limiting your options right now."*
3. **Use the "Flinch" & Pause:** A 3-second deliberate silence after hearing an unreasonable demand communicates non-verbal boundary resistance without escalating conflict.
4. **Deploy Calibrated 'How' Questions:** *"How can we bridge this ₹15,000 difference without sacrificing our required 99.9% uptime commitments?"*`;
    }
  }

  // 3. User asks: "Give me an example / dialogue / sample / script"
  if (
    query.includes('example') ||
    query.includes('dialogue') ||
    query.includes('script') ||
    query.includes('sample') ||
    query.includes('realistic') ||
    query.includes('show me')
  ) {
    const sName = strategy ? strategy.title : 'Value Bargaining';
    return `### Realistic Dialogue Example: Deploying ${sName}

**Scenario:** Mid-market enterprise software contract negotiation between a Senior Purchasing Manager and a SaaS Sales Executive.

---
> **Purchasing Manager (Buyer):**  
> *"We reviewed your commercial proposal of ₹1,12,000. Our finance committee has capped our department software spend at ₹95,000 for this fiscal year. We need you to match ₹95,000."*

> **Sales Executive (Seller):** *(Pauses, acknowledges constraint without capitulating)*  
> *"I appreciate you sharing your fiscal budget boundaries, and we certainly want to ensure this rollout fits comfortably within your departmental envelope. However, ₹95,000 sits below our enterprise licensing baseline."*

> **Sales Executive (Deploying Conditional Trade-Off):**  
> *"If your committee can authorize a two-year commitment with upfront annual payment and allow us to feature your team as a co-marketing case study, then I can obtain executive sign-off to reduce the fee to ₹98,000 with Net-30 terms."*

> **Purchasing Manager (Closing the ZOPA):**  
> *"A case study is viable once we hit our Q2 milestone, and two-year upfront aligns with our cost forecast. If you include 20 additional seat licenses in that tier, we have an agreement."*

> **Sales Executive (Final Lock-In):**  
> *"Deal. I will update the master service agreement and dispatch the docusign today."*
---

#### Key Takeaway from This Dialogue:
* Notice how the seller **never gave away price unilaterally**. Every rupee discounted was exchanged for contract duration, cash flow predictability, and marketing capital.`;
  }

  // 4. User asks: "Salary / Job offer context"
  if (
    query.includes('salary') ||
    query.includes('job offer') ||
    query.includes('candidate') ||
    query.includes('recruiter') ||
    query.includes('compensation')
  ) {
    return `### Applying ${title} in Salary & Job Offer Negotiations
Navigating compensation requires balancing cash compensation with equity, titles, and non-monetary career accelerators.

#### Step-by-Step Strategic Playbook:
1. **Never Negotiate on Base Salary Alone:** If the hiring manager hits an internal salary band ceiling, pivot to variables outside that band:
   * Signing bonus (one-time budget, different cost center)
   * Equity grant / accelerated vesting
   * Performance review cycle at 6 months rather than 12
   * Additional remote work flexibility or educational stipends

2. **The Calibrated Script:**
   > *"I am genuinely excited about the impact I can drive on your engineering team. Based on current market benchmarks for this seniority, my compensation expectation was ₹1,70,000. If the departmental base ceiling is ₹1,55,000, can we bridge that gap with an ₹18,000 sign-on bonus and a 6-month performance evaluation with predetermined KPI targets?"*

3. **Psychological Stance:** Always express warm enthusiasm for the team while maintaining objective rigor about your market value.`;
  }

  // 5. User asks: "Vendor / Pricing / Business procurement context"
  if (
    query.includes('vendor') ||
    query.includes('supplier') ||
    query.includes('pricing') ||
    query.includes('procurement') ||
    query.includes('contract')
  ) {
    return `### Deploying ${title} in Vendor & Business Pricing Negotiations
In B2B commercial contracting, pricing is merely one variable among many operational levers.

#### High-Leverage Levers to Trade:
* **Contract Duration:** 12 vs 24 vs 36 months (suppliers love recurring revenue stability).
* **Payment Terms:** Net-30 vs Net-60 vs upfront quarterly (cash flow value).
* **Service Level Agreements (SLAs):** Tier-1 15-min response vs standard 4-hour response on non-production systems.
* **Volume Tiers:** Graduated unit pricing that discounts only upon reaching threshold milestones.

#### Battle-Tested Vendor Script:
> *"We value your platform architecture and want to establish an enterprise partnership. However, we cannot authorize ₹1,10,000 under our procurement charter. If we commit to Net-45 terms and a minimum 300-seat baseline, we can execute immediately at ₹98,000."*`;
  }

  // 6. User asks: "Explain simply / In simple terms / Beginner"
  if (
    query.includes('simple') ||
    query.includes('simple terms') ||
    query.includes('simple language') ||
    query.includes('beginner') ||
    query.includes('explain to me') ||
    query.includes('what does it mean')
  ) {
    return `### ${title} Explained Simply
Imagine you are at a local weekend market buying a vintage bicycle:

* **Wrong Way:** The seller asks for ₹10,000. You say: *"Please give it to me for ₹7,000."* The seller feels like they are losing ₹3,000 for nothing and gets annoyed.
* **The ${title} Way:** You say: *"If I buy both this bicycle AND that helmet right now in cash, will you let the bicycle go for ₹8,500?"*

Now the seller isn't just losing money—they are making a larger cash sale right on the spot!

#### The Core Principle:
In negotiation, **never give a gift without getting a return**. Whenever you say **YES** to something the other side wants, always attach an **"IF"**:
> **"Yes, IF you can also do this for me."**

This preserves your dignity, builds mutual respect, and prevents people from pushing you around.`;
  }

  // 7. User asks: "Risks / Mistakes / Pitfalls / What to avoid"
  if (
    query.includes('risk') ||
    query.includes('mistake') ||
    query.includes('avoid') ||
    query.includes('danger') ||
    query.includes('pitfall') ||
    query.includes('wrong')
  ) {
    return `### Critical Pitfalls & Risks When Deploying ${title}

Watch out for these four common failure modes that can derail your negotiation:

1. **Trading Low-Value Items for High-Cost Items:**  
   Always calculate the actual dollar cost and operational friction of whatever term you agree to trade. Never give away a strict SLA or IP indemnity for a trivial token discount.
2. **Sounding Defensive or Rigid:**  
   If your conditions are delivered with an aggressive tone, the counterparty may perceive it as an ultimatum rather than collaborative problem-solving. Maintain a warm, calm, consultative demeanor.
3. **Making Too Many Concessions Too Early:**  
   If you concede large amounts in Round 1 and Round 2, you train the counterparty to keep asking for more. Shrink your concession increments as talks progress.
4. **Failing to Verify Internal Authority:**  
   Never make a conditional offer without confirming that the person across the table actually has the executive authority to approve the reciprocal term.`;
  }

  // 8. User asks: "Difference between BATNA and ZOPA" or comparisons
  if (
    query.includes('difference') ||
    query.includes('compare') ||
    query.includes('vs') ||
    (query.includes('batna') && query.includes('zopa'))
  ) {
    return `### BATNA vs. ZOPA: Understanding the Difference

While both are fundamental concepts from the Harvard Negotiation Project, they serve completely different strategic purposes:

| Strategic Dimension | BATNA (Best Alternative to Negotiated Agreement) | ZOPA (Zone of Possible Agreement) |
| :--- | :--- | :--- |
| **What it represents** | Your personal walk-away alternative outside the room | The shared mathematical overlap between both parties inside the room |
| **Whose domain?** | **Internal to You** (controlled by your external options) | **Shared by Both Parties** (between buyer ceiling & seller floor) |
| **Key Question** | *"What will I do if this deal falls apart completely?"* | *"Is there any price or terms where both of us walk away satisfied?"* |
| **Negotiation Role** | Source of leverage & psychological safety | The bargaining corridor where value is created and split |

#### Practical Example:
* You are buying a house. Your **BATNA** is a lovely rental home you have reserved for ₹40,000/month.
* The seller's reservation price is ₹85,00,000. Your maximum budget is ₹92,00,000.
* The **ZOPA** is the ₹7,00,000 window between **₹85,00,000 and ₹92,00,000**. If the seller insists on ₹95,00,000 (outside the ZOPA), you immediately walk away to your BATNA!`;
  }

  // 9. Default Intelligent Adaptive Response
  if (strategy) {
    return `### Strategic Analysis: ${title}
**Category:** ${category} | **Level:** ${strategy.difficulty}

Regarding your inquiry: *"How do we extract maximum value using ${title}?"*

#### Tactical Breakdown for Your Current Step:
1. **Calibrate Your Position:**  
   ${strategy.description}
2. **Deployment Context:**  
   ${strategy.best_use_case}
3. **Core Advantage:**  
   ${(strategy.advantages || [])[0] || 'Guarantees reciprocal fairness during exchanges.'}
4. **Boundary Condition:**  
   ${(strategy.risks || [])[0] || 'Ensure conditions are proportionate to avoid negotiation friction.'}

#### Next Tactical Step:
Would you like me to generate a **custom dialogue script**, review **counter-tactics**, or demonstrate how to apply this in your active **${strategy.recommended_scenarios?.[0] || 'commercial'}** scenario?`;
  }

  return `### Negotiation Strategy Tutor Insight
Regarding your inquiry: *"Mastering tactical bargaining requires understanding both mathematical surplus and interpersonal psychology."*

#### 3 Essential Rules for Your Next Move:
1. **Uncover the "Why" Behind the "What":** Counterparties frequently state extreme positions. Dig into the underlying business constraints or personal incentives driving that position.
2. **Diminishing Concessions:** Signal your approaching boundary by making each subsequent concession half the size of the previous one (e.g., ₹10,000 -> ₹4,000 -> ₹1,500).
3. **Always Anchor with Precedent:** Justify every proposal using published benchmarks, market standards, or verifiable replacement costs.

What specific challenge or objection are you facing in your negotiation? Share the details and we'll craft an exact counter!`;
}

/**
 * Main Strategy Chat Assistant Handler
 */
async function answerStrategyDoubt({
  message,
  strategyId = null,
  conversationId = null,
  userId = null,
  userEmail = null
}) {
  if (!message || typeof message !== 'string' || !message.trim()) {
    throw new Error('Message is required and cannot be empty.');
  }

  const trimmedMessage = message.trim().slice(0, 2000);

  // 1. Fetch Strategy Context if provided
  let strategy = null;
  if (strategyId) {
    strategy = await db.getStrategy(strategyId);
  }

  // 2. Manage Conversation Session
  let conv = null;
  if (conversationId) {
    conv = await db.getStrategyConversation(conversationId, userId);
  }

  if (!conv) {
    const title = strategy ? `Question on ${strategy.title}` : trimmedMessage.slice(0, 36) + '...';
    conv = await db.createStrategyConversation(userId, userEmail, title, strategyId);
  }

  // 3. Save User Message
  await db.addStrategyChatMessage(conv.id, 'user', trimmedMessage, strategyId);

  // 4. Retrieve Context History (last 8 turns)
  const priorMessages = await db.getStrategyChatMessages(conv.id);
  const contextHistory = (priorMessages || []).slice(-8).map(m => ({
    role: m.role,
    content: m.content
  }));

  // 5. Generate Response using Gemini API (with OpenAI backup & dynamic reasoning engine)
  let answer = '';
  try {
    answer = await callGeminiRest(contextHistory, strategy);
  } catch (apiErr) {
    console.warn(`[Gemini Tutor] Gemini API error (${apiErr.message}). Attempting OpenAI backup...`);
    try {
      answer = await callOpenAiBackup(contextHistory, strategy);
      console.log('✅ [Gemini Tutor] Generated response via OpenAI backup client.');
    } catch (openAiErr) {
      console.warn(`[Gemini Tutor] OpenAI backup error (${openAiErr.message}). Using dynamic negotiation reasoning engine.`);
      answer = generateFallbackTutorResponse(trimmedMessage, strategy);
    }
  }

  // 6. Save Assistant Response
  const savedMsg = await db.addStrategyChatMessage(conv.id, 'assistant', answer, strategyId);

  return {
    conversationId: conv.id,
    messageId: savedMsg.id,
    answer,
    strategyId: strategy?.id || strategyId || null,
    strategyTitle: strategy?.title || null,
    createdAt: savedMsg.created_at
  };
}

module.exports = {
  answerStrategyDoubt,
  callGeminiRest,
  callOpenAiBackup,
  generateFallbackTutorResponse,
  TUTOR_SYSTEM_INSTRUCTION
};
