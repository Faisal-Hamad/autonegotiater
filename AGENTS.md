# AutoNegotiater AI Implementation Instructions

Read AI_IMPLEMENTATION_PLAN.md before making AI negotiation changes.

Important rules:
- Reuse the existing FastAPI/PostgreSQL architecture.
- Reuse existing negotiation and multi-seller code where possible.
- Do not duplicate existing functionality.
- Keep one shared deterministic negotiation engine.
- Gemini handles language, not financial limits.
- Support both one-to-one and one-to-many negotiation.
- Preserve private buyer/seller limits.
- Human approval is required before a final deal.
- Inspect existing models and tests before modifying code.
- Implement incrementally and run tests after each phase.
- Do not commit or push unless explicitly asked.
