import { runAnalyst, type AnalystInput } from "@/lib/ai/agents/analyst";
import {
  runContentWriter,
  type ContentWriterInput,
} from "@/lib/ai/agents/content-writer";
import {
  runJourneyOrchestrator,
  type JourneyOrchestratorInput,
} from "@/lib/ai/agents/journey-orchestrator";
import {
  runSegmenter,
  type SegmenterInput,
  type StandardizedSegment,
} from "@/lib/ai/agents/segmenter";
import {
  runSupervisor,
  type SupervisorInput,
  type SupervisorPlan,
} from "@/lib/ai/agents/supervisor";
import type {
  GeneratedMessage,
  JourneyStep,
  KpiSuggestion,
} from "@/lib/ai/schemas";

type AgentInputMap = {
  supervisor: SupervisorInput;
  segmenter: SegmenterInput;
  "content-writer": ContentWriterInput;
  "journey-orchestrator": JourneyOrchestratorInput;
  analyst: AnalystInput;
};

type AgentOutputMap = {
  supervisor: SupervisorPlan;
  segmenter: StandardizedSegment;
  "content-writer": { prompt: string; variants: GeneratedMessage[] };
  "journey-orchestrator": JourneyStep[];
  analyst: KpiSuggestion[];
};

type AgentRegistry = {
  [Key in keyof AgentInputMap]: (
    input: AgentInputMap[Key],
  ) => AgentOutputMap[Key] | Promise<AgentOutputMap[Key]>;
};

const registry: AgentRegistry = {
  supervisor: runSupervisor,
  segmenter: runSegmenter,
  "content-writer": runContentWriter,
  "journey-orchestrator": runJourneyOrchestrator,
  analyst: runAnalyst,
};

export async function runAgent<Name extends keyof AgentInputMap>(
  name: Name,
  input: AgentInputMap[Name],
): Promise<AgentOutputMap[Name]> {
  return registry[name](input);
}
