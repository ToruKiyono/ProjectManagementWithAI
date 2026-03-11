import type { VersionInfo } from "./version";

export const requirementStages = [
  "需求基线",
  "需求澄清",
  "设计文档编写",
  "需求会签",
  "需求评审",
  "需求串讲",
  "需求开发（跟进度）",
  "需求转测",
  "问题单清理",
  "需求上线"
] as const;

export type RequirementStage = (typeof requirementStages)[number] | "未识别阶段";

export type Requirement = VersionInfo & {
  id: string;
  title: string;
  type: string;
  status: string;
  stage: RequirementStage;

  owner: string;
  tester: string;
  creator: string;
  module: string;

  progress: number;
  progressPercent: number;

  createTime: string;
  startDate: string;
  endDate: string;
  onlinePlanTime: string;

  workloadDay: number;
  workloadMonth: number;
  issueCount: number;
  tags: string[];
  priority: string;
  category: string;

  risk: string;
  riskOwner: string;
  stageDates: Record<string, string>;
  raw: Record<string, unknown>;
};
