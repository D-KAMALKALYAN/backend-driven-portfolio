import { describe, it, expect } from 'vitest';
import { countWords, readingMinutes, formatPostDate } from '../utils/reading';

const block = (block_type: string, config: unknown, heading: string | null = null) => ({ block_type, heading, config: config as never });

describe('reading time', () => {
  it('counts words across every block type', () => {
    const blocks = [
      block('prose', { paragraphs: ['one two three', 'four five'], bullets: ['six'] }, 'Seven'),
      block('code', { snippet: 'eight nine', caption: 'ten' }),
      block('steps', { steps: [{ title: 'eleven', body: 'twelve thirteen' }] }),
      block('table', { columns: ['fourteen'], rows: [['fifteen', 'sixteen']] }),
      block('diagram', { ascii: 'seventeen' }),
    ];
    expect(countWords(blocks)).toBe(17);
  });

  it('never reports less than a minute, and rounds at ~200 wpm', () => {
    expect(readingMinutes([])).toBe(1);
    expect(readingMinutes([block('prose', { paragraphs: [Array(900).fill('w').join(' ')] })])).toBe(5);
  });

  it('ignores malformed config rather than throwing', () => {
    expect(countWords([block('prose', null), block('table', { rows: 'nope' }), block('steps', { steps: [null, 3] })])).toBe(0);
  });

  it('formats the publish date long-form and empty for drafts', () => {
    expect(formatPostDate('2026-09-16T05:00:00Z')).toBe('16 September 2026');
    expect(formatPostDate(null)).toBe('');
  });
});
