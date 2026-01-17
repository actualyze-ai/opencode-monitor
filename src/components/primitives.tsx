/**
 * Primitive layout components for OpenTUI.
 *
 * OpenTUI's <box> inherits Yoga's default flexDirection="column". These
 * wrappers provide explicit direction and sensible defaults for predictable
 * layouts.
 *
 * Default properties:
 * - flexGrow: 0
 * - flexShrink: 1
 * - flexWrap: 'no-wrap'
 */

import type React from "react";
import type {
  AlignString,
  JustifyString,
  OverflowString,
  PositionTypeString,
  WrapString,
} from "@opentui/core";
import type { BorderStyle } from "@opentui/core";

// Dimension type matching OpenTUI's expectations
type DimensionValue = number | "auto" | `${number}%`;

// Common layout props shared by Row and Col
interface LayoutProps {
  children?: React.ReactNode;

  // Dimensions
  width?: DimensionValue;
  height?: DimensionValue;
  minWidth?: DimensionValue;
  minHeight?: DimensionValue;
  maxWidth?: DimensionValue;
  maxHeight?: DimensionValue;

  // Flex properties
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: number | "auto";
  flexWrap?: WrapString;
  alignItems?: AlignString;
  alignSelf?: AlignString;
  justifyContent?: JustifyString;

  // Spacing (OpenTUI uses number | `${number}%` for these)
  padding?: number | `${number}%`;
  paddingLeft?: number | `${number}%`;
  paddingRight?: number | `${number}%`;
  paddingTop?: number | `${number}%`;
  paddingBottom?: number | `${number}%`;
  margin?: number | "auto" | `${number}%`;
  marginLeft?: number | "auto" | `${number}%`;
  marginRight?: number | "auto" | `${number}%`;
  marginTop?: number | "auto" | `${number}%`;
  marginBottom?: number | "auto" | `${number}%`;
  gap?: number | `${number}%`;

  // Border
  border?: boolean;
  borderStyle?: BorderStyle;
  borderColor?: string;

  // Appearance
  backgroundColor?: string;

  // Positioning
  position?: PositionTypeString;
  top?: DimensionValue;
  right?: DimensionValue;
  bottom?: DimensionValue;
  left?: DimensionValue;

  // Overflow
  overflow?: OverflowString;
}

/**
 * Row - A flex container with horizontal layout (flexDirection="row").
 *
 * Use for horizontal arrangements of children.
 *
 * @example
 * <Row>
 *   <text>Left</text>
 *   <text>Right</text>
 * </Row>
 */
export function Row({
  children,
  flexGrow = 0,
  flexShrink = 1,
  flexWrap = "no-wrap",
  ...props
}: LayoutProps): React.ReactNode {
  return (
    <box
      flexDirection="row"
      flexGrow={flexGrow}
      flexShrink={flexShrink}
      flexWrap={flexWrap}
      {...props}
    >
      {children}
    </box>
  );
}

/**
 * Col - A flex container with vertical layout (flexDirection="column").
 *
 * Use for vertical arrangements of children. Explicit about direction
 * for clarity.
 *
 * @example
 * <Col>
 *   <text>Top</text>
 *   <text>Bottom</text>
 * </Col>
 */
export function Col({
  children,
  flexGrow = 0,
  flexShrink = 1,
  ...props
}: LayoutProps): React.ReactNode {
  return (
    <box
      flexDirection="column"
      flexGrow={flexGrow}
      flexShrink={flexShrink}
      {...props}
    >
      {children}
    </box>
  );
}
