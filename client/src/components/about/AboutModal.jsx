import Modal from '../ui/Modal';
import Button from '../ui/Button';
import TradeRetroLogo from '../ui/TradeRetroLogo';
import PRODUCT from '../../constants/product';

const WHAT_IT_DOES = [
  'Configure trading strategies and their parameters',
  'Select assets to study',
  'Define historical backtest periods',
  'Execute precise historical backtests with Indian transaction costs',
  'Analyse performance, risk, and trading metrics',
  'Compare strategy results with a buy-and-hold benchmark',
  'Inspect results visually through charts, tables, and metrics',
  'Ask the AI Copilot for interpretation of strategies and results',
];

const AUDIENCE = [
  'Students learning algorithmic trading',
  'Retail traders exploring strategy validation',
  'Quantitative finance learners',
  'Software engineering students',
  'Researchers interested in market ideas',
  'Developers curious about systematic strategy testing',
];

const WHY_TRADERETRO = [
  'No-code strategy configuration',
  'Historical validation with deterministic execution',
  'Quantitative performance and risk metrics',
  'Visual analysis of results',
  'Educational value for anyone learning the craft',
];

const TECHNOLOGY = [
  { area: 'Frontend', value: 'React + Vite (Tailwind CSS)' },
  { area: 'Backend', value: 'FastAPI' },
  { area: 'Quantitative Engine', value: 'Python' },
  { area: 'Data', value: 'TimescaleDB' },
  { area: 'Streaming / Workflow', value: 'Redis + Prefect' },
  { area: 'Visualization', value: 'Recharts + Grafana' },
  { area: 'AI', value: 'AI Copilot · LM Studio · Gemini-Compatible Providers · OpenAI-compatible Providers' },
];

const ROADMAP = [
  'Multi-asset backtesting',
  'Broader market-data integrations',
  'Paper trading',
  'Advanced analytics',
  'Strategy optimization',
  'Market-regime analysis',
  'Expanded AI-assisted analysis',
  'AI Agent / autonomous research assistance (Planned / Deferred — considered but deferred due to scope constraints)',
  'UI modernization and migration toward industry-standard Next.js architecture',
];

function Section({ title, children }) {
  return (
    <section className="tr-about-section">
      <h4 className="tr-about-section-title">{title}</h4>
      {children}
    </section>
  );
}

function List({ items }) {
  return (
    <ul className="tr-about-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/**
 * About TradeRetro modal — product information, technology, roadmap,
 * credits, and version. Presentation only; no live data is fetched.
 */
export default function AboutModal({ onClose }) {
  return (
    <Modal
      open
      size="lg"
      title="About TradeRetro"
      subtitle="Event-Driven Historical Strategy Validation Engine"
      onClose={onClose}
      footer={
        <Button size="sm" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="tr-about">
        <div className="tr-about-hero">
          <div className="tr-about-logo" aria-hidden="true">
            <TradeRetroLogo size={44} />
          </div>
          <div>
            <h3 className="tr-about-name">{PRODUCT.name}</h3>
            <p className="tr-about-tagline mono">Look Back. Test Better.</p>
          </div>
        </div>

        <Section title="What is TradeRetro?">
          <p className="tr-about-copy">
            TradeRetro is an event-driven historical strategy validation and backtesting platform.
            It helps you test a trading idea against real historical market data before relying on
            intuition or unvalidated assumptions.
          </p>
        </Section>

        <Section title="What does TradeRetro do?">
          <List items={WHAT_IT_DOES} />
        </Section>

        <Section title="Who is it for?">
          <p className="tr-about-copy">
            TradeRetro is built for anyone who wants to turn a trading idea into an evidence-based
            decision:
          </p>
          <List items={AUDIENCE} />
        </Section>

        <Section title="Why TradeRetro?">
          <p className="tr-about-copy">
            The central idea is simple: validate a trading hypothesis against historical evidence
            instead of relying only on intuition. TradeRetro keeps that journey honest:
          </p>
          <List items={WHY_TRADERETRO} />
        </Section>

        <Section title="Technology">
          <div className="tr-about-tech">
            {TECHNOLOGY.map(({ area, value }) => (
              <div className="tr-about-tech-row" key={area}>
                <span className="tr-about-tech-area">{area}</span>
                <span className="tr-about-tech-value mono">{value}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="What's Next?">
          <p className="tr-about-copy">
            TradeRetro is designed as a continuing project. Future development may include:
          </p>
          <List items={ROADMAP} />
          <p className="tr-about-copy tr-about-copy-muted">
            These are roadmap directions — they are not currently shipped features.
          </p>
        </Section>

        <Section title="Project Continuity">
          <p className="tr-about-copy">
            TradeRetro began as a Study Project and continues into the Capstone with greater depth,
            scale, and technical maturity.
          </p>
        </Section>

        <Section title="Project Team">
          <List items={['SHAURYA SINGH', 'ADHIRAJ SINGH', 'SHREYASH CHAUGULE', 'LAVANYA.N']} />
          <p className="tr-about-copy tr-about-copy-muted">
            Special thanks to our supervisor and mentor, <strong>Mr. Raj Kumar</strong>, for their continuous
            guidance, feedback, encouragement, and support throughout the TradeRetro project journey.
          </p>
        </Section>

        <div className="tr-about-version">
          <span className="tr-about-version-number mono">{PRODUCT.version}</span>
          <span className="tr-about-version-title">Capstone Project Release</span>
        </div>
      </div>
    </Modal>
  );
}