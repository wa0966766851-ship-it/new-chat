export async function providerStatus(signal?: AbortSignal) {
  const response = await fetch('/api/battle-ai/status',{cache:'no-store',signal});
  if (!response.ok) throw Error('僅支援本機服務');
  const status = await response.json();
  if (!status.supported || typeof status.session !== 'string') throw Error('本機決策服務尚未就緒');
  return status as {supported:boolean; configured:boolean; remembered:boolean; canRemember:boolean; session:string};
}
export async function providerPost(route: 'key'|'decide', body: unknown, signal?: AbortSignal) {
  const status = await providerStatus(signal);
  const response = await fetch(`/api/battle-ai/${route}`,{method:'POST',signal,headers:{'Content-Type':'application/json','x-seer-ai-session':status.session},body:JSON.stringify(body)});
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw Error(data.error === 'KEY_MISSING' ? '尚未設定模型金鑰' : data.error === 'BUSY' ? '模型忙碌，使用本地決策' : /^PROVIDER_\d{3}$/.test(data.error) ? `模型服務回應 ${data.error.slice(9)}，使用本地決策` : '模型服務未完成請求，使用本地決策');
  }
  return response.json();
}
