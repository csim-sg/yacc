---
description: Start task development
agent: product-owner
---

Orchestrate $1 task(s) thats between sub-agent. Colleborate or Align the requirements. 

## Workflow
1. Architect to review and understand the task, then plan a handsoff development + QA tasks.
    a. The tasks must be clear and concise
    b. A clear expectation of the task must be presented.
2. Product Owner should review the tasks from step 1, analyze any missed gaps from the user perspective. 
3. If found any gaps, go back to Architect to resolve or re-evaluate the tasks.
4. Repeat 2-3 till all possible gaps are resolved. This is **"Gap Analysis"** Phase
5. Once the tasks are ready, FullStack developer to take over and start the development work. 
6. FullStack developer will create a PR to dev branch once when the development & QA tasks are done. 
    a. Update docs before sending PR
7. Code Reviewer to review the PR created, comment down the analysis in the PR.
    a. **Only fix** docs related blocker directly.
    b. The blocker must have clear descriptions and reasonale. 
    c. Blocker should have clear expectation on the fixes needed. 
    d. Never fix any blocker, even though it might be a simple 1 line. This will cause confusion to developers.
8. FullStack developer will step in if there are blockers found by Code Reviewer in the PR. Fix the PR. 
    a. Never start development without knowing the full context of the issue
    b. Never just fix the blocker, review if the fix will cause other issues.
    c. Before finishing off, review whether all tasks given got fixed.
9. Repeat 5-8 till all development tasks are done and Code Reviewer approved the PR merge. This is **"Development & PR"** phase
10. Code Reviewer merge the PR and start on next issue in the list.

## Stopper and require Human intervention. 
- If there are any blocker or tasks thats not align with documentation. 
- **Gap Analysis** or **Development & PR** iterate more than 10 rounds. 
- **Development & PR**, for more than 2 time, development breaks whats already fixed in the previous iterations.

## Not to do 
- Sub Agent should never call the same Sub Agent
- Sub Agent level must be less than or equal to 2. ie. Main Agent > Sub Agent > Sub Agent. 

## Agents
- Architect & Code Reviewer, @ea-architecture-validator
- FullStack developer & QA test writer, @fullstack-developer
- Product Owner & Documents Writer, @product-owner