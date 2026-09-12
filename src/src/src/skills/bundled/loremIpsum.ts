import { registerBundledSkill } from '../bundledSkills.js'

// Verified 1-token words (tested via API token counting)
// All common English words confirmed to tokenize as single tokens
const ONE_TOKEN_WORDS = [
  // Articles & pronouns
  'the',
  'a',
  'an',
  'I',
  'you',
  'he',
  'she',
  'it',
  'we',
  'they',
  'me',
  'him',
  'her',
  'us',
  'them',
  'my',
  'your',
  'his',
  'its',
  'our',
  'this',
  'that',
  'what',
  'who',
  // Common verbs
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'can',
  'could',
  'may',
  'might',
  'must',
  'shall',
  'should',
  'make',
  'made',
  'get',
  'got',
  'go',
  'went',
  'come',
  'came',
  'see',
  'saw',
  'know',
  'take',
  'think',
  'look',
  'want',
  'use',
  'find',
  'give',
  'tell',
  'work',
  'call',
  'try',
  'ask',
  'need',
  'feel',
  'seem',
  'leave',
  'put',
  // Common nouns & adjectives
  'time',
  'year',
  'day',
  'way',
  'man',
  'thing',
  'life',
  'hand',
  'part',
  'place',
  'case',
  'point',
  'fact',
  'good',
  'new',
  'first',
  'last',
  'long',
  'great',
  'little',
  'own',
  'other',
  'old',
  'right',
  'big',
  'high',
  'small',
  'large',
  'next',
  'early',
  'young',
  'few',
  'public',
  'bad',
  'same',
  'able',
  // Prepositions & conjunctions
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'from',
  'by',
  'about',
  'like',
  'through',
  'over',
  'before',
  'between',
  'under',
  'since',
  'without',
  'and',
  'or',
  'but',
  'if',
  'than',
  'because',
  'as',
  'until',
  'while',
  'so',
  'though',
  'both',
  'each',
  'when',
  'where',
  'why',
  'how',
  // Common adverbs
  'not',
  'now',
  'just',
  'more',
  'also',
  'here',
  'there',
  'then',
  'only',
  'very',
  'well',
  'back',
  'still',
  'even',
  'much',
  'too',
  'such',
  'never',
  'again',
  'most',
  'once',
  'off',
  'away',
  'down',
  'out',
  'up',
  // Tech/common words
  'test',
  'code',
  'data',
  'file',
  'line',
  'text',
  'word',
  'number',
  'system',
  'program',
  'set',
  'run',
  'value',
  'name',
  'type',
  'state',
  'end',
  'start',
]

function generateLoremIpsum(targetTokens: number): string {
  let tokens = 0
  let result = ''

  while (tokens < targetTokens) {
    // Sentence: 10-20 words
    const sentenceLength = 10 + Math.floor(Math.random() * 11)
    let wordsInSentence = 0

    for (let i = 0; i < sentenceLength && tokens < targetTokens; i++) {
      const word =
        ONE_TOKEN_WORDS[Math.floor(Math.random() * ONE_TOKEN_WORDS.length)]
      result += word
      tokens++
      wordsInSentence++

      if (i === sentenceLength - 1 || tokens >= targetTokens) {
        result += '. '
      } else {
        result += ' '
      }
    }

    // Paragraph break every 5-8 sentences (roughly 20% chance per sentence)
    if (wordsInSentence > 0 && Math.random() < 0.2 && tokens < targetTokens) {
      result += '\n\n'
    }
  }

  return result.trim()
}

export function registerLoremIpsumSkill(): void {
  if (process.env.USER_TYPE !== 'ant') {
    return
  }

  registerBundledSkill({
    name: 'lorem-ipsum',
    description:
      'Generate filler text for long context testing. Specify token count as argument (e.g., /lorem-ipsum 50000). Outputs approximately the requested number of tokens. Ant-only.',
    argumentHint: '[token_count]',
    userInvocable: true,
    async getPromptForCommand(args) {
      const parsed = parseInt(args)

      if (args && (isNaN(parsed) || parsed <= 0)) {
        return [
          {
            type: 'text',
            text: 'Invalid token count. Please provide a positive number (e.g., /lorem-ipsum 10000).',
          },
        ]
      }

      const targetTokens = parsed || 10000

      // Cap at 500k tokens for safety
      const cappedTokens = Math.min(targetTokens, 500_000)

      if (cappedTokens < targetTokens) {
        return [
          {
            type: 'text',
            text: `Requested ${targetTokens} tokens, but capped at 500,000 for safety.\n\n${generateLoremIpsum(cappedTokens)}`,
          },
        ]
      }

      const loremText = generateLoremIpsum(cappedTokens)

      // Just dump the lorem ipsum text into the conversation
      return [
        {
          type: 'text',
          text: loremText,
        },
      ]
    },
  })
}
