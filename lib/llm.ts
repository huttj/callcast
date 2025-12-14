/**
 * LLM utilities for OpenRouter API
 */

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Call LLM via OpenRouter
 */
export async function callLLM(
  messages: Message[],
  maxTokens: number = 4000
): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/yourusername/callcast',
      'X-Title': 'Callcast Research Tool'
    },
    body: JSON.stringify({
      model: 'anthropic/claude-4.5-sonnet',
      messages: messages,
      max_tokens: maxTokens
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  let content = data.choices[0]?.message?.content;

  // Handle both string and array content formats
  if (Array.isArray(content)) {
    content = content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('');
  }

  return typeof content === 'string' ? content.trim() : '';
}
