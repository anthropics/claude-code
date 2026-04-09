import { describe, it, expect } from 'bun:test';
import { extractDuplicateIssueNumber, mergeLabels } from './auto-close-duplicates';

describe('extractDuplicateIssueNumber', () => {
  it('extracts issue number from inline #N format', () => {
    expect(extractDuplicateIssueNumber('This is a duplicate of #123')).toBe(123);
  });

  it('extracts issue number from a GitHub issue URL', () => {
    const body =
      'Found 1 possible duplicate issues:\n\n' +
      '1. https://github.com/anthropics/claude-code/issues/456\n\n' +
      'This issue will be automatically closed as a duplicate in 3 days.';
    expect(extractDuplicateIssueNumber(body)).toBe(456);
  });

  it('returns the first URL when multiple duplicates are listed', () => {
    const body =
      'Found 2 possible duplicate issues:\n\n' +
      '1. https://github.com/anthropics/claude-code/issues/100\n' +
      '2. https://github.com/anthropics/claude-code/issues/200\n\n' +
      'This issue will be automatically closed as a duplicate in 3 days.';
    expect(extractDuplicateIssueNumber(body)).toBe(100);
  });

  it('returns null when the comment contains no issue reference', () => {
    expect(extractDuplicateIssueNumber('No issue reference here at all.')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(extractDuplicateIssueNumber('')).toBeNull();
  });
});

describe('mergeLabels', () => {
  it('adds the label to an empty list', () => {
    expect(mergeLabels([], 'duplicate')).toEqual(['duplicate']);
  });

  it('preserves existing triage labels when adding duplicate', () => {
    const result = mergeLabels(['bug', 'has repro', 'platform:macos', 'area:sandbox'], 'duplicate');
    expect(result).toContain('bug');
    expect(result).toContain('has repro');
    expect(result).toContain('platform:macos');
    expect(result).toContain('area:sandbox');
    expect(result).toContain('duplicate');
  });

  it('does not add the label a second time when already present', () => {
    const result = mergeLabels(['bug', 'duplicate'], 'duplicate');
    expect(result.filter((l) => l === 'duplicate')).toHaveLength(1);
  });

  it('returns the original array unchanged when label is already present', () => {
    const existing = ['bug', 'duplicate'];
    expect(mergeLabels(existing, 'duplicate')).toEqual(['bug', 'duplicate']);
  });

  it('does not mutate the original array', () => {
    const original = ['bug', 'has repro'];
    const result = mergeLabels(original, 'duplicate');
    expect(original).toEqual(['bug', 'has repro']); // unchanged
    expect(result).toHaveLength(3);
  });
});
