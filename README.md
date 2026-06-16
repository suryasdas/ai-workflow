# AI Support Workflow

A beginner-friendly but production-shaped support triage app.

Workflow:

```text
submit ticket -> save ticket -> AI classifies and drafts -> validate output -> save analysis -> human reviews -> approve/edit/reject
```

## Stack

- Next.js App Router
- TypeScript
- Postgres
- Raw SQL through `pg`
- `zod` runtime validation
- Provider abstraction for Anthropic Claude

No ORM is used. SQL is encapsulated behind repository classes.

## Run Locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env` from `.env.example` and set `DATABASE_URL`.

3. Run the migration:

   ```bash
   npm run db:migrate
   ```

4. Start the app:

   ```bash
   npm run dev
   ```

The app uses Anthropic Claude for ticket analysis.

Set:

```bash
ANTHROPIC_API_KEY=your_api_key
ANTHROPIC_MODEL=claude-opus-4-6
```

## OOP Notes While Building

- Entity: `Ticket`, `TicketAnalysis`, and `ReviewAction` are domain objects with identity and meaning.
- Encapsulation: repository classes hide SQL so the UI and services do not know query details.
- Abstraction: `AiSupportProvider` lets the service ask for analysis without coupling workflow orchestration to Anthropic API details.
- Composition: `TicketService` coordinates repositories and an AI provider instead of inheriting from them.
- Coupling: UI code depends on `TicketService`, not on `pg`, which keeps database coupling low.
- Polymorphism: the provider interface remains in place so another implementation can be introduced later without rewriting the workflow service.
- Invariants: ticket state changes are guarded by `assertTicketTransition`.
- Service responsibility: `TicketService` owns workflow orchestration, validation calls, and status transitions.
- Repository pattern: `TicketRepository`, `AnalysisRepository`, and `ReviewRepository` contain raw SQL access.
- Object lifecycle: a ticket moves from `new` to `processing`, then to `processed`, `failed`, `approved`, or `rejected`.
