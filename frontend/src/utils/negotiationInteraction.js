/**
 * Negotiation Interaction Utility Functions
 * Pure helper functions for:
 * 1. Monetary offer extraction from user and AI messages
 * 2. Deal acceptance and rejection intent detection
 * 3. Offer badge dynamic resolution
 */

/**
 * Extracts negotiation monetary proposal amounts from message text
 * Supports: ₹150,000, Rs. 1,50,000, 150000, 1.5 lakh, ₹2 LPA, $80,000, etc.
 * Avoids incorrectly identifying unrelated numbers (dates, years, round numbers, percentages).
 */
export function extractMonetaryOffer(text) {
  if (!text || typeof text !== 'string') return null;
  const str = text.trim();
  if (!str) return null;

  // Strip non-monetary contexts to prevent false positives:
  const cleaned = str
    .replace(/\b(round|rd|step|stage|version|v)\s*#?\d+\b/gi, '')
    .replace(/\b(19\d\d|20\d\d)\b/g, '') // Years like 2024, 2026
    .replace(/\d+(?:\.\d+)?\s*(%|percent|percentage)\b/gi, '')
    .replace(/\b\d+\s*(day|days|week|weeks|month|months|year|years|hr|hrs|hour|hours)\b/gi, '');

  // 1. LPA format: '₹2 LPA', '2 LPA', '2.5 LPA'
  const lpaMatch = cleaned.match(/(?:₹|Rs\.?|INR|\$)?\s*(\d+(?:\.\d+)?)\s*(?:lpa|l\.p\.a)/i);
  if (lpaMatch) {
    const val = parseFloat(lpaMatch[1]);
    if (!isNaN(val) && val > 0) return Math.round(val * 100000);
  }

  // 2. Lakh / Lac format: '1.5 lakh', '2.5 lacs', '15 lac', '₹1.5 lakh'
  const lakhMatch = cleaned.match(/(?:₹|Rs\.?|INR|\$)?\s*(\d+(?:\.\d+)?)\s*(?:lakh|lakhs|lac|lacs)\b/i);
  if (lakhMatch) {
    const val = parseFloat(lakhMatch[1]);
    if (!isNaN(val) && val > 0) return Math.round(val * 100000);
  }

  // 2b. Thousand in words format: '50 thousand', '50 thousands', '₹50 thousand', '$50 thousand'
  const thousandMatch = cleaned.match(/(?:₹|Rs\.?|INR|\$)?\s*(\d+(?:\.\d+)?)\s*(?:thousand|thousands)\b/i);
  if (thousandMatch) {
    const val = parseFloat(thousandMatch[1]);
    if (!isNaN(val) && val > 0) return Math.round(val * 1000);
  }

  // 2c. Crore format: '1.5 crore', '2 crores'
  const croreMatch = cleaned.match(/(?:₹|Rs\.?|INR|\$)?\s*(\d+(?:\.\d+)?)\s*(?:crore|crores)\b/i);
  if (croreMatch) {
    const val = parseFloat(croreMatch[1]);
    if (!isNaN(val) && val > 0) return Math.round(val * 10000000);
  }

  // 2d. Million format: '1 million', '1.5 millions'
  const millionMatch = cleaned.match(/(?:₹|Rs\.?|INR|\$)?\s*(\d+(?:\.\d+)?)\s*(?:million|millions|mn)\b/i);
  if (millionMatch) {
    const val = parseFloat(millionMatch[1]);
    if (!isNaN(val) && val > 0) return Math.round(val * 1000000);
  }

  // 2e. Written English number words with multiplier: 'fifty thousand', 'twenty five thousand', 'one lakh'
  const wordNumMatch = cleaned.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:\s+(one|two|three|four|five|six|seven|eight|nine))?\s*(hundred)?\s*(thousand|thousands|lakh|lakhs|lac|lacs|crore|crores|million|millions)\b/i);
  if (wordNumMatch) {
    const wordsToNum = {
      zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
      ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
      seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
      sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100
    };
    let base = wordsToNum[wordNumMatch[1].toLowerCase()] || 0;
    if (wordNumMatch[2]) base += wordsToNum[wordNumMatch[2].toLowerCase()] || 0;
    if (wordNumMatch[3]) base *= 100;
    const mult = wordNumMatch[4].toLowerCase();
    if (mult.includes('thousand')) base *= 1000;
    else if (mult.includes('lakh') || mult.includes('lac')) base *= 100000;
    else if (mult.includes('crore')) base *= 10000000;
    else if (mult.includes('million')) base *= 1000000;
    if (base > 0) return base;
  }

  // 3. K format: '150k', '80k', '₹150k', '$80k'
  const kMatch = cleaned.match(/(?:₹|Rs\.?|INR|\$)?\s*(\d+(?:\.\d+)?)\s*k\b/i);
  if (kMatch) {
    const val = parseFloat(kMatch[1]);
    if (!isNaN(val) && val > 0) return Math.round(val * 1000);
  }

  // 4a. Currency symbol or prefix followed by number: '₹150,000', 'Rs. 1,50,000', 'rupees 80', 'rupee 80', '$80,000', 'INR 150000'
  const currPrefixMatch = cleaned.match(/(?:₹|Rs\.?|rupees?|INR|\$)\s*([\d,]+(?:\.\d+)?)/i);
  if (currPrefixMatch) {
    const num = parseFloat(currPrefixMatch[1].replace(/,/g, ''));
    if (!isNaN(num) && num > 0) return Math.round(num);
  }

  // 4b. Currency suffix after number: '80 rupees', '80 rupee', '80 rs', '80 rs.', '80 inr'
  const currSuffixMatch = cleaned.match(/\b([\d,]+(?:\.\d+)?)\s*(?:rupees?|rs\.?|inr)\b/i);
  if (currSuffixMatch) {
    const num = parseFloat(currSuffixMatch[1].replace(/,/g, ''));
    if (!isNaN(num) && num > 0) return Math.round(num);
  }

  // 5. Explicit keywords before numbers: 'offer 150000', 'package 154,500', 'to 173,500', 'price 80'
  const keywordMatch = cleaned.match(/\b(?:offer|counter|package|salary|price|budget|rate|pay|compensation|adjust to|increase to|reduce to|settle at|at|to)\s*[:=]?\s*([\d,]+(?:\.\d+)?)/i);
  if (keywordMatch) {
    const num = parseFloat(keywordMatch[1].replace(/,/g, ''));
    if (!isNaN(num) && num > 0) return Math.round(num);
  }

  // 6. Standalone formatted numbers: e.g. '150,000', '1,50,000'
  const plainFormatted = cleaned.match(/\b\d{1,3}(?:,\d{2,3})+\b/);
  if (plainFormatted) {
    const num = parseFloat(plainFormatted[0].replace(/,/g, ''));
    if (!isNaN(num) && num >= 1000) return Math.round(num);
  }

  // 7. Standalone digits (4 to 9 digits): e.g. '150000', '173500'
  const standaloneMatch = cleaned.match(/\b\d{4,9}\b/);
  if (standaloneMatch) {
    const num = parseInt(standaloneMatch[0], 10);
    if (!isNaN(num) && num >= 500) return num;
  }

  return null;
}

/**
 * Detects user intent: Deal Acceptance vs Final Rejection vs Counteroffer
 * Prevents treating conditional rejections or counteroffers as terminations.
 */
export function detectNegotiationIntent(text) {
  if (!text || typeof text !== 'string') {
    return { isAccept: false, isReject: false, isConditionalCounter: false };
  }
  const lower = text.toLowerCase().trim();

  // Conditional guards: e.g. "I cannot accept ₹150,000, but I can agree to ₹180,000"
  // Counterproposal and conditional guards:
  // e.g. "I want to propose offer ₹99000 , I cannot accept ₹95,500" or "I cannot accept ₹150,000, but I can agree to ₹180,000"
  const hasCounterKeywords = /\b(propose|counter|counteroffer|counter-offer|how about|what about|instead|rather|prefer|settle at|my price|my offer|make it)\b/i.test(lower);
  const hasMonetary = /(?:₹|Rs\.?|INR|\$)?\s*\d+/i.test(lower);
  const hasConditional = /\b(if\b|only if|provided that|unless|as long as|but\b|however|subject to|with the condition)\b/i.test(lower);
  const isConditionalCounter = (hasConditional && (hasMonetary || hasCounterKeywords)) || (hasCounterKeywords && hasMonetary);

  const rejectPatterns = [
    /\b(i\s*(?:want\s*to|would\s*like\s*to|wish\s*to|plan\s*to|am\s*going\s*to)?\s*reject\s*(?:this|the|your)?\s*(?:deal|offer|proposal|terms)?)\b/i,
    /\b(reject\s*(?:this|the|your)?\s*(?:deal|offer|proposal|terms)|deal\s*rejected|offer\s*rejected)\b/i,
    /\b(i\s*(?:want\s*to|would\s*like\s*to|must|will)?\s*decline\s*(?:this|the|your)?\s*(?:deal|offer|proposal|terms)?)\b/i,
    /\b(decline\s*(?:this|the|your)?\s*(?:deal|offer|proposal|terms))\b/i,
    /\b(don't\s*want\s*to\s*proceed|do\s*not\s*want\s*to\s*proceed)\b/i,
    /\b(cannot\s*accept\s*(?:your|this|the)?\s*(?:offer|deal|terms)?|can't\s*accept\s*(?:your|this|the)?\s*(?:offer|deal|terms)?)\b/i,
    /\b(not\s*acceptable|unacceptable)\b/i,
    /\b(end\s*(?:this|the)?\s*negotiation|terminate\s*(?:this|the)?\s*negotiation)\b/i,
    /\b(withdrawing\s*from\s*(?:this|the)?\s*deal|withdraw\s*from\s*(?:this|the)?\s*(?:negotiation|deal))\b/i,
    /\b(walk\s*away|call\s*off\s*(?:the\s*deal|negotiations?)|no\s*deal)\b/i,
    /^reject(?:ed)?$/i,
    /^decline(?:d)?$/i,
  ];

  const acceptPatterns = [
    /\b(i\s*(?:want\s*to|would\s*like\s*to|wish\s*to|am\s*ready\s*to|plan\s*to|will)?\s*accept\s*(?:the|this|your)?\s*(?:deal|offer|proposal|terms|agreement)?)\b/i,
    /\b(accept\s*(?:the|this|your)?\s*(?:deal|offer|proposal|terms|agreement))\b/i,
    /\b(deal\s*accepted|offer\s*accepted|accepted\s*the\s*deal|terms\s*accepted)\b/i,
    /\b(i\s*(?:want\s*to|would\s*like\s*to)?\s*agree\s*(?:to|with)?\s*(?:the|this|your)?\s*(?:offer|deal|proposal|terms|price)?)\b/i,
    /\b(agree\s*(?:to|with)\s*(?:the|this|your)?\s*(?:offer|deal|proposal|terms|price))\b/i,
    /\b(that\s*works\s*for\s*me)\b/i,
    /\b(let'?s\s*(?:finalize|close|conclude)\s*(?:this|the)?\s*(?:deal|agreement)?|let\s*us\s*(?:finalize|close|conclude)\s*(?:this|the)?\s*(?:deal|agreement)?)\b/i,
    /\b(happy\s*with\s*(?:this|the|your)?\s*(?:agreement|deal|terms|offer))\b/i,
    /\b(we\s*have\s*a\s*deal|deal\s*is\s*(?:done|finalized|reached))\b/i,
    /\b(ready\s*to\s*(?:accept|sign|close))\b/i,
    /^accept(?:ed)?$/i,
    /^agree(?:d)?$/i,
  ];

  let isReject = false;
  let isAccept = false;

  if (!isConditionalCounter) {
    isReject = rejectPatterns.some((p) => p.test(lower));
    isAccept = !isReject && acceptPatterns.some((p) => p.test(lower));
  }

  return { isAccept, isReject, isConditionalCounter };
}

/**
 * Detects and extracts tripartite departmental budget allocations
 * from user or AI dialogue in Project Budget Allocation scenarios.
 * Handles inputs like:
 * - "Engineering 400k, Marketing 350k, Product 250k"
 * - "400k, 350k, 250k" or "400000, 350000, 250000"
 * - "40L, 35L, 25L" or "₹4,00,000 / ₹3,50,000 / ₹2,50,000"
 */
export function extractProjectBudgetAllocations(text) {
  if (!text || typeof text !== 'string') return null;
  const str = text.trim();
  if (!str) return null;

  const parseTokenAmount = (token) => {
    if (!token) return null;
    return extractMonetaryOffer(token.trim());
  };

  // 1. Labeled pattern: e.g. "Engineering 400k, Marketing 350k, Product 250k"
  const engMatch = str.match(/(?:eng(?:ineering)?|lead software|infra(?:structure)?|dept\s*a)\D{0,15}((?:₹|Rs\.?|\$)?\s*\d[\d,\.]*\s*(?:k|lakhs?|lacs?|crores?|lpa)?)/i);
  const mktMatch = str.match(/(?:mkt|marketing|growth|cmo|dept\s*b)\D{0,15}((?:₹|Rs\.?|\$)?\s*\d[\d,\.]*\s*(?:k|lakhs?|lacs?|crores?|lpa)?)/i);
  const prodMatch = str.match(/(?:prod(?:uct)?|ai|pm|dept\s*c)\D{0,15}((?:₹|Rs\.?|\$)?\s*\d[\d,\.]*\s*(?:k|lakhs?|lacs?|crores?|lpa)?)/i);

  if (engMatch && mktMatch && prodMatch) {
    const engVal = parseTokenAmount(engMatch[1]);
    const mktVal = parseTokenAmount(mktMatch[1]);
    const prodVal = parseTokenAmount(prodMatch[1]);

    if (engVal && mktVal && prodVal) {
      const total = engVal + mktVal + prodVal;
      return {
        engineering: engVal,
        marketing: mktVal,
        product: prodVal,
        total,
        isValidBudget: total <= 1000000,
      };
    }
  }

  // 2. Delimited sequence of 3 amounts: e.g. "400k, 350k, 250k" or "400000, 350000, 250000" or "400k / 350k / 250k"
  const tokens = str.split(/[,/;\+]|\band\b/i).map((s) => s.trim()).filter(Boolean);
  if (tokens.length >= 3) {
    const parsedAmounts = tokens.map(parseTokenAmount).filter((val) => val !== null && val > 0);
    if (parsedAmounts.length === 3) {
      const [engVal, mktVal, prodVal] = parsedAmounts;
      const total = engVal + mktVal + prodVal;
      return {
        engineering: engVal,
        marketing: mktVal,
        product: prodVal,
        total,
        isValidBudget: total <= 1000000,
      };
    }
  }

  // 3. Search for 3 distinct money tokens separated by whitespace or punctuation
  const allNumbers = [];
  const tokenRegex = /(?:₹|Rs\.?|\$)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|lakhs?|lacs?|crores?|thousand|thousands|lpa)?\b/gi;
  let match;
  while ((match = tokenRegex.exec(str)) !== null) {
    const parsed = parseTokenAmount(match[0]);
    if (parsed && parsed >= 1000 && !allNumbers.includes(parsed)) {
      allNumbers.push(parsed);
    }
  }

  if (allNumbers.length === 3) {
    const [engVal, mktVal, prodVal] = allNumbers;
    const total = engVal + mktVal + prodVal;
    return {
      engineering: engVal,
      marketing: mktVal,
      product: prodVal,
      total,
      isValidBudget: total <= 1000000,
    };
  }

  return null;
}

/**
 * Extracts and displays the monetary offer from a message (User or AI).
 * Returns null if the message contains no actual monetary proposal.
 */
export function getMessageOffer(msg) {
  if (!msg) return null;

  // Filter out non-monetary chit-chat/greetings inheriting an old offer_value
  const lower = (msg.message || '').toLowerCase();
  const isChitChatOrGreeting =
    /^(hello|hi\b|hey\b|how are you|good morning|good evening)/i.test(lower) ||
    /\b(favourite movie|favorite movie|weather|joke)\b/i.test(lower) ||
    /\b(accept|agreed?|let'?s finalize|happy with this agreement|we have a deal)\b/i.test(lower) ||
    /\b(reject|don't want to proceed|cannot accept|can't accept|end this negotiation|decline|walk away)\b/i.test(lower);

  if (isChitChatOrGreeting) return null;

  // 1. If explicit offer_value was stored for this specific agent's move, prefer it!
  // This guarantees that in tripartite dialogues listing multiple numbers,
  // each agent's bubble displays THEIR OWN requested offer amount.
  if (msg.offer_value !== undefined && msg.offer_value !== null && Number(msg.offer_value) > 0) {
    return Number(msg.offer_value);
  }

  // 2. Fallback to parsing text proposal if offer_value is missing
  const extracted = extractMonetaryOffer(msg.message);
  if (extracted !== null) return extracted;

  return null;
}

