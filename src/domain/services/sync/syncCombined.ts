export async function syncCombined(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`单接口同步失败: HTTP ${response.status}`);
  return response.json();
}
