// Tests for session tree building

import { describe, it, expect } from "bun:test";
import {
  buildChildrenMap,
  buildSessionNodes,
  calculateChildCounts,
} from "../tree";
import {
  createSession,
  createSessionTree,
  createFlatSessions,
} from "./fixtures";

describe("buildChildrenMap", () => {
  it("returns empty map for empty array", () => {
    const map = buildChildrenMap([]);
    expect(map.size).toBe(0);
  });

  it("returns empty map for sessions without parents", () => {
    const sessions = createFlatSessions(3);
    const map = buildChildrenMap(sessions);
    expect(map.size).toBe(0);
  });

  it("groups children by parentId", () => {
    const sessions = createSessionTree();
    const map = buildChildrenMap(sessions);

    // root has 2 children (child1, child2)
    expect(map.get("root")?.length).toBe(2);

    // child1 has 1 child (grandchild)
    expect(map.get("child1")?.length).toBe(1);

    // child2 and grandchild have no children
    expect(map.has("child2")).toBe(false);
    expect(map.has("grandchild")).toBe(false);
  });

  it("handles multiple levels of nesting", () => {
    const sessions = createSessionTree();
    const map = buildChildrenMap(sessions);

    const rootChildren = map.get("root") || [];
    expect(rootChildren.map((s) => s.originalId)).toContain("child1");
    expect(rootChildren.map((s) => s.originalId)).toContain("child2");

    const child1Children = map.get("child1") || [];
    expect(child1Children.map((s) => s.originalId)).toContain("grandchild");
  });
});

describe("buildSessionNodes", () => {
  it("returns empty array for empty input", () => {
    expect(buildSessionNodes([])).toEqual([]);
  });

  it("single session has depth 0 and no prefix", () => {
    const sessions = [createSession()];
    const nodes = buildSessionNodes(sessions);

    expect(nodes).toHaveLength(1);
    expect(nodes[0]!.depth).toBe(0);
    expect(nodes[0]!.treePrefix).toBe("");
    expect(nodes[0]!.isLastChild).toBe(true);
  });

  it("builds correct tree structure", () => {
    const sessions = createSessionTree();
    const nodes = buildSessionNodes(sessions);

    // Should have all 4 sessions
    expect(nodes.length).toBe(4);

    // Find nodes by originalId
    const root = nodes.find((n) => n.session.originalId === "root");
    const child1 = nodes.find((n) => n.session.originalId === "child1");
    const child2 = nodes.find((n) => n.session.originalId === "child2");
    const grandchild = nodes.find((n) => n.session.originalId === "grandchild");

    expect(root?.depth).toBe(0);
    expect(child1?.depth).toBe(1);
    expect(child2?.depth).toBe(1);
    expect(grandchild?.depth).toBe(2);
  });

  it("assigns correct tree prefixes", () => {
    const sessions = createSessionTree();
    const nodes = buildSessionNodes(sessions);

    const root = nodes.find((n) => n.session.originalId === "root");
    const child1 = nodes.find((n) => n.session.originalId === "child1");
    const child2 = nodes.find((n) => n.session.originalId === "child2");
    const grandchild = nodes.find((n) => n.session.originalId === "grandchild");

    // Root has no prefix
    expect(root?.treePrefix).toBe("");

    // Children have branch prefixes
    // child1 is first (not last), child2 is last
    expect(child1?.treePrefix).toBe("├── ");
    expect(child2?.treePrefix).toBe("└── ");

    // Grandchild is under child1 (not last sibling), so has continuation line
    expect(grandchild?.treePrefix).toBe("│   └── ");
  });

  it("sorts roots by lastActivity (most recent first)", () => {
    const now = Date.now();
    const sessions = [
      createSession({
        id: "s1:old",
        originalId: "old",
        lastActivity: now - 10000,
      }),
      createSession({
        id: "s1:new",
        originalId: "new",
        lastActivity: now - 1000,
      }),
      createSession({
        id: "s1:mid",
        originalId: "mid",
        lastActivity: now - 5000,
      }),
    ];

    const nodes = buildSessionNodes(sessions);

    expect(nodes[0]!.session.originalId).toBe("new");
    expect(nodes[1]!.session.originalId).toBe("mid");
    expect(nodes[2]!.session.originalId).toBe("old");
  });

  it("sorts children by createdAt (oldest first)", () => {
    const now = Date.now();
    const parent = createSession({
      id: "s1:parent",
      originalId: "parent",
      createdAt: now - 100000,
    });
    const child1 = createSession({
      id: "s1:child1",
      originalId: "child1",
      parentId: "parent",
      createdAt: now - 50000, // older
    });
    const child2 = createSession({
      id: "s1:child2",
      originalId: "child2",
      parentId: "parent",
      createdAt: now - 10000, // newer
    });

    const nodes = buildSessionNodes([parent, child2, child1]); // intentionally out of order

    // Parent first, then children sorted by createdAt
    expect(nodes[0]!.session.originalId).toBe("parent");
    expect(nodes[1]!.session.originalId).toBe("child1"); // older first
    expect(nodes[2]!.session.originalId).toBe("child2");
  });

  it("handles orphaned sessions (parent not in list)", () => {
    const orphan = createSession({
      id: "s1:orphan",
      originalId: "orphan",
      parentId: "nonexistent",
    });

    const nodes = buildSessionNodes([orphan]);

    // Orphan should be treated as root
    expect(nodes).toHaveLength(1);
    expect(nodes[0]!.depth).toBe(0);
    expect(nodes[0]!.treePrefix).toBe("");
  });

  it("handles multiple root sessions", () => {
    const sessions = createFlatSessions(3);
    const nodes = buildSessionNodes(sessions);

    expect(nodes.length).toBe(3);
    expect(nodes.every((n) => n.depth === 0)).toBe(true);
  });

  it("preserves all sessions in output", () => {
    const sessions = createSessionTree();
    const nodes = buildSessionNodes(sessions);

    expect(nodes.length).toBe(sessions.length);

    const outputIds = nodes.map((n) => n.session.originalId).sort();
    const inputIds = sessions.map((s) => s.originalId).sort();
    expect(outputIds).toEqual(inputIds);
  });
});

describe("calculateChildCounts", () => {
  it("returns empty map for empty array", () => {
    const result = calculateChildCounts([]);
    expect(result.size).toBe(0);
  });

  it("returns empty map for empty Map", () => {
    const result = calculateChildCounts(new Map());
    expect(result.size).toBe(0);
  });

  it("returns empty map for sessions without parents", () => {
    const sessions = createFlatSessions(3);
    const result = calculateChildCounts(sessions);
    expect(result.size).toBe(0);
  });

  it("counts children correctly from array", () => {
    const sessions = createSessionTree();
    const result = calculateChildCounts(sessions);

    // root has 2 children (child1, child2)
    expect(result.get("server1:root")).toBe(2);

    // child1 has 1 child (grandchild)
    expect(result.get("server1:child1")).toBe(1);

    // child2 and grandchild have no children
    expect(result.has("server1:child2")).toBe(false);
    expect(result.has("server1:grandchild")).toBe(false);
  });

  it("counts children correctly from Map", () => {
    const sessions = createSessionTree();
    const sessionMap = new Map(sessions.map((s) => [s.id, s]));
    const result = calculateChildCounts(sessionMap);

    expect(result.get("server1:root")).toBe(2);
    expect(result.get("server1:child1")).toBe(1);
  });

  it("uses serverId:parentId as key", () => {
    const parent = createSession({
      id: "myserver:parent",
      originalId: "parent",
      serverId: "myserver",
    });
    const child = createSession({
      id: "myserver:child",
      originalId: "child",
      serverId: "myserver",
      parentId: "parent",
    });

    const result = calculateChildCounts([parent, child]);

    // Key should be serverId:parentId
    expect(result.get("myserver:parent")).toBe(1);
  });

  it("handles multiple servers correctly", () => {
    const parent1 = createSession({
      id: "s1:p1",
      originalId: "p1",
      serverId: "s1",
    });
    const child1 = createSession({
      id: "s1:c1",
      originalId: "c1",
      serverId: "s1",
      parentId: "p1",
    });
    const parent2 = createSession({
      id: "s2:p1",
      originalId: "p1",
      serverId: "s2",
    });
    const child2a = createSession({
      id: "s2:c2a",
      originalId: "c2a",
      serverId: "s2",
      parentId: "p1",
    });
    const child2b = createSession({
      id: "s2:c2b",
      originalId: "c2b",
      serverId: "s2",
      parentId: "p1",
    });

    const result = calculateChildCounts([
      parent1,
      child1,
      parent2,
      child2a,
      child2b,
    ]);

    // s1:p1 has 1 child
    expect(result.get("s1:p1")).toBe(1);
    // s2:p1 has 2 children
    expect(result.get("s2:p1")).toBe(2);
  });

  it("handles orphaned sessions (parent not in list)", () => {
    const orphan = createSession({
      id: "s1:orphan",
      originalId: "orphan",
      serverId: "s1",
      parentId: "nonexistent",
    });

    const result = calculateChildCounts([orphan]);

    // Orphan's parent gets counted even if parent isn't in list
    expect(result.get("s1:nonexistent")).toBe(1);
  });
});
