# 🎯 Claude Model Selection Guide

***Choose the right Claude model for your task complexity and requirements***
***The right tool for  the  right job!***

This guide helps you pick the right Claude model for a task based on complexity, latency, cost, and context size. Use it to balance capability and budget across development, debugging, and automation workflows.

Key points:

- Consider complexity (simple → Haiku 3.5, standard dev → Sonnet 4, deep reasoning → Opus 4.1).
- Prioritize latency and cost for quick iteractions; prioritize capability for architecture, audits, and complex debugging.
- Default recommendation: Sonnet 4 for daily development; escalate to Opus 4.1 for multi-step planning or heavy analysis; use Haiku 3.5 for fast, low-cost jobs.
- Configure via environment variables (CLAUDE_CODE_MODEL, CLAUDE_CODE_MAX_TOKENS) and switch models per workflow needs — examples and tradeoffs follow.
- Refer to the sections below for model specs, example prompts, configuration snippets, and switching strategy.

## 📊 Model Hierarchy (2025)

| Model | Strength | Best For | Speed | Cost (Input/Output) |
|-------|----------|----------|--------|---------------------|
| 🚀 **Opus 4.1** | Strongest | Complex tasks, planning | Slower | $15/$75 per 1M tokens |
| 🎯 **Sonnet 4** | Balanced | Daily development tasks | Medium | $3/$15 per 1M tokens |
| ⚡ **Haiku 3.5** | Fastest | Quick, simple tasks | Fastest | $0.80/$4 per 1M tokens |

## 🚀 Claude Opus 4.1 (`claude-opus-4-1-20250805`)

### **When to Use:**

- **Architecture Planning**: System design, database schema, API architecture
- **Complex Reasoning**: Multi-step problem solving, algorithmic challenges  
- **Code Reviews**: Comprehensive analysis of large codebases
- **Strategic Planning**: Project roadmaps, technical decisions
- **Debugging Complex Issues**: Multi-layer problems, performance optimization

### **Perfect For:**

```bash
# Examples of Opus-worthy tasks:
- "Design a microservices architecture for our e-commerce platform"
- "Optimize this database query that's causing performance issues"
- "Review this 500-line function and suggest refactoring approach"
- "Plan the migration from monolith to microservices"
- "Analyze security vulnerabilities in this authentication system"
```

### **Configuration:**

```env
CLAUDE_CODE_MODEL=claude-opus-4-1-20250805
CLAUDE_CODE_MAX_TOKENS=200000  # Can handle large contexts
```

---

## 🎯 Claude Sonnet 4 (`claude-sonnet-4-20250514`)

### **When to Use**

- **Daily Coding**: Feature implementation, bug fixes
- **Code Generation**: Writing functions, classes, components
- **Documentation**: README files, API docs, comments
- **Code Reviews**: Standard PR reviews, style checks
- **Testing**: Unit tests, integration tests

### **Perfect For**

```bash
# Examples of Sonnet-worthy tasks:
- "Implement user authentication with JWT tokens"
- "Write unit tests for this payment processing function" 
- "Create a React component for the user profile page"
- "Fix this TypeScript compilation error"
- "Generate API documentation for these endpoints"
```

### **Configuration**

```env
CLAUDE_CODE_MODEL=claude-sonnet-4-20250514
CLAUDE_CODE_MAX_TOKENS=200000  # Good for most development tasks
```

**💡 Recommended as Default**: Best balance of capability, speed, and cost for daily development.

---

## ⚡ Claude Haiku 3.5 (`claude-3-5-haiku-20241022`)

### **When to Use**

- **Quick Fixes**: Simple bugs, typos, formatting
- **Atomic Tasks**: Single-purpose functions, utilities
- **Fast Responses**: Immediate answers, quick clarifications
- **Batch Processing**: Multiple small, similar tasks
- **Code Snippets**: Short examples, templates

### **Perfect For:**

```bash
# Examples of Haiku-worthy tasks:
- "Fix this typo in the variable name"
- "Add error handling to this HTTP request"
- "Generate a utility function to format dates"
- "Create a simple validation function"
- "Write a quick bash script to clean temp files"
```

### **Configuration:**

```env
CLAUDE_CODE_MODEL=claude-3-5-haiku-20241022
CLAUDE_CODE_MAX_TOKENS=50000   # Optimized for shorter contexts
```

---

## 🎛️ Model Switching Strategy

### **Development Workflow:**

1. **Start with Sonnet 4** (daily default)
2. **Escalate to Opus 4.1** when:
   - Task takes multiple attempts
   - Need deep analysis or planning
   - Working with complex/legacy code
   - Architecture decisions required

3. **Use Haiku 3.5** when:
   - Quick, obvious fixes needed
   - Batch processing simple tasks
   - Fast turnaround required
   - Cost optimization important

### **Dynamic Switching:**

```bash
# In your .env.local, comment/uncomment as needed:

# For complex planning session:
CLAUDE_CODE_MODEL=claude-opus-4-1-20250805

# For daily development:
# CLAUDE_CODE_MODEL=claude-sonnet-4-20250514

# For quick fixes:
# CLAUDE_CODE_MODEL=claude-3-5-haiku-20241022
```

---

## 📈 Performance Benchmarks

### **Coding Performance:**

- **Opus 4.1**: 72.5% on SWE-bench (industry leading)
- **Sonnet 4**: 72.7% on SWE-bench (excellent)
- **Haiku 3.5**: Good performance, optimized for speed

### **Context Windows:**

- **All Models**: 200,000 tokens (can handle large codebases)

### **Response Times (Typical):**

- **Opus 4.1**: 10-30 seconds for complex tasks
- **Sonnet 4**: 3-10 seconds for standard tasks  
- **Haiku 3.5**: 1-3 seconds for quick tasks

---

## 💰 Cost Optimization

### **Monthly Budget Example:**

```
Team of 5 developers, moderate usage:

Opus 4.1:   $50-100/month  (complex tasks)
Sonnet 4:   $100-200/month (daily development) 
Haiku 3.5:  $20-50/month   (quick tasks)

Total: ~$170-350/month
```

### **Cost-Effective Strategy:**

1. **80% Sonnet 4**: Daily development baseline  
2. **15% Opus 4.1**: Complex problems only
3. **5% Haiku 3.5**: Quick fixes and utilities

---

## 🧪 Testing Different Models

### **A/B Testing Approach:**

1. Use Sonnet 4 for a task
2. If unsatisfied, retry with Opus 4.1
3. Compare results and note patterns
4. Build team knowledge of when to escalate

### **Team Learning:**

- Track which tasks need escalation to Opus
- Document model choice reasoning
- Share successful model selection patterns

---

## 🎯 Quick Decision Matrix

| Task Complexity | Time Pressure | Budget | Recommended Model |
|------------------|---------------|--------|-------------------|
| High | Low | High | Opus 4.1 |
| High | Low | Low | Sonnet 4 → Opus if needed |
| Medium | Medium | Any | Sonnet 4 |
| Low | High | Any | Haiku 3.5 |
| Low | Low | Low | Haiku 3.5 |

---

## 🔄 Model Migration

### **When Models Update:**

- Anthropic uses versioned model IDs (e.g., `20250514`)
- Update `.env.example` and documentation when new versions release
- Test new models with existing workflows
- Gradual migration strategy recommended

---

*🎯 Remember: Start with Sonnet 4 as your daily driver, escalate to Opus 4.1 for complexity, drop to Haiku 3.5 for speed.*
