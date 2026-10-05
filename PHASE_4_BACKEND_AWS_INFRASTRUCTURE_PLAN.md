# Phase 4 — Backend AWS Infrastructure: Implementation Plan (PLAN ONLY, NOT EXECUTED)
## Handyman Services Marketplace

**Status: PLAN ONLY.** Nothing in this document has been created, modified, deleted, or mutated. Every fact below about "existing" resources comes directly from a live, read-only AWS API inspection performed in the preceding INSPECT step (account `129741467723`, region `ap-south-1`), not from assumption. No AWS mutation, no database migration, no frontend change, and no deployment will happen until this plan is explicitly approved, and even then only in the order and with the approvals specified in §15/§K below.

---

## 1. VPC / network architecture

**Current state (inspected, not assumed):**
- One VPC: `vpc-01e7d0be9e2387607` — the account's **default VPC**, CIDR `172.31.0.0/16`.
- Three subnets, one per AZ, all with `MapPublicIpOnLaunch: true`: `subnet-07b6a7e9e5943ecc4` (ap-south-1a), `subnet-028cf6b843e960506` (ap-south-1b), `subnet-03c199a9916716dc1` (ap-south-1c).
- One route table (the VPC's main table, implicitly associated with all three subnets) with a `0.0.0.0/0 → igw-0ad17a027abdb4698` route. **All three subnets are, in practice, public subnets.**
- **No NAT Gateway exists.**
- `database-1` (RDS) already sits in all three of these subnets via its DB subnet group, and is already `PubliclyAccessible: false`.

**Are new private subnets required?**

Not strictly, and I recommend against creating them in this phase. Reasoning: RDS's actual exposure is governed by `PubliclyAccessible=false` + its security group, not by whether its subnet has a route to an Internet Gateway — a resource in a "public" subnet is not reachable from the internet unless it both has a public IP/DNS *and* a security group that allows the inbound traffic. RDS has neither. Moving RDS into a new private subnet would require modifying its DB subnet group (a production RDS change), which is explicitly out of scope for this phase and not something you asked for. So creating private subnets would only ever matter for where ECS runs, not for RDS's safety.

**Is a NAT Gateway required?**

Only if ECS tasks run in a private subnet with no other route to the internet (ECS Fargate tasks need to reach ECR to pull the image, the regional Cognito/CloudWatch Logs endpoints, and S3 — all internet-routable AWS service endpoints unless VPC Interface Endpoints are used instead). Two real options:

| | **Option A — Public subnets + tight security groups (RECOMMENDED for this phase)** | **Option B — New private subnets + NAT Gateway** |
|---|---|---|
| What changes | Nothing new in networking. ECS tasks run in the same 3 existing subnets, each task gets a public IP (`assignPublicIp: ENABLED`, required in a subnet with no NAT so the task can reach ECR/Cognito/CloudWatch), but a security group allows inbound **only** from the ALB — nothing else can reach a task directly even though it technically has a public IP. | Create 2 new private subnets (no IGW route) in 2 AZs, 1 NAT Gateway (in an existing public subnet), new route table for the private subnets pointing egress at the NAT Gateway. ECS tasks move to the private subnets with `assignPublicIp: DISABLED`. ALB stays in the existing public subnets. RDS is **not** moved (out of scope here), so it remains in the "public" subnets regardless — this option does not change RDS's actual security posture at all. |
| Ongoing cost | No new fixed cost. | ~$32–35/month for the NAT Gateway itself (ap-south-1, 1 AZ) **plus** per-GB data-processing charges for all egress traffic through it (ECR pulls, logs, S3, Cognito calls) — I have not verified current exact rates and won't invent a number; this is a real, ongoing line item that scales with traffic. |
| Operational complexity | Lower — fewer resources to create, monitor, and eventually roll back. | Higher — more subnets, route tables, and a NAT Gateway to manage and pay for; a single-AZ NAT Gateway is also itself a single point of failure unless a second one is added per AZ (further cost). |
| Security benefit over Option A | None for RDS (already not publicly accessible either way). For ECS specifically: tasks have no public IP at all, which is a genuine (if modest) reduction in the theoretical internet-facing attack surface, since Option A's tasks do hold a public IP even though the security group blocks everything but the ALB. | — |
| Matches original Phase 2 AWS design doc's aspirational diagram | Partially — the diagram envisioned private subnets for compute, but didn't anticipate that RDS would stay in the current public-only subnet layout, which this inspection found to already be the case. | More literally, for ECS only (RDS is unchanged either way). |

**Recommendation (not implemented): Option A.** For an initial small-production workload, the security group is the actual control that matters, Option A achieves the same practical isolation for ECS as Option B does, it doesn't touch RDS, it's reversible, and it avoids an ongoing cost that isn't yet justified by traffic or a stated compliance requirement. Option B remains available to revisit later (e.g., if a compliance review specifically requires "no public IP on compute," or once traffic/budget justifies it) without re-architecting anything else — it only ever affects where ECS tasks live.

**ALB placement:** existing public subnets (all three), regardless of which option is chosen — the ALB is meant to be internet-facing.

**ECS Fargate placement:** existing public subnets (Option A, recommended) or new private subnets (Option B).

**RDS placement/access:** **unchanged** in either option — stays in its current DB subnet group, stays `PubliclyAccessible: false`. The only RDS-adjacent change in this plan is a security-group rule (§2/§7/§15).

---

## 2. Security groups

**Existing (inspected):**
- `sg-03a13443873cc3b39` ("handyman-rds-sg") — inbound: TCP 3306 from `117.214.73.68/32` only. Outbound: all traffic.
- `sg-0ee66d87adc7d993d` ("default") — standard default VPC SG, not attached to RDS, not otherwise relevant here.

**New security groups required:**

**`handyman-alb-sg`** (new)
- Inbound: TCP 80 from `0.0.0.0/0` (HTTP). TCP 443 from `0.0.0.0/0` once an ACM certificate exists (§6).
- Outbound: TCP to the ECS container port, destination = `handyman-ecs-sg` only (tighter than "all traffic," since the ALB only ever needs to reach the backend).

**`handyman-ecs-sg`** (new)
- Inbound: TCP `<container port, e.g. 4000>` from `handyman-alb-sg` only. Nothing else, from no other source.
- Outbound: all traffic, `0.0.0.0/0` — required under Option A (§1) so tasks can reach ECR, Cognito, CloudWatch Logs, and S3 over the internet. (Under Option B this could instead be scoped to the NAT Gateway's route only, but the SG rule itself would look the same — the privacy comes from the route table, not the SG, in that option.)

**`handyman-rds-sg`** (existing — one rule added, nothing removed by default)
- **Add:** inbound TCP 3306, source = `handyman-ecs-sg` (a security-group reference, not a CIDR) — this is what actually lets the backend reach the database.
- **Decision point for you:** keep or remove the existing `117.214.73.68/32` rule (looks like a developer's own IP for manual MySQL client access). I recommend keeping it unless you tell me that IP is stale or you want DB access locked to ECS-only — either way, **`0.0.0.0/0` is never used for 3306**, in either the kept or removed scenario.
- Outbound: unchanged.

---

## 3. ECR

- **New repository** (proposed name, pending your confirmation): `handyman-backend`.
- **Image/tag strategy:** tag every build with its git commit SHA (immutable, traceable to exact source) as the primary deployment reference; optionally also push a mutable `latest` tag for convenience during early development. Recommend enabling ECR **tag immutability** on the commit-SHA tag pattern so a pushed image can never be silently overwritten.
- **Containerization:** the backend currently has **no Dockerfile** (confirmed absent in the repo during INSPECT). Plan: a multi-stage Dockerfile — stage 1 installs dependencies and runs `tsc` to produce `dist/`; stage 2 copies only `dist/` + production `node_modules` into a slim runtime base (e.g. `node:22-alpine`), runs as a non-root user, exposes the app's `PORT`. Not built or pushed in this plan step — this is a described approach, not code written or executed yet.

---

## 4. ECS Fargate

- **Cluster** (new, proposed name): `handyman-cluster` — Fargate launch type only, no EC2 capacity provider.
- **Task definition:**
  - **CPU/memory:** 0.25 vCPU / 0.5 GB (256 / 512) as the starting point — matches "initial small production workload" and the existing backend's own modest DB connection pool (5–20 connections per the Phase 2 design). Can be resized later with no architectural change.
  - **Port mapping:** container port = the app's `PORT` (default `4000` per `src/config/env.ts`), mapped 1:1 to the ALB target group.
  - **Health check:** the ALB target group's own health check against `GET /health` (already implemented, unauthenticated, per Phase 3 code) is the primary signal. An optional container-level `HEALTHCHECK` can be added if the base image supports `curl`/`wget`, but is not strictly required since the ALB target group check already covers it.
  - **Desired count:** **1**, recommended for this stage — matches "do not over-engineer," lowest cost. Trade-off to accept explicitly: with `desiredCount=1`, a rolling deployment will briefly take the single task down before the replacement is healthy (a few seconds to low tens of seconds of downtime per deploy), since `minimumHealthyPercent` can't stay at 100% with only one task. Moving to `desiredCount=2` later removes this trade-off at roughly double the compute cost — your call, not decided here.
  - **Deployment strategy:** ECS native rolling update. At `desiredCount=1`: `minimumHealthyPercent=0`, `maximumPercent=200` (brief downtime per deploy, as above). At `desiredCount=2`: `minimumHealthyPercent=100`, `maximumPercent=200` (zero-downtime deploys).
  - **CloudWatch logging:** `awslogs` driver, new log group `/ecs/handyman-backend`, recommend 30-day retention (cost control — logs aren't free to retain indefinitely).
  - **Environment variables (non-secret), using only inspected real values:**
    `NODE_ENV=production`, `PORT=4000`, `API_BASE_PATH=/api/v1`, `AWS_REGION=ap-south-1`, `COGNITO_REGION=ap-south-1`, `COGNITO_USER_POOL_ID=ap-south-1_EQEjEvk2M`, `COGNITO_CUSTOMER_APP_CLIENT_ID=1k0cuqjjs55bo6egeb017nmpg3` (the existing "Handyman Services Web" client — see §8 for why), `S3_BUCKET_NAME=handyman-services-media-2026`, `S3_REGION=ap-south-1`, `DB_HOST=database-1.cj8aggs8ag16.ap-south-1.rds.amazonaws.com`, `DB_PORT=3306`, `CORS_ALLOWED_ORIGINS=https://handymanservices.in` (plus any other real frontend origin you confirm).
    `COGNITO_ADMIN_PROVIDER_APP_CLIENT_ID` and `DB_NAME` are intentionally left out above — the former doesn't exist yet (§8), the latter needs you to confirm the real production schema name before I put it in a task definition (not invented here).
  - **Secrets (via ECS `secrets`, pulled from Secrets Manager at task start — never plaintext env vars):** `DB_USER`, `DB_PASSWORD`. (Cognito/S3 need no password-style secret — access is via IAM role and public JWKS respectively.)

---

## 5. IAM

No role is created in this plan step. Two are required:

- **`handyman-ecs-task-execution-role`** — trust policy: `ecs-tasks.amazonaws.com`. Permissions: the AWS-managed `AmazonECSTaskExecutionRolePolicy` (ECR image pull + CloudWatch Logs) plus a scoped inline policy granting `secretsmanager:GetSecretValue` limited to the exact ARNs of the DB credential secret(s) created in §10 — not `secretsmanager:*`, not a wildcard resource.
- **`handyman-ecs-task-role`** — assumed by the running Node.js app itself (via the AWS SDK's default credential provider chain, which is why the Phase 3 code never needs `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` set in production — see `env.ts`'s own comment to that effect). Permissions: `s3:PutObject`, `s3:GetObject` (and `s3:DeleteObject` if the media-delete endpoint needs it) scoped to `arn:aws:s3:::handyman-services-media-2026/*` only — never the bucket ARN alone, never `s3:*`.
- **Cognito IAM access:** **not required** for the backend's normal operation — JWT verification happens by fetching Cognito's public JWKS over plain HTTPS, which needs no IAM permission at all. The one place real Cognito IAM access would eventually matter is the Admin disable/enable-account action, which Phase 3 explicitly left **not wired to a real Cognito Admin API call** (flagged in `PHASE_3_BACKEND_IMPLEMENTATION.md` §17 as a known gap, since no real Cognito existed to test against then). I'm flagging this as a future permission to add once that gap is actually closed — not adding it speculatively now, since least-privilege means granting what's used, not what might be used.

---

## 6. ALB

- **Load balancer:** new, Application Load Balancer, internet-facing, in the 3 existing subnets (§1), security group = `handyman-alb-sg`.
- **Target group:** type `ip` (required for Fargate awsvpc networking), protocol HTTP, port = container port, health check path `GET /health`, healthy threshold 2, unhealthy threshold 3, interval 30s, timeout 5s, success matcher `200`.
- **Listener:** HTTP :80 → forwards to the target group, for initial bring-up.
- **HTTP vs HTTPS:** HTTP-only is acceptable for an initial, non-public smoke-test deployment but **is not acceptable for real customer traffic** — Cognito bearer tokens would travel in plaintext. HTTPS requires an **ACM certificate** for the API subdomain (e.g. `api.handymanservices.in`), which in turn requires DNS validation (a CNAME record at GoDaddy, or delegating the zone to Route 53 — this is Open Question #23 in `PHASE_2_BACKEND_OPEN_QUESTIONS.md`, still genuinely open and not decided here). Recommend treating the HTTPS listener + ACM cert as a required step before any real traffic is routed through this ALB, immediately following the DNS decision — not an optional nice-to-have for later.

---

## 7. RDS

- **`database-1` is used exactly as it exists.** Not recreated, not resized, not re-engined, not made publicly accessible, no schema or data change in this phase.
- **The only required change:** the security-group rule addition in §2/§15 — add `handyman-rds-sg` inbound TCP 3306 from `handyman-ecs-sg`. This is the one and only way the new backend can reach the existing database.
- **Flagged existing conditions (not changed by this plan, confirmed via inspection, carried over from `PHASE_2_BACKEND_OPEN_QUESTIONS.md` item 24, still open):** `DeletionProtection: false`, `BackupRetentionPeriod: 1 day`, `MultiAZ: false`. These are pre-existing facts about the instance as it already stands, not something Phase 4 is asked to fix — surfaced here so they're documented, not silently carried forward unremarked.

---

## 8. Cognito

- **Existing pool:** `ap-south-1_EQEjEvk2M`, email+password sign-in, `MfaConfiguration: OFF`, zero Groups currently, one app client ("Handyman Services Web", `1k0cuqjjs55bo6egeb017nmpg3`, public client — no secret, `ExplicitAuthFlows` includes `ALLOW_USER_AUTH`/`ALLOW_USER_SRP_AUTH`, i.e. built for direct SDK sign-in, not a hosted-UI redirect flow).
- **One loose end found during this inspection, worth flagging:** that client's `CallbackURLs` is still AWS's own placeholder (`https://d84l1y8p4kdic.cloudfront.net`), not your real frontend domain. Since the app appears to authenticate via direct Cognito SDK calls (SRP/USER_AUTH) rather than an OAuth redirect, this placeholder likely doesn't block the backend's bearer-token verification today — but it should be corrected before any feature that does rely on OAuth hosted-UI redirects is built. Flagging, not fixing, since this is a Cognito modification and the instruction is "do not modify Cognito yet."
- **Required (not created yet):**
  - Three Cognito **Groups**: `customer`, `admin`, `provider` — these don't need any IAM role attached; they only need to exist so that adding a user to one populates the `cognito:groups` claim the backend's authorization middleware already reads.
  - A **second app client** ("Admin/Provider" client, public, no secret — mirroring the existing client's auth-flow configuration) — per the already-approved two-app-client design in `PHASE_2_AUTHORIZATION_MATRIX.md` §4.
- **Authorization model (unchanged, confirmed against real resources):** the backend verifies the JWT's signature against this pool's JWKS, checks `iss`/`aud`/`exp`, and reads the role from the token's `cognito:groups` claim — never from a client-supplied value. This matches the existing code exactly; nothing about this model changes in Phase 4.
- **Nothing in Cognito is modified in this plan step.**

---

## 9. S3

- **Existing bucket:** `handyman-services-media-2026`, `ap-south-1`, all four Block Public Access settings `true`, SSE-S3 (AES256) encryption on by default, **no bucket policy**, **no CORS configuration**.
- **Public access block stays exactly as-is — not relaxed.**
- **Presigned URL architecture (already designed in Phase 2/3, unchanged):** the backend's task role (§5) generates short-lived presigned `PUT`/`GET` URLs server-side; the browser uploads/downloads directly to/from S3 using that URL; the frontend never receives a long-lived AWS credential.
- **Required CORS configuration** (not applied yet) — needed because a presigned `PUT` from the browser is a cross-origin request from the frontend's own domain to the S3 endpoint:
  ```json
  [{
    "AllowedOrigins": ["https://handymanservices.in"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }]
  ```
  (Add the Vercel preview-deployment origin pattern too if you want preview builds to be able to upload media — your call.)
- **Nothing in S3 is modified in this plan step.**

---

## 10. Secrets

- **Recommend ECS `secrets` injection from AWS Secrets Manager** (not plaintext environment variables, not hardcoded anywhere) for exactly: `DB_USER`, `DB_PASSWORD`.
- Everything else the task definition needs (Cognito pool/client IDs, S3 bucket name, region, etc.) is **not secret** — these are safe as plain task-definition environment variables (§4), consistent with how Cognito pool/client IDs are treated elsewhere (public, non-sensitive identifiers).
- **Never:** in source code, in git, in this documentation, in terminal output/logs, in API responses, or in any frontend environment variable (`NEXT_PUBLIC_*` or otherwise) — the frontend never receives DB credentials, AWS credentials, or any secret value.
- No secret is created, read, or exposed in this plan step — `ListSecrets` during INSPECT confirmed zero secrets currently exist.

---

## 11. Backend deployment

- The existing Node.js/TypeScript backend and its `/api/v1` contract are unchanged by Phase 4 — this phase connects the existing, already-tested (90/90) code to real infrastructure; it does not add features or change business logic.
- **`/health`** already exists, already unauthenticated, already returns only `{ success: true, data: { status: "ok" } }` — no sensitive infrastructure detail, confirmed by reading the actual route in `src/app.ts`. No change needed here.
- **Production environment variables needed** are exactly those listed in §4/§10 — all either already-designed config keys in `src/config/env.ts` or already-existing real AWS identifiers from this inspection; none invented.
- **Database connection:** via `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD`, reaching `database-1` over the private VPC network once the §2/§15 security-group rule is in place — never over the public internet, since the instance stays non-publicly-accessible.
- **Cognito JWT validation:** against this real pool's JWKS endpoint (`https://cognito-idp.ap-south-1.amazonaws.com/ap-south-1_EQEjEvk2M/.well-known/jwks.json`), exactly as already implemented.
- **S3 presigned URLs:** generated using the task role's credentials (§5), scoped to the real bucket.

---

## 12. DNS

- Frontend stays on Vercel; domain stays `handymanservices.in` at GoDaddy — neither is touched by this plan.
- **Intended approach for the API subdomain** (e.g. `api.handymanservices.in`): a GoDaddy CNAME record pointing at the ALB's DNS name — this is the lighter-weight option that doesn't require delegating the whole domain's DNS away from GoDaddy, and matches the Phase 2 AWS Architecture doc's own stated recommendation. The alternative (delegating the zone to Route 53) remains Open Question #23 in `PHASE_2_BACKEND_OPEN_QUESTIONS.md` and is **not decided here** — recommending the CNAME approach as the pragmatic default, not deciding it unilaterally.
- **No DNS record is created or modified in this plan step.**

---

## 13. Cost impact

New resources that will incur **ongoing** cost if this plan is implemented (Option A from §1):

- **ECS Fargate**: billed per vCPU-second/GB-second while the task runs — at `desiredCount=1`, 0.25 vCPU/0.5GB, this runs continuously (24/7), so it's a genuine ongoing cost, not a one-off.
- **Application Load Balancer**: a fixed hourly charge plus per-LCU usage charges — ongoing as long as the ALB exists, independent of traffic volume.
- **CloudWatch Logs**: ingestion + storage cost, scales with log volume (mitigated by the recommended 30-day retention).
- **ECR**: storage cost per GB of stored image layers — small for a single Node.js app image, but ongoing as long as images are retained.
- **NAT Gateway**: **zero under the recommended Option A** — this cost only applies if Option B (§1) is chosen instead; it is a fixed hourly charge plus per-GB data-processing charge if introduced later.
- **ACM certificate**: free of charge for certificates used with an ALB — no ongoing cost from the certificate itself.
- **Secrets Manager**: a small per-secret monthly charge for the one or two secrets stored (DB_USER/DB_PASSWORD).
- **Route 53** (only if that DNS option is later chosen over the GoDaddy CNAME): a per-hosted-zone monthly charge — not incurred under the recommended CNAME approach.

I have **not** looked up or stated exact current AWS prices anywhere above, since I haven't verified them against AWS's current pricing pages for `ap-south-1` and won't invent figures — if you want precise monthly estimates before approving, I can look those up specifically as a follow-up, separate from this plan.

---

## 14. Dependency-aware implementation order

This is the order IMPLEMENT would follow, once approved — each step depends on the one(s) before it:

1. Create `handyman-ecs-task-execution-role` and `handyman-ecs-task-role` (IAM) — needed by the task definition in step 6.
2. Create the two DB-credential secrets in Secrets Manager — needed by the task definition in step 6, and by the execution role's inline policy in step 1 (so steps 1 and 2 are mutually referencing; practically, create the secrets first, then write the execution role's policy against their real ARNs).
3. Create `handyman-alb-sg` and `handyman-ecs-sg` (security groups) — needed before the ALB (step 7) or ECS service (step 8) can be created, and before the RDS rule in step 4.
4. **Add the inbound rule to `handyman-rds-sg`** allowing `handyman-ecs-sg` on 3306 — the one RDS-adjacent change, done here since `handyman-ecs-sg` must exist first.
5. Create the ECR repository; build and push the backend's container image (requires the Dockerfile from §3 to be written first, as its own small step).
6. Create the ECS cluster and task definition, referencing the roles (step 1), secrets (step 2), image (step 5), and log group.
7. Create the ALB, target group (health check `/health`), and HTTP listener, using `handyman-alb-sg` (step 3) and the existing public subnets.
8. Create the ECS Fargate service, in the chosen subnets (§1), using `handyman-ecs-sg` (step 3), registered against the target group (step 7).
9. Verify: ECS task reaches `RUNNING`+`HEALTHY`, ALB target group reports healthy, `GET /health` succeeds through the ALB's DNS name.
10. **Only after step 9 succeeds**, and only with your separate explicit approval: apply the Cognito Groups + second app client (§8), S3 CORS (§9), and — separately again — any database migration against the real RDS instance (not part of this infrastructure plan at all; migrations get their own STOP-and-show-exact-SQL step per your original Phase 4 brief, independent of this sequence).
11. DNS (§12) and the HTTPS listener + ACM certificate (§6) — last, since they depend on steps 7–9 being live and on your DNS-approach decision.

---

## 15. Safety — every action that modifies an existing AWS resource

Only **one** existing resource is touched by this plan; everything else listed above is a **new** resource.

| | **`handyman-rds-sg` — add one inbound rule** |
|---|---|
| Current state | Inbound: TCP 3306 from `117.214.73.68/32` only. No other inbound rules. |
| Proposed change | **Add** one inbound rule: TCP 3306, source = `handyman-ecs-sg` (security group reference). The existing `117.214.73.68/32` rule is left in place unless you tell me to remove it (§2). |
| Reason | Without this, the backend (wherever it runs) cannot open a MySQL connection to `database-1` — Phase 4's entire purpose requires this one change. |
| Risk | Low, and additive only — it widens who can *attempt* a TCP connection on 3306, but only to resources inside the new `handyman-ecs-sg` (i.e., only the backend's own ECS tasks), never to the internet, never to `0.0.0.0/0`. Does not touch the RDS instance itself, its engine, its data, or its public-accessibility setting. |
| Rollback | Remove the single added rule from `handyman-rds-sg` — a one-step, instant, non-destructive security-group edit; no RDS restart or data impact. |

Cognito, S3, and VPC/subnet/network are **not modified** by this plan at all (only new Groups/client/CORS are proposed as future, separately-approved steps in §14 step 10). No IAM policy or role is modified — only new ones are proposed.

---

## Summary

### A. Plan summary
Run the existing, already-tested backend on ECS Fargate behind an ALB, in the account's existing default VPC and its 3 existing subnets (no new private subnets or NAT Gateway recommended at this stage), reaching the existing `database-1` RDS instance over the private VPC network via one new security-group rule, authenticating against the existing Cognito User Pool (plus two new Groups and a second app client, applied only after the infrastructure itself is verified healthy), and storing media through the existing S3 bucket via presigned URLs (plus a CORS rule, applied at the same later stage). DB credentials live in Secrets Manager, never in code or logs. Nothing is implemented yet.

### B. Existing resources to retain (unchanged)
Default VPC `vpc-01e7d0be9e2387607`; all 3 existing subnets; RDS instance `database-1` (engine, data, public-accessibility, subnet group — all unchanged); Cognito User Pool `ap-south-1_EQEjEvk2M` and its existing app client; S3 bucket `handyman-services-media-2026` (public-access-block, encryption — unchanged); the existing `117.214.73.68/32` rule on `handyman-rds-sg` (unless you say otherwise).

### C. New resources to create (none created yet — pending approval)
`handyman-alb-sg`, `handyman-ecs-sg` (security groups); `handyman-backend` ECR repository; `handyman-ecs-task-execution-role`, `handyman-ecs-task-role` (IAM); two Secrets Manager secrets (`DB_USER`, `DB_PASSWORD`); `handyman-cluster` (ECS), task definition, Fargate service; CloudWatch log group `/ecs/handyman-backend`; Application Load Balancer, target group, HTTP listener; (later, separately) Cognito Groups × 3, second Cognito app client, S3 CORS rule, ACM certificate, HTTPS listener, GoDaddy CNAME record.

### D. Existing resources to modify
Exactly one: `handyman-rds-sg` — add one inbound rule (§15). Nothing else existing is modified in the core infrastructure build; the later, separately-approved step also touches the existing Cognito pool (add Groups + a client) and the existing S3 bucket (add CORS) — both additive, non-destructive, and gated behind their own approval per §14 step 10.

### E. Resources not to touch
`database-1`'s engine, data, schema, public-accessibility, subnet placement, Multi-AZ/backup settings; the default VPC's CIDR or existing subnets' structure; the existing Cognito app client's current settings; the S3 bucket's public-access-block or encryption settings; anything on the Vercel frontend; GoDaddy's existing DNS records (until the API-subdomain step is separately approved).

### F. Security model
Internet → ALB (SG: 80/443 open) → ECS tasks (SG: inbound only from ALB-SG, on the container port) → RDS (SG: inbound only from ECS-SG, on 3306, never `0.0.0.0/0`). DB credentials via Secrets Manager injection, never in env/code/logs. S3 reached only via server-generated, short-lived presigned URLs — the frontend never holds a standing AWS credential. Cognito JWTs verified against the pool's public JWKS; role comes only from the verified token's `cognito:groups` claim, never from client input.

### G. Network architecture
Recommended: existing default VPC, existing 3 (public) subnets used for both ALB and ECS tasks, no new private subnets, no NAT Gateway, isolation enforced by security groups rather than subnet routing. RDS stays exactly where it already is.

### H. Cost considerations
New ongoing costs: ECS Fargate (continuous, since `desiredCount=1` runs 24/7), ALB (fixed + per-LCU), CloudWatch Logs, ECR storage, Secrets Manager (per-secret). No NAT Gateway cost under the recommended option. ACM certificate itself is free. No exact dollar figures stated — not verified against current pricing, so not invented.

### I. Implementation order
See §14 — IAM → secrets → security groups → RDS rule → ECR/image → ECS cluster/task definition → ALB/target group/listener → ECS service → verify health → (separately approved) Cognito Groups/client + S3 CORS + migrations → DNS/HTTPS.

### J. Risks / blockers
- Exact AWS pricing not verified — a follow-up lookup is recommended before final budget sign-off, separate from this plan.
- The existing Cognito app client's callback URL is still an AWS placeholder, not your real domain — flagged, not yet a blocker, but worth resolving before any OAuth-redirect-based feature is built.
- `DB_NAME` for the real production schema has not been confirmed by you — needed before the task definition can be finalized.
- RDS's `DeletionProtection: false` and 1-day backup retention are pre-existing conditions outside this plan's scope but worth a separate decision from you (Open Question #24).
- Choosing Option B (§1) later, after Option A is live, is possible but not a trivial follow-on change — it would mean re-deploying the ECS service into new subnets, which is a bigger lift than deciding it upfront; flagged so you can weigh in now if you'd rather start with Option B instead.

### K. Exact approvals required before implementation
1. Approval of the overall plan as written (this document).
2. Explicit confirmation: **Option A** (recommended) vs. **Option B** for ECS subnet placement (§1).
3. Confirmation of the real production `DB_NAME` to put in the task definition.
4. Confirmation of the real frontend origin(s) to allow in `CORS_ALLOWED_ORIGINS` and the S3 CORS rule (I used `https://handymanservices.in` as the obvious candidate from your brief — confirm or correct).
5. Decision on keeping or removing the existing `117.214.73.68/32` rule on `handyman-rds-sg`.
6. Explicit, separate approval for the one RDS-adjacent action (§15: the security-group rule add) — called out on its own per your instruction, even though it's part of the same overall plan.
7. Explicit, separate approval before the later-stage Cognito Groups/client creation, S3 CORS application, and any database migration against the real RDS instance (§14 step 10) — none of that happens as part of approving the core infrastructure build.

---

**No AWS resource has been created, modified, deleted, or mutated in producing this plan.** Stopping here per your instructions, awaiting your explicit approval before any IMPLEMENT step.
