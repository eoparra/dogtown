---
name: feature-branch-workflow
description: Use this skill whenever a user wants to add a new feature, fix a bug, make a code change, implement something, or start working on a task in a codebase. Triggers include phrases like add a feature, fix this bug, implement X, make a change to, I want to add, can you build, lets work on, I need to change, update the code to, or create a new endpoint/component/module/function. Also triggers for any request to modify existing code or create new code in a project, or when a user describes a problem to solve, a behavior to change, or a capability to add to their software. Use this skill proactively - if someone is clearly about to start coding work, load it before writing a single line.
---

# Feature Branch Workflow

This skill guides you through a disciplined, safe workflow for implementing features or fixes: branch hygiene first, then understand before acting, then write clean code with tests.

## Phase 1: Git Setup

Before touching any code, get the repo into a clean state.

### 1.1 Detect the project's default branch

```bash
DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || git branch -r | grep -E 'origin/(main|master)' | head -1 | sed 's@.*origin/@@' || echo "main")
echo "Default branch: $DEFAULT_BRANCH"
```

### 1.2 Check for pending changes

```bash
git status --short
```

If there are uncommitted changes, ask the user:

> "You have uncommitted changes on `[current-branch]`. How would you like to proceed?
> 1. **Continue on this branch** — keep working here, no new branch needed
> 2. **Commit, open a PR, then start fresh** — I'll commit your current changes, open a PR for them, then create a new branch off of `[DEFAULT_BRANCH]` for this task"

- If **option 1**: skip the rest of Phase 1 and go directly to Phase 2 with the current branch.
- If **option 2**: commit the pending changes (ask for a commit message or suggest one), push the branch, open a PR, then continue to 1.3 to pull and create a new branch.

If there are **no** pending changes, continue to 1.3.

### 1.3 Verify you're on the default branch

```bash
git branch --show-current
```

If not on the default branch, check it out:
```bash
git checkout "$DEFAULT_BRANCH"
```

### 1.4 Pull latest changes

```bash
git pull origin "$DEFAULT_BRANCH"
```

If there are merge conflicts or the pull fails, stop and inform the user. Don't proceed until the repo is clean and up to date.

### 1.5 Create a feature branch

Derive the branch name from the task description. Use kebab-case and be specific:

- Feature: `feat/add-user-notifications`
- Bug fix: `fix/login-redirect-loop`
- Refactor: `refactor/extract-pricing-service`

```bash
git checkout -b feat/your-descriptive-branch-name
```

Confirm the branch was created:
```bash
git branch --show-current
```

Tell the user the branch name and that you're now working on it.

---

## Phase 2: Understand the Request

Don't start coding yet. First, make sure you fully understand what needs to be built and why.

### 2.1 Receive and restate the instructions

Ask the user to describe what they want, or read their description carefully. Then restate it back in your own words:

> "So you want me to [X], which means [Y], and the expected outcome is [Z]. Is that right?"

This surfaces misunderstandings early, before any code is written.

### 2.2 Create a plan

Break the work into concrete steps. For each step, identify:
- What file(s) will be created or modified
- What the change accomplishes
- Any risk or complexity worth calling out

Present the plan to the user before proceeding. Format it clearly:

```
Plan:
1. [Step description] → affects [file/module]
2. [Step description] → affects [file/module]
...
```

### 2.3 Ask clarifying questions

Surface any ambiguity now, not after writing code. Consider:

- **Scope**: Is this the full feature or a first slice?
- **Edge cases**: What should happen when [X]? What if [Y] is null/empty/missing?
- **Integration**: Does this touch auth, payments, external APIs, or other sensitive systems?
- **Reversibility**: Is this a breaking change? Does it need a migration?
- **Design**: Is there a preference between approach A and approach B?

Keep questions focused — don't ask for things you can figure out from the codebase. Ask only what you genuinely can't infer.

### 2.4 Offer suggestions proactively

If you see a better approach, a pitfall to avoid, or an opportunity the user may have missed, say so:

> "One thing worth considering: [observation]. This could [benefit/risk]. Would you like to [alternative approach]?"

Don't just execute orders blindly — be a thoughtful collaborator.

---

## Phase 3: Codebase Research

Before writing a single line, explore what already exists.

### 3.1 Find reusable logic

Search for existing modules, utilities, services, or functions that overlap with what you're about to build. Look for:

- Similar data transformations or calculations
- Existing validation or error handling patterns
- Shared utilities (date formatting, auth helpers, HTTP clients, etc.)
- Base classes or interfaces you should extend rather than duplicate

If you find something reusable, plan to use it — don't reinvent it.

Use the `Grep` tool (not bash grep) to search for relevant patterns:
- Pattern: `functionName|moduleName|keyword`, file glob: `**/*.ts`

Tell the user what you found:
> "I found an existing `calculatePrice()` function in `src/services/pricing.ts` — I'll reuse that rather than writing a new one."

### 3.2 Check for Prisma schema changes

Determine early whether the task will require changes to `prisma/schema.prisma`. Ask yourself:

- Does this feature add, remove, or rename a model or field?
- Does it change a relation, index, or constraint?
- Does it require a new enum value?

If **yes — schema changes are needed**, flag this in your plan:

> "This feature requires a Prisma schema change. I'll run `db:migrate` after modifying `schema.prisma` and keep the test DB in sync."

Then, **after modifying `schema.prisma`** during implementation:

1. **Apply schema to the local dev database**:
   ```bash
   cd backend && npm run db:push
   ```
2. **Regenerate the Prisma client** (if not already triggered by db:push):
   ```bash
   cd backend && npm run db:generate
   ```
3. **Sync the test database**:
   ```bash
   cd backend && npm run db:test:setup
   ```
4. **Check `seed.ts`** — if you added new required fields or models, update `backend/prisma/seed.ts` so the seed script still runs cleanly.

If **no schema changes are needed**, skip this and continue.

> **Note**: `db:push` is used here for local dev. For production deployments, use `db:migrate` to create versioned migration files that can be reviewed and applied safely across environments.

### 3.3 Understand existing tests

Before writing tests, find what already exists using the `Glob` tool (not bash find):
- Pattern: `**/*.test.*` or `**/*.spec.*` (excluding node_modules)

Review relevant test files. Ask yourself:
- Are there existing tests for the code you're modifying?
- Are any existing tests redundant or could they be merged?
- What's the project's testing style — unit, integration, e2e? Jest? Vitest? Mocha?

If you find redundant or overlapping tests, flag them:
> "I noticed `user.test.ts` and `userService.test.ts` both test the same `createUser` path. Before adding new tests, I'd suggest merging those."

---

## Phase 4: Implementation

Now write the code, following the plan you laid out.

### 4.1 Follow existing patterns

Before writing new code, look at nearby files for:
- Naming conventions (camelCase, PascalCase, snake_case)
- Import styles (named vs default exports)
- Error handling patterns
- Logging conventions
- File/folder organization

Match the style of the surrounding codebase — consistency matters more than personal preference.

### 4.2 Avoid duplication

If you catch yourself writing something that looks like code that already exists elsewhere, stop and refactor. Extract shared logic into a utility or service. If you're modifying a function that's called in many places, make sure you understand all call sites first.

### 4.3 Handle edge cases

Don't write happy-path-only code. Consider:
- Null/undefined inputs
- Empty arrays or objects
- Auth failures and unauthorized access
- Network timeouts and external service failures
- Concurrent operations and race conditions (if relevant)

---

## Phase 4.5: Security Review

Before writing any tests, run a security review on the implementation you just wrote.

```
/security-review
```

This runs against all code changed since the feature branch was created. Review the findings carefully.

**If issues are found**: Fix them before proceeding. Do not write tests around insecure code — the tests would need to be rewritten after the fix anyway. Tell the user what was found and what you changed:

> "Security review flagged [X]. I've fixed it by [Y]. Proceeding to tests."

**If no issues are found**: Confirm and move on:

> "Security review passed. Writing tests now."

---

## Phase 5: Tests

Tests are part of the implementation, not an afterthought.

### 5.1 Write unit tests

For each new function or module, write unit tests that:
- Test the happy path
- Test each meaningful edge case you identified
- Test error/failure conditions
- Are isolated (mock external dependencies)

Name tests clearly: `should [do X] when [Y]`.

### 5.2 Write integration tests

If the change touches:
- API endpoints
- Database queries
- Auth flows
- Multi-step workflows

...write at least one integration test that validates the end-to-end behavior, not just the unit in isolation.

### 5.3 Merge redundant tests

If you identified duplicate or overlapping tests in Phase 3, consolidate them now. A single well-structured test is better than three tests that cover the same thing with slight variations.

### 5.4 Run the tests

```bash
# Run all tests
npm test

# Or run just the affected tests
npm test -- --testPathPattern="feature-name"
```

Don't stop if tests fail — investigate and fix. Tell the user about test failures and what caused them.

### 5.5 Start dev servers (if tests pass)

Only proceed here if all tests passed. If any tests failed, stop and investigate — don't start a broken server.

Check whether ports are already in use before starting:

```bash
lsof -ti:3001 && echo "Port 3001 in use — backend may already be running"
lsof -ti:5173 && echo "Port 5173 in use — frontend may already be running"
```

If ports are free, start both servers as background processes:

```bash
cd backend && npm run dev &
cd frontend && npm run dev &
```

Wait a moment for the backend to initialize, then confirm it's healthy:

```bash
sleep 3 && curl -s http://localhost:3001/api/health && echo "Backend is up"
```

Tell the user:

> "Both dev servers are running in the background:
> - Backend: http://localhost:3001
> - Frontend: http://localhost:5173
>
> You can now manually verify the feature in the browser."

---

## Phase 6: Wrap Up

### 6.1 Self-review

Before handing off, mentally review:
- Does the implementation match the plan from Phase 2?
- Are there any TODOs or stubbed-out areas?
- Did you handle all the edge cases discussed?
- Are there any console.logs or debug artifacts to remove?

### 6.2 Summarize what was done

Give the user a concise summary:

```
Done. Here's what I did:

Branch: feat/your-branch-name

Changes:
- Created/modified [file] to [purpose]
- Added [X] unit tests covering [scenarios]
- Added [Y] integration test for [endpoint/flow]
- Reused existing [module] instead of duplicating logic

Next steps (if any):
- [Migration needed / manual config / env var to add / etc.]
```

### 6.3 Suggest what to review

Point the user to the most important parts to look at — the core logic, any tricky decisions, places where you made assumptions that should be validated.

---

## Handling Common Situations

**"The repo has uncommitted changes"**
Tell the user. Offer to stash them (`git stash`) before pulling and branching, and restore after (`git stash pop`). Don't silently discard work.

**"The user's request is vague"**
Don't guess. Ask the minimum questions needed to make the plan concrete. A 2-minute clarification prevents hours of rework.

**"There's existing code that partially does this"**
Show the user what exists. Ask whether to extend it, replace it, or leave it and build alongside it. Don't make that call unilaterally.

**"The tests are failing before I even start"**
Stop and tell the user. Starting a feature on a broken test suite means you can't verify whether your changes caused new failures.

**"This looks like a larger refactor than expected"**
Scope creep is real. Tell the user what you discovered and let them decide: do the full refactor now, or do the minimum to ship the feature and log a follow-up?
