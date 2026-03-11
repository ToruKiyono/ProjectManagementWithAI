import { buildHuaweiIssuePayload } from "../normalize/mapHuaweiIssue";

export async function syncHuaweiIssues(url: string) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildHuaweiIssuePayload())
  });
  if (!response.ok) throw new Error(`华为问题单同步失败: HTTP ${response.status}`);
  return response.json();
}
