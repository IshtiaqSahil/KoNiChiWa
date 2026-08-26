// Contract defined in design/AGENT_CONNECTION_INTERFACE_PROPOSAL_EN.md

export type Language = "en" | "zh" | "ja";

export interface WalletContact {
  name: string;
  address: string;
}

export interface ScenarioContext {
  wallet_balance: number;
  spending_limit: number;
  contacts: WalletContact[];
}

export interface AgentInvokeRequest {
  scenario_id: string;
  language: Language;
  message: string;
  context: ScenarioContext;
}

export type AgentActionType = "transfer" | "clarify" | "refuse" | "none";

export interface AgentAction {
  type: AgentActionType;
  asset?: string;
  amount?: number;
  recipient?: string;
}

export interface AgentInvokeResponse {
  reply: string;
  action: AgentAction | null;
}

export interface AgentEndpointConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
}
