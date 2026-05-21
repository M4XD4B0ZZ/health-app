# Ralph-Loop Safety Policies

**Gate ownership (safety):** `SAFETY.md` owns safety-gate policy and safety-triggered immediate-stop conditions. Other governance documents may reference these gates but do not redefine them.

## Protected Files

### Absolute Protection (Never Modified by Agents)

**These files must never be modified by any agent under any circumstances:**

#### Environment and Secrets
- `.env` - Environment variables
- `.env.*` - Environment variable variants (`.env.local`, `.env.production`, etc.)
- `secrets/**` - Any secrets directory
- `credentials/**` - Any credentials directory

#### System and Dependencies
- `node_modules/**` - Package dependencies
- `.git/**` - Git metadata and history
- `.gitignore` - Git ignore rules (unless explicitly tasked)

#### Lock Files and Critical Configuration
- `package-lock.json` - Dependency lock file (unless explicitly approved)
- `package.json` - Package configuration (unless explicitly approved)

#### Database Migrations
- `supabase/migrations/**` - Database migrations (unless explicitly tasked)

### Conditional Protection (Explicit Approval Required)

**These files may only be modified with explicit human approval and task authorization:**

#### Package Management
- `package.json` - Only with explicit dependency management task
- `package-lock.json` - Only with explicit dependency management task
- `npm-shrinkwrap.json` - Only with explicit dependency management task

#### Database Schema
- `supabase/migrations/**` - Only with explicit migration task
- Database schema files - Only with explicit schema change task

#### CI/CD Configuration
- `.github/workflows/**` - Only with explicit CI/CD task
- `Dockerfile` - Only with explicit containerization task
- Docker configuration files - Only with explicit deployment task

#### Build Configuration
- `babel.config.js` - Only with explicit build configuration task
- `metro.config.js` - Only with explicit build configuration task
- `webpack.config.js` - Only with explicit build configuration task

## Forbidden Actions

### Never Allowed

**These actions are strictly forbidden for all agents:**

#### External Operations
- **Push to remote repositories** - No `git push` operations
- **Deploy to production environments** - No production deployments
- **Production side effects** - No API calls to production systems
- **Network operations affecting external systems** - No external API modifications

#### Security Violations
- **Secret printing or logging** - Never output secrets to logs or console
- **Credential exposure** - Never expose API keys, passwords, or tokens
- **Environment variable printing** - Never log environment variables

#### Destructive Operations
- **Destructive deletes of source files** - No `rm -rf` on source code
- **Database drops or truncates** - No destructive database operations
- **Git history modification** - No `git rebase`, `git reset --hard`, etc.

#### Unauthorized Modifications
- **Modification of `.env` files** - Never change environment configuration
- **Installation of dependencies without approval** - No `npm install` without explicit task
- **Global system changes** - No system-wide configuration changes

### Approval Required

**These actions require explicit human approval before execution:**

#### Database Operations
- **Database migrations** - Schema changes require approval
- **Data migrations** - Data transformation requires approval
- **Index creation/deletion** - Performance-affecting changes require approval

#### Dependency Management
- **Package installation** - New dependencies require approval
- **Package updates** - Version changes require approval
- **Package removal** - Dependency removal requires approval

#### Configuration Changes
- **Build configuration** - Changes to build process require approval
- **CI/CD configuration** - Workflow changes require approval
- **Environment configuration** - Environment setup changes require approval

#### Deployment Operations
- **Edge function deployment** - Supabase function deployment requires approval
- **Database deployment** - Schema deployment requires approval
- **Production configuration** - Any production setting requires approval

## Safety Gates

### Pre-execution Safety Checks

**These checks must pass before any agent execution:**

#### Repository State
- **Clean working tree verification** - No uncommitted changes
- **Branch state check** - Verify current branch is safe for changes
- **Remote sync check** - Verify local branch is up to date

#### File Protection
- **Protected file modification detection** - Scan for protected file changes
- **Permission verification** - Verify agent has appropriate permissions
- **Backup verification** - Ensure recovery options exist

#### Scope Validation
- **Dangerous operation detection** - Scan for forbidden operations
- **Scope boundary validation** - Verify changes stay within task scope
- **Dependency impact assessment** - Check for unintended side effects

### Runtime Safety Monitoring

**These monitors must be active during agent execution:**

#### File System Monitoring
- **File modification tracking** - Log all file changes
- **Protected file access attempts** - Block and log protection violations
- **Directory traversal monitoring** - Prevent unauthorized directory access

#### Network Monitoring
- **Network request monitoring** - Log all external network calls
- **API endpoint validation** - Verify endpoints are approved for agent use
- **Rate limiting enforcement** - Prevent API abuse

#### Process Monitoring
- **Process execution monitoring** - Log all subprocess executions
- **Resource usage monitoring** - Prevent resource exhaustion
- **Timeout enforcement** - Prevent runaway processes

### Post-execution Safety Validation

**These validations must pass after agent execution:**

#### Change Validation
- **Changed file review** - Verify all changes are within scope
- **Diff size validation** - Flag large or unexpected changes
- **Protected file violation check** - Confirm no protected files were modified

#### Security Validation
- **Security scan results** - Run security scans on changed files
- **Secret detection** - Scan for accidentally committed secrets
- **Vulnerability assessment** - Check for introduced vulnerabilities

#### Quality Validation
- **Verification pipeline results** - All verification must pass per [`VERIFY.md`](../VERIFY.md)
- **Code quality checks** - Lint and type checking must pass
- **Test execution results** - All tests must pass

## Safety Stop Rules

### Immediate Stop Conditions

**Agent execution must stop immediately when these conditions occur:**

#### Protection Violations
- **Protected file modification attempt** - Stop on any protected file access
- **Forbidden action detection** - Stop on any forbidden operation attempt
- **Security policy violation** - Stop on any security rule violation

#### System Safety
- **Resource exhaustion** - Stop if system resources are depleted
- **Network connectivity loss** - Stop if external dependencies fail
- **File system errors** - Stop on file system corruption or errors

#### Validation Failures
- **Verification pipeline failure** - Stop if verification fails
- **Safety gate failure** - Stop if any safety check fails
- **Quality threshold violation** - Stop if quality metrics fail

### Escalation Procedures

**When safety stops occur, follow these procedures:**

#### Immediate Actions
1. **Preserve current state** - Save all work in progress
2. **Document the violation** - Record what triggered the safety stop
3. **Isolate the issue** - Prevent further safety violations
4. **Alert human oversight** - Notify human reviewers immediately

#### Recovery Actions
1. **Assess damage** - Determine scope of any safety violations
2. **Rollback if necessary** - Revert changes that caused violations
3. **Fix root cause** - Address underlying safety issue
4. **Verify safety** - Confirm safety policies are restored

## Protected-File Violation Handling

### Detection
- **Real-time monitoring** - Detect protected file access attempts immediately
- **Pre-commit hooks** - Prevent commits containing protected file changes
- **Automated scanning** - Regular scans for protection violations

### Response
- **Immediate block** - Prevent the violating operation from completing
- **Detailed logging** - Record full context of the violation attempt
- **Human notification** - Alert human reviewers of the violation
- **Automatic rollback** - Revert any partial changes if safe to do so

### Recovery
- **Violation analysis** - Understand why the violation occurred
- **Policy update** - Update policies if legitimate need exists
- **Agent retraining** - Update agent behavior to prevent recurrence
- **Process improvement** - Improve safety systems based on lessons learned