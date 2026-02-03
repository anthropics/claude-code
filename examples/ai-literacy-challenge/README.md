# AI Literacy Challenge

An interactive educational game designed to teach AI concepts through three progressive levels.

## Overview

DR.DE.SOUZ.AI - AI Literacy Challenge is a gamified learning platform that teaches artificial intelligence concepts through:

- **🟢 Level 1: Fundação (Foundation)** - Basic AI concepts including what AI is, GenAI vs Predictive AI, Neural Networks, and fundamental algorithms
- **🟡 Level 2: Competência (Competency)** - Practical skills including Prompt Science, Hallucination, Tokens, RAG, and Context Window
- **🔴 Level 3: Maestria (Mastery)** - Advanced topics including Chain of Thought, Temperature parameters, Epistemic Agency, and the 2 Sigma Problem

## Features

- **Progressive Learning**: Levels unlock as you complete previous ones
- **Gamification**: Score system with streaks, combos, and global leaderboards
- **Bilingual**: Presented in Portuguese (Brazilian)
- **Mobile-Responsive**: Works on all device sizes
- **Engaging UI**: Vibrant animations and interactive feedback
- **Educational Videos**: Placeholder for 8-second concept videos (recommended: Gemini V3)

## How to Use

1. Open `index.html` in a web browser
2. Enter your name
3. Select a level (start with Level 1)
4. Watch the concept video or skip it
5. Answer 5 questions per level
6. See your global ranking and stats

## Technical Details

- **No Dependencies**: Pure HTML, CSS, and JavaScript
- **Local Storage**: Progress is saved in browser localStorage
- **Storage API**: Uses optional `window.storage` API for global leaderboards (gracefully degrades if not available)

## Educational Concepts Covered

### Level 1: Foundation (Literacy)
- Science of the Artificial
- Predictive AI vs Generative AI
- Large Language Models (LLMs)
- Neural Networks
- AI Algorithms

### Level 2: Competency (Skills)
- Prompt Science
- Hallucination (Epistemic Noise)
- Tokens
- Context Window
- RAG (Retrieval Augmented Generation)

### Level 3: Mastery (Science)
- Chain of Thought (CoT)
- Temperature Hyperparameter
- Epistemic Agency
- 2 Sigma Problem
- Sandwich Method

## Customization

To add video content:
1. Replace the `.video-placeholder` section with actual video elements
2. Update the `videoUrl` field in the `levels` object in the JavaScript
3. Videos should be ~8 seconds for optimal engagement

## Credits

Created for AI education and literacy purposes.

## License

See repository LICENSE file.
