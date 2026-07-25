import { useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function CodeBlock({ className, children, language }) {
  const code = String(children).replace(/\n$/, '');
  return (
    <div className="ai-md-code-block">
      {language && <div className="ai-md-code-lang">{language}</div>}
      <pre className={className || ''}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function InlineCode({ children }) {
  return <code className="ai-md-inline-code">{children}</code>;
}

function Table({ children }) {
  return (
    <div className="ai-md-table-wrap">
      <table className="ai-md-table">{children}</table>
    </div>
  );
}

function Blockquote({ children }) {
  return <blockquote className="ai-md-blockquote">{children}</blockquote>;
}

function Link({ href, children }) {
  return (
    <a className="ai-md-link" href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

function renderHeading(Tag) {
  return function Heading({ children, ...props }) {
    return <Tag className={`ai-md-h ai-md-${Tag}`} {...props}>{children}</Tag>;
  };
}

function List({ ordered, children, ...props }) {
  const Tag = ordered ? 'ol' : 'ul';
  return <Tag className={`ai-md-list ${ordered ? 'ai-md-ordered' : 'ai-md-unordered'}`} {...props}>{children}</Tag>;
}

function ListItem({ children, ...props }) {
  return <li className="ai-md-li" {...props}>{children}</li>;
}

function Paragraph({ children }) {
  return <p className="ai-md-p">{children}</p>;
}

function Hr() {
  return <hr className="ai-md-hr" />;
}

function Image({ src, alt }) {
  return <img className="ai-md-img" src={src} alt={alt || ''} loading="lazy" />;
}

const components = {
  code: InlineCode,
  pre: ({ children }) => {
    const child = children?.props?.children || '';
    const lang = children?.props?.className?.replace('language-', '') || '';
    return <CodeBlock language={lang}>{child}</CodeBlock>;
  },
  table: Table,
  blockquote: Blockquote,
  a: Link,
  h1: renderHeading('h1'),
  h2: renderHeading('h2'),
  h3: renderHeading('h3'),
  h4: renderHeading('h4'),
  h5: renderHeading('h5'),
  h6: renderHeading('h6'),
  ul: List,
  ol: List,
  li: ListItem,
  p: Paragraph,
  hr: Hr,
  img: Image,
};

function MarkdownRenderer({ content }) {
  return (
    <div className="ai-md-root">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default MarkdownRenderer;
