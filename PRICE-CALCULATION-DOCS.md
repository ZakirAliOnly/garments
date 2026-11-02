# SK-Panaflex: Credit & Debit Logic

---

## Account Balance

Every account has a single running balance that is either:
- **Credit** — the client owes us money
- **Debit** — we owe the client money

The balance flips sides automatically as transactions are applied.

---

## Setting an Opening Balance on Account Creation

When creating an account, you can optionally enter an opening balance and choose whether it is a credit or debit:

- **Credit opening balance** — the client already owes us money before any invoice is raised
- **Debit opening balance** — we already owe the client money before any transaction

---

## Buying on Credit (Pay Later)

When a client makes a purchase but does not pay immediately:

1. The invoice total is added to their credit balance (they owe us more)
2. Each time they make a payment, it is subtracted from their credit balance
3. If they overpay, the balance flips to debit (we owe them the excess)

**Example:**
```
Client owes: Rs 0
New invoice: Rs 10,000
Client owes: Rs 10,000  (credit)

Client pays: Rs 6,000
Client owes: Rs 4,000   (credit)

Client pays: Rs 4,000
Client owes: Rs 0
```

---

## Advance Payment (Pay Before Buying)

When a client pays in advance before any invoice is raised:

1. The payment is recorded as a debit balance (we owe them)
2. When an invoice is later raised, it is applied against that debit balance
3. If the invoice exceeds the advance, the remaining amount flips to credit (they now owe us)

**Example:**
```
Client balance: Rs 0
Client pays advance: Rs 5,000
Client balance: Rs 5,000  (debit — we owe them)

New invoice raised: Rs 8,000
Advance applied:   −Rs 5,000
Client owes:        Rs 3,000  (credit — they owe us)
```

---

## Summary

| Situation | Effect on Balance |
|---|---|
| Invoice raised, unpaid | Balance increases (credit — they owe us) |
| Payment received | Balance decreases |
| Overpayment or advance | Balance flips to debit (we owe them) |
| New invoice against advance | Advance absorbs the invoice; remainder flips if invoice exceeds advance |
