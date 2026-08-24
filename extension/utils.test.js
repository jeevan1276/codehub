import { describe, it, expect, vi, beforeEach } from 'vitest';
import { slugify, getFileExtension, generateReadme, parseReadmeTable, base64Encode, debounce, generateId, formatBytes } from './utils.js';

describe('utils', () => {
  describe('slugify', () => {
    it('should convert text to lowercase and replace spaces with hyphens', () => {
      expect(slugify('Hello World')).toBe('hello-world');
    });

    it('should remove special characters', () => {
      expect(slugify('Hello@World!')).toBe('helloworld');
    });

    it('should handle multiple spaces', () => {
      expect(slugify('Hello   World')).toBe('hello-world');
    });

    it('should trim leading/trailing hyphens', () => {
      expect(slugify('  Hello World  ')).toBe('hello-world');
    });

    it('should handle empty string', () => {
      expect(slugify('')).toBe('');
    });
  });

  describe('getFileExtension', () => {
    it('should return correct extension for common languages', () => {
      expect(getFileExtension('python')).toBe('py');
      expect(getFileExtension('javascript')).toBe('js');
      expect(getFileExtension('typescript')).toBe('ts');
      expect(getFileExtension('cpp')).toBe('cpp');
      expect(getFileExtension('java')).toBe('java');
      expect(getFileExtension('c')).toBe('c');
      expect(getFileExtension('go')).toBe('go');
      expect(getFileExtension('rust')).toBe('rs');
    });

    it('should be case insensitive', () => {
      expect(getFileExtension('Python')).toBe('py');
      expect(getFileExtension('JAVASCRIPT')).toBe('js');
    });

    it('should return default for unknown languages', () => {
      expect(getFileExtension('unknown')).toBe('txt');
    });
  });

  describe('generateReadme', () => {
    it('should generate a markdown table with submissions', () => {
      const submissions = [
        {
          platform: 'leetcode',
          problemId: '1',
          problemName: 'Two Sum',
          problemUrl: 'https://leetcode.com/problems/two-sum/',
          language: 'python',
          code: 'def twoSum(self, nums, target):\n    pass',
          timestamp: '2024-01-01T00:00:00.000Z',
          verdict: 'Accepted',
          runtime: '45 ms',
          memory: '14.2 MB'
        }
      ];

      const readme = generateReadme(submissions);
      expect(readme).toContain('# CodeHub Submissions');
      expect(readme).toContain('| Platform | Problem | Language | Verdict | Runtime | Memory | Date |');
      expect(readme).toContain('LeetCode');
      expect(readme).toContain('Two Sum');
      expect(readme).toContain('Python');
      expect(readme).toContain('Accepted');
    });

    it('should handle empty submissions array', () => {
      const readme = generateReadme([]);
      expect(readme).toContain('# CodeHub Submissions');
      expect(readme).toContain('No submissions yet');
    });

    it('should sort submissions by date descending', () => {
      const submissions = [
        { platform: 'leetcode', problemId: '1', problemName: 'A', problemUrl: '', language: 'python', code: '', timestamp: '2024-01-01T00:00:00.000Z', verdict: 'Accepted' },
        { platform: 'leetcode', problemId: '2', problemName: 'B', problemUrl: '', language: 'python', code: '', timestamp: '2024-01-02T00:00:00.000Z', verdict: 'Accepted' }
      ];

      const readme = generateReadme(submissions);
      const indexA = readme.indexOf('A');
      const indexB = readme.indexOf('B');
      expect(indexB).toBeLessThan(indexA);
    });
  });

  describe('parseReadmeTable', () => {
    it('should parse markdown table back to submissions', () => {
      const readme = `# CodeHub Submissions

| Platform | Problem | Language | Verdict | Runtime | Memory | Date |
| --- | --- | --- | --- | --- | --- | --- |
| LeetCode | [Two Sum](https://leetcode.com/problems/two-sum/) | Python | Accepted | 45 ms | 14.2 MB | 2024-01-01 |`;

      const submissions = parseReadmeTable(readme);
      expect(submissions).toHaveLength(1);
      expect(submissions[0].platform).toBe('leetcode');
      expect(submissions[0].problemName).toBe('Two Sum');
      expect(submissions[0].language).toBe('python');
      expect(submissions[0].verdict).toBe('Accepted');
    });

    it('should return empty array for invalid readme', () => {
      expect(parseReadmeTable('')).toEqual([]);
      expect(parseReadmeTable('No table here')).toEqual([]);
    });
  });

  describe('base64Encode', () => {
    it('should encode UTF-8 strings correctly', () => {
      expect(base64Encode('hello')).toBe('aGVsbG8=');
      expect(base64Encode('Hello World!')).toBe('SGVsbG8gV29ybGQh');
      expect(base64Encode('🎉')).toBe('8J+YgA==');
    });

    it('should handle empty string', () => {
      expect(base64Encode('')).toBe('');
    });
  });

  describe('debounce', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('should delay function execution', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);
      
      debounced();
      expect(fn).not.toHaveBeenCalled();
      
      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should only call once for multiple rapid calls', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);
      
      debounced();
      debounced();
      debounced();
      
      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments to debounced function', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);
      
      debounced('arg1', 'arg2');
      vi.advanceTimersByTime(100);
      
      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(100);
    });

    it('should generate IDs with prefix', () => {
      const id = generateId('test');
      expect(id.startsWith('test_')).toBe(true);
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    });

    it('should handle decimal values', () => {
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(1572864)).toBe('1.5 MB');
    });
  });
});