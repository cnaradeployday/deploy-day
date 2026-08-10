import Anthropic from '@anthropic-ai/sdk'

let cachedClient: Anthropic | null = null

function getClient() {
  if (!cachedClient) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('Falta configurar ANTHROPIC_API_KEY')
    cachedClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return cachedClient
}

export async function extractFromDocument({ base64, mediaType, systemPrompt, schema, instructions }: {
  base64: string
  mediaType: string
  systemPrompt: string
  schema: Record<string, unknown>
  instructions?: string
}): Promise<any> {
  const client = getClient()
  const documentBlock = mediaType.startsWith('image/')
    ? { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType as any, data: base64 } }
    : { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } }

  const response = await client.messages.parse({
    model: 'claude-opus-5',
    max_tokens: 8000,
    system: systemPrompt,
    output_config: { format: { type: 'json_schema', schema } },
    messages: [{
      role: 'user',
      content: [documentBlock, { type: 'text', text: instructions ?? 'Extraé los datos del documento según el schema indicado.' }],
    }],
  } as any)

  if ((response as any).stop_reason === 'refusal') throw new Error('La IA no pudo procesar este documento')
  const parsed = (response as any).parsed_output
  if (!parsed) throw new Error('No se pudo interpretar el documento')
  return parsed
}
