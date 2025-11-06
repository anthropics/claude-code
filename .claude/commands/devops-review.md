---
description: Comprehensive DevOps and infrastructure review - CI/CD, containers, IaC, monitoring
argument-hint: "[scope: all|cicd|containers|infra|monitoring]"
---

You are performing a **comprehensive DevOps and infrastructure review** to optimize delivery pipelines, improve reliability, and enhance operational excellence.

## Review Scope

Target: $ARGUMENTS (default: comprehensive review of all areas)

Scopes available:
- `all` - Complete DevOps assessment (default)
- `cicd` - CI/CD pipeline optimization
- `containers` - Docker/Kubernetes review
- `infra` - Infrastructure as Code and cloud architecture
- `monitoring` - Observability and monitoring setup

## Comprehensive Review Process

### Phase 1: Current State Discovery

Gather information about the current DevOps setup:

**Infrastructure:**
```bash
# Look for IaC files
!`find . -name "*.tf" -o -name "*.tfvars" -o -name "cloudformation*.yml" -o -name "pulumi*.yaml" 2>/dev/null | head -20` || echo "No IaC files found"

# Docker files
!`find . -name "Dockerfile*" -o -name "docker-compose*.yml" 2>/dev/null | head -10` || echo "No Docker files found"

# Kubernetes manifests
!`find . -name "*.yaml" -path "*/k8s/*" -o -path "*/kubernetes/*" 2>/dev/null | head -10` || echo "No K8s files found"
```

**CI/CD:**
```bash
# CI/CD configuration
!`ls -la .github/workflows/ .gitlab-ci.yml .circleci/ Jenkinsfile 2>/dev/null` || echo "No CI/CD config found"
```

**Monitoring:**
```bash
# Monitoring config
!`find . -name "prometheus*.yml" -o -name "grafana*.json" -o -name "*alert*.yml" 2>/dev/null | head -10` || echo "No monitoring config found"
```

### Phase 2: Launch DevOps Expert Agent

**Task for devops-expert:**

Perform comprehensive DevOps review for scope: $ARGUMENTS

**Analysis Areas:**

#### 1. CI/CD Pipeline Assessment

**Analyze:**
- Pipeline configuration files
- Build and test stages
- Deployment automation
- Security scanning integration
- Caching strategies
- Parallelization opportunities

**Evaluate:**
- Build time and reliability
- Test execution time
- Deployment frequency capability
- Rollback mechanisms
- Secret management in pipelines

**Identify:**
- Bottlenecks and slow stages
- Missing automation
- Security vulnerabilities in pipeline
- Cost optimization opportunities
- Improvement recommendations

#### 2. Container & Orchestration Review

**Analyze:**
- Dockerfiles for best practices
- Multi-stage builds
- Layer caching
- Base image choices
- Security vulnerabilities

**For Kubernetes:**
- Deployment manifests
- Resource limits and requests
- Health checks (liveness/readiness)
- Security contexts
- Network policies
- Scaling configuration

**Evaluate:**
- Container security posture
- Image size and optimization
- Orchestration best practices
- High availability setup
- Disaster recovery

#### 3. Infrastructure as Code Review

**Analyze:**
- Terraform/CloudFormation/Pulumi code
- Module structure and reusability
- State management
- Variable management
- Security configurations

**Evaluate:**
- IaC best practices compliance
- Security posture
- Cost optimization
- Disaster recovery setup
- Multi-region/AZ configuration

**Identify:**
- Configuration drift risks
- Security misconfigurations
- Cost optimization opportunities
- Maintenance issues

#### 4. Monitoring & Observability Assessment

**Analyze:**
- Metrics collection (Prometheus, CloudWatch, etc.)
- Logging infrastructure
- Tracing setup (if any)
- Alerting rules
- Dashboard configurations

**Evaluate:**
- Coverage of golden signals (latency, traffic, errors, saturation)
- Alert quality (actionable vs noise)
- Runbook availability
- On-call processes
- SLO/SLI definitions

**Identify:**
- Monitoring blind spots
- Alert fatigue sources
- Missing critical alerts
- Observability gaps

#### 5. Security & Compliance

**Analyze:**
- Secrets management approach
- Access controls (IAM, RBAC)
- Network security
- Compliance requirements
- Security scanning in CI/CD

**Evaluate:**
- Security posture score
- Compliance readiness
- Audit capabilities
- Incident response preparedness

### Phase 3: Comprehensive Report Generation

**Deliverable Format:**

```markdown
## DevOps & Infrastructure Assessment Report

### Executive Summary
- Overall DevOps Maturity: [Score/100]
- Critical Issues: [Count]
- High Priority: [Count]
- Deployment Frequency: [Capability assessment]
- Lead Time: [Assessment]
- Change Failure Rate: [Assessment]
- MTTR: [Assessment]

### Maturity Assessment

| Area | Score | Grade | Status |
|------|-------|-------|--------|
| CI/CD | [X/25] | [A-F] | [✅/⚠️/❌] |
| Containers | [X/20] | [A-F] | [✅/⚠️/❌] |
| Infrastructure | [X/20] | [A-F] | [✅/⚠️/❌] |
| Monitoring | [X/20] | [A-F] | [✅/⚠️/❌] |
| Security | [X/15] | [A-F] | [✅/⚠️/❌] |

**Maturity Levels:**
- **Level 1 (0-40):** Ad-hoc - Manual processes, no automation
- **Level 2 (41-60):** Repeatable - Some automation, inconsistent
- **Level 3 (61-75):** Defined - Standardized processes, good automation
- **Level 4 (76-90):** Managed - Measured and controlled
- **Level 5 (91-100):** Optimizing - Continuous improvement

### Current Maturity: [Level X - Description]

---

## Detailed Findings

### CI/CD Pipeline Analysis

**Current Performance:**
- Build Time: [X minutes]
- Test Time: [X minutes]
- Deploy Time: [X minutes]
- Success Rate: [X%]

**Strengths:**
- [What's done well]

**Critical Issues:**
1. **[Issue Title]** - Priority: Critical
   - Location: [file:line]
   - Impact: [Description]
   - Current: [Current situation]
   - Recommended: [Fix]
   - Expected Improvement: [Metrics]

**High Priority Issues:**
[Same format]

**Optimization Opportunities:**
- [Quick wins for performance]
- [Cost reduction opportunities]
- [Reliability improvements]

**Estimated Improvements:**
- Build time: [Current] → [Optimized] ([X]% faster)
- Cost: [Current] → [Optimized] ([X]% reduction)
- Reliability: [Current] → [Optimized]

---

### Container & Orchestration Review

**Container Security Scan Results:**
- Critical vulnerabilities: [N]
- High vulnerabilities: [N]
- Base image security: [Assessment]
- Running as root: [Yes/No]

**Kubernetes Best Practices:**
- Resource limits: [Configured/Missing]
- Health checks: [Configured/Missing]
- Security contexts: [Configured/Missing]
- Network policies: [Configured/Missing]
- Pod Disruption Budgets: [Configured/Missing]

**Issues Found:**
[Detailed list with remediation]

---

### Infrastructure as Code Assessment

**IaC Tool:** [Terraform/CloudFormation/Pulumi/etc.]
**State Management:** [Assessment]
**Security Posture:** [Score]

**Strengths:**
- [What's done well]

**Issues:**
- [Security misconfigurations]
- [Cost optimization opportunities]
- [Disaster recovery gaps]

**Recommendations:**
- [Specific improvements]

---

### Monitoring & Observability

**Current Setup:**
- Metrics: [Tool/Coverage]
- Logs: [Tool/Coverage]
- Traces: [Tool/Coverage]
- Alerts: [Count/Quality]

**Golden Signals Coverage:**
- Latency: [✅/❌]
- Traffic: [✅/❌]
- Errors: [✅/❌]
- Saturation: [✅/❌]

**Issues:**
- [Monitoring blind spots]
- [Alert quality problems]
- [Missing runbooks]

**Recommendations:**
- [Specific improvements]

---

### Security & Compliance

**Security Score:** [X/100]

**Secrets Management:** [Assessment]
**Access Control:** [Assessment]
**Network Security:** [Assessment]
**Compliance:** [Assessment]

**Critical Security Issues:**
[List with severity and remediation]

---

## Action Plan

### Immediate Actions (Week 1)
**Critical Issues - Must Fix:**
1. [Action item with owner and deadline]
2. [Action item with owner and deadline]

### Short-term (Month 1)
**High Priority:**
1. [Action item]
2. [Action item]

### Medium-term (Quarter 1)
**Strategic Improvements:**
1. [Action item]
2. [Action item]

### Long-term (Year 1)
**Transformation Initiatives:**
1. [Initiative]
2. [Initiative]

---

## Recommended Tools & Technologies

Based on current gaps and needs:

**CI/CD Improvements:**
- [Tool recommendations with rationale]

**Monitoring Enhancement:**
- [Tool recommendations with rationale]

**Security Tooling:**
- [Tool recommendations with rationale]

**Cost Optimization:**
- [Tool recommendations with rationale]

---

## Success Metrics

Define KPIs to track improvement:

**DORA Metrics:**
- Deployment Frequency: [Current → Target]
- Lead Time for Changes: [Current → Target]
- Change Failure Rate: [Current → Target]
- Mean Time to Recovery: [Current → Target]

**Operational Metrics:**
- Build Success Rate: [Current → Target]
- Pipeline Duration: [Current → Target]
- Infrastructure Cost: [Current → Target]
- Alert Noise Ratio: [Current → Target]

---

## Next Steps

1. **Review findings** with engineering and operations teams
2. **Prioritize actions** based on impact and effort
3. **Assign owners** for each action item
4. **Schedule implementation** in upcoming sprints
5. **Set up tracking** for success metrics
6. **Schedule follow-up review** (recommended: quarterly)

---

**Remember:** DevOps is a journey, not a destination. This assessment provides a roadmap for continuous improvement.
```

## Specialized Review Types

### Quick Pipeline Audit (--scope=cicd)
**Focus:** CI/CD pipeline only
**Time:** 30 minutes
**Output:** Pipeline optimization recommendations

### Container Security Scan (--scope=containers)
**Focus:** Docker and Kubernetes security
**Time:** 1 hour
**Output:** Security vulnerabilities and fixes

### Infrastructure Health Check (--scope=infra)
**Focus:** IaC and cloud architecture
**Time:** 1-2 hours
**Output:** Infrastructure improvements

### Observability Assessment (--scope=monitoring)
**Focus:** Monitoring, logging, alerting
**Time:** 1 hour
**Output:** Observability gaps and recommendations

## After the Review

### Create Improvement Roadmap:
1. **Fix critical issues immediately** - Security, stability
2. **Plan high-priority improvements** - Next sprint
3. **Schedule strategic work** - Next quarter
4. **Track metrics** - Measure improvement over time
5. **Re-assess periodically** - Quarterly reviews

### Best Practices:
- Make DevOps improvement a continuous process
- Involve the whole team in improvements
- Celebrate wins and learn from failures
- Share knowledge through documentation
- Automate everything that can be automated

---

**Goal:** Build a world-class DevOps practice that enables fast, safe, reliable software delivery. 🚀
