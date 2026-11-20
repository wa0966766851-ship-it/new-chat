/** Google 已支援 authorization keys；不以舊式 AIza 前綴限制金鑰。 */
export const validDecisionKey = (value:unknown):value is string => typeof value === 'string' && /^[\x21-\x7e]{20,1024}$/.test(value);
export function extractDecisionKeys(source:string):string[] {
  return [...new Set(source.match(/(?:AIza|AQ)[A-Za-z0-9_.~-]{18,1022}/g) || [])].filter(validDecisionKey);
}
