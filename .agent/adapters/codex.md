# Codex Adapter Documentation

## Adapter Overview

**Codex** is a repository-aware AI assistant designed for analysis, review, and isolated development tasks. In the Ralph-Loop system, Codex serves as a **read-only or isolated-analysis adapter** by default, with controlled write access for specific tasks.

## Codex Role in Ralph-Loop

### Primary Role: Analysis and Review

- Codex excels at repository analysis, code review, and risk assessment
- Codex provides isolated analysis without modifying repository state
- Codex can perform complex reasoning about code architecture and patterns
- Codex is suitable for review, analysis, risk checks, and plan validation

### Secondary Role: Controlled Implementation

- Codex may be assigned implementation tasks with explicit authorization
- Codex can handle complex reasoning-heavy implementation tasks
- Codex provides detailed analysis and documentation of implementation decisions
- Codex is particularly effective for tasks requiring deep architectural understanding

## Codex Integration Requirements

### Default Mode: Read-Only Analysis

By default, Codex operates in read-only mode:

- **No repository writes** unless explicitly assigned implementation tasks
- **Analysis and reporting** as primary functions
- **Risk assessment and review** capabilities
- **Plan validation and architectural analysis**

### Controlled Write Mode

When explicitly assigned implementation tasks, Codex must:

- Read `.governance/SYSTEM.md`, `.governance/RULES.md`, `.governance/SAFETY.md` before starting work
- Respect task scope defined in `runs/current-run.json`
- Follow safety policies for protected files and forbidden actions
- Execute validation as specified in task definition
- Write handoff documentation to `handoffs/latest-handoff.md`

### File System Constraints

- **Read-Only by Default**: No file modifications unless explicitly authorized
- **Controlled Write Access**: Only when assigned implementation tasks
- **Allowed Files**: Only modify files listed in task's `allowed_files` (when authorized)
- **Forbidden Files**: Never touch files in task's `forbidden_files`
- **Protected Files**: Never modify `.env*`, `secrets/**`, `credentials/**`, `node_modules/**`, `.git/**`

## Codex-Specific Considerations

### Codex Strengths

- Deep repository analysis and understanding
- Complex reasoning about code architecture
- Excellent for risk assessment and review tasks
- Strong pattern recognition and architectural insights
- Detailed documentation and explanation capabilities

### Codex Limitations in Ralph-Loop

- **No Push/Deploy Operations** - Codex never pushes to remote or deploys
- **No Secret Access** - Codex must not handle secrets or credentials
- **Controlled Repository Writes** - Write access only with explicit authorization
- **No Broad Autonomous Changes** - Not suitable for broad autonomous repository changes by default

### Codex Safety Integration

- Codex must respect protected file patterns defined in `.governance/SAFETY.md`
- Codex must stop immediately on safety policy violations
- Codex must never bypass validation requirements
- Codex must escalate to human review when required
- Codex must never handle secrets or credentials

## Codex Use Cases

### Ideal Codex Tasks

1. **Repository Analysis**
   - Code architecture review
   - Technical debt assessment
   - Pattern analysis and recommendations
   - Dependency analysis

2. **Risk Assessment**
   - Change impact analysis
   - Security risk evaluation
   - Performance impact assessment
   - Architectural risk analysis

3. **Plan Validation**
   - Implementation plan review
   - Architecture decision validation
   - Technical feasibility assessment
   - Resource requirement analysis

4. **Code Review**
   - Pull request analysis
   - Code quality assessment
   - Best practices compliance
   - Security vulnerability detection

### Codex Implementation Tasks (When Authorized)

- Complex architectural implementations requiring deep analysis
- Tasks requiring extensive documentation and reasoning
- Implementation tasks with high complexity and low risk
- Refactoring tasks requiring careful architectural consideration

## Codex Validation Integration

### Analysis Validation

For analysis tasks, Codex should:

- Provide evidence-based analysis
- Document reasoning and assumptions
- Cross-reference multiple sources
- Validate findings against repository state

### Implementation Validation (When Authorized)

When assigned implementation tasks, Codex must:

- Execute validation commands as specified in task definition
- Capture and document validation results
- Not claim task completion without passing validation
- Escalate validation failures to human review

### Validation Commands

```bash
npm run verify          # Standard validation pipeline
npm run verify:edge     # Edge function validation (conditional)
npm run lint           # Linting (component of verify)
npm run typecheck      # Type checking (component of verify)
```

## Codex Error Handling

### Analysis Mode Errors

For analysis tasks:

1. Document analysis limitations
2. Identify areas requiring human expertise
3. Provide confidence levels for findings
4. Escalate complex or ambiguous situations

### Implementation Mode Errors (When Authorized)

For implementation tasks:

1. Stop immediately on scope violations
2. Document specific failure details
3. Attempt to fix within task scope
4. If unfixable, document and escalate
5. Never bypass or ignore validation failures

### Human Escalation Triggers

Codex must escalate to human review when:

- Analysis reveals critical security or architectural issues
- Task requirements are ambiguous or conflicting
- Implementation exceeds authorized scope
- Validation failures cannot be resolved
- Complex business decisions are required

## Codex vs Other Adapters

### Codex Advantages

- Excellent analytical and reasoning capabilities
- Strong architectural understanding
- Detailed documentation and explanation
- Good for complex, reasoning-heavy tasks
- Effective for risk assessment and review

### Codex Limitations

- Not optimized for routine implementation tasks
- May be slower for simple, straightforward changes
- Requires careful scope management for implementation tasks
- Not suitable for interactive development workflows

### When to Use Codex

- Repository analysis and assessment tasks
- Complex architectural decisions
- Risk assessment and security review
- Plan validation and feasibility analysis
- Code review and quality assessment
- Tasks requiring deep reasoning and documentation

### When Not to Use Codex

- Simple, routine implementation tasks
- Interactive development requiring real-time feedback
- Tasks requiring specialized IDE features
- Batch processing or automated operations
- Tasks requiring external system integration

## Codex Configuration

### Codex Analysis Configuration

```json
{
  "codex": {
    "mode": "analysis",
    "repository_access": "read_only",
    "analysis_depth": "comprehensive",
    "documentation_level": "detailed",
    "risk_assessment": "enabled"
  }
}
```

### Codex Implementation Configuration (When Authorized)

```json
{
  "codex": {
    "mode": "implementation",
    "repository_access": "controlled_write",
    "max_file_changes": 5,
    "require_validation": true,
    "documentation_required": true,
    "reasoning_documentation": "mandatory"
  }
}
```

## Codex Prompt Integration

### Analysis Mode Prompt

```markdown
You are operating as a Ralph-Loop Analyzer via Codex. Your role is analysis and review.

CRITICAL: You are in READ-ONLY mode. Do not modify any repository files.

Read these files for context:

1. .governance/SYSTEM.md
2. .governance/RULES.md
3. .governance/SAFETY.md
4. [Task-specific files as needed]

Provide comprehensive analysis with evidence and reasoning. Document findings clearly.
```

### Implementation Mode Prompt (When Authorized)

```markdown
You are operating as a Ralph-Loop Worker via Codex. Your task assignment is in runs/current-run.json.

CRITICAL: Read these files in order before starting:

1. .governance/SYSTEM.md
2. .governance/RULES.md
3. .governance/SAFETY.md
4. runs/current-run.json
5. tasks/task-state.json

Execute ONLY the assigned task. Stay within allowed scope. Document work and reasoning in handoffs/latest-handoff.md. Stop after task completion.
```

## Codex Security Considerations

### Secret Handling

- **Never access secrets** - Codex must not read .env files or credential stores
- **No credential printing** - Never output or log sensitive information
- **Environment isolation** - Operate without access to production credentials
- **Security scanning** - Can analyze code for security issues without accessing secrets

### Network Restrictions

- **No production API calls** - Codex must not make calls to production systems
- **No external modifications** - Cannot modify external systems or services
- **Analysis only** - Can analyze API usage patterns without making calls
- **Documentation focus** - Document security considerations without testing them

## Future Codex Integration

### Planned Enhancements

- Enhanced repository analysis capabilities
- Improved risk assessment algorithms
- Better integration with Ralph-Loop coordinator
- Advanced architectural pattern recognition

### Codex Adapter Evolution

As Ralph-Loop matures, the Codex adapter may evolve to:

- Provide more sophisticated analysis capabilities
- Support specialized review workflows
- Integrate with additional analysis tools
- Support collaborative analysis with other adapters

## Important Notes

### Default Read-Only Operation

Unless explicitly assigned implementation tasks, Codex operates in read-only mode. This ensures safety while maximizing Codex's analytical capabilities.

### Repository-First Principle

Codex is an adapter that implements repository contracts. The repository governance is authoritative, not Codex's internal logic or assumptions. When conflicts arise, repository governance takes precedence.

### Controlled Implementation Access

When Codex is assigned implementation tasks, it operates under the same constraints as other worker adapters, with additional emphasis on documentation and reasoning.
