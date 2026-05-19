# Ralph-Loop Review Policy

## Human Review Purpose

**Human review is a safety feature, not a failure.**

The Ralph-Loop system is designed to stop after each task completion for human review. This is an intentional safety mechanism to ensure quality, catch issues early, and maintain human oversight of the development process.

## What Humans Review After Each Run

### Task Completion Assessment
- **Task scope adherence** - Verify the agent stayed within the defined task boundaries
- **Implementation quality** - Review the technical approach and code quality
- **Architecture compliance** - Ensure architecture boundaries were respected
- **Safety compliance** - Confirm no protected files were modified inappropriately

### Change Review
- **File changes** - Review all modified, added, or deleted files
- **Diff analysis** - Examine the specific changes made to each file
- **Unintended changes** - Look for modifications outside the task scope
- **Code quality** - Assess readability, maintainability, and best practices

### Verification Results
- **Verification pipeline** - Review results of `npm run verify` and related checks
- **Test results** - Examine test execution outcomes
- **Lint and type checking** - Review static analysis results
- **Edge function verification** - Check edge function tests if applicable

### Documentation and Handoff
- **Handoff quality** - Review the agent's handoff documentation
- **Decision rationale** - Understand why specific implementation choices were made
- **Issue documentation** - Review any problems or blockers encountered
- **Next steps** - Assess recommendations for follow-up work

## What Can Be Accepted Automatically

### Low-Risk Changes
- **Documentation updates** - Changes to `.md` files that don't affect functionality
- **Test additions** - New tests that increase coverage without changing behavior
- **Code formatting** - Automated formatting changes that don't affect logic
- **Comment additions** - Code comments that improve readability

### Successful Verification
- **All checks pass** - When `npm run verify` and all required checks pass
- **No protected file changes** - When no safety policies were violated
- **Single-file changes** - Small, focused changes to a single file
- **Clear task alignment** - When changes clearly match the task requirements

### Routine Maintenance
- **Dependency updates** - When explicitly tasked and all tests pass
- **Configuration updates** - When explicitly tasked and verification passes
- **Refactoring** - When explicitly tasked, well-scoped, and all tests pass

## What Requires Manual Review

### High-Risk Changes
- **Multiple file modifications** - Changes spanning multiple files require review
- **Architecture changes** - Any modifications to system architecture
- **New dependencies** - Addition of new packages or external dependencies
- **Database changes** - Schema modifications or migration scripts

### Quality Concerns
- **Large diffs** - Changes exceeding 500 lines require careful review
- **Complex logic** - Intricate algorithms or business logic changes
- **Performance implications** - Changes that may affect system performance
- **Security implications** - Changes that may affect system security

### Verification Issues
- **Partial verification failure** - When some but not all checks pass
- **Test failures** - When existing tests fail due to changes
- **Type errors** - When TypeScript compilation issues arise
- **Lint violations** - When code style violations are introduced

### Scope Concerns
- **Scope creep** - When changes extend beyond the original task
- **Unrelated changes** - When modifications don't align with the task
- **Side effects** - When changes may have unintended consequences
- **Breaking changes** - When modifications may break existing functionality

## Failed Task Handling

### Task Failure Categories
- **Verification failure** - Task implementation fails verification pipeline
- **Safety violation** - Task violates safety policies or protected files
- **Scope violation** - Task implementation exceeds defined boundaries
- **Technical failure** - Task cannot be completed due to technical issues

### Failure Response Process
1. **Document the failure** - Record what went wrong and why
2. **Preserve work** - Save any partial progress that may be valuable
3. **Analyze root cause** - Understand the underlying issue
4. **Update task status** - Mark task as `blocked` or `failed` in [`ROADMAP.md`](../ROADMAP.md)
5. **Plan remediation** - Determine next steps to address the failure

### Failure Recovery Options
- **Task refinement** - Break down the task into smaller, more manageable pieces
- **Prerequisite identification** - Identify missing dependencies or requirements
- **Approach change** - Consider alternative implementation strategies
- **Human intervention** - Escalate to human developer for complex issues

## Blocked Task Handling

### Common Blocking Conditions
- **Missing dependencies** - Required tools, libraries, or services unavailable
- **External dependencies** - Waiting for third-party services or approvals
- **Unclear requirements** - Task specification is ambiguous or incomplete
- **Technical constraints** - Current system limitations prevent implementation

### Blocking Response Process
1. **Identify blocking condition** - Clearly document what is preventing progress
2. **Update task status** - Mark task as `blocked` in [`ROADMAP.md`](../ROADMAP.md)
3. **Document blocker** - Record the specific blocking condition and context
4. **Identify resolution path** - Determine what needs to happen to unblock
5. **Escalate if necessary** - Involve human decision-makers for resolution

### Unblocking Strategies
- **Dependency resolution** - Install required tools or obtain necessary access
- **Requirement clarification** - Work with stakeholders to clarify ambiguous requirements
- **Alternative approaches** - Find workarounds or alternative implementation paths
- **Scope adjustment** - Modify task scope to work within current constraints

## Rollback and Revision Principles

### When to Rollback
- **Safety violations** - Immediate rollback when safety policies are violated
- **Breaking changes** - Rollback when changes break existing functionality
- **Quality degradation** - Rollback when changes significantly reduce code quality
- **Scope violations** - Rollback when changes exceed authorized scope

### Rollback Process
1. **Assess impact** - Determine the scope of changes that need to be reverted
2. **Preserve learning** - Document what was learned before rolling back
3. **Execute rollback** - Revert changes using appropriate Git operations
4. **Verify restoration** - Confirm system is restored to previous working state
5. **Update documentation** - Record the rollback and reasons in appropriate files

### Revision Strategies
- **Incremental fixes** - Make small, targeted fixes to address specific issues
- **Partial acceptance** - Accept parts of the work while rejecting problematic sections
- **Iterative improvement** - Use multiple small revisions to reach the desired state
- **Alternative implementation** - Start fresh with a different approach

## Morning Review Expectations

### Daily Review Cycle
- **Review overnight work** - Examine any agent work completed since last review
- **Assess progress** - Evaluate progress toward current milestones and goals
- **Identify issues** - Look for any problems or concerns that need attention
- **Plan daily priorities** - Determine which tasks should be prioritized

### Morning Review Checklist
- [ ] **Repository state** - Verify repository is in a clean, consistent state
- [ ] **Task status** - Review current task statuses in [`ROADMAP.md`](../ROADMAP.md)
- [ ] **Verification results** - Check that all verification pipelines are passing
- [ ] **Safety compliance** - Confirm no safety violations occurred
- [ ] **Quality metrics** - Review code quality and test coverage metrics
- [ ] **Blockers and issues** - Identify any blockers that need resolution

### Morning Review Outcomes
- **Approval** - Accept completed work and allow progression to next tasks
- **Revision requests** - Request specific changes or improvements
- **Task reprioritization** - Adjust task priorities based on current needs
- **Blocker resolution** - Take action to resolve identified blockers
- **Process improvements** - Identify and implement process improvements

## Review Quality Standards

### Review Thoroughness
- **Complete diff review** - Examine every changed line of code
- **Context understanding** - Understand the broader context of changes
- **Impact assessment** - Consider the full impact of changes on the system
- **Future implications** - Think about long-term consequences of changes

### Review Documentation
- **Review notes** - Document key findings and decisions from review
- **Approval rationale** - Record why changes were approved or rejected
- **Improvement suggestions** - Note opportunities for future improvements
- **Learning capture** - Document lessons learned for future reference

### Review Consistency
- **Standard criteria** - Apply consistent review standards across all changes
- **Quality benchmarks** - Maintain consistent quality expectations
- **Process adherence** - Ensure review process is followed consistently
- **Continuous improvement** - Regularly refine and improve review processes