import { normalizeIssue } from "./normalizeIssue";

type HuaweiAttr = {
  attr_name?: string;
  attrNameEn?: string;
  attr_value?: unknown;
};

function getExtendAttrValue(item: Record<string, unknown>, attrNames: string[]): string {
  const attrs = Array.isArray(item.extendAttrs) ? (item.extendAttrs as HuaweiAttr[]) : [];
  const target = attrs.find((attr) => attrNames.includes(attr.attr_name || "") || attrNames.includes(attr.attrNameEn || ""));
  if (!target) return "";
  const raw = target.attr_value;
  if (raw && typeof raw === "object") {
    const objectValue = raw as Record<string, unknown>;
    return String(objectValue.enum_value || objectValue.value || objectValue.name || "");
  }
  return String(raw || "");
}

export function buildHuaweiIssuePayload() {
  return {
    sorts: [
      { key: "severity", value: "desc" },
      { key: "updated_time", value: "desc" }
    ],
    filters: [
      { key: "scene", operator: "||", value: ["issue_bug"] },
      { key: "current_domain", operator: "||", value: [22142] },
      { key: "extendAttr", operator: "||", value: [21268] },
      {
        key: "status",
        operator: "||",
        value: [
          "ISSUE_STATUS_SUBMIT",
          "ISSUE_STATUS_ANALYSIS",
          "ISSUE_STATUS_FIXING",
          "ISSUE_STATUS_VERIFYING",
          "ISSUE_STATUS_REGRESSION_TEST",
          "ISSUE_STATUS_RETURNED"
        ]
      },
      {
        key: "assigned_domain",
        value: [{ id: 22142, type: "Domain" }],
        operator: "||",
        convolution: "down"
      },
      { key: "category", operator: "||", value: ["04000001", "04000002", "04000003"] }
    ],
    pagination: { current_page: 1, page_size: "100" },
    with_children: true,
    view: "receive",
    data_type: "tree",
    request_tag: Date.now()
  };
}

export function mapHuaweiIssue(input: Record<string, unknown>) {
  const ownerObj = (input.owner || input.assignee || input.testOperator || {}) as Record<string, unknown>;
  const assigneeObj = (input.assignee || {}) as Record<string, unknown>;
  const testObj = (input.testOperator || input.verifier || {}) as Record<string, unknown>;
  const devObj = (input.developer || input.devOwner || {}) as Record<string, unknown>;
  const story = (input.story || input.requirement || {}) as Record<string, unknown>;

  const ownerName =
    String(ownerObj.name || ownerObj.name_full || ownerObj.username || ownerObj.account || "") ||
    String(assigneeObj.name || assigneeObj.username || assigneeObj.account || "") ||
    String(testObj.name || testObj.username || testObj.account || "");

  return normalizeIssue({
    id: String(input.number || input.id || ""),
    title: String(input.title || input.subject || input.name || "未命名问题"),
    subject: String(input.subject || input.title || input.name || "未命名问题"),
    问题描述: input.description || input.content || input.desc || getExtendAttrValue(input, ["问题描述", "Description", "描述"]),
    交付场景: getExtendAttrValue(input, ["交付场景", "Delivery Scene", "Scene", "场景"]) || input.scene || input.sceneName || "",
    版本: getExtendAttrValue(input, ["版本", "Version", "发现版本"]) || input.version || input.fixVersion || "",
    发现迭代: getExtendAttrValue(input, ["发现迭代", "Iteration", "迭代"]) || input.iteration || input.version || "",
    发现问题版本: getExtendAttrValue(input, ["发现问题版本", "Found Version", "版本", "Version"]) || input.version || input.fixVersion || "",
    发现版本: getExtendAttrValue(input, ["发现版本", "Detected Version"]) || input.release || "",
    发布计划: getExtendAttrValue(input, ["发布计划", "Release Plan"]) || input.release || "",
    团队: getExtendAttrValue(input, ["团队", "Team"]) || input.teamName || "",
    解决计划: getExtendAttrValue(input, ["解决计划", "Solution Plan"]) || input.solutionPlan || "",
    关联工作项:
      input.requirementId ||
      input.requirementNo ||
      input.requirement_number ||
      input.story_no ||
      story.number ||
      story.id ||
      getExtendAttrValue(input, ["关联需求号", "需求号", "Story No"]),
    严重程度: input.severity || "",
    问题状态: input.status || "",
    问题阶段: getExtendAttrValue(input, ["问题阶段", "Issue Stage", "Stage"]) || input.phase || input.stage || "",
    问题类别: getExtendAttrValue(input, ["类别", "Category"]) || input.category || "",
    优先级: getExtendAttrValue(input, ["优先级", "Priority"]) || input.priority || "",
    发现环境: getExtendAttrValue(input, ["环境", "Environment"]) || input.environment || "",
    发现阶段: getExtendAttrValue(input, ["发现阶段", "Found Phase"]) || "",
    发现方式: getExtendAttrValue(input, ["发现方式", "Found Way"]) || "",
    发现站点: getExtendAttrValue(input, ["发现地点", "Found Site", "发现站点"]) || "",
    发现服务: getExtendAttrValue(input, ["发现服务", "Found Service"]) || "",
    影响范围: getExtendAttrValue(input, ["影响范围", "Affect Scope"]) || "",
    问题根因: getExtendAttrValue(input, ["问题根因", "Root Cause"]) || input.rootCause || "",
    结论简述: getExtendAttrValue(input, ["结论简述", "Conclusion Summary"]) || input.conclusion || "",
    结论描述: input.conclusionDesc || "",
    责任人: ownerName,
    当前责任人: ownerName,
    研发责任人: String(devObj.name || devObj.username || devObj.account || ""),
    测试责任人: String(testObj.name || testObj.username || testObj.account || ""),
    问题创建时间: input.createdAt || input.created_time || input.create_time || "",
    承诺修复时间: input.dueDate || input.planCloseDate || input.expectedCloseDate || input.deadline || "",
    接纳时间: input.acceptTime || "",
    开始修复时间: input.fixStartTime || "",
    转测时间: input.transferTestTime || "",
    修复完成时间: input.fixedTime || "",
    上线时间: input.onlineTime || "",
    问题关闭时间: input.closeTime || "",
    "遗留问题评审：原因分析": getExtendAttrValue(input, ["遗留问题评审：原因分析", "Legacy Reason Analysis"]) || "",
    "遗留问题评审：规避措施": getExtendAttrValue(input, ["遗留问题评审：规避措施", "Legacy Mitigation"]) || "",
    "遗留问题评审：用户影响": getExtendAttrValue(input, ["遗留问题评审：用户影响", "Legacy User Impact"]) || ""
  }, 0);
}
