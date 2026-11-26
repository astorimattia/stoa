// Note text, from the published notes. Micron and Anthropic so far; the rest show the members gate.

export type NoteBody = {
  author: string
  sections: { label?: string; paragraphs: string[] }[]
}

export const noteBodies: Record<string, NoteBody> = {
  'micron-margin': {
    author: 'Dinki',
    sections: [
      {
        paragraphs: [
          'In Q3 2026, Micron kept $86.80 of every $100 in sales as gross profit. Nvidia kept $74.80, according to the results it released on November 17.',
          'Yet, Micron trades at about 10x its annual earnings, compared with 17x for Nvidia. The simple reason being, investors expect Nvidia’s profits to be more durable.',
          'Micron is one of the world’s largest memory chip makers. It supplies everything from the RAM in phones and PCs, to the high-bandwidth memory used alongside Nvidia’s AI chips.',
          'And these AI chips need huge amounts of it.',
          'Memory stores and rapidly delivers the data AI models need. Without enough of it, even the fastest chips spend time waiting for data, instead of doing valuable work.',
          'That demand has tightened memory supply, pushing up prices even for memory used in phones and PCs. Micron’s phone and PC memory business earned a 90% gross margin last quarter.',
          'Buyers are also committing years ahead to secure this scarce supply. Nvidia’s own supply commitments jumped from $279 billion to $390 billion in one quarter, primarily through multiyear agreements to buy memory.',
          'Today, Micron’s value is driven primarily from scarcity. Nvidia’s pricing power comes from a different source: Switching costs.',
          'Their customers buy chips, software and networking that all work together. Replacing that system takes time and effort, giving customers reasons to stay, even when competing chips are available. Nvidia’s gross margin has stayed between 60% and 78% since the start of 2023.',
          'Micron’s customers have more room to switch suppliers once memory becomes plentiful again. Today’s shortage gives Micron enormous pricing power.',
          'How much of that pricing power survives once supply catches up?',
          'Micron’s gross margin peaked at 61% in August 2018. A year later it was 29%. Its stock fell 54% from its May 2018 high to its December low.',
          'In mid-2022, the margin was 47%. By March 2023, after demand fell and Micron wrote down inventory, it was negative 33%.',
          'But Micron investors might have a reason to expect more stability this time around.',
          'Its annual report describes multiyear contracts that require customers to pay for agreed volumes, backed by deposits and letters of credit. Most also include minimum and maximum prices.',
          'Yet at roughly twice its 2018 earnings multiple, Micron appears to be getting some credit from investors for looking like a more durable business.',
        ],
      },
      {
        label: 'Macro takeaway',
        paragraphs: [
          'Margins earned from scarcity get a lower multiple than margins earned from a product customers cannot replace.',
          'When underwriting AI suppliers, the entry price should be tested against how long a shortage responsible for current margin improvements can last.',
        ],
      },
    ],
  },
}

noteBodies['anthropic-ipo'] = {
  author: 'Dinki',
  sections: [
    {
      paragraphs: [
        'The current proposed range is $70 to $78 a share, which Anthropic set in its updated IPO filing ahead of pricing. Counting every share that could exist, that’s about $1.26 trillion to $1.41 trillion. At the midpoint of $74, the valuation is about $1.33 trillion.',
        'Anthropic booked about $35 billion of revenue over the last 12 months, so you’re paying about 38× revenue. This is a high multiple by historical IPO standards.',
        'The typical company that went public in 2024 and 2025 priced at about 7x revenue. Of the 4,110 large US IPOs Jay Ritter tracked from 1980 to 2024, only 73 priced above 20 times.',
        'But as we all know by now, Anthropic is not your typical company.',
        'Part of the high multiple is explained by Anthropic’s absurd growth rate. If its latest quarter’s revenue continued for a full year, the same valuation would work out to about 20x revenue.',
        'IPO buyers are paying for the revenue Anthropic is bringing in now and next year, and last year’s total currently understates that.',
        'The argument over the debut price comes down to how much money Anthropic can eventually make, how much it has to spend to get there, and whether customers will keep choosing them.',
      ],
    },
    {
      label: 'How much success is already priced in?',
      paragraphs: [
        'A massive amount. At $74 a share, investors are giving Anthropic a lot of credit for things it hasn’t done yet. The company has to grow enormously and turn that growth into substantial profits to justify what they’re paying today.',
        'Damodaran’s model assumes Anthropic reaches roughly $1 trillion of annual revenue by 2036. That’s about 28 times what it made last year, and more than Amazon made in 2025.',
        'He also assumes Anthropic eventually keeps $25 of every $100 in revenue as operating profit. For context, the average US company keeps about $13 per $100 of revenue, while the average software company keeps about $33.',
        'The current valuation therefore requires two enormous achievements: near-software margins, and annual revenue beyond anything any company has ever achieved.',
        'After adjusting for how his model treats convertible debt, the proposed IPO range is pretty close to his valuation, only ~3% lower.',
      ],
    },
  ],
}

export const noteAuthors: Record<string, string> = {
  'anthropic-ipo': 'Dinki',
  'micron-margin': 'Dinki',
  'elections-vc': 'Dinki',
  'space-insurance': 'Hayden Bleecker',
}
