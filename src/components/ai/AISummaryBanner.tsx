import type { HighlightedIssueRisk, HighlightedOwner, HighlightedRequirementRisk, ReleaseRiskAnalysis } from "../../domain/models/ai";

type Props = {
  recognitionCount: number;
  highlightedRequirements: HighlightedRequirementRisk[];
  highlightedIssues: HighlightedIssueRisk[];
  highlightedOwners: HighlightedOwner[];
  releaseResults: ReleaseRiskAnalysis[];
};

export function AISummaryBanner({ recognitionCount, highlightedRequirements, highlightedIssues, highlightedOwners, releaseResults }: Props) {
  const topRelease = [...releaseResults].sort((a, b) => ["无", "低", "中", "高"].indexOf(b.riskLevel) - ["无", "低", "中", "高"].indexOf(a.riskLevel))[0];
  const overall = topRelease?.riskLevel ?? (highlightedIssues.length || highlightedRequirements.length ? "中" : "低");
  const tone = overall === "高" ? "border-rose-200 bg-rose-50 text-rose-800" : overall === "中" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800";
  return (
    <section className={`panel ${tone}`}>
      <div className="flex flex-wrap items-center gap-3 text-sm font-medium">
        <span>已完成 AI 分析，共识别 {recognitionCount} 个表格</span>
        <span>发现 {highlightedRequirements.length} 个高风险需求</span>
        <span>发现 {highlightedIssues.length} 个高风险问题单</span>
        <span>需要立即提醒 {highlightedOwners.filter((item) => item.bucket === "立即提醒").length} 位责任人</span>
        <span>{topRelease ? `当前 ${topRelease.versionLine} ${topRelease.releaseVersion} 上线风险为${topRelease.riskLevel}` : "当前整体风险已完成评估"}</span>
      </div>
    </section>
  );
}
