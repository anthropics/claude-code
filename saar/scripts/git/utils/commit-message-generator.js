/**
 * Commit Message Generator
 * 
 * Generates meaningful commit messages based on file changes
 */

/**
 * Analyzes changes and generates appropriate commit messages
 */
class CommitMessageGenerator {
  constructor() {
    this.conventionalTypes = [
      'feat', 'fix', 'docs', 'style', 'refactor', 
      'perf', 'test', 'build', 'ci', 'chore'
    ];
    
    // Patterns that indicate different commit types
    this.typePatterns = {
      feat: [
        /new feature/i,
        /implement/i,
        /add .* functionality/i,
        /feature/i
      ],
      fix: [
        /fix/i,
        /bug/i,
        /issue/i,
        /error/i,
        /correct/i
      ],
      docs: [
        /document/i,
        /\.md$/,
        /comment/i,
        /README/i,
        /CHANGELOG/i
      ],
      style: [
        /style/i,
        /format/i,
        /whitespace/i,
        /css/i,
        /indent/i
      ],
      refactor: [
        /refactor/i,
        /restructure/i,
        /clean/i,
        /move/i,
        /rename/i
      ],
      perf: [
        /performance/i,
        /optimize/i,
        /fast/i,
        /speed/i,
        /memory/i
      ],
      test: [
        /test/i,
        /spec/i,
        /_test\.js$/,
        /\.test\./,
        /\.spec\./
      ],
      build: [
        /build/i,
        /webpack/i,
        /package/i,
        /dep/i
      ],
      ci: [
        /ci/i,
        /github action/i,
        /pipeline/i,
        /jenkins/i,
        /travis/i,
        /circle/i
      ],
      chore: [
        /chore/i,
        /maintenance/i,
        /update/i
      ]
    };
  }

  /**
   * Determine the most appropriate conventional commit type
   * @param {Array} files List of file objects
   * @param {Object} diffs Diff content
   * @returns {string} Commit type
   */
  determineCommitType(files, diffContent = '') {
    const fileTypes = {};
    
    // Initialize counter for each type
    this.conventionalTypes.forEach(type => {
      fileTypes[type] = 0;
    });
    
    // Analyze file paths
    for (const file of files) {
      const filePath = file.path;
      
      // Check each type's patterns against the file path
      for (const [type, patterns] of Object.entries(this.typePatterns)) {
        for (const pattern of patterns) {
          if (pattern.test(filePath)) {
            fileTypes[type]++;
            break;
          }
        }
      }
      
      // Special case for file operations based on status
      if (file.status === 'A') {
        fileTypes.feat += 2; // New files are likely features
      } else if (file.status === 'D') {
        fileTypes.refactor += 2; // Deleted files are likely refactoring
      }
    }
    
    // Also check diff content if provided
    if (diffContent) {
      for (const [type, patterns] of Object.entries(this.typePatterns)) {
        for (const pattern of patterns) {
          if (pattern.test(diffContent)) {
            fileTypes[type]++;
          }
        }
      }
    }
    
    // Get type with highest score
    let highestType = 'chore';
    let highestScore = 0;
    
    for (const [type, score] of Object.entries(fileTypes)) {
      if (score > highestScore) {
        highestScore = score;
        highestType = type;
      }
    }
    
    return highestType;
  }

  /**
   * Generate a scope based on file paths
   * @param {Array} files List of file objects
   * @returns {string|null} Scope or null if no common scope
   */
  determineScope(files) {
    if (files.length === 0) return null;
    
    // Find common directory as scope
    const pathParts = files.map(file => file.path.split('/'));
    const minDepth = Math.min(...pathParts.map(p => p.length));
    
    // Check for common elements at each level
    for (let i = 0; i < minDepth; i++) {
      const part = pathParts[0][i];
      if (pathParts.every(p => p[i] === part)) {
        // Found a common directory
        if (part && !['src', 'lib', 'app', 'test'].includes(part)) {
          return part;
        }
      } else {
        break;
      }
    }
    
    // Special case for test files
    if (files.every(file => file.path.includes('test'))) {
      return 'test';
    }
    
    return null;
  }

  /**
   * Extract keywords from file changes
   * @param {Array} files List of file objects
   * @param {string} diffContent Combined diff content
   * @returns {Array} List of keywords
   */
  extractKeywords(files, diffContent = '') {
    const keywords = new Set();
    
    // Extract from file paths
    for (const file of files) {
      const pathParts = file.path.split('/');
      
      // Get last directory and filename without extension
      const lastDir = pathParts.length > 1 ? pathParts[pathParts.length - 2] : null;
      const fileName = path.basename(file.path, path.extname(file.path));
      
      if (lastDir && !['src', 'lib', 'app', 'test'].includes(lastDir)) {
        keywords.add(lastDir);
      }
      
      if (fileName && !['index', 'main', 'app'].includes(fileName)) {
        keywords.add(fileName);
      }
    }
    
    // Extract from diff content if provided
    if (diffContent) {
      // Extract function/class names
      const functionMatches = diffContent.match(/function\s+(\w+)/g) || [];
      functionMatches.forEach(match => {
        const funcName = match.replace('function', '').trim();
        keywords.add(funcName);
      });
      
      const classMatches = diffContent.match(/class\s+(\w+)/g) || [];
      classMatches.forEach(match => {
        const className = match.replace('class', '').trim();
        keywords.add(className);
      });
    }
    
    return Array.from(keywords);
  }

  /**
   * Generate a commit message for a group of files
   * @param {Object} group Feature group
   * @returns {string} Commit message
   */
  generateCommitMessage(group) {
    const { files, name } = group;
    
    // Combine diff content for analysis
    const diffContent = files.map(file => file.diff).join('\n');
    
    // Determine commit type
    const type = this.determineCommitType(files, diffContent);
    
    // Determine scope
    const scope = this.determineScope(files);
    
    // Extract keywords
    const keywords = this.extractKeywords(files, diffContent);
    
    // Format commit message
    let message = type;
    
    if (scope) {
      message += `(${scope})`;
    }
    
    message += ': ';
    
    // Generate message based on feature name and keywords
    let subject = this._cleanupFeatureName(name);
    
    // Add some keywords if the subject is too generic
    if (subject.length < 15 && keywords.length > 0) {
      subject += ` ${keywords.slice(0, 2).join(' and ')}`;
    }
    
    message += subject;
    
    return message;
  }

  /**
   * Clean up feature name for commit message
   * @param {string} featureName Raw feature name
   * @returns {string} Cleaned up feature name
   * @private
   */
  _cleanupFeatureName(featureName) {
    // Remove prefix patterns
    let cleaned = featureName
      .replace(/^content\//, '')
      .replace(/^file-type\//, '')
      .replace(/^function\//, '')
      .replace(/^class\//, '');
    
    // Replace slashes with spaces
    cleaned = cleaned.replace(/\//g, ' ');
    
    // Ensure first letter is capital, rest are lowercase
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
    
    return cleaned;
  }
}

module.exports = CommitMessageGenerator;