import { useState, useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';

// TODO: replace with Stoa Capital's real portfolio company URLs.
const companyWebsites = {
  'Example Co': 'https://example.com',
  'Sample Inc': 'https://example.com',
};

// TODO: replace with Stoa Capital's real co-investors.
const coInvestorWebsites = {};

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
    const saved = localStorage.getItem('sc_theme_v1');
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
    localStorage.setItem('sc_theme_v1', nextMode ? 'light' : 'dark');
  };

  // TODO: replace with Stoa Capital's real portfolio.
  const portfolio = [
    { company: 'Example Co', year: '2026', investors: 'Co-investor, Co-investor' },
    { company: 'Sample Inc', year: '2026', investors: 'Co-investor, Co-investor, Co-investor' },
  ];

  // TODO: replace with Stoa Capital's real co-investors.
  const coInvestors = ['Co-investor One', 'Co-investor Two', 'Co-investor Three'];

  return (
    <div className="frame">
      <header>
        <div className="brand-name">Stoa Capital</div>
        <div className="header-location">San Francisco · MMXXVI</div>
        <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle Theme">
          {lightMode ? '☾︎' : '☼︎'}
        </button>
      </header>

      <div className="hero-fold">
        <div className="hero">
          <h1>
            A private investment firm. <span>[Placeholder tagline — describe Stoa Capital's investment strategy here.]</span>
          </h1>
        </div>

        <div className="metrics-bar">
          <div className="metric-item">
            <div className="metric-val">$XXM</div>
            <div className="metric-label">deployed</div>
          </div>
          <div className="metric-item">
            <div className="metric-val">XX</div>
            <div className="metric-label">investments</div>
          </div>
          <div className="metric-item">
            <div className="metric-val">XX</div>
            <div className="metric-label">vintages</div>
          </div>
        </div>
        <div className="metrics-context">
          [Placeholder — metrics context / summary of track record]
        </div>
        <div className="top-disclosure">
          [Placeholder legal disclosure — describe Stoa Capital's legal entity structure, any registered investment advisor / broker-dealer affiliations, and regulatory status here. Do not publish this site until this section reflects Stoa Capital's actual, verified regulatory disclosures.]
        </div>
      </div>

      <section>
        <div className="section-row">
          <h2 className="section-label">Portfolio</h2>
          <div>
            <p className="portfolio-intro">
              [Placeholder — one-line description of Stoa Capital's portfolio / investment focus.]
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
                  {portfolio.map((deal, idx) => {
                    const url = companyWebsites[deal.company];
                    return (
                      <tr key={idx}>
                        <td className="company-name">
                          {url ? (
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
                        <td className="co-investors">{deal.investors}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="section-disclaimer">
              <p>
                [Placeholder — standard portfolio disclaimer language. Replace with Stoa Capital's actual disclosures before publishing.]
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
              [Placeholder — description of Stoa Capital's co-investor network.]
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
                [Placeholder — co-investor disclosure language.]
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
            <p>[Placeholder — founder bio and firm background.]</p>
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
              [Placeholder — regulatory disclosures. If Stoa Capital or its principals are registered with the SEC, FINRA, or any state regulator, or work through a registered broker-dealer, disclose that here accurately before this site goes live.]
            </p>
            <p>
              This website is for informational purposes only and does not constitute an offer to sell or solicitation of an offer to buy any securities. Investments in private companies are speculative and illiquid, involve a high degree of risk including total loss of capital, have no public market and an indefinite holding period, and are available only to eligible investors. Past performance is not indicative of future results.
            </p>
          </div>
        </div>
      </section>

      <footer>
        <div>© 2026 Stoa Capital.</div>
        <div>Last updated {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.</div>
      </footer>
      <Analytics />
      <SpeedInsights />
    </div>
  );
}
