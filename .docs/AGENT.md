Got it 👍
Below is a **clean, concise README-style SYSTEM PROMPT** for the `.docs` folder.

It is written to:

* Explain **why each document exists**
* Be **easy to read and maintain**
* Enforce **governance without over-policing**
* **Leave room for new documents** to be added intentionally

---

# `.docs` — Documentation Governance README

## Purpose

The `.docs` directory is the **authoritative source of truth** for product, architecture, and quality documentation.

Its goals are to:

* Capture **95%+ of user requirements and requests**
* Preserve **business intent**
* Make architectural and product decisions explicit
* Align implementation and testing with documented behavior
* Reduce ambiguity, rework, and undocumented decisions

Documentation exists to **clarify decisions and behavior**, not to document code line-by-line.

---

## Core Principles

All contributors MUST:

* Treat `.docs` as authoritative
* Keep documentation **clear, purposeful, and role-appropriate**
* Avoid duplication across documents
* Update documentation when behavior or decisions change

All contributors MUST NOT:

* Encode undocumented decisions in code
* Duplicate the same content across multiple documents
* Add new documents without a clear reason

---

## Current `.docs` Structure

```
.docs/
├─ 01-product-specification.md
├─ 02-api-and-data-model.md
├─ 03-implementation-guide.md
├─ 04-qa-and-testing.md
├─ 05-quick-reference.md
├─ 06-testing-execution-guide.md
├─ adr/
├─ features/
├─ governance/
└─ temp/
```

---

## Document Purpose & Responsibility

### `01-product-specification.md`

**Why it exists**
Defines **WHAT the product does and WHY**, from the user and business perspective.

**Focus**

* Product vision and goals
* User roles and permissions (business rules)
* Scope (in / out)
* User flows (Mermaid diagrams)
* Features, user stories, acceptance criteria
* UX requirements and wireframe references

---

### `02-api-and-data-model.md`

**Why it exists**
Defines the **system contracts** that implementations must follow.

**Focus**

* API conventions and contracts
* Data models and schemas
* Enums and shared definitions
* Integration boundaries

---

### `03-implementation-guide.md`

**Why it exists**
Explains **HOW the system is built** and documents technical decisions.

**Focus**

* System architecture
* Technology stack
* Component responsibilities
* Deployment and environment considerations
* References to Architecture Decision Records (ADRs)

---

### `04-qa-and-testing.md`

**Why it exists**
Defines **WHAT must be tested** to validate documented product behavior.

**Focus**

* Acceptance criteria summary
* Test scope and priorities
* Coverage expectations
* Traceability to product requirements

---

### `05-quick-reference.md`

**Why it exists**
Provides a **one-page, human-friendly summary** of key decisions and gotchas.

**Focus**

* High-level product summary
* Common pitfalls and decisions
* Links to detailed documents

---

### `06-testing-execution-guide.md`

**Why it exists**
Explains **HOW to execute tests**, not what to test.

**Focus**

* Test setup and execution steps
* Environment configuration
* Automation and tooling instructions

---

### `adr/`

**Why it exists**
Stores **Architecture Decision Records** for traceability and auditability.

---

### `features/`

**Why it exists**
Holds **individual feature specifications** that expand on the product spec.

---

### `governance/`

**Why it exists**
Records architectural and process governance logs and decisions.

---

### `temp/`

**Why it exists**
For **temporary, exploratory, or just-in-time documentation**.

Content here is **non-authoritative** and may be deleted.

---

## Adding New Documents

New documents **may be added** when:

* Existing documents cannot reasonably hold the content
* The document has a **clear, unique purpose**
* Ownership and scope are defined
* Overlap with existing documents is avoided

Before adding a new document, contributors SHOULD answer:

1. What problem does this document solve?
2. Why doesn’t an existing document fit?
3. Who owns and maintains it?

---

## Guiding Rule

> **If a document does not have a clear reason to exist, it should not exist.**

This README defines intent and boundaries —
**details live in the documents themselves.**

---

If you want, next I can:

* Add **document ownership notes** (PO / Architect / QA)
* Create a **change checklist** for updating `.docs`
* Produce a **shorter “TL;DR” version** for onboarding
* Align this README explicitly with your **agent system prompts**

Just tell me 👍
