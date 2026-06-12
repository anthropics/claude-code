const { Classifier } = require('@anthropic-ai/classifiers');

class ContentModerationPlugin {
  constructor() {
    this.classifier = new Classifier({
      // Update the classifier to ignore common software/content-QA terms
      ignoreTerms: [
        'reward-hack',
        'anti-gaming gate',
        'adversarial verify',
        // Add other common terms that may trigger false positives
      ],
    });
  }

  async moderateContent(content) {
    // Use the updated classifier to moderate content
    const result = await this.classifier.classify(content);
    if (result.score < 0.5) {
      // If the score is below the threshold, do not flag as cybersecurity
      return { flagged: false, reason: 'Legitimate content' };
    }
    // Otherwise, flag as potential cybersecurity threat
    return { flagged: true, reason: 'Potential cybersecurity threat' };
  }
}

module.exports = ContentModerationPlugin;