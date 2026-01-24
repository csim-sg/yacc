# 05. Quick Reference Card

**YACC - One-Page MVP Decision Summary**

---

## Project Overview

YACC — Omni-channel social inbox. Phase 1 platforms: Telegram + IRC. Phase 2 platforms: WhatsApp, WeChat, Meta, X.

See [01-product-specification.md](./01-product-specification.md) for full scope and user stories, and [03-implementation-guide.md](./03-implementation-guide.md) for architecture and tech stack.

---

## Common Gotchas

| Gotcha | Solution |
|--------|----------|
| **Retry loops**: User hits retry multiple times | Disable retry button after 1 attempt, show timeout |
| **Notification spam**: Same conversation assigned twice | Dedup by (user_id, conversation_id, type) |
| **Search lag**: Message not searchable immediately | Index in real-time or batch every 5 minutes |
| **Status confusion**: Conversation auto-reopens | Show reason in UI: "Reopened: new message from customer" |
| **Bulk failure silent**: 50 of 100 fail without feedback | Always return failure list with reasons |
| **Group threading wrong**: Messages in separate conversations | Design: one conversation per group (Telegram group ID) |
| **Role check missing**: User can do admin action | Enforce RBAC on every endpoint via middleware |
| **Attachment not deleted**: R2 grows unbounded | Manual cleanup or archival policy (defer to Phase 2) |

---

## Checklist for Dev Kickoff

- [ ] Read 01-product-specification.md (features + user stories)
- [ ] Review 02-api-and-data-model.md (API + data model)
- [ ] Review 03-implementation-guide.md (architecture, phases)
- [ ] Check 04-qa-and-testing.md (ACs, regression suite)
- [ ] Keep 05-quick-reference.md pinned for quick lookup
- [ ] Setup PostgreSQL + Redis locally
- [ ] Setup Cloudflare R2 bucket (or MinIO locally)

---

## Quick Links

| Document | Purpose |
|----------|---------|
| **01-product-specification.md** | Product scope, features, user stories (20 stories, 130+ ACs) |
| **02-api-and-data-model.md** | Complete API contract + database schema |
| **03-implementation-guide.md** | Architecture, tech stack, code examples, phases |
| **04-qa-and-testing.md** | Test cases, acceptance criteria, regression suite |
| **05-quick-reference.md** | This file — one-page cheat sheet |

---

## Key Contacts / Decision Makers

**Product Owner**: [Name] — Feature scope, acceptance criteria decisions  
**Tech Lead**: [Name] — Architecture, technical implementation decisions  
**QA Lead**: [Name] — Testing strategy, release criteria  

---

**Version**: 1.0  
**Last Updated**: January 17, 2026  
**Status**: MVP Ready for Launch  

**Print this page. Pin it on your wall. Reference frequently. 📌**
