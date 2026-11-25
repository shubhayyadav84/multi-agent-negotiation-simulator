import test from 'node:test';
import assert from 'node:assert';
import {
  extractMonetaryOffer,
  detectNegotiationIntent,
  getMessageOffer,
  extractProjectBudgetAllocations,
} from '../src/utils/negotiationInteraction.js';

test('1. Automatic Offer Amount Detection for various currency & number formats', () => {
  // ₹ formatted
  assert.strictEqual(extractMonetaryOffer('I can adjust my salary expectation to ₹173,500.'), 173500);
  assert.strictEqual(extractMonetaryOffer('We can increase our package to ₹154,500.'), 154500);

  // Rs. format
  assert.strictEqual(extractMonetaryOffer('Rs. 1,50,000 is our proposed rate'), 150000);
  assert.strictEqual(extractMonetaryOffer('Rs 150000 per year'), 150000);

  // Raw numeric amount
  assert.strictEqual(extractMonetaryOffer('I can offer 150000 for this batch'), 150000);
  assert.strictEqual(extractMonetaryOffer('110000'), 110000);

  // Lakh / Lac format
  assert.strictEqual(extractMonetaryOffer('Our budget is 1.5 lakh per month'), 150000);
  assert.strictEqual(extractMonetaryOffer('We can do 2.5 lacs'), 250000);

  // LPA format
  assert.strictEqual(extractMonetaryOffer('My current CTC is ₹2 LPA'), 200000);
  assert.strictEqual(extractMonetaryOffer('Proposing 2.5 LPA'), 250000);

  // Dollar format
  assert.strictEqual(extractMonetaryOffer('Final offer is $80,000'), 80000);
  assert.strictEqual(extractMonetaryOffer('$120k base compensation'), 120000);

  // Thousand in words format (e.g. 'my offer 50 thousand')
  assert.strictEqual(extractMonetaryOffer('my offer 50 thousand'), 50000);
  assert.strictEqual(extractMonetaryOffer('50 thousand'), 50000);
  assert.strictEqual(extractMonetaryOffer('₹50 thousand'), 50000);
  assert.strictEqual(extractMonetaryOffer('fifty thousand'), 50000);
  assert.strictEqual(extractMonetaryOffer('twenty five thousand'), 25000);
  assert.strictEqual(extractMonetaryOffer('1 crore'), 10000000);
  assert.strictEqual(extractMonetaryOffer('1.5 million'), 1500000);

  // Rupees word prefix & suffix variations ('80 rupees', 'rupees 80', '80 rs')
  assert.strictEqual(extractMonetaryOffer('80 rupees'), 80);
  assert.strictEqual(extractMonetaryOffer('my offer 80 rupees'), 80);
  assert.strictEqual(extractMonetaryOffer('rupees 80'), 80);
  assert.strictEqual(extractMonetaryOffer('rupee 80'), 80);
  assert.strictEqual(extractMonetaryOffer('80 rs'), 80);
  assert.strictEqual(extractMonetaryOffer('80 rs.'), 80);
  assert.strictEqual(extractMonetaryOffer('my offer 80 rupees or rupees 80 or 80 rs'), 80);
});

test('2. Messages without monetary proposals do NOT extract offers (no false positives)', () => {
  // Years, dates, rounds, percentages
  assert.strictEqual(extractMonetaryOffer('Hello, how are you in 2026?'), null);
  assert.strictEqual(extractMonetaryOffer('Let us discuss during round 2'), null);
  assert.strictEqual(extractMonetaryOffer('We offer a 10% discount on volume'), null);
  assert.strictEqual(extractMonetaryOffer('Delivery within 30 days or 2 weeks'), null);

  // Casual / off-topic conversation
  assert.strictEqual(extractMonetaryOffer('What is your favourite movie?'), null);
  assert.strictEqual(extractMonetaryOffer('Hello, how are you?'), null);
  assert.strictEqual(extractMonetaryOffer('Good morning! Let us begin'), null);

  // Acceptance & Rejection statements without numbers
  assert.strictEqual(extractMonetaryOffer('I accept the deal.'), null);
  assert.strictEqual(extractMonetaryOffer('I cannot accept this offer. Let\'s end the negotiation.'), null);
  assert.strictEqual(extractMonetaryOffer('That works for me.'), null);
});

test('3. Deal Acceptance Intent Detection', () => {
  assert.strictEqual(detectNegotiationIntent('I accept the deal.').isAccept, true);
  assert.strictEqual(detectNegotiationIntent('i want to accept this offer').isAccept, true);
  assert.strictEqual(detectNegotiationIntent('I would like to accept this offer').isAccept, true);
  assert.strictEqual(detectNegotiationIntent('accept the offer').isAccept, true);
  assert.strictEqual(detectNegotiationIntent('I agree to your offer.').isAccept, true);
  assert.strictEqual(detectNegotiationIntent('i agree with this offer').isAccept, true);
  assert.strictEqual(detectNegotiationIntent('Deal accepted.').isAccept, true);
  assert.strictEqual(detectNegotiationIntent('That works for me.').isAccept, true);
  assert.strictEqual(detectNegotiationIntent("Let's finalize this.").isAccept, true);
  assert.strictEqual(detectNegotiationIntent("I'm happy with this agreement.").isAccept, true);
  assert.strictEqual(detectNegotiationIntent('We have a deal.').isAccept, true);

  // Must not accept for casual text
  assert.strictEqual(detectNegotiationIntent('Hello, how are you?').isAccept, false);
  assert.strictEqual(detectNegotiationIntent('Can we negotiate?').isAccept, false);
});

test('4. Deal Rejection Intent Detection', () => {
  assert.strictEqual(detectNegotiationIntent('I reject this deal.').isReject, true);
  assert.strictEqual(detectNegotiationIntent('i want to reject this offer').isReject, true);
  assert.strictEqual(detectNegotiationIntent('I decline this proposal').isReject, true);
  assert.strictEqual(detectNegotiationIntent("I don't want to proceed.").isReject, true);
  assert.strictEqual(detectNegotiationIntent('I cannot accept your offer.').isReject, true);
  assert.strictEqual(detectNegotiationIntent('This agreement is not acceptable.').isReject, true);
  assert.strictEqual(detectNegotiationIntent("Let's end this negotiation.").isReject, true);
  assert.strictEqual(detectNegotiationIntent("I'm withdrawing from this deal.").isReject, true);
  assert.strictEqual(detectNegotiationIntent('I will walk away from this deal').isReject, true);
  assert.strictEqual(detectNegotiationIntent('no deal').isReject, true);
});

test('5. Conditional Rejection does NOT accidentally terminate negotiations (continues as counteroffer)', () => {
  const cond1 = detectNegotiationIntent('I cannot accept ₹150,000, but I can agree to ₹180,000');
  assert.strictEqual(cond1.isReject, false, 'Must not reject');
  assert.strictEqual(cond1.isAccept, false, 'Must not accept');
  assert.strictEqual(cond1.isConditionalCounter, true, 'Must flag as conditional counter');
  assert.strictEqual(extractMonetaryOffer('I cannot accept ₹150,000, but I can agree to ₹180,000'), 150000 || 180000 ? 150000 : null);

  const cond2 = detectNegotiationIntent('I agree only if you include free shipping and ₹100,000');
  assert.strictEqual(cond2.isReject, false);
  assert.strictEqual(cond2.isAccept, false);
  assert.strictEqual(cond2.isConditionalCounter, true);

  const cond3 = detectNegotiationIntent('I want to propose offer ₹99000 , I cannot accept ₹95,500');
  assert.strictEqual(cond3.isReject, false, 'Must not reject when counter-proposing');
  assert.strictEqual(cond3.isAccept, false);
  assert.strictEqual(cond3.isConditionalCounter, true);
  assert.strictEqual(extractMonetaryOffer('I want to propose offer ₹99000 , I cannot accept ₹95,500'), 99000);
});

test('6. getMessageOffer dynamically attaches offer badge for monetary messages only', () => {
  // Monetary user message
  assert.strictEqual(
    getMessageOffer({ message: 'I can adjust my salary expectation to ₹173,500.', offer_value: 173500 }),
    173500
  );

  // Monetary AI opponent message
  assert.strictEqual(
    getMessageOffer({ message: 'We can increase our package to ₹154,500.', offer_value: 154500 }),
    154500
  );

  // Casual / non-monetary AI or User message must return null
  assert.strictEqual(
    getMessageOffer({ message: 'What is your favourite movie?', offer_value: null }),
    null
  );
  assert.strictEqual(
    getMessageOffer({ message: 'Hello, how are you?', offer_value: null }),
    null
  );
  assert.strictEqual(
    getMessageOffer({ message: 'I accept the deal.', offer_value: 165000 }),
    null
  );
  assert.strictEqual(
    getMessageOffer({ message: 'I cannot accept this offer. Let\'s end the negotiation.', offer_value: null }),
    null
  );
});

test('7. extractProjectBudgetAllocations correctly detects three separate departmental values', () => {
  // Labeled formats
  const labeled = extractProjectBudgetAllocations('Engineering ₹400,000, Marketing ₹350,000, Product AI ₹250,000');
  assert.ok(labeled);
  assert.strictEqual(labeled.engineering, 400000);
  assert.strictEqual(labeled.marketing, 350000);
  assert.strictEqual(labeled.product, 250000);
  assert.strictEqual(labeled.total, 1000000);
  assert.strictEqual(labeled.isValidBudget, true);

  // Comma delimited short format (400k, 350k, 250k)
  const shortFormat = extractProjectBudgetAllocations('400k, 350k, 250k');
  assert.ok(shortFormat);
  assert.strictEqual(shortFormat.engineering, 400000);
  assert.strictEqual(shortFormat.marketing, 350000);
  assert.strictEqual(shortFormat.product, 250000);
  assert.strictEqual(shortFormat.total, 1000000);
  assert.strictEqual(shortFormat.isValidBudget, true);

  // Over budget proposal
  const overBudget = extractProjectBudgetAllocations('Engineering 450k, Marketing 350k, Product 300k');
  assert.ok(overBudget);
  assert.strictEqual(overBudget.total, 1100000);
  assert.strictEqual(overBudget.isValidBudget, false);

  // Single value does NOT match tripartite split
  assert.strictEqual(extractProjectBudgetAllocations('My offer 400k'), null);
});

test('8. getMessageOffer respects explicit agent offer_value over first string match', () => {
  // Marketing Lead proposed 350,000, even though the text mentions Engineering 450,000 first
  const mktMsg = {
    message: 'To optimize cross-team ROI, our revised distribution is: Engineering ₹450,000, Marketing ₹350,000, Product AI ₹200,000.',
    offer_value: 350000,
    action: 'COUNTER_OFFER',
  };
  assert.strictEqual(getMessageOffer(mktMsg), 350000);
});
