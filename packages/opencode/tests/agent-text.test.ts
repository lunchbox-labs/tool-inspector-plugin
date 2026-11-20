import assert from "node:assert/strict";
import { test } from "node:test";
import { agentAccessLines } from "../../core/src/agent-text.ts";
import { resolveToolAgentAccess } from "../../core/src/agents.ts";
import { linesText } from "../../core/src/schema-text.ts";
import { opencodeHost } from "../src/host.ts";

const allowAll = { permission: "*", pattern: "*", action: "allow" } as const;

function render(
  tool: string,
  agents: Parameters<typeof resolveToolAgentAccess>[1],
  options?: Parameters<typeof resolveToolAgentAccess>[2],
) {
  const [access] = resolveToolAgentAccess([tool], agents, options);
  return linesText(agentAccessLines(access, opencodeHost));
}

test("tools sharing a permission name it, with compact labels and no mode annotations", () => {
  assert.equal(
    render(
      "write",
      [
        { name: "docs", mode: "subagent", permission: [allowAll] },
        {
          name: "build",
          mode: "all",
          permission: [
            allowAll,
            { permission: "edit", pattern: "*.lock", action: "deny" },
          ],
        },
      ],
      { primaryTools: ["edit"] },
    ),
    [
      "Checked as the edit permission.",
      "build  Allow",
      "  *.lock: Deny",
      "docs  Deny",
    ].join("\n"),
  );
});

test("custom agents show only permissions, native hidden agents are left out, and unreadable rules are unknown", () => {
  assert.equal(
    render("read", [
      { name: "title", mode: "primary", native: true, hidden: true },
      {
        name: "reviewer",
        mode: "subagent",
        hidden: true,
        permission: [allowAll],
      },
      { name: "broken", mode: "primary", permission: "nope" },
    ]),
    ["broken  Unknown", "reviewer  Allow"].join("\n"),
  );
});

test("a tool no listed agent can run says so instead of rendering nothing", () => {
  assert.equal(
    render("read", [
      { name: "title", mode: "primary", native: true, hidden: true },
    ]),
    "OpenCode reported no agents that use tools.",
  );
});

test("path rules use compact labels and preserve precedence when patterns overlap", () => {
  assert.equal(
    render("read", [
      {
        name: "build",
        mode: "primary",
        permission: [
          allowAll,
          { permission: "read", pattern: ".env", action: "deny" },
          { permission: "read", pattern: "secrets/**", action: "ask" },
          { permission: "read", pattern: "secrets/public/*", action: "allow" },
        ],
      },
      {
        name: "plan",
        mode: "primary",
        permission: [{ permission: "read", pattern: "*", action: "ask" }],
      },
      {
        name: "explore",
        mode: "subagent",
        permission: [{ permission: "read", pattern: "*", action: "deny" }],
      },
    ]),
    [
      "build  Allow",
      "  .env: Deny",
      "  secrets/**: Ask",
      "  secrets/public/*: Allow",
      "plan  Ask",
      "explore  Deny",
    ].join("\n"),
  );
});
