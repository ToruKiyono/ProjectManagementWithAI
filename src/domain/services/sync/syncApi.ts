export async function syncApi(requirementUrl: string, issueUrl: string) {
  const [requirementResponse, issueResponse] = await Promise.all([fetch(requirementUrl), fetch(issueUrl)]);
  if (!requirementResponse.ok) throw new Error(`需求接口失败: HTTP ${requirementResponse.status}`);
  if (!issueResponse.ok) throw new Error(`问题单接口失败: HTTP ${issueResponse.status}`);
  const [requirementPayload, issuePayload] = await Promise.all([requirementResponse.json(), issueResponse.json()]);
  return { requirementPayload, issuePayload };
}
