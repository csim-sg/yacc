---
description: Start task development
agent: product-owner
---

Orchestrate the list of $1 task(s) thats not done to sub-agent. 

## Workflow
lets start handsoff development, follow the below steps
1. @ea-architecture-validator to review and understand the task, then plan a handsoff development + QA tasks.
    a. The tasks must be clear and concise
    b. A clear expectation of the task must be presented.
2. @product-owner should review the tasks, analyze any missed gaps from the user perspective. 
3. If found any gaps, go back to @ea-architecture-validator to resolve or re-evaluate the tasks.
4. Repeat 2-3 till all possible gaps are resolved. This is **"Gap Analysis"** Phase
5. Once the tasks are ready, @fullstack-developer to take over and start the development work. 
6. @fullstack-developer will create a PR to dev branch once when the development & QA tasks are done. 
7. @ea-architecture-validator to review the PR created, comment down the analysis in the PR.
    a. **Only fix** docs related blocker directly.
    b. The blocker must have clear descriptions and reasonale. 
    c. Blocker should have clear expectation on the fixes needed. 
    d. Never fix any blocker, even though it might be a simple 1 line. This will cause confusion to developers.
8. @fullstack-developer will step in if there are blockers found by @ea-architecture-validator in the PR. Fix the PR. 
    a. Never start development without knowing the full context of the issue
    b. Never just fix the blocker, review if the fix will cause other issues.
    c. Before finishing off, review whether all tasks given got fixed.
9. Repeat 5-8 till all development tasks are done and @ea-architecture-validator approved the PR merge. This is **"Development & PR"** phase
10. @ea-architecture-validator merge the PR and start on next issue in the list.

## Stopper and require Human intervention. 
- If there are any blocker or tasks thats not align with documentation. 
- **Gap Analysis** or **Development & PR** iterate more than 10 rounds. 
- **Development & PR**, for more than 2 time, development breaks whats already fixed in the previous iterations.