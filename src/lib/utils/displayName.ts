export function applyNickname(
  data: any,
  currentUserId: string,
  nickname: string | null | undefined
): any {
  if (!nickname || !currentUserId || data == null) return data
  if (Array.isArray(data)) return data.map(item => applyNickname(item, currentUserId, nickname))
  if (typeof data !== 'object') return data
  const result: any = { ...data }
  if (result.id === currentUserId && Object.prototype.hasOwnProperty.call(result, 'full_name')) {
    result.full_name = nickname
  }
  for (const key of Object.keys(result)) {
    if (result[key] !== null && typeof result[key] === 'object') {
      result[key] = applyNickname(result[key], currentUserId, nickname)
    }
  }
  return result
}
