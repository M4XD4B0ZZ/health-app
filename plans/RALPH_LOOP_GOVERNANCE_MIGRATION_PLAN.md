# Ralph-Loop Governance Migration Plan

**Projekt:** HealthApp  
**Ziel:** Migration von Roo-first zu agent-neutraler Ralph-Loop-kompatibler Governance  
**Datum:** 2026-05-19  
**Status:** Planning Phase  

---

## 1. Current State Assessment

### 1.1 Existing SSOK Files

**Strategische Projekt-SSOK (Root-Dateien):**
- [`README.md`](README.md) - Projektkontext, Setup, Hauptkommandos
- [`ROADMAP.md`](ROADMAP.md) - Single Source of Knowledge für Tasks (Status: todo/in_progress/blocked/done)
- [`AGENTS.md`](AGENTS.md) - Agent-Governance, Arbeitsregeln, Verification-Anforderungen
- [`VERIFY.md`](VERIFY.md) - Canonical verification commands, Definition of Done
- [`SSOK.md`](SSOK.md) - Übergeordnete Roo-first Governance-Definition
- [`package.json`](package.json) - Ausführbare Verify-Commands

**Operative Roo-SSOK:**
- [`.roomodes`](.roomodes) - Rollen/Modi/Agentenlogik (ask/code/architect/agentic)
- [`.roo/rules/`](.roo/rules/) - Operative Verhaltensregeln (01-global.md, rules-code/)
- [`.roo/commands/`](.roo/commands/) - Standardisierte Arbeitsabläufe (feature/bugfix/review/commit)

### 1.2 Existing Roo-specific Assumptions

**Roo-zentrische Architektur:**
- SSOK.md definiert explizit "Roo ist die operative SSOK"
- .roomodes definiert Modus-spezifische Rollen und Berechtigungen
- .roo/commands/ enthält Roo-spezifische Slash-Command-Workflows
- .roo/rules/ definiert Roo-spezifische Verhaltensregeln
- Governance-Hierarchie: "Projektwahrheit oben, Ausführungswahrheit in Roo, Implementierung unten"

**Agent Registry in SSOK.md:**
- 7 definierte Agenten: Feature, Bugfix, Refactor, Review, Explain, Commit, Commit-Push
- Trigger-basierte Aktivierung über Slash-Commands (/feature, /bugfix, etc.)
- Modell-Zuordnungsempfehlungen pro Agent-Typ

### 1.3 Existing Verification Model

**Canonical Verification Pipeline:**
```bash
npm run lint
npm run typecheck  
npm run verify      # Kombiniert: lint + typecheck + format:check + test
npm run verify:edge # Optional bei Edge Function Änderungen
```

**Definition of Done:**
- `npm run verify` muss bestehen
- Keine Type-Errors
- Keine Lint-Errors
- Edge verification bei Edge Function Änderungen
- ROADMAP.md Task-Status auf `done` aktualisiert

**Resolver-spezifische Verification:**
- Multi-Source Fusion Verification
- Performance Verification
- Debug-Logs für Resolver-Verhalten

### 1.4 Existing Roadmap/Task Model

**Task-Status-Werte:**
- `todo` - Geplant, nicht gestartet
- `in_progress` - Aktiv bearbeitet
- `blocked` - Wartet auf Dependency/Entscheidung
- `done` - Abgeschlossen und verifiziert

**Task-Governance:**
- Stabile Task-IDs (nie wiederverwendet)
- Completed Tasks werden auf `done` markiert, nie gelöscht
- Jeder Task muss ROADMAP.md-Referenz haben
- Verification vor `done`-Status erforderlich

### 1.5 Existing Agent Scripts

**Aktuelle Agent-Infrastruktur in [`scripts/agent/`](scripts/agent/):**

**Phase A - Basis Scripts:**
- [`select-next-task.mjs`](scripts/agent/select-next-task.mjs) - Task-Auswahl aus ROADMAP.md
- [`build-roo-prompt.mjs`](scripts/agent/build-roo-prompt.mjs) - Roo-kompatible Prompts
- [`run-verify.mjs`](scripts/agent/run-verify.mjs) - Verification Pipeline
- [`write-handoff-template.mjs`](scripts/agent/write-handoff-template.mjs) - Handoff-Dokumentation

**Phase B - State Management:**
- [`run-agent-loop.mjs`](scripts/agent/run-agent-loop.mjs) - Workflow-State-Management
- [`.agent/state.json`](.agent/state.json) - Agent State Tracking

**Phase C - OpenCode Integration:**
- [`build-worker-prompt.mjs`](scripts/agent/build-worker-prompt.mjs) - Kompakte Worker-Prompts
- [`run-opencode-worker.mjs`](scripts/agent/run-opencode-worker.mjs) - OpenCode CLI Worker

**Phase D - Automation:**
- [`run-auto-task.mjs`](scripts/agent/run-auto-task.mjs) - Single-Task Automation
- [`select-model.mjs`](scripts/agent/select-model.mjs) - LLM Model Registry
- [`watch-agent.mjs`](scripts/agent/watch-agent.mjs) - Live Dashboard

**Phase E - Multi-Task:**
- [`run-milestone.mjs`](scripts/agent/run-milestone.mjs) - Multi-Task Automation mit Gates

**State-Struktur (`.agent/state.json`):**
```json
{
  "currentTaskId": "P1-002",
  "currentTaskTitle": "Canonical Food Entity Dictionary + Source Adapters", 
  "status": "ready_for_human_review",
  "lastStep": "handoff_ready",
  "iteration": 5,
  "verifyPassed": true,
  "autoMode": false,
  "milestoneMode": false
}
```

### 1.6 Existing Gaps versus Ralph-Loop Requirements

**Fehlende Ralph-Loop-Komponenten:**

1. **Runtime Task-State Layer:** Aktuell nur `.agent/state.json`, keine strukturierte Task-State-Verwaltung
2. **Handoff Layer:** Nur Templates, keine strukturierte Handoff-Persistierung
3. **Validation Layer:** Verification existiert, aber keine strukturierte Validation-State-Verwaltung
4. **Run Logging Layer:** Nur Output-Dateien, keine strukturierte Run-Logs
5. **Morning Review Layer:** Nicht implementiert
6. **Tool Adapter Layer:** OpenCode-spezifisch, nicht agent-neutral

**Agent-spezifische Abhängigkeiten:**
- Roo-spezifische Prompt-Formate
- OpenCode-spezifische Worker-Integration
- Keine generische Tool-Adapter-Architektur

**Governance-Lücken:**
- Keine agent-neutrale Governance-Definition
- Keine Tool-unabhängige Arbeitsverträge
- Keine standardisierte Agent-Adapter-Schnittstelle

---

## 2. Target State

### 2.1 Agent-Neutral Governance

**Prinzip:** Das Repository enthält das dauerhafte Betriebsmodell, Tools sind nur Adapter/Worker.

**Governance-Hierarchie (neu):**
```
Repository Governance (durable)
├── Strategic Project SSOK (README, ROADMAP, VERIFY, AGENTS)
├── Runtime Governance (.governance/)
└── Tool Adapters (.agent/adapters/)
```

**Agent-Neutralität:**
- Cline, OpenCode, Codex, Roo sind austauschbare Worker
- Repository definiert Arbeitsverträge, nicht Tools
- Standardisierte Adapter-Schnittstellen für alle Tools

### 2.2 Runtime Task-State Layer

**Strukturierte Task-State-Verwaltung:**
- Persistente Task-Zustände in `tasks/`
- Granulare State-Übergänge
- Audit-Trail für alle Task-Änderungen
- Tool-unabhängige State-Definition

### 2.3 Handoff Layer

**Strukturierte Handoff-Persistierung:**
- Standardisierte Handoff-Formate
- Handoff-Validierung
- Handoff-History
- Tool-übergreifende Handoff-Kompatibilität

### 2.4 Validation Layer

**Erweiterte Validation-State-Verwaltung:**
- Validation-Results-Persistierung
- Validation-History
- Conditional Validation Rules
- Tool-spezifische Validation-Adapter

### 2.5 Run Logging Layer

**Strukturierte Run-Logs:**
- Alle Tool-Ausführungen geloggt
- Standardisierte Log-Formate
- Run-Korrelation und -Analyse
- Performance-Metriken

### 2.6 Morning Review Layer

**Tägliche Review-Zyklen:**
- Automatische Report-Generierung
- Review-Status-Tracking
- Review-Entscheidungs-Persistierung
- Review-Workflow-Integration

### 2.7 Tool Adapter Layer

**Standardisierte Tool-Integration:**
- Generic Tool Contracts
- Tool-spezifische Adapter
- Tool-Capability-Registry
- Tool-Selection-Logic

---

## 3. Proposed Directory Structure

```
.governance/                    # Agent-neutral governance
├── contracts/                  # Tool-agnostic work contracts
│   ├── feature-contract.md
│   ├── bugfix-contract.md
│   ├── review-contract.md
│   └── commit-contract.md
├── policies/                   # Repository policies
│   ├── security-policy.md
│   ├── verification-policy.md
│   └── handoff-policy.md
└── schemas/                    # Data schemas
    ├── task-state-schema.json
    ├── handoff-schema.json
    └── run-log-schema.json

.agent/                         # Tool adapters and runtime
├── adapters/                   # Tool-specific adapters
│   ├── cline/
│   │   ├── adapter.mjs
│   │   └── prompts/
│   ├── opencode/
│   │   ├── adapter.mjs
│   │   └── prompts/
│   ├── roo/
│   │   ├── adapter.mjs
│   │   └── prompts/
│   └── codex/
│       ├── adapter.mjs
│       └── prompts/
├── config/                     # Agent configuration
│   ├── tools.json             # Available tools registry
│   ├── models.json            # Model registry
│   └── capabilities.json      # Tool capabilities
├── state/                      # Runtime state
│   ├── current-run.json
│   ├── tool-selection.json
│   └── session-state.json
└── out/                        # Tool outputs (existing)

tasks/                          # Task state management
├── active/                     # Active task states
├── completed/                  # Completed task archives
├── failed/                     # Failed task records
└── templates/                  # Task templates

runs/                           # Run logging
├── current-run.json           # Current run state
├── run-history/               # Historical runs
│   ├── 2026-05-19/
│   └── 2026-05-18/
└── metrics/                   # Run metrics

handoffs/                       # Handoff management
├── pending/                   # Pending handoffs
├── completed/                 # Completed handoffs
└── templates/                 # Handoff templates

validation/                     # Validation layer
├── results/                   # Validation results
├── rules/                     # Validation rules
└── reports/                   # Validation reports

reports/                        # Generated reports
├── daily/                     # Daily reports
├── weekly/                    # Weekly summaries
└── morning-review/            # Morning review reports

scripts/agent/                  # Agent orchestration (existing, evolved)
├── core/                      # Core orchestration
├── adapters/                  # Adapter implementations
└── utils/                     # Utilities
```

---

## 4. Migration Strategy

### 4.1 Migration from .roo/rules → .governance/policies

**Mapping:**
- `.roo/rules/01-global.md` → `.governance/policies/general-policy.md`
- `.roo/rules-code/01-code.md` → `.governance/policies/code-policy.md`
- `.roo/rules-code/02-plans.md` → `.governance/policies/planning-policy.md`

**Transformation:**
- Remove Roo-specific references
- Generalize to tool-agnostic language
- Maintain core behavioral rules
- Add tool-adapter compliance requirements

### 4.2 Migration from .roo/commands → .governance/contracts + .agent/adapters

**Command → Contract Mapping:**
- `.roo/commands/feature.md` → `.governance/contracts/feature-contract.md` + `.agent/adapters/*/feature-prompts/`
- `.roo/commands/bugfix.md` → `.governance/contracts/bugfix-contract.md` + `.agent/adapters/*/bugfix-prompts/`
- `.roo/commands/review.md` → `.governance/contracts/review-contract.md` + `.agent/adapters/*/review-prompts/`
- `.roo/commands/commit.md` → `.governance/contracts/commit-contract.md` + `.agent/adapters/*/commit-prompts/`

**Contract Structure:**
```markdown
# Feature Implementation Contract

## Objective
Implement new functionality according to specifications.

## Inputs
- Task specification from ROADMAP.md
- Relevant architecture documentation
- Existing codebase context

## Outputs
- Implementation files
- Updated tests
- Documentation updates
- Handoff report

## Constraints
- Preserve architecture boundaries
- Maintain existing interfaces
- Follow security policies
- Pass all verification

## Success Criteria
- All tests pass
- No lint errors
- No type errors
- Handoff report complete
```

### 4.3 Migration from .roomodes → .agent/adapters + role contracts

**Mode → Adapter Mapping:**
- `ask` mode → Generic analysis adapter
- `code` mode → Generic implementation adapter  
- `architect` mode → Generic planning adapter
- `agentic` mode → Controlled automation adapter

**Adapter Structure:**
```javascript
// .agent/adapters/cline/adapter.mjs
export class ClineAdapter {
  constructor(config) {
    this.toolName = 'cline';
    this.capabilities = ['code', 'analysis', 'planning'];
  }
  
  async executeContract(contractName, inputs) {
    // Tool-specific implementation
  }
  
  async buildPrompt(contractName, inputs) {
    // Tool-specific prompt building
  }
}
```

### 4.4 Migration from SSOK.md → updated agent-neutral SSOK

**SSOK.md Transformation:**
- Remove "Roo-first" declarations
- Replace with "Repository-first, tool-neutral" governance
- Update hierarchy to reflect new structure
- Maintain core governance principles
- Add tool-adapter governance section

**New SSOK Structure:**
```markdown
# SSOK v3 – Agent-Neutral Repository Governance

## Governance Hierarchy
- Repository Governance (durable, tool-independent)
- Tool Adapters (exchangeable, contract-compliant)
- Implementation (tool-specific execution)

## Core Principle
The repository contains the durable operating model.
Tools are adapters that implement repository contracts.
```

---

## 5. File Ownership Model

### 5.1 Human-Authored Files

**Strategic Governance:**
- `README.md` - Human-maintained project overview
- `ROADMAP.md` - Human-curated task priorities
- `VERIFY.md` - Human-defined verification requirements
- `AGENTS.md` - Human-defined agent governance

**Policies and Contracts:**
- `.governance/policies/*.md` - Human-authored policies
- `.governance/contracts/*.md` - Human-authored work contracts
- `.governance/schemas/*.json` - Human-defined data schemas

**Configuration:**
- `.agent/config/tools.json` - Human-curated tool registry
- `.agent/config/models.json` - Human-curated model registry
- `.agent/config/capabilities.json` - Human-defined tool capabilities

### 5.2 Agent-Written Files

**Implementation Files:**
- `src/**/*` - Agent-implemented source code
- `tests/**/*` - Agent-written tests
- `docs/**/*` - Agent-generated documentation

**Handoffs:**
- `handoffs/pending/*.md` - Agent-generated handoff reports
- `handoffs/completed/*.md` - Agent-completed handoffs

### 5.3 Script-Written Files

**State Management:**
- `tasks/active/*.json` - Script-managed task states
- `runs/current-run.json` - Script-managed run state
- `.agent/state/*.json` - Script-managed agent state

**Reports:**
- `reports/daily/*.md` - Script-generated daily reports
- `reports/morning-review/*.md` - Script-generated morning reviews
- `validation/reports/*.md` - Script-generated validation reports

### 5.4 Source-of-Truth Files

**Single Source of Truth:**
- `ROADMAP.md` - Task priorities and status
- `VERIFY.md` - Verification requirements
- `.governance/contracts/*.md` - Work contracts
- `.governance/policies/*.md` - Repository policies

### 5.5 Runtime-State Files

**Ephemeral State:**
- `runs/current-run.json` - Current execution state
- `.agent/state/session-state.json` - Session state
- `tasks/active/*.json` - Active task states

### 5.6 Generated Report Files

**Automated Reports:**
- `reports/**/*.md` - All generated reports
- `validation/reports/*.md` - Validation reports
- `runs/run-history/**/*.json` - Historical run data

---

## 6. Ralph Task State Model

### 6.1 Ralph Task States

**Extended State Model:**
- `not_started` - Task identified but not begun
- `in_progress` - Task actively being worked
- `needs_validation` - Implementation complete, awaiting validation
- `needs_review` - Validation passed, awaiting human review
- `blocked` - Cannot proceed due to dependency
- `failed` - Task failed, requires intervention
- `done` - Task completed and accepted
- `skipped` - Task intentionally skipped
- `cancelled` - Task cancelled due to changed requirements

### 6.2 Current ROADMAP.md Status Mapping

**Migration Mapping:**
- `todo` → `not_started`
- `in_progress` → `in_progress` (unchanged)
- `blocked` → `blocked` (unchanged)
- `done` → `done` (unchanged)

**New States for Enhanced Workflow:**
- Tasks completing implementation → `needs_validation`
- Tasks passing validation → `needs_review`
- Tasks with errors → `failed`
- Tasks skipped by human decision → `skipped`
- Tasks cancelled due to scope change → `cancelled`

### 6.3 State Transition Rules

**Valid Transitions:**
```
not_started → in_progress
in_progress → needs_validation | blocked | failed
needs_validation → needs_review | failed | in_progress
needs_review → done | in_progress | failed
blocked → in_progress | cancelled
failed → in_progress | cancelled
done → (terminal)
skipped → (terminal)
cancelled → (terminal)
```

**Transition Triggers:**
- Human decision (start, review, cancel)
- Validation results (pass/fail)
- Dependency resolution (unblock)
- Error conditions (fail)

---

## 7. Safety Model

### 7.1 Protected Files

**Absolute Protection (Never Modified by Agents):**
- `.env` - Environment variables
- `.env.*` - Environment variable variants
- `secrets/**` - Any secrets directory
- `credentials/**` - Any credentials directory
- `node_modules/**` - Package dependencies
- `.git/**` - Git metadata

**Conditional Protection (Explicit Approval Required):**
- `package-lock.json` - Only with explicit dependency task
- `package.json` - Only with explicit dependency task
- `supabase/migrations/**` - Only with explicit migration task

### 7.2 Forbidden Actions

**Never Allowed:**
- Push to remote repositories
- Deploy to production environments
- Production side effects (API calls to prod)
- Secret printing or logging
- Destructive deletes of source files
- Modification of `.env` files
- Installation of dependencies without approval

**Approval Required:**
- Database migrations
- Dependency changes
- Configuration changes
- Deployment scripts
- CI/CD modifications

### 7.3 Safety Gates

**Pre-execution Safety Checks:**
- Clean working tree verification
- Protected file modification detection
- Dangerous operation detection
- Scope boundary validation

**Runtime Safety Monitoring:**
- File modification tracking
- Network request monitoring
- Process execution monitoring
- Resource usage monitoring

**Post-execution Safety Validation:**
- Changed file review
- Diff size validation
- Security scan results
- Verification pipeline results

---

## 8. Validation Model

### 8.1 Integration with Existing VERIFY.md

**Core Verification Pipeline (Unchanged):**
```bash
npm run lint           # ESLint checks
npm run typecheck      # TypeScript validation
npm run verify         # Combined: lint + typecheck + format:check + test
npm run verify:edge    # Edge function validation (conditional)
```

**Enhanced Validation Framework:**
- Pre-validation: Safety checks
- Core validation: Existing VERIFY.md pipeline
- Post-validation: Quality gates
- Conditional validation: Context-specific checks

### 8.2 Resolver-Specific Validation Integration

**Existing Resolver V2 Compliance (Preserved):**
- No Early Translation checks
- Source-Native Queries validation
- Multi-Source Candidates verification
- Fusion Layer functionality tests
- Knowledge Persistence validation
- AI Rate Limiting verification

**Enhanced Integration:**
- Resolver validation triggered by file patterns
- Conditional execution based on changed files
- Validation result persistence
- Validation history tracking

### 8.3 Validation State Management

**Validation Results Structure:**
```json
{
  "validationId": "val_2026-05-19_001",
  "taskId": "P1-002",
  "timestamp": "2026-05-19T10:00:00Z",
  "pipeline": {
    "lint": { "status": "passed", "duration": 1200 },
    "typecheck": { "status": "passed", "duration": 3400 },
    "test": { "status": "passed", "duration": 15600 },
    "format": { "status": "passed", "duration": 800 }
  },
  "conditional": {
    "resolver": { "status": "passed", "reason": "resolver files changed" },
    "edge": { "status": "skipped", "reason": "no .env file" }
  },
  "overall": "passed"
}
```

### 8.4 Validation Gates

**Blocking Gates (Must Pass):**
- `npm run verify` pipeline
- Security policy compliance
- Protected file modification check
- Diff size validation

**Warning Gates (Human Review Required):**
- Large diff detection
- High-risk model usage
- Complex multi-file changes
- Performance regression detection

---

## 9. Loop MVP

### 9.1 Smallest Safe Sequential Loop

**Loop Definition:**
```
1. Select one eligible safe task
2. Write runs/current-run.json
3. Invoke worker (via tool adapter)
4. Write handoff
5. Run validation
6. Update task-state
7. Append history
8. Update morning report
9. Stop (human review gate)
```

**Safety Constraints:**
- Maximum 1 task per loop iteration
- Human review gate after each task
- Validation must pass before state update
- All operations logged and auditable

### 9.2 Loop State Management

**Current Run State:**
```json
{
  "runId": "run_2026-05-19_001",
  "startedAt": "2026-05-19T10:00:00Z",
  "taskId": "P1-002",
  "phase": "validation",
  "toolUsed": "opencode",
  "modelUsed": "openai/gpt-5.3-codex",
  "status": "running",
  "safetyChecks": {
    "workingTreeClean": true,
    "protectedFilesCheck": true,
    "scopeBoundaryCheck": true
  }
}
```

### 9.3 Loop Execution Flow

**Phase 1: Task Selection**
- Read ROADMAP.md
- Filter eligible tasks (not_started, in_progress)
- Apply safety filters
- Select highest priority safe task
- Update current-run.json

**Phase 2: Tool Selection**
- Analyze task requirements
- Check tool capabilities
- Select appropriate tool adapter
- Load tool-specific configuration

**Phase 3: Worker Invocation**
- Build tool-specific prompt
- Execute tool adapter
- Monitor execution
- Capture all outputs

**Phase 4: Validation**
- Run safety checks
- Execute verification pipeline
- Validate outputs
- Generate validation report

**Phase 5: State Update**
- Update task state based on results
- Append to run history
- Update morning report data
- Prepare handoff

**Phase 6: Human Review Gate**
- Present results for review
- Wait for human decision
- Log review outcome
- Prepare for next iteration

---

## 10. Stop Conditions

### 10.1 Planned Stop Conditions

**Successful Completion:**
- No eligible tasks remaining
- Task completed successfully
- Human review gate reached
- Milestone target achieved

**Safety Stops:**
- Protected file modification detected
- Working tree not clean
- Security policy violation
- Resource limit exceeded

### 10.2 Error Stop Conditions

**Validation Failures:**
- Verification pipeline failed
- Type errors detected
- Lint errors detected
- Test failures

**Tool Failures:**
- Tool adapter crashed
- Tool timeout exceeded
- Tool returned error
- Tool output invalid

### 10.3 Resource Stop Conditions

**Iteration Limits:**
- Maximum iterations reached (default: 3)
- Maximum fix attempts reached (default: 1)
- Maximum runtime exceeded (default: 30 minutes)
- Maximum file changes exceeded (default: 10 files)

**System Limits:**
- Memory usage exceeded
- Disk space insufficient
- Network connectivity lost
- Tool unavailable

### 10.4 Human Intervention Required

**Ambiguous Situations:**
- Multiple valid task candidates
- Conflicting validation results
- Unclear task requirements
- Complex merge conflicts

**Review Required:**
- Large diff generated (>500 lines)
- High-risk model used
- Multiple files modified
- Architecture changes detected

### 10.5 No-op Detection

**Repeated Failure Patterns:**
- Same validation error repeated
- No progress after multiple iterations
- Tool producing identical outputs
- Circular dependency detected

**Stale State Detection:**
- Task unchanged for extended period
- No recent successful runs
- Outdated dependencies detected
- Configuration drift detected

---

## 11. Implementation Phases

### 11.1 RALPH-001: Governance Structure Migration

**Title:** Migrate Roo-specific governance to agent-neutral structure

**Scope:**
- Create `.governance/` directory structure
- Migrate `.roo/rules/` to `.governance/policies/`
- Create initial work contracts in `.governance/contracts/`
- Update SSOK.md to agent-neutral version

**Allowed Files:**
- `.governance/**/*` (new)
- `SSOK.md` (update)
- `.gitignore` (update for new directories)

**Forbidden Files:**
- `.roo/**/*` (preserve existing)
- `src/**/*` (no implementation changes)
- `.env*` (no environment changes)

**Definition of Done:**
- `.governance/` structure exists
- All policies migrated and generalized
- SSOK.md updated to agent-neutral
- `npm run verify` passes

**Verify Command:** `npm run verify`

---

### 11.2 RALPH-002: Task State Management System

**Title:** Implement structured task state management

**Scope:**
- Create `tasks/` directory structure
- Implement task state schema
- Create task state management utilities
- Migrate existing task tracking

**Allowed Files:**
- `tasks/**/*` (new)
- `scripts/agent/task-*.mjs` (new utilities)
- `.governance/schemas/task-state-schema.json` (new)

**Forbidden Files:**
- `ROADMAP.md` (preserve existing format)
- `src/**/*` (no implementation changes)

**Definition of Done:**
- Task state schema defined
- Task state utilities implemented
- Migration script for existing tasks
- `npm run verify` passes

**Verify Command:** `npm run verify`

---

### 11.3 RALPH-003: Tool Adapter Framework

**Title:** Create generic tool adapter framework

**Scope:**
- Create `.agent/adapters/` structure
- Implement base adapter interface
- Create OpenCode adapter (migrate existing)
- Create Roo adapter (new)

**Allowed Files:**
- `.agent/adapters/**/*` (new)
- `scripts/agent/adapters/**/*` (new)
- `.governance/schemas/adapter-schema.json` (new)

**Forbidden Files:**
- `scripts/agent/run-opencode-worker.mjs` (preserve, will be refactored later)
- `src/**/*` (no implementation changes)

**Definition of Done:**
- Base adapter interface defined
- OpenCode adapter implemented
- Roo adapter implemented
- Adapter registry system working
- `npm run verify` passes

**Verify Command:** `npm run verify`

---

### 11.4 RALPH-004: Run Logging System

**Title:** Implement structured run logging and history

**Scope:**
- Create `runs/` directory structure
- Implement run logging utilities
- Create run history management
- Integrate with existing agent scripts

**Allowed Files:**
- `runs/**/*` (new)
- `scripts/agent/run-*.mjs` (update existing)
- `.governance/schemas/run-log-schema.json` (new)

**Forbidden Files:**
- `.agent/state.json` (preserve existing format)
- `src/**/*` (no implementation changes)

**Definition of Done:**
- Run logging schema defined
- Run history system implemented
- Integration with existing scripts
- `npm run verify` passes

**Verify Command:** `npm run verify`

---

### 11.5 RALPH-005: Handoff Management System

**Title:** Implement structured handoff management

**Scope:**
- Create `handoffs/` directory structure
- Implement handoff schema and validation
- Create handoff management utilities
- Migrate existing handoff templates

**Allowed Files:**
- `handoffs/**/*` (new)
- `scripts/agent/handoff-*.mjs` (new utilities)
- `.governance/schemas/handoff-schema.json` (new)

**Forbidden Files:**
- `scripts/agent/write-handoff-template.mjs` (preserve, will be refactored)
- `src/**/*` (no implementation changes)

**Definition of Done:**
- Handoff schema defined
- Handoff management system implemented
- Handoff validation working
- `npm run verify` passes

**Verify Command:** `npm run verify`

---

### 11.6 RALPH-006: Validation Layer Enhancement

**Title:** Enhance validation with state management and history

**Scope:**
- Create `validation/` directory structure
- Implement validation result persistence
- Create validation history tracking
- Integrate with existing VERIFY.md pipeline

**Allowed Files:**
- `validation/**/*` (new)
- `scripts/agent/validation-*.mjs` (new utilities)
- `.governance/schemas/validation-schema.json` (new)

**Forbidden Files:**
- `VERIFY.md` (preserve existing)
- `scripts/agent/run-verify.mjs` (preserve, will be enhanced)
- `src/**/*` (no implementation changes)

**Definition of Done:**
- Validation schema defined
- Validation result persistence implemented
- Validation history tracking working
- Integration with existing VERIFY.md complete
- `npm run verify` passes

**Verify Command:** `npm run verify`

---

### 11.7 RALPH-007: Morning Review System

**Title:** Implement morning review and reporting system

**Scope:**
- Create `reports/` directory structure
- Implement daily report generation
- Create morning review workflow
- Integrate with existing agent state

**Allowed Files:**
- `reports/**/*` (new)
- `scripts/agent/report-*.mjs` (new utilities)
- `.governance/schemas/report-schema.json` (new)

**Forbidden Files:**
- `src/**/*` (no implementation changes)
- `.env*` (no environment changes)

**Definition of Done:**
- Report schema defined
- Daily report generation implemented
- Morning review workflow working
- `npm run verify` passes

**Verify Command:** `npm run verify`

---

### 11.8 RALPH-008: Ralph Loop MVP Implementation

**Title:** Implement core Ralph Loop with safety gates

**Scope:**
- Create core loop orchestrator
- Implement safety gates and stop conditions
- Integrate all previous systems
- Create loop configuration management

**Allowed Files:**
- `scripts/agent/ralph-loop.mjs` (new)
- `scripts/agent/core/` (new directory)
- `.agent/config/loop-config.json` (new)

**Forbidden Files:**
- `scripts/agent/run-auto-task.mjs` (preserve existing)
- `src/**/*` (no implementation changes)

**Definition of Done:**
- Ralph Loop MVP implemented
- Safety gates working
- Stop conditions implemented
- Loop configuration system working
- `npm run verify` passes

**Verify Command:** `npm run verify`

---

### 11.9 RALPH-009: Tool Adapter Integration

**Title:** Integrate existing tools with new adapter framework

**Scope:**
- Refactor existing OpenCode integration
- Create Cline adapter
- Create Codex adapter
- Update tool selection logic

**Allowed Files:**
- `.agent/adapters/**/*` (update)
- `scripts/agent/run-opencode-worker.mjs` (refactor)
- `scripts/agent/select-model.mjs` (update)

**Forbidden Files:**
- `src/**/*` (no implementation changes)
- `.env*` (no environment changes)

**Definition of Done:**
- All tool adapters implemented
- Existing OpenCode integration refactored
- Tool selection logic updated
- `npm run verify` passes

**Verify Command:** `npm run verify`

---

### 11.10 RALPH-010: Legacy Cleanup and Documentation

**Title:** Clean up legacy Roo-specific files and update documentation

**Scope:**
- Update README.md with new governance
- Update AGENTS.md with adapter information
- Create migration documentation
- Optional: Archive .roo/ directory

**Allowed Files:**
- `README.md` (update)
- `AGENTS.md` (update)
- `docs/migration.md` (new)
- `.roo/` (optional archive)

**Forbidden Files:**
- `src/**/*` (no implementation changes)
- `ROADMAP.md` (preserve task structure)

**Definition of Done:**
- Documentation updated
- Migration guide created
- Legacy cleanup completed
- `npm run verify` passes

**Verify Command:** `npm run verify`

---

## 12. Recommendation

### 12.1 Single Smallest Next Task

**Empfohlener nächster Task nach diesem Plan:**

**RALPH-001: Governance Structure Migration**

**Begründung:**
- Fundamentale Basis für alle weiteren Schritte
- Geringes Risiko (nur neue Dateien, keine Änderungen an bestehender Funktionalität)
- Klare Abgrenzung und testbare Ergebnisse
- Ermöglicht parallele Entwicklung der anderen Komponenten

**Konkrete erste Schritte:**
1. Erstelle `.governance/` Verzeichnisstruktur
2. Migriere `.roo/rules/01-global.md` zu `.governance/policies/general-policy.md`
3. Erstelle ersten Work Contract in `.governance/contracts/feature-contract.md`
4. Aktualisiere SSOK.md zu agent-neutraler Version

---

## 13. Handoff

### 13.1 Files Changed

**Neue Datei erstellt:**
- [`plans/RALPH_LOOP_GOVERNANCE_MIGRATION_PLAN.md`](plans/RALPH_LOOP_GOVERNANCE_MIGRATION_PLAN.md)

### 13.2 Checks Run

**Durchgeführte Analysen:**
- Vollständige Analyse der bestehenden Roo-first Governance-Struktur
- Untersuchung aller Agent-Skripte in `scripts/agent/`
- Bewertung der `.agent/` Verzeichnisstruktur und State-Management
- Analyse der bestehenden Verification- und Task-Management-Systeme

### 13.3 Risks

**Identifizierte Risiken:**

1. **Komplexität der Migration:** Die bestehende Agent-Infrastruktur ist bereits sehr ausgereift (Phase A-E), Migration könnte bestehende Workflows unterbrechen

2. **Tool-Abhängigkeiten:** Bestehende OpenCode-Integration ist tief in die Skripte integriert, Abstraktion könnte Performance beeinträchtigen

3. **State-Management-Komplexität:** Neue Task-State-Layer könnte mit bestehendem `.agent/state.json` System kollidieren

4. **Governance-Übergang:** Parallelbetrieb von Roo-Governance und Ralph-Loop-Governance während Migration

### 13.4 Recommended Next Task

**RALPH-001: Governance Structure Migration**

**Warum dieser Task zuerst:**
- Fundamentale Basis ohne Risiko für bestehende Funktionalität
- Ermöglicht schrittweise Migration ohne Breaking Changes
- Klare Abgrenzung und einfache Validierung
- Schafft Grundlage für alle weiteren Ralph-Loop-Komponenten

**Nächste Schritte:**
1. Review dieses Plans durch das Team
2. Genehmigung für RALPH-001 einholen
3. Implementierung von RALPH-001 starten
4. Iterative Umsetzung der weiteren Phasen basierend auf Erfahrungen

**Wichtiger Hinweis:** Dieser Plan ist bewusst konservativ und erhält bestehende Funktionalität. Die Migration kann schrittweise erfolgen, ohne die aktuelle Agent-Infrastruktur zu unterbrechen.