# Architecture Diagrams

Interactive diagrams of the Commentary Dashboard infrastructure.

> **Note:** These diagrams use Mermaid syntax and render in GitHub, VS Code (with Mermaid extension), and most modern documentation tools.

---

## 1. Overall System Architecture

```mermaid
graph TB
    subgraph "Client Browser"
        UI[React Frontend<br/>Port 5173]
    end

    subgraph "Backend Server"
        BFF[Express BFF<br/>Port 3001]

        subgraph "Cache Layer"
            Fallback[FallbackCacheService]
            Redis[(Redis Cache<br/>Optional)]
            Memory[(In-Memory Cache<br/>Always Available)]
        end

        subgraph "Services"
            StartGG[start.gg API Client<br/>Rate Limiting]
            TTL[Dynamic TTL Calculator]
        end
    end

    subgraph "External APIs"
        SGGAPI[start.gg GraphQL API<br/>api.start.gg/gql/alpha]
    end

    UI -->|HTTP REST| BFF
    BFF --> Fallback
    Fallback -->|Try First| Redis
    Fallback -->|Fallback| Memory
    BFF --> StartGG
    BFF --> TTL
    StartGG -->|GraphQL Queries| SGGAPI
    TTL -.->|Calculates TTL for| Fallback

    style UI fill:#F5F9FF,stroke:#1976D2,stroke-width:3px
    style BFF fill:#F5FBF5,stroke:#388E3C,stroke-width:3px
    style Redis fill:#FFF5F5,stroke:#C62828,stroke-width:3px
    style Memory fill:#FFFAF0,stroke:#F57C00,stroke-width:3px
    style SGGAPI fill:#F9F5FF,stroke:#7B1FA2,stroke-width:3px
```

---

## 2. Monorepo Structure

```mermaid
graph LR
    subgraph "Monorepo Root"
        Root[package.json<br/>pnpm workspaces]

        subgraph "packages/frontend"
            F1[React App]
            F2[Components]
            F3[Services]
            F4[Hooks]
        end

        subgraph "packages/backend"
            B1[Express Server]
            B2[Cache System]
            B3[Routes]
            B4[start.gg Client]
        end

        subgraph "packages/shared"
            S1[TypeScript Types]
            S2[Interfaces]
        end
    end

    Root --> F1
    Root --> B1
    Root --> S1

    F1 -.->|imports types| S1
    B1 -.->|imports types| S1

    F3 -->|HTTP calls| B1

    style Root fill:#FAFAFA,stroke:#757575,stroke-width:3px
    style F1 fill:#F5F9FF,stroke:#1976D2,stroke-width:3px
    style B1 fill:#F5FBF5,stroke:#388E3C,stroke-width:3px
    style S1 fill:#F0F9FF,stroke:#0288D1,stroke-width:3px
```

---

## 3. Cache System Architecture

```mermaid
classDiagram
    class ICacheService {
        <<interface>>
        +get(key) Promise~T~
        +set(key, value, ttl) Promise~void~
        +del(key) Promise~void~
        +exists(key) Promise~bool~
        +getMetadata(key) Promise~Metadata~
        +clear() Promise~void~
        +close() Promise~void~
        +getName() string
    }

    class RedisCacheService {
        -redis: Redis
        -connected: boolean
        +get(key) Promise~T~
        +set(key, value, ttl) Promise~void~
        +isConnected() boolean
    }

    class InMemoryCacheService {
        -cache: Map
        -cleanupInterval: Timer
        +get(key) Promise~T~
        +set(key, value, ttl) Promise~void~
        +getStats() Stats
        -cleanExpired() void
    }

    class FallbackCacheService {
        -caches: ICacheService[]
        +get(key) Promise~T~
        +set(key, value, ttl) Promise~void~
        -promoteToHigherCaches() void
    }

    class Factory {
        +createCacheService() ICacheService
        +createInMemoryCache() ICacheService
        +createRedisCache(url) ICacheService
        +createFallbackCache(...caches) ICacheService
    }

    ICacheService <|.. RedisCacheService : implements
    ICacheService <|.. InMemoryCacheService : implements
    ICacheService <|.. FallbackCacheService : implements
    FallbackCacheService o-- ICacheService : contains
    Factory ..> ICacheService : creates
```

---

## 4. Request Flow: Tournament Data

```mermaid
sequenceDiagram
    participant User as User Browser
    participant Frontend as React Frontend
    participant BFF as Express BFF
    participant Cache as FallbackCache
    participant Redis as RedisCache
    participant Memory as InMemoryCache
    participant StartGG as start.gg API

    User->>Frontend: Load Tournament URL
    Frontend->>BFF: GET /api/tournament/slug

    BFF->>Cache: get("tournament:slug")
    Cache->>Redis: get(key)

    alt Redis Hit
        Redis-->>Cache: return data
        Cache-->>BFF: return data (cached: true)
        BFF-->>Frontend: { data, cached: true, ttl: 120s }
        Frontend-->>User: Display Data ⚡ <100ms
    else Redis Miss/Error
        Redis--xCache: null or error
        Cache->>Memory: get(key)

        alt Memory Hit
            Memory-->>Cache: return data
            Cache-->>BFF: return data (cached: true)
            BFF-->>Frontend: { data, cached: true }
            Frontend-->>User: Display Data ⚡ <100ms
        else Memory Miss
            Memory-->>Cache: null
            Cache-->>BFF: null
            BFF->>StartGG: getTournamentBySlug(slug)
            StartGG->>StartGG: Queue Request<br/>(rate limiting)
            StartGG-->>BFF: Tournament Data
            BFF->>BFF: calculateDynamicTTL(data)

            par Write to Both Caches
                BFF->>Cache: set(key, data, ttl)
                Cache->>Redis: set(key, data, ttl)
                Cache->>Memory: set(key, data, ttl)
            end

            BFF-->>Frontend: { data, cached: false, ttl: 15s }
            Frontend-->>User: Display Data 🐌 50s+
        end
    end
```

---

## 5. Cache Fallback Flow

```mermaid
flowchart TD
    Start([GET Request]) --> CheckRedis{Try Redis.get}

    CheckRedis -->|Success + Value| ReturnRedis[Return from Redis<br/>Log: Cache Hit - Redis]
    CheckRedis -->|Error or Null| TryMemory{Try Memory.get}

    TryMemory -->|Success + Value| ReturnMemory[Return from Memory<br/>Log: Cache Hit - Memory<br/>fallback level 1]
    TryMemory -->|Null| ReturnNull[Return null<br/>Cache Miss]

    ReturnRedis --> End([End])
    ReturnMemory --> End
    ReturnNull --> End

    style Start fill:#F5F9FF,stroke:#1976D2,stroke-width:3px
    style ReturnRedis fill:#F5FBF5,stroke:#388E3C,stroke-width:3px
    style ReturnMemory fill:#FFFAF0,stroke:#F57C00,stroke-width:3px
    style ReturnNull fill:#FFF5F5,stroke:#C62828,stroke-width:3px
    style End fill:#F5F9FF,stroke:#1976D2,stroke-width:3px
```

---

## 6. Write-Through Cache Strategy

```mermaid
flowchart TD
    Start([SET Request<br/>key, value, ttl]) --> Parallel{Write to All Caches<br/>Promise.all}

    Parallel -->|Parallel Write 1| WriteRedis[Redis.set<br/>key, value, ttl]
    Parallel -->|Parallel Write 2| WriteMemory[Memory.set<br/>key, value, ttl]

    WriteRedis --> RedisResult{Redis Result}
    WriteMemory --> MemoryResult{Memory Result}

    RedisResult -->|Success| RS[✓]
    RedisResult -->|Error| RE[✗ Log Error]

    MemoryResult -->|Success| MS[✓]
    MemoryResult -->|Error| ME[✗ Log Error]

    RS --> Collect{Check Results}
    RE --> Collect
    MS --> Collect
    ME --> Collect

    Collect -->|All Failed| Error[Throw Error:<br/>All caches failed]
    Collect -->|Some Failed| Warning[Log Warning:<br/>Partial success]
    Collect -->|All Success| Success[Return Success]

    Error --> End([End])
    Warning --> End
    Success --> End

    style Start fill:#F5F9FF,stroke:#1976D2,stroke-width:3px
    style Success fill:#F5FBF5,stroke:#388E3C,stroke-width:3px
    style Warning fill:#FFFAF0,stroke:#F57C00,stroke-width:3px
    style Error fill:#FFF5F5,stroke:#C62828,stroke-width:3px
    style End fill:#F5F9FF,stroke:#1976D2,stroke-width:3px
```

---

## 7. Dynamic TTL Calculation

```mermaid
flowchart TD
    Start([Tournament Data<br/>Received]) --> Analyze[Analyze Match States]

    Analyze --> CheckOngoing{Has Ongoing<br/>Matches?}

    CheckOngoing -->|Yes| TTL15[TTL = 15 seconds<br/>Live Action]
    CheckOngoing -->|No| CheckRecent{Has Recently<br/>Completed<br/>within 5 min?}

    CheckRecent -->|Yes| TTL120[TTL = 120 seconds<br/>Late Updates Expected]
    CheckRecent -->|No| CheckPending{Has Pending<br/>Matches?}

    CheckPending -->|Yes| TTL600[TTL = 600 seconds<br/>Low Change Rate]
    CheckPending -->|No| TTL1800[TTL = 1800 seconds<br/>Tournament Complete]

    TTL15 --> Cache[Cache with TTL]
    TTL120 --> Cache
    TTL600 --> Cache
    TTL1800 --> Cache

    Cache --> End([End])

    style Start fill:#F5F9FF,stroke:#1976D2,stroke-width:3px
    style TTL15 fill:#FFF5F5,stroke:#C62828,stroke-width:3px
    style TTL120 fill:#FFFAF0,stroke:#F57C00,stroke-width:3px
    style TTL600 fill:#F5FBF5,stroke:#689F38,stroke-width:3px
    style TTL1800 fill:#F0F9F0,stroke:#388E3C,stroke-width:3px
    style End fill:#F5F9FF,stroke:#1976D2,stroke-width:3px
```

---

## 8. Data Flow: Frontend → Backend → API

```mermaid
graph LR
    subgraph "Frontend Layer"
        UI[User Interface<br/>Dashboard.tsx]
        Hook[useTournamentData<br/>React Hook]
        Service[tournamentService.ts<br/>Business Logic]
        API[backendApi.ts<br/>HTTP Client]
    end

    subgraph "Backend Layer"
        Router[Tournament Router<br/>Express Routes]
        Cache[Cache Service<br/>Fallback Strategy]
        SGClient[start.gg Client<br/>Rate Limiting]
        TTLCalc[TTL Calculator<br/>Dynamic Logic]
    end

    subgraph "External"
        StartGG[start.gg API<br/>GraphQL]
    end

    UI --> Hook
    Hook --> Service
    Service --> API
    API -->|HTTP GET/POST| Router

    Router --> Cache
    Router --> SGClient
    Router --> TTLCalc

    SGClient -->|GraphQL Query| StartGG

    StartGG -.->|Response| SGClient
    SGClient -.-> Router
    TTLCalc -.-> Router
    Cache -.-> Router
    Router -.->|JSON Response| API
    API -.-> Service
    Service -.-> Hook
    Hook -.-> UI

    style UI fill:#F5F9FF,stroke:#1976D2,stroke-width:3px
    style Router fill:#F5FBF5,stroke:#388E3C,stroke-width:3px
    style Cache fill:#FFFAF0,stroke:#F57C00,stroke-width:3px
    style StartGG fill:#F9F5FF,stroke:#7B1FA2,stroke-width:3px
```

---

## 9. Cache Promotion Flow (Optional Feature)

```mermaid
flowchart TD
    Start([GET Request]) --> L1{Try L1 Cache<br/>InMemory}

    L1 -->|Hit| ReturnL1[Return Value<br/>Fast Path]
    L1 -->|Miss| L2{Try L2 Cache<br/>Redis}

    L2 -->|Hit| FoundL2[Found in L2]
    L2 -->|Miss| ReturnNull[Return null]

    FoundL2 --> Promote{Enable Cache<br/>Promotion?}

    Promote -->|Yes| WarmL1[Write to L1<br/>Async/Background]
    Promote -->|No| SkipPromo[Skip Promotion]

    WarmL1 --> ReturnL2[Return Value<br/>from L2]
    SkipPromo --> ReturnL2

    ReturnL1 --> End([End])
    ReturnL2 --> End
    ReturnNull --> End

    style Start fill:#F5F9FF,stroke:#1976D2,stroke-width:3px
    style ReturnL1 fill:#F5FBF5,stroke:#388E3C,stroke-width:3px
    style ReturnL2 fill:#FFFAF0,stroke:#F57C00,stroke-width:3px
    style WarmL1 fill:#F5FBF5,stroke:#689F38,stroke-width:3px
    style End fill:#F5F9FF,stroke:#1976D2,stroke-width:3px
```

---

## 10. Deployment Architecture

```mermaid
graph TB
    subgraph "Production Environment"
        subgraph "Frontend Hosting"
            Vercel[Vercel / Netlify<br/>Static Frontend<br/>CDN Distribution]
        end

        subgraph "Backend Hosting"
            Railway[Railway / Render<br/>Express Server<br/>Auto-scaling]
        end

        subgraph "Cache Infrastructure"
            RedisCloud[Redis Cloud<br/>Managed Redis<br/>Persistent Cache]
        end

        subgraph "External Services"
            StartGGAPI[start.gg API<br/>GraphQL Endpoint]
        end
    end

    subgraph "Development Environment"
        LocalFE[pnpm dev:frontend<br/>localhost:5173]
        LocalBE[pnpm dev:backend<br/>localhost:3001]
        LocalRedis[Docker Redis<br/>localhost:6379<br/>OR In-Memory]
    end

    Users[Users/Commentators] -->|HTTPS| Vercel
    Vercel -->|API Calls| Railway
    Railway -->|Cache Ops| RedisCloud
    Railway -->|GraphQL| StartGGAPI

    LocalFE -.->|Dev API| LocalBE
    LocalBE -.->|Dev Cache| LocalRedis

    style Vercel fill:#1A1A1A,color:#fff,stroke:#9E9E9E,stroke-width:3px
    style Railway fill:#311B92,color:#fff,stroke:#9575CD,stroke-width:3px
    style RedisCloud fill:#B71C1C,color:#fff,stroke:#EF5350,stroke-width:3px
    style StartGGAPI fill:#4A148C,color:#fff,stroke:#BA68C8,stroke-width:3px
```

---

## 11. Error Handling Flow

```mermaid
flowchart TD
    Start([API Request]) --> Try{Try Primary<br/>Operation}

    Try -->|Success| Success[Return Success<br/>Response]
    Try -->|Error| Catch{Catch Error}

    Catch --> CheckType{Error Type?}

    CheckType -->|429 Rate Limit| RateLimit[Log Warning<br/>Retry with Backoff<br/>Max 3 Attempts]
    CheckType -->|401 Auth| AuthError[Log Error<br/>Return 500<br/>'Invalid API Token']
    CheckType -->|Network Error| NetworkError[Log Error<br/>Return 503<br/>'Service Unavailable']
    CheckType -->|Cache Error| CacheError[Log Warning<br/>Try Fallback Cache]
    CheckType -->|Other| GenericError[Log Error<br/>Return 500<br/>Error Message]

    RateLimit --> Retry{Retry Count<br/>< Max?}
    Retry -->|Yes| Wait[Wait with<br/>Exponential Backoff]
    Wait --> Try
    Retry -->|No| Failed[Return Error<br/>'Rate Limited']

    CacheError --> Fallback{Fallback Cache<br/>Available?}
    Fallback -->|Yes| TryFallback[Try Fallback]
    Fallback -->|No| Failed
    TryFallback --> Success

    Success --> End([End])
    AuthError --> End
    NetworkError --> End
    GenericError --> End
    Failed --> End

    style Start fill:#F5F9FF,stroke:#1976D2,stroke-width:3px
    style Success fill:#F5FBF5,stroke:#388E3C,stroke-width:3px
    style Failed fill:#FFF5F5,stroke:#C62828,stroke-width:3px
    style End fill:#F5F9FF,stroke:#1976D2,stroke-width:3px
```

---

## 12. Component Interaction Diagram

```mermaid
graph TB
    subgraph "React Components"
        Dashboard[Dashboard<br/>Main Container]
        BracketViz[BracketVisualization<br/>Match Display]
        PlayerInfo[PlayerInfo<br/>Player Details]
        PlayerSearch[PlayerSearch<br/>Search Dropdown]
        ErrorDisplay[ErrorDisplay<br/>Error Handler]
    end

    subgraph "React Hooks"
        UseTournament[useTournamentData<br/>State Management]
    end

    subgraph "Services"
        TournamentSvc[tournamentService<br/>Business Logic]
        BackendAPI[backendApi<br/>HTTP Client]
    end

    Dashboard --> UseTournament
    Dashboard --> BracketViz
    Dashboard --> PlayerInfo
    Dashboard --> PlayerSearch
    Dashboard --> ErrorDisplay

    UseTournament --> TournamentSvc
    TournamentSvc --> BackendAPI

    BackendAPI -.->|HTTP| TournamentSvc
    TournamentSvc -.-> UseTournament
    UseTournament -.-> Dashboard

    style Dashboard fill:#F5F9FF,stroke:#1976D2,stroke-width:3px
    style UseTournament fill:#F9F5FF,stroke:#8E24AA,stroke-width:3px
    style TournamentSvc fill:#F5FBF5,stroke:#388E3C,stroke-width:3px
```

---

## Viewing These Diagrams

### In VS Code
1. Install the "Markdown Preview Mermaid Support" extension
2. Open this file and press `Cmd+Shift+V` (Mac) or `Ctrl+Shift+V` (Windows/Linux)

### In GitHub
These diagrams render automatically when viewing this file on GitHub.

### Online Mermaid Editor
Copy any diagram and paste into: https://mermaid.live/

### Generate PNG/SVG
Use the Mermaid CLI:
```bash
pnpm add -g @mermaid-js/mermaid-cli
mmdc -i ARCHITECTURE_DIAGRAMS.md -o diagrams.pdf
```

---

## Legend

**Color Scheme (Maximum Contrast)**

**Light Backgrounds** (near-white with colored borders):
- 🔵 **Very Light Blue** (#F5F9FF): User-facing, flow start/end - **Contrast: 19:1**
- 🟢 **Very Light Green** (#F5FBF5): Backend, success - **Contrast: 19.5:1**
- 🟠 **Very Light Orange** (#FFFAF0): Cache, warnings - **Contrast: 20:1**
- 🔴 **Very Light Red** (#FFF5F5): Errors, external APIs - **Contrast: 19.8:1**
- 🟣 **Very Light Purple** (#F9F5FF): State management - **Contrast: 19.5:1**

**Dark Backgrounds** (very dark with white text):
- ⚫ **Very Dark Gray** (#1A1A1A): Vercel - **Contrast: 16:1**
- 🟣 **Very Dark Purple** (#311B92, #4A148C): Railway, APIs - **Contrast: 12:1**
- 🔴 **Very Dark Red** (#B71C1C): Redis - **Contrast: 11:1**

**Visual Distinction:**
- 3px colored stroke borders keep boxes visually distinct
- Near-white fills ensure maximum text readability
- All ratios exceed WCAG AAA standards (7:1+)

---

## Related Documentation

- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - Full implementation details
- [CACHE_REFACTORING.md](./CACHE_REFACTORING.md) - Cache system refactoring
- [packages/backend/src/cache/README.md](./packages/backend/src/cache/README.md) - Cache architecture
- [README.md](./README.md) - Getting started guide
