import type {
  AccessDecision,
  AgentToolAccess,
  ToolAgentAccess,
} from "./agents.ts";
import type { AccessNotes, Host } from "./host.ts";
import type { TextLine, TextSegment } from "./schema-text.ts";

type ActionLabels = Host["actionLabels"];

function muted(text: string): TextSegment {
  return { text, tone: "muted" };
}

function decisionSummary(
  decision: AccessDecision,
  actionLabels: ActionLabels,
): string {
  if (decision.access === "unknown") {
    return "Unknown";
  }
  if (decision.offeredToModel === false) {
    return actionLabels.deny;
  }
  return actionLabels[decision.access];
}

function exceptionLines(
  decision: AccessDecision,
  actionLabels: ActionLabels,
): TextLine[] {
  if (decision.offeredToModel === false) {
    return [];
  }
  return decision.exceptions.map((exception) => [
    { text: `  ${exception.pattern}`, tone: "name" },
    muted(`: ${actionLabels[exception.access]}`),
  ]);
}

function agentLines(
  agent: AgentToolAccess,
  actionLabels: ActionLabels,
): TextLine[] {
  return [
    [
      { text: agent.agent, tone: "name" },
      muted(`  ${decisionSummary(agent, actionLabels)}`),
    ],
    ...exceptionLines(agent, actionLabels),
  ];
}

/** The host's own hidden agents, such as `compaction` and `title`, never take tool calls. */
function listed(agent: AgentToolAccess): boolean {
  return !(agent.native && agent.hidden);
}

function primaryFirst(left: AgentToolAccess, right: AgentToolAccess): number {
  const rank = (agent: AgentToolAccess) => (agent.mode === "subagent" ? 1 : 0);
  return rank(left) - rank(right);
}

function notesFor(
  notes: Readonly<Record<string, readonly string[]>> | undefined,
  key: string,
): readonly string[] {
  return notes !== undefined && Object.hasOwn(notes, key) ? notes[key] : [];
}

function accessNoteLines(
  notes: AccessNotes,
  access: ToolAgentAccess,
): TextLine[] {
  return [
    ...(notes.always ?? []),
    ...notesFor(notes.permission, access.permission),
    ...notesFor(notes.tool, access.tool),
  ].map((note) => [muted(note)]);
}

/** Renders which agents can use a tool, primary agents first. */
export function agentAccessLines(
  access: ToolAgentAccess,
  host: Host,
): TextLine[] {
  const { actionLabels } = host;
  const agents = access.agents.filter(listed).sort(primaryFirst);
  if (agents.length === 0) {
    return [[muted(`${host.name} reported no agents that use tools.`)]];
  }
  const permissionNote: TextLine[] =
    access.permission === access.tool
      ? []
      : [[muted(`Checked as the ${access.permission} permission.`)]];
  return [
    ...permissionNote,
    ...accessNoteLines(host.accessNotes, access),
    ...agents.flatMap((agent) => agentLines(agent, actionLabels)),
  ];
}
