import type {
  IntelligenceRequest,
  ContingencyInput,
} from "@/schemas/intelligence";
export const numericalClaim =
  /\d|[%$₹€£¥]|\b(?:INR|USD|EUR|GBP|JPY|rupees?|dollars?|euros?|pounds?|yen|paise|cents?|percent(?:age)?s?)\b/i;
export type IntelligenceOptions = {
  operation: IntelligenceRequest["operation"];
  question?: string;
  preferences?: string;
  contingency?: ContingencyInput;
  tone?: IntelligenceRequest["tone"];
  length?: IntelligenceRequest["length"];
};
export function exactFinancialQuestion(question: string) {
  return (
    /budget|money|fund|spen[dt]|paid|commit|balance/i.test(question) &&
    /how much|remain|left|available|total|spent|paid|commit/i.test(question)
  );
}
export const kindFor = {
  "ask-plan": "answer",
  "contingency-playbook": "playbook",
  "task-suggestions": "tasks",
  "invitation-refinement": "invitation",
} as const;
