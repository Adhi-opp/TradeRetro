import { useState } from 'react';
import { CheckCircle2, CircleAlert } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { cx } from '../ui/styles';
import { POST } from '../../services/apiClient';

const RATING_STEPS = [1, 2, 3, 4, 5];

const INITIAL_RESPONSES = {
  experience: null,
  navigation: null,
  helped: null,
  mostUseful: '',
  engine: null,
  controls: null,
  metrics: null,
  copilot: null,
  copilotHelped: null,
  copilotImprove: '',
  ui: null,
  design: null,
  confusing: '',
  improve: '',
  liked: '',
  email: '',
};

const REQUIRED_KEYS = [
  'experience',
  'navigation',
  'helped',
  'engine',
  'controls',
  'metrics',
  'copilot',
  'copilotHelped',
  'ui',
  'design',
];

const MISSING_LABELS = {
  experience: 'How does TradeRetro feel to use?',
  navigation: 'How easy was TradeRetro to understand and navigate?',
  helped: 'Did TradeRetro help you in any way?',
  engine: 'How useful did you find the Backtest Engine?',
  controls: 'Were the strategy configuration controls easy to understand?',
  metrics: 'How useful were the performance metrics and visualizations?',
  copilot: 'How useful was the AI Copilot?',
  copilotHelped: 'Did the AI Copilot help you understand your strategy or results better?',
  ui: 'What do you think about the TradeRetro UI / frontend?',
  design: 'How would you rate the visual design?',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function RatingQuestion({ label, scale, value, onChange, error }) {
  return (
    <fieldset className={cx('tr-fb-field', error && 'tr-fb-invalid')}>
      <legend className="tr-fb-question">{label}</legend>
      {scale && <div className="tr-fb-scale">{scale}</div>}
      <div className="tr-rating-row" role="radiogroup" aria-label={label}>
        {RATING_STEPS.map((step) => (
          <button
            key={step}
            type="button"
            role="radio"
            aria-checked={value === step}
            aria-label={`${label} (${step} of 5)`}
            className={cx('tr-rating-btn', value === step && 'is-selected')}
            onClick={() => onChange(step)}
          >
            {step}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function ChoiceQuestion({ label, options, value, onChange, error }) {
  return (
    <fieldset className={cx('tr-fb-field', error && 'tr-fb-invalid')}>
      <legend className="tr-fb-question">{label}</legend>
      <div className="tr-choice-row" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={value === option}
            className={cx('tr-choice-chip', value === option && 'is-selected')}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function TextQuestion({ id, label, value, onChange, placeholder }) {
  return (
    <div className="tr-fb-field">
      <label className="tr-fb-question" htmlFor={id}>{label}</label>
      <textarea
        id={id}
        className="tr-fb-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
      />
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="tr-fb-section" aria-label={title}>
      <h4 className="tr-fb-section-title">{title}</h4>
      {children}
    </section>
  );
}

function MissingLabel({ label }) {
  return (
    <span className="tr-fb-missing">
      <CircleAlert size={13} />
      {label}
    </span>
  );
}

/**
 * Native TradeRetro feedback survey.
 *
 * Demo-level submission: no feedback persistence backend exists, so the form
 * validates locally and ends in a client-side success state. Nothing is
 * claimed to be stored server-side.
 */
export default function FeedbackModal({ onClose }) {
  const [responses, setResponses] = useState(INITIAL_RESPONSES);
  const [missing, setMissing] = useState([]);
  const [emailError, setEmailError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const set = (key) => (value) => setResponses((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (submitting) return;

    const stillMissing = REQUIRED_KEYS.filter(
      (key) => responses[key] === null || responses[key] === '',
    );
    setMissing(stillMissing);

    const email = responses.email.trim();
    let emailProblem = null;
    if (email && !EMAIL_RE.test(email)) {
      emailProblem = 'Please enter a valid email address or leave it empty.';
    }
    setEmailError(emailProblem);

    if (stillMissing.length > 0 || emailProblem) return;

    setSubmitting(true);
    POST('/api/feedback', responses)
      .then(() => {
        setSubmitting(false);
        setSubmitted(true);
      })
      .catch((err) => {
        setSubmitting(false);
        setEmailError(err.message || 'Failed to submit feedback. Please try again.');
      });
  };

  const resetForm = () => {
    setResponses(INITIAL_RESPONSES);
    setMissing([]);
    setEmailError(null);
    setSubmitting(false);
    setSubmitted(false);
  };

  return (
    <Modal
      open
      size="lg"
      title="Feedback"
      subtitle="Help us improve TradeRetro"
      onClose={onClose}
      footer={
        submitted ? (
          <>
            <Button variant="secondary" size="sm" onClick={resetForm}>
              Submit another response
            </Button>
            <Button size="sm" onClick={onClose}>
              Close
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Cancel and close the feedback form">
              Cancel
            </Button>
            <Button size="sm" disabled={submitting} aria-disabled={submitting} onClick={handleSubmit}>
              {submitting ? 'Submitting...' : 'Submit Feedback'}
            </Button>
          </>
        )
      }
    >
      {submitted ? (
        <div className="tr-fb-success" role="status" aria-live="polite">
          <div className="tr-fb-success-icon" aria-hidden="true">
            <CheckCircle2 size={34} />
          </div>
          <h3 className="tr-fb-success-title">Thank you for your feedback.</h3>
          <p className="tr-fb-success-text">
            Feedback submitted successfully. Your response has been securely stored on the server.
          </p>
        </div>
      ) : (
        <form
          id="tr-feedback-form"
          className="tr-fb-form"
          onSubmit={handleSubmit}
          noValidate
          aria-label="Feedback form"
        >
          {(missing.length > 0 || emailError) && (
            <div id="tr-fb-top-error" className="tr-fb-error-banner" role="alert" tabIndex={-1}>
              <CircleAlert size={15} />
              <div className="tr-fb-error-copy">
                <strong>Almost there — a few answers are needed.</strong>
                <span className="tr-fb-missing-list">
                  {missing.map((key) => (
                    <MissingLabel key={key} label={MISSING_LABELS[key]} />
                  ))}
                  {emailError && <MissingLabel label={emailError} />}
                </span>
              </div>
            </div>
          )}

          <Section title="1 · Overall Experience">
            <RatingQuestion
              label="How does TradeRetro feel to use?"
              value={responses.experience}
              onChange={set('experience')}
              error={missing.includes('experience')}
            />
            <RatingQuestion
              label="How easy was TradeRetro to understand and navigate?"
              value={responses.navigation}
              onChange={set('navigation')}
              error={missing.includes('navigation')}
            />
            <ChoiceQuestion
              label="Did TradeRetro help you in any way?"
              options={['Yes', 'Somewhat', 'Not really']}
              value={responses.helped}
              onChange={set('helped')}
              error={missing.includes('helped')}
            />
            <TextQuestion
              id="tr-feedback-most-useful"
              label="What was most useful to you? (optional)"
              value={responses.mostUseful}
              onChange={set('mostUseful')}
              placeholder="Optional — what stood out for you?"
            />
          </Section>

          <Section title="2 · Backtesting Experience">
            <RatingQuestion
              label="How useful did you find the Backtest Engine?"
              value={responses.engine}
              onChange={set('engine')}
              error={missing.includes('engine')}
            />
            <ChoiceQuestion
              label="Were the strategy configuration controls easy to understand?"
              options={['Very easy', 'Easy', 'Neutral', 'Difficult', 'Very difficult']}
              value={responses.controls}
              onChange={set('controls')}
              error={missing.includes('controls')}
            />
            <RatingQuestion
              label="How useful were the performance metrics and visualizations?"
              value={responses.metrics}
              onChange={set('metrics')}
              error={missing.includes('metrics')}
            />
          </Section>

          <Section title="3 · AI Copilot">
            <RatingQuestion
              label="How useful was the AI Copilot in helping you understand strategies, backtests, or results?"
              scale="1 — Not useful · 5 — Extremely useful"
              value={responses.copilot}
              onChange={set('copilot')}
              error={missing.includes('copilot')}
            />
            <ChoiceQuestion
              label="Did the AI Copilot help you understand your strategy or results better?"
              options={['Yes', 'Somewhat', 'No', 'I did not use it']}
              value={responses.copilotHelped}
              onChange={set('copilotHelped')}
              error={missing.includes('copilotHelped')}
            />
            <TextQuestion
              id="tr-feedback-copilot-better"
              label="What would you want the AI Copilot to do better? (optional)"
              value={responses.copilotImprove}
              onChange={set('copilotImprove')}
              placeholder="Optional — what should the Copilot improve?"
            />
          </Section>

          <Section title="4 · UI / Frontend">
            <RatingQuestion
              label="What do you think about the TradeRetro UI / frontend?"
              value={responses.ui}
              onChange={set('ui')}
              error={missing.includes('ui')}
            />
            <RatingQuestion
              label="How would you rate the visual design?"
              value={responses.design}
              onChange={set('design')}
              error={missing.includes('design')}
            />
            <TextQuestion
              id="tr-feedback-ui-confusing"
              label="Was anything confusing, difficult to find, or difficult to use? (optional)"
              value={responses.confusing}
              onChange={set('confusing')}
              placeholder="Optional — tell us what tripped you up"
            />
          </Section>

          <Section title="5 · Open Feedback">
            <TextQuestion
              id="tr-feedback-improve"
              label="What is one thing you would improve about TradeRetro? (optional)"
              value={responses.improve}
              onChange={set('improve')}
              placeholder="Optional — your single biggest improvement idea"
            />
            <TextQuestion
              id="tr-feedback-liked"
              label="What is one thing you particularly liked? (optional)"
              value={responses.liked}
              onChange={set('liked')}
              placeholder="Optional — what deserves to stay?"
            />
          </Section>

          <Section title="Contact">
            <div className="tr-fb-field">
              <label className="tr-fb-question" htmlFor="tr-feedback-email">
                Email address (optional)
              </label>
              <input
                id="tr-feedback-email"
                className={cx('tr-fb-input', emailError && 'tr-fb-invalid')}
                type="email"
                value={responses.email}
                onChange={(e) => setResponses((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="you@example.com"
                aria-invalid={Boolean(emailError)}
              />
              <p className="tr-fb-helper">
                Leave your email if you would like us to follow up on your feedback.
              </p>
            </div>
          </Section>
        </form>
      )}
    </Modal>
  );
}