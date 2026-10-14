# Sportmetryx Football — Business Value, Problem Solved, and Insights

## 1. What problem this project solves

Performance staff in football typically work across disconnected surfaces:
- readiness and availability decisions live in spreadsheets or gut feel;
- workload, recovery, and environment signals are reviewed separately;
- exceptions surface late, after an athlete is already compromised;
- consent and governance are hard to demonstrate;
- data quality issues are discovered after they affect decisions.

Sportmetryx Football puts those surfaces into one operational platform:
- an exception-first **Team Command** view that routes attention to the athletes who need it;
- a **validity-gated performance index** so a number is only shown when the underlying evidence supports it;
- **role-based access** so staff see only what they are allowed to see;
- **consent and audit trails** so governance is visible and defensible;
- **data-quality views** so missing, invalid, or stale data is visible before it becomes a decision problem;
- a **marketplace** layer that turns existing datasets and import jobs into purchasable/browsable data products.

## 2. What the project is, honestly

This is a **decision-support platform**, not a medical device and not an automated selection tool. Scores are labeled by evidence quality:
- **READY / MONITOR / COMPROMISED / WITHHELD** bands;
- **confidence** as an evidence-quality indicator, not a probability;
- every number can be withheld by a validity gate with a reason code.

The platform is a prototype/demo environment with synthetic sample data. It is designed to be demonstrable, auditable, and governance-aware — not to predict injury or make automated lineup decisions.

## 3. Business value

### 3.1. Faster, more defensible operational decisions
Team Command gives staff a single exception-first surface:
- readiness distribution;
- critical/high exception counts;
- position-group summaries;
- recent sessions and baseline activity;
- links into roster, player 360, interventions, and exports.

This reduces the time spent hunting across data sources and makes the "who needs review now?" question easier to answer.

### 3.2. Validity-gated scores reduce reckless use of numbers
A readiness number is only released when the engine's validity gates pass:
- consent state;
- device calibration freshness;
- sample integrity;
- baseline sufficiency;
- capture freshness.

If a gate fails, the composite is withheld with a reason code. That protects the business from acting on weak evidence and makes the platform more trustworthy for staff review.

### 3.3. Explainability supports adoption
Each score includes:
- component breakdown;
- top positive/negative drivers;
- validity checks with status and reason.

That makes the platform easier to explain to athletes, coaches, and medical staff — and easier to trust.

### 3.4. Role-based access and consent support governance
- roles such as ADMIN, PERFORMANCE, MEDICAL, COACH, EXECUTIVE, ATHLETE;
- team-scoped access and IDOR protection for athlete records;
- consent state that can withhold scores and exclude data from research cohorts/exports.

This helps the platform fit real organizational and compliance expectations around who can see what, and under which consent state.

### 3.5. Data quality as a first-class surface
Data Quality & Validity shows:
- invalid samples;
- calibration issues;
- import job outcomes;
- signal staleness;
- withheld scores with reason codes.

That turns hidden data problems into visible workflow items.

### 3.6. Marketplace creates a reusable data-product layer
The marketplace turns existing import jobs and demo datasets into browsable, shortlistable, purchasable data products:
- team roster packages;
- session/workload packages;
- recovery and environment packages;
- per-athlete packages;
- import-job-derived packages.

That makes the platform useful as a **data-products surface**, not just a read-only dashboard.

## 4. Key insights the project demonstrates

### 4.1. Baseline-first is different from population-first
The engine normalizes against each athlete's own baseline percentiles, not against a generic population. That makes comparisons individualized and easier to interpret for that athlete.

### 4.2. Validity should be explicit, not implicit
Instead of showing every number and hoping people read the footnotes, the platform withholds results when evidence is insufficient, and explains why. That is a more honest and more usable design for a demo/support tool.

### 4.3. Confidence is not probability
Confidence is presented as evidence quality, with a clear tooltip and color/text combination. That avoids the common mistake of treating a single "confidence" number as a likelihood of correctness.

### 4.4. Exceptions are the right organizing principle for operations
An exception-first team view is often more operationally useful than a flat roster sorted by score, because the highest-severity cases are the ones that actually need attention.

### 4.5. Governance and consent are part of the product, not an afterthought
Consent state affects scores, exports, and research cohorts. That makes governance visible rather than buried.

### 4.6. The marketplace reframes data as products
Datasets become shortlistable, comparable, previewable, and purchasable. That is a useful mental model for internal data portfolios.

## 5. What was built

### 5.1. Platform surface
- landing/marketing page;
- guest mode for demo access without login;
- authenticated app shell with sidebar, header, and role-aware navigation;
- Team Command, Roster, Position Room, Practice Command, Game Readiness, Recovery Command, Environment & Travel, Data Quality, Research & Exports, Administration & Audit;
- Player 360, Digital Athlete Twin, and Governance & Consent pages.

### 5.2. Scoring and validity
- seven-component performance index with position-model variants;
- athlete-own-baseline normalization;
- validity gates with fail-closed behavior;
- bands, confidence, drivers, explanation, and withheld reason codes.

### 5.3. Auth, access, and governance
- session-based authentication with signed cookies;
- server-enforced RBAC;
- athlete access control;
- consent records and audit logging;
- tamper-evident hash chain for audit entries.

### 5.4. Data ingestion and exports
- validated CSV import;
- import job tracking and error reporting;
- CSV exports for roster and per-athlete data;
- de-identified export option.

### 5.5. Marketplace
- browsable product catalog derived from import jobs and sample datasets;
- search, filters, sort, shortlist/favorites;
- product detail with source summary and sample preview download;
- demo cart and demo checkout;
- shortlist preview and comparison panels.

## 6. What was learned

### 6.1. Honesty labels are not optional
If scores can be withheld, the UI must make that obvious and explain why. Hidden validity logic undermines trust.

### 6.2. One root cause of deployment failures is environment, not code
The app can work locally and still fail in deployment if the database environment, secrets, or serverless bundling are not configured correctly. That is a deployment/operations lesson more than a product lesson.

### 6.3. Exception-first surfaces are easier to act on
Operational tools are more useful when they route attention rather than just display data.

### 6.4. Governance becomes more credible when visible
Consent and audit visibility make the platform easier to defend in a review context.

### 6.5. Data products need metadata
For a marketplace to feel real, products need source, size, availability, tag, and what-include metadata — not just a name and a price.

## 7. Current limitations

- prototype weights and thresholds;
- synthetic sample data for demo/guest modes;
- no live external data feeds;
- demo checkout only; no real payment processing;
- deployment depends on correct database and secret configuration on the host.

## 8. Recommended next steps for business value

- move from prototype weights toward reviewed configuration;
- add more real import sources as available;
- strengthen export and de-identification workflows;
- expand marketplace product metadata and comparison features;
- keep validity-gated design and consent/audit visibility as core differentiators.
