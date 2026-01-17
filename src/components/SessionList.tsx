// Session list component with server groups and session rows

import { TextAttributes } from "@opentui/core";
import {
  formatTimestamp,
  formatContextUsage,
  getStatusColor,
  getContextUsageColor,
} from "../lib/format";
import { truncateText } from "../lib/text";
import Spinner from "./Spinner";
import { Row, Col } from "./primitives";
import type { Session, SessionNode, Server, ListItem } from "../types";

interface SessionListProps {
  visibleItems: ListItem[];
  scrollOffset: number;
  selectedIndex: number;
  listWidth: number;
  totalItems: number;
  servers: Map<string, Server>;
  nodesByServer: Map<string, SessionNode[]>;
  collapsedServers: Set<string>;
}

function renderSessionName(
  name: string,
  maxWidth: number,
  isSelected: boolean,
): React.ReactNode {
  const safeName = name || "";
  const subagentMatch = safeName.match(
    /^(.+?)\s*\(@(\w+(?:-\w+)*)\s+subagent\)$/,
  );

  if (subagentMatch) {
    const mainName = subagentMatch[1] || "";
    const agentType = subagentMatch[2] || "";
    const suffix = ` @${agentType}`;
    const availableForMain = maxWidth - suffix.length;
    const truncatedMain = truncateText(mainName, availableForMain);

    return (
      <>
        <text
          style={{
            attributes: isSelected ? TextAttributes.BOLD : TextAttributes.NONE,
          }}
          fg={isSelected ? "white" : "#cccccc"}
        >
          {truncatedMain}
        </text>
        <text fg={isSelected ? "#888888" : "#555555"}>{suffix}</text>
      </>
    );
  }

  return (
    <text
      style={{
        attributes: isSelected ? TextAttributes.BOLD : TextAttributes.NONE,
      }}
      fg={isSelected ? "white" : "#cccccc"}
    >
      {truncateText(safeName, maxWidth)}
    </text>
  );
}

function SessionStatus({
  session,
  isPending,
  isSelected,
}: {
  session: Session;
  isPending: boolean;
  isSelected: boolean;
}): React.ReactNode {
  const dimColor = "#444444";

  if (isPending) {
    return <text fg={dimColor}>○</text>;
  }

  if (session.status === "busy" || session.status === "retry") {
    return <Spinner isBusy={true} />;
  }

  if (session.status === "waiting_for_permission") {
    return (
      <text style={{ attributes: TextAttributes.BOLD }} fg="yellow">
        ◉
      </text>
    );
  }

  if (session.status === "idle") {
    return <text fg={isSelected ? "white" : "green"}>●</text>;
  }

  if (session.status === "completed") {
    return <text fg={isSelected ? "white" : "#666666"}>○</text>;
  }

  if (session.status === "error" || session.status === "aborted") {
    return <text fg={isSelected ? "white" : "red"}>✕</text>;
  }

  return (
    <text fg={isSelected ? "white" : getStatusColor(session.status)}>●</text>
  );
}

function ServerGroupRow({
  serverId,
  server,
  nodeCount,
  isSelected,
  isCollapsed,
}: {
  serverId: string;
  server: Server | undefined;
  nodeCount: number;
  isSelected: boolean;
  isCollapsed: boolean;
}): React.ReactNode {
  const serverName = server?.name || serverId;
  const isPending = server?.pending === true;
  const indicator = isCollapsed ? "▶" : "▼";

  return (
    <Row
      key={`group-${serverId}`}
      backgroundColor={isSelected ? "#264f78" : "#1a1a1a"}
      paddingLeft={1}
      paddingRight={1}
    >
      <text
        style={{ attributes: TextAttributes.BOLD }}
        fg={isSelected ? "white" : isPending ? "#666666" : "yellow"}
      >
        {`${indicator} ${serverName} (${nodeCount})`}
      </text>
    </Row>
  );
}

function SessionRow({
  node,
  server,
  isSelected,
  listWidth,
}: {
  node: SessionNode;
  server: Server | undefined;
  isSelected: boolean;
  listWidth: number;
}): React.ReactNode {
  const session = node.session;
  const isPending = server?.pending === true;
  const treePrefixWidth = node.treePrefix.length;
  const dimColor = "#444444";

  const statusW = 3;
  const timeW = 13;
  const tokensW = 9;
  const contextW = 16;
  const nameW = Math.max(
    20,
    listWidth - statusW - timeW - tokensW - contextW - treePrefixWidth - 2,
  );

  return (
    <Row
      key={`session-${session.id}`}
      {...(isSelected ? { backgroundColor: "#264f78" } : {})}
      paddingLeft={1}
      paddingRight={1}
    >
      {node.treePrefix ? (
        <text fg={isSelected ? "#888888" : dimColor}>{node.treePrefix}</text>
      ) : null}

      <Row width={statusW}>
        <SessionStatus
          session={session}
          isPending={isPending}
          isSelected={isSelected}
        />
      </Row>

      <Row width={nameW}>
        {isPending ? (
          <text fg={dimColor}>{truncateText(session.name || "", nameW)}</text>
        ) : (
          renderSessionName(session.name || "", nameW, isSelected)
        )}
      </Row>

      <Row width={contextW} justifyContent="flex-end" paddingRight={1}>
        <text
          fg={
            isPending
              ? dimColor
              : isSelected
                ? "#aaaaaa"
                : getContextUsageColor(
                    session.contextUsed,
                    session.contextLimit,
                  )
          }
        >
          {formatContextUsage(session.contextUsed, session.contextLimit)}
        </text>
      </Row>

      <Row width={tokensW} justifyContent="flex-end" paddingRight={1}>
        <text fg={isPending ? dimColor : isSelected ? "#aaaaaa" : "#666666"}>
          {session.tokens !== undefined && session.tokens >= 1000
            ? `${Math.round(session.tokens / 1000)}k`
            : session.tokens !== undefined
              ? String(session.tokens)
              : ""}
        </text>
      </Row>

      <Row width={timeW} justifyContent="flex-end">
        <text fg={isPending ? dimColor : isSelected ? "#aaaaaa" : "#666666"}>
          {formatTimestamp(session.lastActivity)}
        </text>
      </Row>
    </Row>
  );
}

export function SessionList({
  visibleItems,
  scrollOffset,
  selectedIndex,
  listWidth,
  totalItems,
  servers,
  nodesByServer,
  collapsedServers,
}: SessionListProps): React.ReactNode {
  const hasMoreAbove = scrollOffset > 0;
  const hasMoreBelow = scrollOffset + visibleItems.length < totalItems;
  const moreAboveCount = scrollOffset;
  const moreBelowCount = totalItems - scrollOffset - visibleItems.length;

  if (servers.size === 0) {
    return (
      <Col width={listWidth} flexGrow={1}>
        <Col paddingLeft={1} paddingRight={1} paddingTop={1} paddingBottom={1}>
          <text style={{ attributes: TextAttributes.DIM }}>
            {"Waiting for OpenCode servers..."}
          </text>
        </Col>
      </Col>
    );
  }

  return (
    <Col width={listWidth} flexGrow={1}>
      {/* Scroll indicator - more above */}
      {hasMoreAbove ? (
        <Row justifyContent="center">
          <text fg="cyan">{`▲ ${moreAboveCount} more above`}</text>
        </Row>
      ) : null}

      {visibleItems.map((item, visibleIdx) => {
        const absoluteIdx = scrollOffset + visibleIdx;
        const isSelected = absoluteIdx === selectedIndex;

        if (item.type === "group") {
          const server = servers.get(item.serverId);
          const groupNodes = nodesByServer.get(item.serverId) || [];
          const isCollapsed = collapsedServers.has(item.serverId);
          return (
            <ServerGroupRow
              key={`group-${item.serverId}`}
              serverId={item.serverId}
              server={server}
              nodeCount={groupNodes.length}
              isSelected={isSelected}
              isCollapsed={isCollapsed}
            />
          );
        }

        const server = servers.get(item.node.session.serverId);
        return (
          <SessionRow
            key={`session-${item.node.session.id}`}
            node={item.node}
            server={server}
            isSelected={isSelected}
            listWidth={listWidth}
          />
        );
      })}

      {/* Spacer to push "more below" to bottom */}
      <Col flexGrow={1} />

      {/* Scroll indicator - more below */}
      {hasMoreBelow ? (
        <Row justifyContent="center">
          <text fg="cyan">{`▼ ${moreBelowCount} more below`}</text>
        </Row>
      ) : null}
    </Col>
  );
}
