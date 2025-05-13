/**
 * Code Analyzer module for detecting relationships between code files
 * 
 * Helps identify related code changes for feature-based commit splitting
 */

const fs = require('fs');
const path = require('path');

/**
 * Analyzes code relationships between files
 */
class CodeAnalyzer {
  constructor() {
    this.dependencyGraph = new Map();
    this.importPatterns = {
      javascript: [
        /import\s+.*\s+from\s+['"](.+)['"]/g,
        /require\s*\(\s*['"](.+)['"]\s*\)/g
      ],
      python: [
        /import\s+(\w+)/g,
        /from\s+(\w+)\s+import/g
      ],
      ruby: [
        /require\s+['"](.+)['"]/g,
        /require_relative\s+['"](.+)['"]/g
      ],
      java: [
        /import\s+([\w.]+)/g
      ],
      go: [
        /import\s+\(\s*([\s\S]*?)\s*\)/g,
        /import\s+["'](.+)["']/g
      ]
    };
  }

  /**
   * Build dependency graph from repository files
   * @param {string} rootDir Root directory to analyze
   */
  buildDependencyGraph(rootDir) {
    this.dependencyGraph.clear();
    this._scanDirectory(rootDir);
    return this.dependencyGraph;
  }

  /**
   * Recursively scan directory for code files
   * @param {string} directory Directory to scan
   * @private
   */
  _scanDirectory(directory) {
    try {
      const entries = fs.readdirSync(directory, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);
        
        // Skip node_modules, .git, etc.
        if (entry.name === 'node_modules' || entry.name === '.git') {
          continue;
        }
        
        if (entry.isDirectory()) {
          this._scanDirectory(fullPath);
        } else if (entry.isFile()) {
          this._analyzeFile(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${directory}: ${error.message}`);
    }
  }

  /**
   * Analyze a single file for dependencies
   * @param {string} filePath Path to file
   * @private
   */
  _analyzeFile(filePath) {
    try {
      const ext = path.extname(filePath).toLowerCase();
      const language = this._detectLanguage(ext);
      
      if (!language) return; // Unsupported file type
      
      const content = fs.readFileSync(filePath, 'utf8');
      const dependencies = this._extractDependencies(content, language);
      
      this.dependencyGraph.set(filePath, dependencies);
    } catch (error) {
      // Ignore errors for files we can't read
    }
  }

  /**
   * Detect language from file extension
   * @param {string} extension File extension
   * @returns {string|null} Language name or null if unsupported
   * @private
   */
  _detectLanguage(extension) {
    const langMap = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'javascript',
      '.tsx': 'javascript',
      '.py': 'python',
      '.rb': 'ruby',
      '.java': 'java',
      '.go': 'go'
    };
    
    return langMap[extension] || null;
  }

  /**
   * Extract dependencies from file content
   * @param {string} content File content
   * @param {string} language Programming language
   * @returns {Array} Array of dependencies
   * @private
   */
  _extractDependencies(content, language) {
    const patterns = this.importPatterns[language] || [];
    const dependencies = new Set();
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (match[1]) {
          dependencies.add(match[1]);
        }
      }
    }
    
    return Array.from(dependencies);
  }

  /**
   * Find related files based on imports/dependencies
   * @param {Array} filePaths List of file paths
   * @param {number} depth Max depth for relationship search
   * @returns {Array} List of related file paths
   */
  findRelatedFiles(filePaths, depth = 1) {
    const related = new Set(filePaths);
    const visited = new Set();
    
    const findRelated = (files, currentDepth) => {
      if (currentDepth > depth) return;
      
      for (const file of files) {
        if (visited.has(file)) continue;
        visited.add(file);
        
        // Find files that import this file
        for (const [potentialImporter, dependencies] of this.dependencyGraph.entries()) {
          const importerPathParts = potentialImporter.split(path.sep);
          const filePathParts = file.split(path.sep);
          
          // Check if any import matches this file (by path or module name)
          const isRelated = dependencies.some(dep => {
            // Check direct path
            if (potentialImporter.includes(file)) return true;
            
            // Check module name (last part of path without extension)
            const fileModule = path.basename(file, path.extname(file));
            return dep.includes(fileModule);
          });
          
          if (isRelated) {
            related.add(potentialImporter);
          }
        }
      }
      
      // Recursively find next level of related files
      const newFiles = Array.from(related).filter(f => !visited.has(f));
      if (newFiles.length > 0) {
        findRelated(newFiles, currentDepth + 1);
      }
    };
    
    findRelated(filePaths, 0);
    return Array.from(related);
  }

  /**
   * Group related files into clusters
   * @param {Array} filePaths List of file paths
   * @returns {Array} Clusters of related files
   */
  groupRelatedFiles(filePaths) {
    const clusters = [];
    const remainingFiles = new Set(filePaths);
    
    while (remainingFiles.size > 0) {
      // Take first remaining file as seed
      const seed = Array.from(remainingFiles)[0];
      const related = this.findRelatedFiles([seed], 2);
      
      // Create a cluster with all related files
      const cluster = related.filter(file => remainingFiles.has(file));
      clusters.push(cluster);
      
      // Remove these files from remaining set
      cluster.forEach(file => remainingFiles.delete(file));
    }
    
    return clusters;
  }

  /**
   * Analyze how files are related to common features/modules
   * @param {Array} filePaths List of file paths
   * @returns {Object} Map of features to related files
   */
  analyzeFeatureRelationships(filePaths) {
    const features = {};
    
    // Extract common path components as potential features
    const pathComponents = new Map();
    
    for (const filePath of filePaths) {
      const parts = filePath.split(path.sep);
      
      // Register each path component
      for (let i = 0; i < parts.length - 1; i++) {
        const component = parts[i];
        if (!pathComponents.has(component)) {
          pathComponents.set(component, []);
        }
        pathComponents.get(component).push(filePath);
      }
    }
    
    // Convert to features, focusing on components with multiple files
    for (const [component, files] of pathComponents.entries()) {
      if (files.length > 1) {
        features[component] = files;
      }
    }
    
    return features;
  }
}

module.exports = CodeAnalyzer;