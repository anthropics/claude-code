// ... existing code ...

// Update the usage policy to allow lattice gauge theory questions
const allowedTopics = [
  // ... existing allowed topics ...
  'lattice gauge theory',
  'periodic-lattice correlators',
  'mass extraction',
];

const isAllowedTopic = (question: string) => {
  return allowedTopics.some((topic) => question.includes(topic));
};

// ... existing code ...

// Update the usage policy check to use the new allowed topics list
const checkUsagePolicy = (question: string) => {
  if (isAllowedTopic(question)) {
    return true;
  }
  // ... existing usage policy checks ...
};

// ... existing code ...