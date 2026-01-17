// Error boundary component for graceful error handling

import { Component, type ReactNode, type ErrorInfo } from "react";
import { TextAttributes, type KeyEvent } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { Row, Col } from "./primitives";
import { debug } from "../lib/debug";

interface ErrorBoundaryProps {
  children: ReactNode;
  onExit?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error display component with keyboard handling
 * Separated from ErrorBoundary class so we can use hooks
 */
function ErrorDisplay({
  error,
  onExit,
}: {
  error: Error | null;
  onExit: (() => void) | undefined;
}): React.ReactNode {
  useKeyboard((event: KeyEvent) => {
    if (event.name === "q" || (event.name === "q" && event.shift)) {
      if (onExit) {
        onExit();
      } else {
        process.exit(1);
      }
    }
    // Also handle Ctrl+C
    if (event.name === "c" && event.ctrl) {
      if (onExit) {
        onExit();
      } else {
        process.exit(1);
      }
    }
  });

  const errorMessage = error?.message || "Unknown error";

  return (
    <Col padding={1}>
      <text style={{ attributes: TextAttributes.BOLD }} fg="red">
        {"Something went wrong"}
      </text>
      <Row marginTop={1}>
        <text fg="yellow">{"Error: "}</text>
        <text>{errorMessage}</text>
      </Row>
      <Row marginTop={1}>
        <text style={{ attributes: TextAttributes.DIM }}>
          {"Check the debug log for details. Press q to quit."}
        </text>
      </Row>
    </Col>
  );
}

/**
 * Error boundary that catches React errors and displays a fallback UI
 * Prevents the entire TUI from crashing on component errors
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to debug file
    debug(`[ErrorBoundary] Caught error: ${error.message}`);
    debug(`[ErrorBoundary] Stack: ${error.stack}`);
    debug(`[ErrorBoundary] Component stack: ${errorInfo.componentStack}`);

    // Try to extract more info from the error
    if (error.message.includes("TextNodeRenderable")) {
      debug(`[ErrorBoundary] TextNodeRenderable error detected`);
      debug(
        `[ErrorBoundary] This usually means a non-string value was passed to a <text> element`,
      );
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- OpenTUI JSX types require any return
  override render(): any {
    if (this.state.hasError) {
      return (
        <ErrorDisplay error={this.state.error} onExit={this.props.onExit} />
      );
    }

    return this.props.children;
  }
}
