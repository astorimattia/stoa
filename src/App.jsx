import { useState, useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';

const companyWebsites = {
  // Stoa Capital
  'AMI Labs': 'https://amilabs.xyz',
  'Erebor': 'https://erebor.bank',
  'Kalshi': 'https://kalshi.com',
  'Project Prometheus': 'https://prometheus.ai',
  'SpaceX': 'https://www.spacex.com',
  'xAI': 'https://x.ai',

  // Wefunder Tenures
  'Anduril': 'https://www.anduril.com',
  'Boom Supersonic': 'https://boomsupersonic.com',
  'Databricks': 'https://www.databricks.com',
  'ElevenLabs': 'https://elevenlabs.io',
  'OpenAI': 'https://openai.com',
  'Perplexity': 'https://www.perplexity.ai',
  'Plaid': 'https://plaid.com',
  'Varda': 'https://www.varda.com',

  // Selected Fund Investments
  'AfterQuery': 'https://www.afterquery.com',
  'Alex': 'https://alex.com',
  'Andromeda': 'https://andromedasurgical.com',
  'Artie': 'https://www.artie.com',
  'Artisan AI': 'https://artisan.co',
  'Benchmark': 'https://withbenchmark.com',
  'Central': 'https://centralhq.com/',
  'Cluely': 'https://www.cluely.com',
  'Corgi': 'https://corgi.com',
  'Flora': 'https://flora.ai',
  'Garage': 'https://www.shopgarage.com',
  'Gentrace': 'https://gentrace.ai',
  'Harper': 'https://www.harperinsure.com',
  'Hello Patient': 'https://www.hellopatient.com',
  'Juicebox': 'https://www.juicebox.work',
  'Leafpress': 'https://www.johnsoncontrols.com',
  'Magic Patterns': 'https://www.magicpatterns.com',
  'Mastra': 'https://mastra.ai',
  'Momentic': 'https://momentic.ai',
  'Outset': 'https://outset.ai',
  'ParadeDB': 'https://www.paradedb.com',
  'PointOne': 'https://pointone.ai',
  'Pure': 'https://collectpure.com',
  'Ravenna': 'https://ravenna.ai',
  'Solve Intelligence': 'https://solveintelligence.com',
  'Starcloud': 'https://www.starcloud.com',
  'Sunday Robotics': 'https://sunday.ai',
  'Terminal': 'https://www.withterminal.com',
  'Trayd': 'https://www.buildtrayd.com/',
  'Weights': 'https://weights.gg'
};

const coInvestorWebsites = {
  'Benchmark': 'https://www.benchmark.com',
  'a16z': 'https://a16z.com',
  'Sequoia': 'https://www.sequoiacap.com',
  'Khosla': 'https://www.khoslaventures.com',
  'Kleiner Perkins': 'https://www.kleinerperkins.com',
  'Accel': 'https://www.accel.com',
  'Lightspeed': 'https://lsvp.com',
  'Bessemer': 'https://www.bvp.com',
  'Y Combinator': 'https://www.ycombinator.com',
  'Founders Fund': 'https://foundersfund.com',
  'General Catalyst': 'https://www.generalcatalyst.com',
  'Thrive Capital': 'https://thrivecap.com'
};

function CompanyLogo({ url, name }) {
  const [hasError, setHasError] = useState(false);
  const initial = name ? name.charAt(0).toUpperCase() : '?';

  let iconUrl = null;
  if (url) {
    try {
      const domain = new URL(url).hostname.replace(/^www\./, '');
      iconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch {
      iconUrl = null;
    }
  }

  if (!iconUrl || hasError) {
    return (
      <span className="company-logo company-logo-fallback" title={name}>
        {initial}
      </span>
    );
  }

  return (
    <img
      src={iconUrl}
      alt=""
      className="company-logo"
      loading="lazy"
      onError={() => setHasError(true)}
    />
  );
}

export default function App() {
  const [lightMode, setLightMode] = useState(() => {
    const saved = localStorage.getItem('sc_theme_v2');
    if (saved === 'dark') {
      return false;
    }
    return true; // Default to white / light mode for all visitors
  });

  useEffect(() => {
    if (lightMode) {
      document.body.classList.add('light-mode');
      document.body.classList.remove('dark-mode');
    } else {
      document.body.classList.add('dark-mode');
      document.body.classList.remove('light-mode');
    }
  }, [lightMode]);

  const toggleTheme = () => {
    const nextMode = !lightMode;
    setLightMode(nextMode);
    localStorage.setItem('sc_theme_v2', nextMode ? 'light' : 'dark');
  };

  const stoaInvestments = [
    {
      company: 'Unannounced',
      year: '2026',
      investors: 'Co-investor, Co-investor, Co-investor',
      isSecret: true
    },
    {
      company: 'Unannounced',
      year: '2026',
      investors: 'Co-investor, Co-investor',
      isSecret: true
    },
    {
      company: 'AMI Labs',
      year: '2026',
      investors: 'Cathay Innovation, Greycroft, NVIDIA, Temasek'
    },
    {
      company: 'Erebor',
      year: '2026',
      investors: '8VC, a16z, Founders Fund, Lux Capital'
    },
    {
      company: 'Kalshi',
      year: '2026',
      investors: 'a16z, Coatue, IVP, Paradigm, Sequoia'
    },
    {
      company: 'OpenAI',
      year: '2026',
      investors: 'a16z, Fidelity, Sequoia, SoftBank, Thrive Capital'
    },
    {
      company: 'Project Prometheus',
      year: '2026',
      investors: 'BlackRock, DST Global, Goldman Sachs, JPMorgan'
    },
    {
      company: 'SpaceX',
      year: '2026',
      investors: 'a16z, Fidelity, Founders Fund, Sequoia'
    },
    {
      company: 'xAI',
      year: '2025',
      investors: 'a16z, Fidelity, Lightspeed, NVIDIA, Sequoia'
    }
  ];

  const wefunderInvestments = [
    {
      company: 'Anduril*',
      year: '2025',
      investors: 'Founders Fund, Sands Capital'
    },
    {
      company: 'Plaid*',
      year: '2025',
      investors: 'BlackRock, Fidelity, Franklin Templeton, NEA'
    },
    {
      company: 'Boom Supersonic',
      year: '2024',
      investors: 'Altimeter, ARK Invest, Bessemer'
    },
    {
      company: 'Databricks',
      year: '2024',
      investors: 'a16z, BlackRock, Fidelity, Thrive Capital'
    },
    {
      company: 'ElevenLabs',
      year: '2024',
      investors: 'a16z, ICONIQ, Lightspeed, Sequoia'
    },
    {
      company: 'OpenAI',
      year: '2024',
      investors: 'a16z, Fidelity, Sequoia, SoftBank, Thrive Capital'
    },
    {
      company: 'Perplexity',
      year: '2024',
      investors: 'Bezos, IVP, NEA, NVIDIA, SoftBank'
    },
    {
      company: 'SpaceX',
      year: '2024',
      investors: 'a16z, Fidelity, Founders Fund, Sequoia'
    },
    {
      company: 'Varda',
      year: '2024',
      investors: 'Founders Fund, Khosla, Lux Capital'
    },
    {
      company: 'xAI',
      year: '2024',
      investors: 'a16z, Fidelity, Lightspeed, NVIDIA, Sequoia'
    }
  ];

  const vintageFunds = [
    { name: 'Insiders Fund', year: '2025', holdings: '25+ Companies' },
    { name: 'YC Vintage W23', year: '2023', holdings: '40+ Companies' },
    { name: 'YC Vintage S23', year: '2023', holdings: '40+ Companies' },
    { name: 'YC Vintage W24', year: '2024', holdings: '45+ Companies' },
    { name: 'YC Vintage S24', year: '2024', holdings: '50+ Companies' },
    { name: 'YC Vintage F24', year: '2024', holdings: '40+ Companies' },
    { name: 'YC Vintage W25', year: '2025', holdings: '35+ Companies' }
  ];

  const unicornOutcomes = [
    { company: 'AfterQuery', stage: 'Unicorn from Seed Round' },
    { company: 'Corgi', stage: 'Unicorn from Seed Round' },
    { company: 'Starcloud', stage: 'Unicorn from Seed Round' },
    { company: 'Sunday Robotics', stage: 'Unicorn from Seed Round' }
  ];

  const acquisitionOutcomes = [
    { company: 'Central', stage: 'Acquired by Mercury' },
    { company: 'Leafpress', stage: 'Acquired by Johnson Controls' },
    { company: 'Weights', stage: 'Acquired by OpenAI' },
    { company: 'Benchmark', stage: 'Acquired by Harvey' }
  ];

  const portfolioMarkups = [
    { company: 'Alex', stage: 'Series A' },
    { company: 'Andromeda', stage: 'Series A' },
    { company: 'Artie', stage: 'Series A' },
    { company: 'Artisan AI', stage: 'Series A' },
    { company: 'Cluely', stage: 'Series A' },
    { company: 'Flora', stage: 'Series A' },
    { company: 'Garage', stage: 'Series A' },
    { company: 'Gentrace', stage: 'Series A' },
    { company: 'Harper', stage: 'Series A' },
    { company: 'Hello Patient', stage: 'Series A' },
    { company: 'Juicebox', stage: 'Series B' },
    { company: 'Magic Patterns', stage: 'Series A' },
    { company: 'Mastra', stage: 'Series A' },
    { company: 'Momentic', stage: 'Series A' },
    { company: 'Outset', stage: 'Series B' },
    { company: 'ParadeDB', stage: 'Series A' },
    { company: 'PointOne', stage: 'Series A' },
    { company: 'Pure', stage: 'Series A' },
    { company: 'Ravenna', stage: 'Series A' },
    { company: 'Solve Intelligence', stage: 'Series B' },
    { company: 'Terminal', stage: 'Series A' },
    { company: 'Trayd', stage: 'Series A' }
  ];

  const coInvestors = [
    'Benchmark',
    'a16z',
    'Sequoia',
    'Khosla',
    'Kleiner Perkins',
    'Accel',
    'Lightspeed',
    'Bessemer',
    'Y Combinator',
    'Founders Fund',
    'General Catalyst',
    'Thrive Capital'
  ];

  return (
    <div className="frame">
      <header>
        <a href="/" className="brand-name brand-link">Stoa Capital</a>
        <div className="header-location">San Francisco · MMXXVI</div>
        <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle Theme">
          {lightMode ? '☾︎' : '☼︎'}
        </button>
      </header>

      <div className="hero-fold">
        <div className="hero">
          <h1>
            A private investment firm. <span>Late-stage liquidity and early-stage access in private companies.</span>
          </h1>
        </div>

        <div className="metrics-bar">
          <div className="metric-item">
            <div className="metric-val">$66M</div>
            <div className="metric-label">deployed</div>
          </div>
          <div className="metric-item">
            <div className="metric-val">319</div>
            <div className="metric-label">investments</div>
          </div>
          <div className="metric-item">
            <div className="metric-val">7</div>
            <div className="metric-label">vintages</div>
          </div>
        </div>
        <div className="metrics-context">
          Cumulative transaction experience of founder Mattia Astori across Wefunder (2023 to 2025) and Stoa Capital (2025 to present)
        </div>
        <div className="top-disclosure">
          Stoa Capital is a brand operated by Astori Ventures LLC. Opus Advisors LLC conducts investment advisory and fund management activities and is a wholly-owned subsidiary of Astori Ventures LLC, registered with the SEC as an Exempt Reporting Adviser. Securities brokerage activities are conducted through Alternative Markets LLC, a separate broker-dealer and member FINRA/SIPC. Astori Ventures LLC and Opus Advisors LLC are not broker-dealers and are separate from Alternative Markets LLC. Mattia Astori is a Registered Representative of Alternative Markets LLC.
        </div>
      </div>

      <section>
        <div className="section-row">
          <h2 className="section-label">Portfolio</h2>
          <div>
            <h3 className="portfolio-section-title">Stoa Capital (2025–present)</h3>
            <p className="portfolio-intro">
              Principal investments and brokered transactions executed through Stoa Capital.
            </p>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '30%' }}>Company</th>
                    <th style={{ width: '20%' }}>Year</th>
                    <th style={{ width: '50%' }}>Investors</th>
                  </tr>
                </thead>
                <tbody>
                  {stoaInvestments.map((deal, idx) => {
                    const url = companyWebsites[deal.company];
                    return (
                      <tr key={idx}>
                        <td className="company-name">
                          {deal.isSecret ? (
                            <span className="blurred-text">{deal.company}</span>
                          ) : url ? (
                            <a href={url} target="_blank" rel="noopener noreferrer" className="company-link">
                              <CompanyLogo url={url} name={deal.company} />
                              <span>{deal.company}</span>
                            </a>
                          ) : (
                            <span className="company-link-static">
                              <CompanyLogo url={url} name={deal.company} />
                              <span>{deal.company}</span>
                            </span>
                          )}
                        </td>
                        <td className="mono">{deal.year}</td>
                        <td className="co-investors">
                          {deal.isSecret ? (
                            <span className="blurred-text">{deal.investors}</span>
                          ) : (
                            deal.investors
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <h3 className="portfolio-section-title portfolio-subsection">Prior Tenures</h3>
            <p className="portfolio-intro" style={{ marginBottom: '24px' }}>
              Transactions executed and managed by Mattia Astori while consulting as Head of Private Capital at Wefunder
            </p>

            <h3 className="table-title" style={{ marginTop: '0' }}>Transactions led during tenure at Wefunder (2023 to 2025)</h3>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '30%' }}>Company</th>
                    <th style={{ width: '20%' }}>Year</th>
                    <th style={{ width: '50%' }}>Investors</th>
                  </tr>
                </thead>
                <tbody>
                  {wefunderInvestments.map((deal, idx) => {
                    const cleanName = deal.company.replace('*', '');
                    const url = companyWebsites[cleanName];
                    return (
                      <tr key={idx}>
                        <td className="company-name">
                          {url ? (
                            <a href={url} target="_blank" rel="noopener noreferrer" className="company-link">
                              <CompanyLogo url={url} name={deal.company} />
                              <span>{deal.company}</span>
                            </a>
                          ) : (
                            deal.company
                          )}
                        </td>
                        <td className="mono">{deal.year}</td>
                        <td className="co-investors">{deal.investors}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="table-footnote">* Vehicle administered by Stoa Capital to present.</div>

            <h3 className="table-title">Selected Fund Investments</h3>

            <div className="featured-outcomes-grid">
              {unicornOutcomes.map((item, idx) => {
                const url = companyWebsites[item.company];
                const content = (
                  <>
                    <div className="featured-outcome-name">
                      <CompanyLogo url={url} name={item.company} />
                      <span>{item.company}</span>
                    </div>
                    <span className="featured-outcome-stage">{item.stage}</span>
                  </>
                );
                if (url) {
                  return (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="featured-outcome-card" key={idx}>
                      {content}
                    </a>
                  );
                }
                return (
                  <div className="featured-outcome-card" key={idx}>
                    {content}
                  </div>
                );
              })}
            </div>

            <div className="featured-outcomes-grid" style={{ marginBottom: '32px' }}>
              {acquisitionOutcomes.map((item, idx) => {
                const url = companyWebsites[item.company];
                const content = (
                  <>
                    <div className="featured-outcome-name">
                      <CompanyLogo url={url} name={item.company} />
                      <span>{item.company}</span>
                    </div>
                    <span className="featured-outcome-stage">{item.stage}</span>
                  </>
                );
                if (url) {
                  return (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="featured-outcome-card" key={idx}>
                      {content}
                    </a>
                  );
                }
                return (
                  <div className="featured-outcome-card" key={idx}>
                    {content}
                  </div>
                );
              })}
            </div>

            <div className="fund-compact-list">
              {portfolioMarkups.map((item, idx) => {
                const url = companyWebsites[item.company];
                const content = (
                  <>
                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                      <CompanyLogo url={url} name={item.company} />
                      <span>{item.company}</span>
                    </span>
                    <span className="fund-compact-stage">{item.stage}</span>
                  </>
                );
                if (url) {
                  return (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="fund-compact-item" key={idx}>
                      {content}
                    </a>
                  );
                }
                return (
                  <div className="fund-compact-item" key={idx}>
                    {content}
                  </div>
                );
              })}
            </div>

            <h3 className="table-title">Vintage Portfolios</h3>
            <div className="vintage-list">
              {vintageFunds.map((fund, idx) => (
                <div className="vintage-item" key={idx}>
                  <span className="vintage-name">{fund.name}</span>
                  <span className="vintage-dot" />
                  <span className="vintage-holdings">{fund.holdings}</span>
                </div>
              ))}
            </div>

            <div className="section-disclaimer">
              <p>
                Investments listed under Prior Tenures represent transactions led by Mattia Astori during his tenure as Head of Private Capital at Wefunder (2023 to 2025). The Vintage Portfolios were deployed via a scout network of active founders. The companies listed above under Selected Fund Investments are a non-exhaustive subset of portfolio companies, originally backed within the Vintage Portfolios, that have subsequently raised priced financing rounds from third-party lead investors or completed acquisitions. This is illustrative only and is not representative of overall vintage performance. The Vintage Portfolios also include companies that have not raised follow-on capital, that have written down in value, or that have ceased operations. A subsequent priced round reflects an unrealized markup, not a realized gain, and may not be recovered. This information is presented solely to illustrate the historical transaction experience and deal access of Mattia Astori, and does not represent an advertisement of investment performance or solicitation of capital for any active Stoa Capital fund.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="section-row">
          <h2 className="section-label">Co-investors</h2>
          <div>
            <p className="co-investors-intro">
              Institutional investors in portfolio companies from transactions executed by Mattia Astori.
            </p>
            <div className="co-investors-text-grid">
              {coInvestors.map((name, idx) => {
                const url = coInvestorWebsites[name];
                return (
                  <div className="co-investor-text-item" key={idx}>
                    <CompanyLogo url={url} name={name} />
                    <span>{name}</span>
                  </div>
                );
              })}
            </div>

            <div className="section-disclaimer">
              <p>
                Investors listed represent institutional firms that have invested in one or more portfolio companies held by Stoa Capital or Wefunder vehicles in which Mattia Astori participated. Inclusion does not represent endorsement, sponsorship, or affiliation with Stoa Capital or its principals.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="section-row">
          <h2 className="section-label">About</h2>
          <div className="about-text">
            <p>Mattia Astori — founder.</p>
            <p>Previously Head of Private Capital at Wefunder. Registered representative of Alternative Markets LLC, member FINRA/SIPC. Series 7 and 63.</p>
            <div className="contact-line">
              <a href="mailto:mattia@stoacap.com">mattia@stoacap.com</a>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="section-row">
          <h2 className="section-label">Disclosures</h2>
          <div className="disclosures-text">
            <p>
              Mattia Astori is a Registered Representative of Alternative Markets LLC, member FINRA/SIPC. Registration and disciplinary history are available via FINRA BrokerCheck.
            </p>
            <p>
              This website is for informational purposes only and does not constitute an offer to sell or solicitation of an offer to buy any securities. Investments in private companies are speculative and illiquid, involve a high degree of risk including total loss of capital, have no public market and an indefinite holding period, and are available only to eligible investors. Valuations shown are estimates and may not reflect realizable value. Past performance is not indicative of future results.
            </p>
          </div>
        </div>
      </section>

      <footer>
        <div>© 2026 Astori Ventures LLC, dba Stoa Capital.</div>
        <div>Last updated {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.</div>
      </footer>
      <Analytics />
      <SpeedInsights />
    </div>
  );
}
