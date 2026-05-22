# Build Prompt — Techverx Team Directory & AI Skill Matcher

> Paste this entire document into Cursor as your build spec. It describes a team-directory web app with AI-inferred skill ratings and project-based candidate matching. Build it as a clean, componentized project (not one giant file).

---

## 1. What you're building

An internal **team directory + staffing tool** for an engineering company. It lets a user:

1. Browse ~50 team members as cards (name, ID, role, experience, skills, email).
2. Filter and search by **specialization**, **tech stack**, **role**, **experience**, **skill**, or free text.
3. See an **AI-inferred 1–5 rating** on every skill, derived from experience + seniority + skill ordering + specialization.
4. **Override any rating** by clicking the skill (persisted locally), which feeds back into matching.
5. Run a **Project Matcher**: enter required skills with minimum ratings, get candidates ranked by a weighted match score.

It is read-mostly: the only data the user mutates is skill ratings.

---

## 2. Recommended stack

- **React 18 + TypeScript + Vite**
- **Tailwind CSS** for styling (design tokens below map cleanly to Tailwind theme extension or CSS variables)
- **Zustand** (or React Context + reducer) for app state
- **localStorage** for rating persistence in v1; structure the persistence layer behind an interface (`RatingStore`) so it can be swapped for a real API/DB later
- No backend required for v1. If you add one later, expose `GET /team`, `GET /ratings`, `PUT /ratings/:personId/:skill`.

Keep the categorization, rating, and matching logic in **pure, unit-testable functions** (no React inside them).

---

## 3. Data model

```ts
interface TeamMember {
  id: string;            // e.g. "TV-00040"
  name: string;
  role: string;          // "" if unknown
  exp: string;           // display string, e.g. "7+", "2.5", "" if unknown
  expNum: number;        // numeric for sorting/inference, 0 if unknown
  skills: string[];
  email: string;         // "" if not on file

  // Derived at load time:
  specialization: Specialization;
  stacks: Stack[];
  aiRatings: Record<string, number>;   // skill -> 1..5 (AI inferred)
  ratings: Record<string, number>;     // skill -> 1..5 (effective: override ?? ai)
}

type Specialization =
  | "Full Stack" | "Frontend" | "Backend"
  | "AI/ML" | "AI Business Analyst"
  | "QA" | "Tech Lead" | "Project Manager"
  | "Other" | "Profile Pending";

type Stack = "MERN" | "MEAN" | "PERN" | ".NET" | "Python / AI" | "React Native" | "WordPress";
```

The full seed dataset is in **Appendix A**. Some records are intentionally incomplete (empty role/skills/email) — handle them gracefully as "Profile Pending".

Data hygiene notes baked into the seed:
- One email is on a non-corporate domain (`uzair.akram@gmail.com`) — keep as-is.
- One email has a likely typo (`...@tehverx.com`) — keep as-is, do not silently fix.
- One record originally had `"2"` in the email column — treated as missing email.

---

## 4. Categorization engine (pure functions)

### 4.1 Pattern constants

```ts
const FRONTEND_PATTERNS = /^(react|next|angular|vue|html|css|tailwind|sass|scss|less|jquery|bootstrap|chakra|material ui|ant design|antd|semantic ui|bulma|blazor|figma|mui|woocommerce|wordpress)/i;
const BACKEND_PATTERNS  = /(^node|^nest|^express|\.net|c#|asp\.net|django|flask|fastapi|spring|laravel|^php|microservices|graphql|rest api|signalr|grpc|webapi)/i;
const AI_PATTERNS       = /(machine learning|deep learning|^ai$|^ml$|langchain|langraph|langgraph|^rag|llm|hugging|computer vision|fine-tuning|fine tuning|agentic ai|model finetuning|opencv|nlp|spacy|nltk)/i;
const QA_PATTERNS       = /(jest|cypress|playwright|selenium|jmeter|postman|^test|jira|swagger|reflect|testmo|testrail|clickup|xray|functional testing)/i;
```

### 4.2 Specialization (one per person — role first, then skills)

```
if no role AND no skills            -> "Profile Pending"
if role ~ /sqa|quality assurance/   -> "QA"
if role ~ /project manager/         -> "Project Manager"
if role ~ /ai business/             -> "AI Business Analyst"
if role ~ /ai\/ml|\(ai\/ml\)/       -> "AI/ML"
if role ~ /tech lead/               -> "Tech Lead"
else (engineer): inspect skills
   hasFrontend = any skill matches FRONTEND_PATTERNS
   hasBackend  = any skill matches BACKEND_PATTERNS
   frontend && backend -> "Full Stack"
   frontend            -> "Frontend"
   backend             -> "Backend"
   neither             -> "Other"
```

> Known judgment call: someone with only `.NET + HTML5 + CSS3` (markup but no JS framework) currently lands in "Full Stack" because HTML/CSS match the frontend pattern. If the user wants "Full Stack" to require an actual framework (React/Angular/Vue/Blazor), tighten `FRONTEND_PATTERNS` to exclude bare `html`/`css`. Make this a config flag: `requireFrameworkForFullStack: boolean`.

### 4.3 Stack detection (zero or more per person)

Lowercase all skills, then:

```
hasMongo        = any ~ /mongo/
hasPg           = any ~ /postgres|psql/
hasAngular      = any ~ /angular/
hasNode         = any ~ /node/
hasExpressOrNest= any ~ /express|nest/
hasDotNet       = any ~ /\.net|asp\.net|c#/
hasPython       = includes "python" OR any ~ /^python/
hasAI           = any matches AI_PATTERNS
hasRN           = any ~ /react native/
hasWP           = any ~ /wordpress/
hasReactWeb     = any ~ /^react($|\.js$|js$)/ OR any ~ /^next/   // excludes bare "react native"

MERN          if hasMongo && hasReactWeb && hasNode && hasExpressOrNest
MEAN          if hasMongo && hasAngular  && hasNode && hasExpressOrNest
PERN          if hasPg    && hasReactWeb && hasNode && hasExpressOrNest
.NET          if hasDotNet
Python / AI   if hasPython && hasAI
React Native  if hasRN
WordPress     if hasWP
```

A person can carry multiple stack tags (MERN + PERN is common when they list both Mongo and Postgres).

---

## 5. AI rating inference (the "initial training")

For each `(person, skill, index)` produce a 1–5 rating. `index` is the skill's position in the person's `skills` array; `total` is the array length.

```
r = min(5, 2 + expNum * 0.35)            // experience base

role seniority:
   Tech Lead  -> r += 0.6
   Senior     -> r += 0.35
   Associate  -> r -= 0.3

skill-list position (earlier = stronger):
   if total > 1: r += 0.4 - (index / (total - 1)) * 0.8   // first +0.4, last -0.4

specialization alignment (+0.3 if the skill matches the person's specialty):
   AI/ML or AI Business Analyst + AI_PATTERNS
   Frontend                     + FRONTEND_PATTERNS
   Backend                      + BACKEND_PATTERNS
   QA                           + QA_PATTERNS
   Full Stack                   + (FRONTEND_PATTERNS or BACKEND_PATTERNS)

r = clamp(round(r * 2) / 2, 1, 5)        // round to nearest 0.5
```

Reference outcomes for sanity-checking: 1yr base ≈ 2.4, 3yr ≈ 3.05, 5yr ≈ 3.75, 7yr ≈ 4.45, 9yr → 5.0. A 9-yr Tech Lead's top skills hit 5.0; a 1-yr Associate's later skills sit near 2.0.

The **effective rating** used everywhere is `userOverride[skill] ?? aiRating[skill]`.

---

## 6. Project Matcher

### 6.1 Parse the input

Free-text input, comma- or newline-separated. Each token is `Skill:Rating` or just `Skill` (defaults to min rating 3).

```
"React.js:4, Node.js:4, MongoDB:3, AWS"
-> [{skill:"React.js",minRating:4},{skill:"Node.js",minRating:4},{skill:"MongoDB",minRating:3},{skill:"AWS",minRating:3}]
```

Regex per token: `/^(.+?):\s*(\d(?:\.\d)?)$/` → captures skill + rating; otherwise whole token is the skill with min 3.

### 6.2 Fuzzy skill matching

To match a required skill against a person's skill list, try in order:
1. Exact (case-insensitive).
2. Normalized equality — strip trailing `.js`/`js`, remove whitespace, lowercase (so "React.js" == "ReactJS" == "React js").
3. Substring either direction (`a.includes(b) || b.includes(a)`).

Return the first matching skill string, or null.

### 6.3 Scoring

```
for each requirement:
   skill = fuzzyMatch(person.skills, req.skill)
   if skill:
      rating = effectiveRating(person, skill)
      if rating >= req.minRating: totalScore += rating;        met++
      else:                       totalScore += rating * 0.5;  partial++   // partial credit, halved
   else:
      miss++

normalizedScore = totalScore / requirements.length    // 0..5 scale
strengthPct     = round(normalizedScore / 5 * 100)
```

### 6.4 Ranking & presentation

- Only include candidates with `(met + partial) > 0`.
- Sort by **met count desc**, then **normalizedScore desc**.
- Mark **Top Match** (highlighted border) for the first 3 results where `met >= ceil(requirements * 0.6)`.
- On each result card show: score `X.X / 5`, `N met · M partial · K missing`, and `strengthPct%`.
- Color the matched skill tags: **met = green**, **partial = amber**.

Matcher is a layered mode on top of normal filters: when active, it overrides the sort dropdown and filters out non-matching people, but specialization/stack/experience filters still apply.

---

## 7. Feature checklist

**Directory**
- [ ] Responsive card grid (min card width ~380px, auto-fill).
- [ ] Card shows: ID, experience badge, name, role, specialization badge (filled), stack badges (dashed outline), up to 8 skill tags with ratings + a "+N more" expander, email with copy-to-clipboard button + mailto link.
- [ ] Incomplete profiles render dimmed with "Profile Pending" and brighten on hover.

**Filters**
- [ ] Free-text search across name, role, ID, specialization, stacks, skills — with match highlighting in the name/role.
- [ ] Dropdowns: Specialization (with counts), Stack (with counts), Role, Experience (Any/1+/2+/3+/5+/7+).
- [ ] Sort: Experience ↓/↑, Name A→Z/Z→A, ID.
- [ ] Skill quick-filter chips (top ~12 most common skills); clicking AND-filters; multiple chips combine.
- [ ] Reset button clears everything including matcher.
- [ ] Active-filter summary line + "showing X of Y" count.
- [ ] Sticky filter bar.
- [ ] Keyboard: `/` focuses search, `Esc` clears it.

**Ratings**
- [ ] AI rating shown on every skill tag, color-tiered (5 brightest → 1 red).
- [ ] Click a tag → modal: shows person + skill, 1–5 star buttons, half-rating toggle (0.5 steps), shows current vs AI value, Save / Reset-to-AI / Cancel.
- [ ] User-edited ratings marked with a small dot indicator.
- [ ] Header stat counts total user edits.
- [ ] Saving a value equal to the AI value clears the override instead of storing a redundant one.

**Persistence**
- [ ] Overrides saved to localStorage under a versioned key (`techverx-ratings-v1`), keyed `personId::skill`.
- [ ] Export all overrides to a downloadable JSON file.
- [ ] Import overrides from a JSON file.
- [ ] "Reset AI" wipes all overrides (with confirm) and restores inferred values.
- [ ] All of the above behind a `RatingStore` interface for future API swap.

**Matcher**
- [ ] Collapsible panel with input, "Find Matches", "Clear".
- [ ] Active requirement pills shown below input.
- [ ] `Ctrl/Cmd+Enter` in the textarea runs the match.
- [ ] Results re-rank the grid live; top 3 highlighted.

**Recompute loop ("retraining")**
- [ ] Any rating change immediately recomputes matcher scores and re-renders. (Specializations are role/skill-derived and don't change with ratings, but matching does — that's the feedback loop.)
- [ ] OPTIONAL enhancement: add a `categorizeByRatings` mode that re-derives specialization from average rating per skill-group (e.g. avg frontend rating vs avg backend rating) and lets the user toggle between "role-based" and "rating-based" categorization.

---

## 8. Design system

Dark, editorial aesthetic. Warm near-black background, single warm-amber accent, three typefaces.

**Fonts (Google Fonts)**
- Display / names / numbers: **Instrument Serif** (use italic for emphasis)
- Body / UI: **Geist** (300–700)
- Mono / IDs / tags / labels: **JetBrains Mono**

**Color tokens**
```css
--bg:            #0e0d0b;   /* warm near-black */
--bg-elev:       #15140f;
--bg-card:       #1a1813;
--bg-card-hover: #211e17;
--border:        #2a2620;
--border-soft:   #1f1c16;
--text:          #ece8df;   /* warm off-white */
--text-dim:      #8a8478;
--text-faint:    #5a554b;
--accent:        #ffa658;   /* warm amber */
--accent-dim:    #b3743d;
--accent-glow:   rgba(255,166,88,0.12);
--accent-strong: rgba(255,166,88,0.2);
--good:          #94c5a0;   /* met */
--warn:          #d4a259;   /* partial / 4-rating */
--bad:           #d97757;   /* missing / 1-rating */
```

**Rating color tiers (on tag rating number)**
- 5 → `--accent` (bold) · 4–4.5 → `--warn` · 3–3.5 → `--text-dim` · 2–2.5 → `--text-faint` · 1–1.5 → `--bad`

**Layout**
- Centered container, max-width ~1400px, generous padding.
- Header: mono eyebrow with a leading rule, large serif headline with one italic-amber phrase, lede paragraph, right-aligned stat block (People / Full Stack / AI-ML / User Edits).
- Subtle radial accent glows on the page background.
- Cards: 4px radius, 1px border, faint diagonal gradient overlay, lift + amber border on hover, 0.4s staggered fade-in.

**Style guidance**: minimal, no rainbow of colors — amber is the only chromatic accent except the green/amber/red used semantically for match status and rating tiers. Avoid generic SaaS blue/purple gradients.

---

## 9. Suggested file structure

```
src/
  data/team.ts                 // seed dataset (Appendix A)
  lib/
    categorize.ts              // specialization + stack detection (§4)
    inferRatings.ts            // AI rating heuristic (§5)
    matcher.ts                 // parse, fuzzy match, score (§6)
    ratingStore.ts             // localStorage impl behind an interface
  state/useDirectory.ts        // Zustand store: filters, matcher, overrides
  components/
    Header.tsx
    ProjectMatcher.tsx
    FilterBar.tsx
    SkillChips.tsx
    PersonCard.tsx
    SkillTag.tsx
    RatingModal.tsx
    MatchScore.tsx
    Toast.tsx
  App.tsx
  index.css                    // tokens + Tailwind
tests/
  categorize.test.ts
  inferRatings.test.ts
  matcher.test.ts
```

Write unit tests for the three pure modules. Suggested cases: MERN+PERN dual-tagging, "react native" not triggering MERN, a Tech Lead hitting 5.0 on a core skill, an Associate's last skill landing ~2.0, fuzzy match of "reactjs" ↔ "React.js", partial-credit scoring when rating is below the requirement threshold.

---

## 10. Acceptance tests (manual)

Run these matcher inputs and confirm sensible top results:
- `React.js:4, Node.js:4, AWS:3, MongoDB:3` → senior MERN full-stackers surface first.
- `Python:4, Langchain:3, RAG:3, FastAPI:3` → the AI/ML engineers rank top.
- `.NET:4, SQL Server:3` → the .NET cluster (Tech Lead first by seniority) ranks top.

---

## Appendix A — Seed dataset

Paste this as `src/data/team.ts`. (Derived/`specialization`, `stacks`, `aiRatings`, `ratings` fields are computed at load — do not hardcode them.)

```ts
export const TEAM_SEED = [
  { id:"TV-00040", name:"Saad Naveed", role:"Senior Software Engineer", exp:"7+", expNum:7, skills:["React.js","React Native","Next.js","Node.js","Nest.js","Javascript","AWS","Stripe","Paypal","MongoDB","Mysql","CI/CD","XCode","App Center","App Monetization","Microservices","RabbitMQ","Redis","CloudFlare"], email:"saad.naveed@techverx.com" },
  { id:"TV-00061", name:"Umair Yaqoob", role:"Software Engineer", exp:"7+", expNum:7, skills:["React.js","JavaScript","HTML5","CSS3","SCSS","SASS","LESS","jQuery","Tailwind CSS","Material UI","Chakra UI","Semantic UI","Ant Design","Bootstrap","Bulma","Responsive UI","WordPress","WooCommerce","GitHub","Adobe Photoshop","Figma to HTML/React","Cross-Browser Compatibility","Web Accessibility"], email:"umair.yaqoob@techverx.com" },
  { id:"TV-00173", name:"Wamik Yasin", role:"", exp:"", expNum:0, skills:[], email:"" },
  { id:"TV-00191", name:"Muhammad Usama Sadaqat", role:"", exp:"", expNum:0, skills:[], email:"" },
  { id:"TV-00305", name:"Muhammad Taimoor", role:"Software Engineer", exp:"3+", expNum:3, skills:[".NET Core","ASP.NET Core","RESTful APIs","Microservices","Docker","Jenkins CI/CD","RabbitMQ","gRPC","SQL Server","Postgres","MySQL","MongoDB","Angular","React.js","React Native","JavaScript","JSX","HTML5","CSS3","Git","GitHub","GitLab","DevOps","Agile"], email:"taimoor.nauman@tehverx.com" },
  { id:"TV-00376", name:"Abdul Rafay Ahmad", role:"Senior Software Engineer", exp:"3+", expNum:3, skills:["NestJS","Node.js","TypeScript","Express.js","Next.js","React.js","Microservices","RabbitMQ","Redis","BullMQ","REST API","GraphQL","Swagger/OpenAPI","PostgreSQL","MongoDB","MySQL","Mongoose","TypeORM","Docker","AWS","Cloudflare","GitHub Actions","CI/CD","Socket.io","Git","Stripe","Paypal","AntD","Tailwind","MUI"], email:"abdul.rafay@techverx.com" },
  { id:"TV-00414", name:"Anees Ahmed", role:"Senior Software Engineer", exp:"5+", expNum:5, skills:["NestJS","Node.js","TypeScript","Express.js","Next.js","React.js","Microservices","RabbitMQ","Redis","REST API","GraphQL","Swagger/OpenAPI","JWT","RBAC","PostgreSQL","MongoDB","MySQL","Prisma","Stripe","Mongoose","Docker","AWS","GitHub Actions","CI/CD","Turborepo","Socket.io","Git"], email:"anees.ahmed@techverx.com" },
  { id:"TV-00417", name:"Muhammad Uzair Akram", role:"Software Engineer", exp:"3+", expNum:3, skills:["React.js","Next.js","Nest.js","FastAPI","Django","AWS","Docker","Rust","Cargo","Digital Ocean","Langchain","LangGraph","Postgres","MongoDB","Vector DBs","Agent Orchestration","Voice Agents","OpenAI Realtime","LLM inference","RabbitMQ","Electron.js"], email:"uzair.akram@gmail.com" },
  { id:"TV-00490", name:"Saqib Idrees", role:"Senior Software Engineer", exp:"5+", expNum:5, skills:["React.js","Next.js","Typescript","REST API","Node.js","Express.js","Nest.js","Javascript","PHP","MongoDB","MySQL","Prisma","Socket.io","Docker","AWS","CI/CD","RabbitMQ","Redis","WordPress","Canvas","HTML","CSS","SASS/LESS","Tailwind","GitHub"], email:"saqib.idrees@techverx.com" },
  { id:"TV-00513", name:"Wajiha Atta", role:"Associate SQA Engineer", exp:"2", expNum:2, skills:["Testmo","Jira","Jmeter","Swagger","AWS MQTT","Testrail","Click Up","Postman"], email:"wajiha.atta@techverx.com" },
  { id:"TV-00518", name:"Muhammad Ahtisham ul haq Dogar", role:"Associate Software Engineer", exp:"2+", expNum:2, skills:[".Net",".Net Core MVC","SQL","MongoDB","ABP.io","Microsoft Identity","Entity Framework","Stripe","JWT","Git","HTML5","CSS3"], email:"" },
  { id:"TV-00541", name:"Ibrar Ali", role:"Associate Software Engineer", exp:"2+", expNum:2, skills:["React.js","Next.js","Node.js","Nest.js","AWS"], email:"ibrar.ali@techverx.com" },
  { id:"TV-00543", name:"Shahbaz Hussain", role:"Associate Software Engineer", exp:"2+", expNum:2, skills:["React.js","Node.js","Nest.js","AWS","Docker","Javascript","Typescript"], email:"shahbaz.hussain@techverx.com" },
  { id:"TV-00575", name:"Mustafa Khan", role:"AI Business Analyst", exp:"3+", expNum:3, skills:["Python","AI","Machine Learning","Model Finetuning","Agentic AI","RAG","FastAPI","N8N","AI Automation","Data Preprocessing","Data Visualization","Playwright","Workflow Engines","Data Analysis","Excel","Power BI","Technical Documentation"], email:"" },
  { id:"TV-00594", name:"Araiz Ahmad", role:"Senior AI/ML Engineer", exp:"2.5+", expNum:2.5, skills:["Python","AI","Machine Learning","Model Finetuning","Agentic AI","RAG","FastAPI","Langchain","LangGraph","Docker","AWS","Model Training","Computer Vision"], email:"araiz.ahmed@techverx.com" },
  { id:"TV-00600", name:"Omar Qayyum", role:"", exp:"", expNum:0, skills:[], email:"" },
  { id:"TV-00601", name:"Hadia Shabbir", role:"Software Engineer", exp:"3", expNum:3, skills:["React.js","Next.js","Node.js","Nest.js","Javascript","MongoDB","MySQL","Docker","Typescript","CI/CD","PostgreSQL","Express.js","Git","Socket.io","RabbitMQ","Tailwind"], email:"hadia.shabbir@techverx.com" },
  { id:"TV-00602", name:"Ubaid Ullah Waleed", role:"Software Engineer", exp:"3+", expNum:3, skills:["React.js","Next.js","React Native","JavaScript","TypeScript","Node.js","Nest.js",".NET Core MVC","MongoDB","PostgreSQL","MySQL","SQL","Supabase","Firebase","Docker","CI/CD","Jenkins","AWS"], email:"ubaid.waleed@techverx.com" },
  { id:"TV-00603", name:"Farhan Ahmad", role:"SQA Engineer", exp:"3+", expNum:3, skills:["Cypress","Playwright","Reflect","Jmeter","Postman","Swagger","Testmo","Testrail","XRay","Jira","CRM","Azure","Selenium WebDriver","CI/CD"], email:"farhan.ahmad@techverx.com" },
  { id:"TV-00609", name:"Rao Imtinan", role:"Associate Software Engineer", exp:"2+", expNum:2, skills:["React.js","Next.js","Node.js","Nest.js","PostgreSQL","MongoDB","React Native","Xcode","Google Play Console","Playwright"], email:"rao.imtinan@techverx.com" },
  { id:"TV-00610", name:"Muhammad Zakriya Tariq", role:"Associate Software Engineer", exp:"1+", expNum:1, skills:["React.js","Node.js","Docker","MongoDB","Javascript","Web Development","Express.js","Git","AWS"], email:"zakriya.tariq@techverx.com" },
  { id:"TV-00613", name:"Salman Ahmad", role:"Senior AI/ML Engineer", exp:"2+", expNum:2, skills:["FastAPI","Langchain","LLM","Agentic AI","Hugging Face","RAG Pipeline","Fine-tuning","Model Evaluation","Computer Vision","PSQL","Docker","AWS"], email:"salman.ahmad@techverx.com" },
  { id:"TV-00615", name:"Sohaib Malik", role:"Software Engineer", exp:"3", expNum:3, skills:["Nest.js","Express.js","React.js","Next.js","Node.js","Javascript","Typescript","PostgreSQL","MongoDB","Docker","Redis","Web Sockets"], email:"sohaib.malik@techverx.com" },
  { id:"TV-00617", name:"Zain Ul Abideen", role:"Software Engineer", exp:"2.5+", expNum:2.5, skills:[".Net",".Net Core MVC","Docker","CI/CD","SQL Server","Postgres","MySQL","Entity Framework","Dapper","Microsoft Identity","REST APIs","RabbitMQ","SignalR","Redis","Razorpay","Angular"], email:"zain.abideen@techverx.com" },
  { id:"TV-00624", name:"Waqar Hussain", role:"Associate Software Engineer", exp:"2.5", expNum:2.5, skills:["React.js","Next.js","Node.js","Nest.js","Electron","JavaScript","TypeScript","PostgreSQL","MongoDB","RabbitMQ","Redis","REST API","GraphQL","Swagger UI","TypeORM","Prisma","Git"], email:"waqar.hussain@techverx.com" },
  { id:"TV-00625", name:"Muhammad Fahad", role:"Software Engineer", exp:"2+", expNum:2, skills:[".Net",".Net Core MVC","SQL","NoSQL","WebAPIs","ABP.io","Angular"], email:"muhammad.fahad@techverx.com" },
  { id:"TV-00627", name:"Kashan Aqeel", role:"Software Engineer", exp:"2+", expNum:2, skills:["React.js","Node.js","Express.js","MongoDB","Next.js","Nest.js","PostgreSQL","GCP","Python","TypeScript","Docker","CI/CD","Redis","BullMQ","Git","Terraform"], email:"kashan.aqeel@techverx.com" },
  { id:"TV-00639", name:"Rohan Khan", role:"Associate Software Engineer", exp:"2", expNum:2, skills:["Django","FastAPI","Nest.js","Node.js","QuickBooks","IES","RAG","LLM integrations","Flutter","Next.js","Digital Ocean","Stripe","Third Party Integrations"], email:"rohan.khan@techverx.com" },
  { id:"TV-00641", name:"Nazir", role:"Associate Software Engineer", exp:"2", expNum:2, skills:["React.js","Next.js","Node.js","Nest.js","Electron","PostgreSQL","MongoDB","Docker","Jest","Prisma","Javascript","Typescript"], email:"nazir.rizwan@techverx.com" },
  { id:"TV-00643", name:"Muhammad Talha Shahzad", role:"Associate Software Engineer", exp:"2", expNum:2, skills:["React.js","Next.js","Node.js","Nest.js","MongoDB","PostgreSQL","Typescript","Javascript","Git","Express.js","Postman","REST API"], email:"talha.shahzad@techverx.com" },
  { id:"TV-00644", name:"Hafsa Naeem", role:"Associate SQA Engineer", exp:"1", expNum:1, skills:["Jmeter","Postman","Swagger","Testmo","Testrail","Jira","Functional Testing"], email:"" },
  { id:"TV-00662", name:"Mashal Maqsood", role:"Software Engineer", exp:"3", expNum:3, skills:["React.js","Next.js","Node.js","Nest.js","Javascript","REST API","FastAPI","MongoDB","PSQL","Docker","Typescript","Stripe","Sequelize","TypeORM","Prisma","Swagger","Postman","Insomnia"], email:"mashal.maqsood@techverx.com" },
  { id:"TV-00665", name:"Saqib Javed", role:"Associate Software Engineer", exp:"2+", expNum:2, skills:["React","Node","Next","Nest","Java","Python","FastAPI","Flask","RDBMS","MongoDB","Firebase","Socket.io","Docker","AWS","Kubernetes","Jenkins","React Native","Computer Vision"], email:"saqib.javed@techverx.com" },
  { id:"TV-00666", name:"Waleed Ullah Khan", role:"Associate SQA Engineer", exp:"2", expNum:2, skills:["Postman","Jmeter","Jira","Clickup","Testmo","API","Trello","Web Testing","Test Case Documentation","Mobile Testing","Swagger"], email:"waleed.khan@techverx.com" },
  { id:"TV-00667", name:"Khadeeja Asif", role:"Associate Software Engineer", exp:"2", expNum:2, skills:["React.js","Next.js","Node.js","Nest.js","Docker","Typescript","JavaScript","MongoDB","Postgres","REST API","FastAPI","WebSockets","Stripe","Prisma","Postman","Swagger","Insomnia","Git"], email:"khadeeja.asif@techverx.com" },
  { id:"TV-00670", name:"Ahmad Hasham", role:"Software Engineer", exp:"2.8", expNum:2.8, skills:["JavaScript","TypeScript","Next.js","React.js","Node.js","Tailwind","Electron.js","Strapi","MongoDB","MySQL","PostgreSQL","Django","Flask","FastAPI","WebSockets","Docker","Git","GHCR","AWS EC2","Nginx","PM2","Computer Vision","LLM","RAG"], email:"ahmad.hasham@techverx.com" },
  { id:"TV-00671", name:"Maryam Ali", role:"Software Engineer", exp:"2", expNum:2, skills:[".Net",".Net Core MVC","Gitlab","Github","SQL Server","Postgres","MySQL","Entity Framework","Dapper","Microsoft Identity","SignalR","REST APIs","RabbitMQ","Redis","Payment Gateway","Swagger"], email:"" },
  { id:"TV-00672", name:"Fiaz Ul Hasan", role:"Software Engineer (AI/ML)", exp:"2.5", expNum:2.5, skills:["Python","Machine Learning","Deep Learning","ANN","CNN","RNN","LSTM","LLMs","RAG","NLP","SpaCy","NLTK","HuggingFace","Computer Vision","LangGraph","Data Preprocessing","MCP","Agent-to-Agent","Google File Search","FastAPI","Power BI","Playwright","Docker","GitHub"], email:"fiaz.hasan@techverx.com" },
  { id:"TV-00673", name:"Syed Izzat Mumtaz", role:"Associate Software Engineer (AI/ML)", exp:"2", expNum:2, skills:["AI","ML","RAG","AI Agents","Model Fine-tuning","Langchain","LangGraph","Computer Vision","OpenCV","Pillow","NLP","StreamLit","Text to Speech","FastAPI","Django","MySQL","PSQL","SQLite","AWS","Docker","Stripe","Selenium","React.js","Unreal Engine 5"], email:"izzat.mumtaz@techverx.com" },
  { id:"TV-00676", name:"Muhammad Ahmad Shahid", role:"Software Quality Assurance Engineer", exp:"3", expNum:3, skills:["Postman","Playwright","Selenium","Postgres","Jira","ClickUp","Mobile Testing","Documentation","Jmeter"], email:"ahmad.shahid@techverx.com" },
  { id:"TV-00677", name:"Mahnoor Ali", role:"Associate Project Manager", exp:"5", expNum:5, skills:["Jira","Slack","Excel","Google Sheets","PowerPoint","Figma","Miro","Teams","Scrum","Roadmapping","Sprint Planning","Risk Tracking","Reporting","Documentation","Project Planning","Timeline Management","Task Management","Team Coordination","Client Communication"], email:"mahnoor.ali@techverx.com" },
  { id:"TV-00678", name:"Muhammad Ahsan Nawaz", role:"Software Engineer", exp:"2", expNum:2, skills:[".NET",".NET Core",".NET Framework",".NET MVC","Entity Framework","LINQ","RESTful APIs","React","MySQL","PostgreSQL","RabbitMQ","SignalR","Git","MS Graph API"], email:"" },
  { id:"TV-00680", name:"Ali Rizwan", role:"Software Engineer", exp:"1.5+", expNum:1.5, skills:[".NET",".NET Core",".NET Framework",".NET Web Forms",".NET MVC","RESTful APIs","React","Angular","Next.js","MS SQL","MySQL","Node.js","Tailwind","Entity Framework","LINQ","MS Azure","Stripe","OpenAI","OAuth","OpenIddict","n8n","Git","IIS","Hangfire"], email:"ali.rizwan@techverx.com" },
  { id:"TV-00682", name:"Muhammad Farrukh Khan", role:"", exp:"", expNum:0, skills:[], email:"" },
  { id:"TV-00683", name:"Hassan Kaleem", role:"", exp:"", expNum:0, skills:[], email:"" },
  { id:"TV-00685", name:"Muhammad Abul Hassan Khan", role:"", exp:"", expNum:0, skills:[], email:"" },
  { id:"TV-00689", name:"Hasnat Rasool", role:"", exp:"", expNum:0, skills:[], email:"" },
  { id:"TV-00681", name:"Meher-un-nisa Tariq", role:"Tech Lead", exp:"9+", expNum:9, skills:["C#",".NET",".NET Core","ASP.NET MVC","ADO.NET","Entity Framework","SQL Server","PostgreSQL","MongoDB","JavaScript","Angular","React","Blazor","jQuery","HTML","CSS","REST APIs","gRPC","Microservices","Redis","RabbitMQ","Docker","Azure DevOps","SharePoint","Shopify","Serilog","VB.NET","Amazon S3","MinIO","SignalR","Payment Gateway","Git","SVN","VSS"], email:"meher.tariq@techverx.com" },
  { id:"TV-00321", name:"Mueen Ul Hasan", role:"Software Engineer", exp:"4+", expNum:4, skills:["React.js","Next.js","Node.js","Express.js","Electron.js","Javascript","MySQL","SQLite","MongoDB","Typescript","Tailwind","Stripe","OAuth","Docker"], email:"" },
] as const;
```

---

## Appendix B — Future enhancements (not required for v1)

- **Team Builder**: given a set of requirements, pick the smallest *group* of people that collectively covers all required skills at threshold (set-cover heuristic), not just rank individuals.
- **Bulk rating editor**: a matrix view to rate one skill across everyone in a single screen.
- **Rating-based recategorization toggle** (see §7).
- **Backend persistence** + multi-user, replacing localStorage.
- **Availability/allocation field** per person (free / on-project / PTO) to filter staffable people.
- **Printable / PDF candidate shortlist** export from a match result.
