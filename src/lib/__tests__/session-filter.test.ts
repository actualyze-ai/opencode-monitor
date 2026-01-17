// Tests for session filtering

import { describe, it, expect } from "bun:test";
import {
  findCurrentSession,
  buildSessionTree,
  filterToCurrentSessionTree,
} from "../session-filter";
import {
  createSession,
  createSessionTree,
  createSessionsWithStatuses,
  createFlatSessions,
} from "./fixtures";

describe("findCurrentSession", () => {
  it("returns undefined for empty array", () => {
    expect(findCurrentSession([])).toBeUndefined();
  });

  it("prioritizes busy sessions", () => {
    const sessions = createSessionsWithStatuses();
    const current = findCurrentSession(sessions);

    expect(current?.status).toBe("busy");
  });

  it("prioritizes waiting_for_permission over idle", () => {
    const sessions = [
      createSession({ id: "s1:idle", originalId: "idle", status: "idle" }),
      createSession({
        id: "s1:waiting",
        originalId: "waiting",
        status: "waiting_for_permission",
      }),
    ];

    const current = findCurrentSession(sessions);
    expect(current?.status).toBe("waiting_for_permission");
  });

  it("falls back to root with most recent activity", () => {
    const now = Date.now();
    const sessions = [
      createSession({
        id: "s1:old",
        originalId: "old",
        status: "idle",
        lastActivity: now - 10000,
      }),
      createSession({
        id: "s1:new",
        originalId: "new",
        status: "idle",
        lastActivity: now - 1000,
      }),
    ];

    const current = findCurrentSession(sessions);
    expect(current?.originalId).toBe("new");
  });

  it("prefers root sessions over children with more recent activity", () => {
    const now = Date.now();
    const root = createSession({
      id: "s1:root",
      originalId: "root",
      status: "idle",
      lastActivity: now - 10000, // older
    });
    const child = createSession({
      id: "s1:child",
      originalId: "child",
      parentId: "root",
      status: "idle",
      lastActivity: now - 1000, // newer
    });

    const current = findCurrentSession([root, child]);
    // Should pick root even though child has more recent activity
    expect(current?.originalId).toBe("root");
  });

  it("handles all sessions having parents (orphans)", () => {
    const now = Date.now();
    const sessions = [
      createSession({
        id: "s1:orphan1",
        originalId: "orphan1",
        parentId: "nonexistent",
        status: "idle",
        lastActivity: now - 10000,
      }),
      createSession({
        id: "s1:orphan2",
        originalId: "orphan2",
        parentId: "nonexistent",
        status: "idle",
        lastActivity: now - 1000,
      }),
    ];

    // Should fall back to most recent activity
    const current = findCurrentSession(sessions);
    expect(current?.originalId).toBe("orphan2");
  });
});

describe("buildSessionTree", () => {
  it("includes current session", () => {
    const sessions = createFlatSessions(3);
    const current = sessions[1]!;
    const tree = buildSessionTree(current, sessions);

    expect(tree).toContainEqual(current);
  });

  it("includes parent if exists", () => {
    const sessions = createSessionTree();
    const child = sessions.find((s) => s.originalId === "child1")!;
    const tree = buildSessionTree(child, sessions);

    const parentInTree = tree.find((s) => s.originalId === "root");
    expect(parentInTree).toBeDefined();
  });

  it("includes all descendants", () => {
    const sessions = createSessionTree();
    const root = sessions.find((s) => s.originalId === "root")!;
    const tree = buildSessionTree(root, sessions);

    // Should include root, child1, child2, grandchild
    expect(tree).toHaveLength(4);
    expect(tree.map((s) => s.originalId).sort()).toEqual([
      "child1",
      "child2",
      "grandchild",
      "root",
    ]);
  });

  it("includes siblings", () => {
    const sessions = createSessionTree();
    const child1 = sessions.find((s) => s.originalId === "child1")!;
    const tree = buildSessionTree(child1, sessions);

    // Should include child1, its parent (root), its sibling (child2), and its child (grandchild)
    const ids = tree.map((s) => s.originalId);
    expect(ids).toContain("child1");
    expect(ids).toContain("root");
    expect(ids).toContain("child2");
    expect(ids).toContain("grandchild");
  });

  it("includes sibling descendants", () => {
    const parent = createSession({
      id: "s1:parent",
      originalId: "parent",
    });
    const child1 = createSession({
      id: "s1:child1",
      originalId: "child1",
      parentId: "parent",
    });
    const child2 = createSession({
      id: "s1:child2",
      originalId: "child2",
      parentId: "parent",
    });
    const grandchild2 = createSession({
      id: "s1:grandchild2",
      originalId: "grandchild2",
      parentId: "child2",
    });

    const sessions = [parent, child1, child2, grandchild2];
    const tree = buildSessionTree(child1, sessions);

    // Should include child1, parent, sibling child2, and sibling's child grandchild2
    const ids = tree.map((s) => s.originalId);
    expect(ids).toContain("child1");
    expect(ids).toContain("parent");
    expect(ids).toContain("child2");
    expect(ids).toContain("grandchild2");
  });

  it("handles session with no parent", () => {
    const sessions = createFlatSessions(3);
    const current = sessions[0]!;
    const tree = buildSessionTree(current, sessions);

    // Should only include the current session (no parent, no children)
    expect(tree).toHaveLength(1);
    expect(tree[0]!.originalId).toBe(current.originalId);
  });
});

describe("filterToCurrentSessionTree", () => {
  it("returns empty array for empty input", () => {
    expect(filterToCurrentSessionTree([])).toEqual([]);
  });

  it("returns current session tree", () => {
    const sessions = createSessionTree();
    const filtered = filterToCurrentSessionTree(sessions);

    // All sessions should be included since they're all connected
    expect(filtered).toHaveLength(4);
  });

  it("prioritizes busy session as current", () => {
    const now = Date.now();
    const busySession = createSession({
      id: "s1:busy",
      originalId: "busy",
      status: "busy",
      lastActivity: now - 10000, // older
    });
    const idleSession = createSession({
      id: "s1:idle",
      originalId: "idle",
      status: "idle",
      lastActivity: now - 1000, // newer
    });

    const filtered = filterToCurrentSessionTree([busySession, idleSession]);

    // Should include busy session (it's the current one)
    expect(filtered.some((s) => s.originalId === "busy")).toBe(true);
  });

  it("result is subset of input", () => {
    const sessions = createSessionTree();
    const filtered = filterToCurrentSessionTree(sessions);

    for (const s of filtered) {
      expect(sessions).toContainEqual(s);
    }
  });
});

describe("buildSessionTree edge cases", () => {
  it("handles parent that does not exist in session list", () => {
    // Session with parentId pointing to non-existent parent
    const orphan = createSession({
      id: "s1:orphan",
      originalId: "orphan",
      parentId: "nonexistent-parent",
    });

    const tree = buildSessionTree(orphan, [orphan]);

    // Should just include the orphan session
    expect(tree).toHaveLength(1);
    expect(tree[0]!.originalId).toBe("orphan");
  });

  it("handles session with no children in childrenMap", () => {
    // Single session with no children
    const lonely = createSession({
      id: "s1:lonely",
      originalId: "lonely",
    });

    const tree = buildSessionTree(lonely, [lonely]);

    expect(tree).toHaveLength(1);
    expect(tree[0]!.originalId).toBe("lonely");
  });

  it("handles siblings with no children", () => {
    const parent = createSession({
      id: "s1:parent",
      originalId: "parent",
    });
    const child1 = createSession({
      id: "s1:child1",
      originalId: "child1",
      parentId: "parent",
    });
    const child2 = createSession({
      id: "s1:child2",
      originalId: "child2",
      parentId: "parent",
    });

    const tree = buildSessionTree(child1, [parent, child1, child2]);

    // Should include child1, parent, and sibling child2
    const ids = tree.map((s) => s.originalId);
    expect(ids).toContain("child1");
    expect(ids).toContain("parent");
    expect(ids).toContain("child2");
    expect(tree).toHaveLength(3);
  });

  it("does not duplicate sessions already in result", () => {
    // Create a tree where the same session could be added multiple times
    const parent = createSession({
      id: "s1:parent",
      originalId: "parent",
    });
    const child = createSession({
      id: "s1:child",
      originalId: "child",
      parentId: "parent",
    });

    const tree = buildSessionTree(child, [parent, child]);

    // Each session should appear exactly once
    const ids = tree.map((s) => s.originalId);
    expect(ids.filter((id) => id === "parent")).toHaveLength(1);
    expect(ids.filter((id) => id === "child")).toHaveLength(1);
  });

  it("handles deeply nested tree", () => {
    const root = createSession({ id: "s1:root", originalId: "root" });
    const level1 = createSession({
      id: "s1:l1",
      originalId: "l1",
      parentId: "root",
    });
    const level2 = createSession({
      id: "s1:l2",
      originalId: "l2",
      parentId: "l1",
    });
    const level3 = createSession({
      id: "s1:l3",
      originalId: "l3",
      parentId: "l2",
    });

    const tree = buildSessionTree(root, [root, level1, level2, level3]);

    expect(tree).toHaveLength(4);
    expect(tree.map((s) => s.originalId).sort()).toEqual([
      "l1",
      "l2",
      "l3",
      "root",
    ]);
  });
});

describe("findCurrentSession edge cases", () => {
  it("handles single session", () => {
    const session = createSession({
      id: "s1:only",
      originalId: "only",
      status: "idle",
    });

    const current = findCurrentSession([session]);
    expect(current?.originalId).toBe("only");
  });

  it("picks most recent among multiple roots with same status", () => {
    const now = Date.now();
    const sessions = [
      createSession({
        id: "s1:root1",
        originalId: "root1",
        status: "idle",
        lastActivity: now - 5000,
      }),
      createSession({
        id: "s1:root2",
        originalId: "root2",
        status: "idle",
        lastActivity: now - 1000, // most recent
      }),
      createSession({
        id: "s1:root3",
        originalId: "root3",
        status: "idle",
        lastActivity: now - 3000,
      }),
    ];

    const current = findCurrentSession(sessions);
    expect(current?.originalId).toBe("root2");
  });

  it("handles retry status like busy", () => {
    const sessions = [
      createSession({
        id: "s1:idle",
        originalId: "idle",
        status: "idle",
      }),
      createSession({
        id: "s1:retry",
        originalId: "retry",
        status: "retry",
      }),
    ];

    // retry is not prioritized like busy/waiting_for_permission
    const current = findCurrentSession(sessions);
    // Should pick idle root since retry is not in the priority list
    expect(current?.originalId).toBe("idle");
  });
});
