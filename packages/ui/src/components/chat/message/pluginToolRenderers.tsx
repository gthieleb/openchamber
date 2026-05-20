import React from "react";
import type { ToolRendererProps } from "@openchamber/plugin";

export interface ToolRendererWithScrollableProps extends ToolRendererProps {
  renderScrollable?: (content: React.ReactNode, options?: { className?: string }) => React.ReactNode;
}

export const QuestionRenderer: React.FC<ToolRendererWithScrollableProps> = ({
  input,
  output,
  renderScrollable,
}) => {
  const wrap = (content: React.ReactNode) => renderScrollable ? renderScrollable(content) : content;

  try {
    if (output) {
      const parsed = JSON.parse(output);
      if (Array.isArray(parsed)) {
        return wrap(
          <div className="space-y-4">
            {parsed.map((qa: { question?: string; answer?: string }, idx: number) => (
              <div key={idx} className="space-y-1">
                {qa.question && (
                  <div className="typography-body font-medium text-foreground">
                    {qa.question}
                  </div>
                )}
                {qa.answer && (
                  <div className="typography-body text-muted-foreground whitespace-pre-wrap">
                    {qa.answer}
                  </div>
                )}
              </div>
            ))}
          </div>,
        );
      }
    }
  } catch {
    // Fall through to question input display
  }

  const questionInput = typeof input?.question === "string" ? input.question : null;
  if (questionInput) {
    return wrap(
      <div className="typography-body text-muted-foreground whitespace-pre-wrap">
        {questionInput}
      </div>,
    );
  }

  return wrap(
    <div className="typography-body text-muted-foreground">
      No output
    </div>,
  );
};

export const TaskRenderer: React.FC<ToolRendererWithScrollableProps> = ({
  output,
  renderScrollable,
}) => {
  const wrap = (content: React.ReactNode) => renderScrollable ? renderScrollable(content) : content;
  if (output) {
    return wrap(
      <div className="typography-body text-muted-foreground whitespace-pre-wrap">
        {output}
      </div>,
    );
  }
  return null;
};

export const EditRenderer: React.FC<ToolRendererWithScrollableProps> = ({
  output,
  renderScrollable,
}) => {
  const wrap = (content: React.ReactNode) => renderScrollable ? renderScrollable(content) : content;
  if (output) {
    return wrap(
      <div className="typography-body text-muted-foreground whitespace-pre-wrap">
        {output}
      </div>,
    );
  }
  return null;
};

export const WriteRenderer: React.FC<ToolRendererWithScrollableProps> = ({
  renderScrollable,
}) => {
  const wrap = (content: React.ReactNode) => renderScrollable ? renderScrollable(content) : content;
  return wrap(null);
};

export const DefaultTextRenderer: React.FC<ToolRendererWithScrollableProps> = ({
  output,
  error,
  renderScrollable,
}) => {
  const wrap = (content: React.ReactNode) => renderScrollable ? renderScrollable(content) : content;

  if (output) {
    return wrap(
      <div className="typography-body text-muted-foreground whitespace-pre-wrap">
        {output}
      </div>,
    );
  }

  if (error) {
    return wrap(
      <div className="typography-body text-destructive whitespace-pre-wrap">
        {error}
      </div>,
    );
  }

  return wrap(
    <div className="typography-body text-muted-foreground">
      No output
    </div>,
  );
};
