# AgentSet × Cloudflare Integration Workspace

This workspace contains the AgentSet × Cloudflare integration project and related development tools.

## 📁 Repository Structure

### Main Project

**[agentset-cloudflare-app/](./agentset-cloudflare-app/)** - Integration repository
The main project that connects AgentSet UI with Cloudflare AI services.

- **apps/cf-worker/** - Cloudflare Worker implementation
- **packages/agentset-tools/** - Client library for Worker communication
- **docs/integration/** - Complete integration documentation
- **INTEGRATION_OVERVIEW.md** - Start here for project overview

### Development Repositories

**agentset/** - AgentSet UI monorepo (cloned for development)
- Not tracked in this workspace
- Clone separately: `git clone https://github.com/agentset-ai/agentset.git`

### Development Tools

- **.claude/** - Claude Code agent system for AI-assisted development
- **.claude-collective/** - Multi-agent collective system configuration
- **.taskmaster/** - Task Master project management

---

## 🚀 Quick Start

### 1. Review Project Documentation

```bash
cd agentset-cloudflare-app
cat INTEGRATION_OVERVIEW.md
```

### 2. Read Integration Guides

- **[Integration Overview](./agentset-cloudflare-app/INTEGRATION_OVERVIEW.md)** - Complete picture
- **[Architecture Guide](./agentset-cloudflare-app/docs/integration/architecture.md)** - System design
- **[Integration Guide](./agentset-cloudflare-app/docs/integration/integration-guide.md)** - Implementation steps
- **[Frontend Plan](./agentset-cloudflare-app/docs/integration/frontend-integration-plan.md)** - UI changes

### 3. Clone AgentSet UI (if needed)

```bash
git clone https://github.com/agentset-ai/agentset.git
cd agentset
pnpm install
```

### 4. Setup Cloudflare Worker

```bash
cd agentset-cloudflare-app/apps/cf-worker
pnpm install
npx wrangler dev  # Local development
```

---

## 📚 Documentation

All integration documentation is in [agentset-cloudflare-app/docs/integration/](./agentset-cloudflare-app/docs/integration/):

- **[README](./agentset-cloudflare-app/docs/integration/README.md)** - Documentation index
- **[SUMMARY](./agentset-cloudflare-app/docs/integration/SUMMARY.md)** - Executive summary
- **[Architecture](./agentset-cloudflare-app/docs/integration/architecture.md)** - System architecture
- **[Integration Guide](./agentset-cloudflare-app/docs/integration/integration-guide.md)** - Step-by-step implementation
- **[Frontend Plan](./agentset-cloudflare-app/docs/integration/frontend-integration-plan.md)** - UI modification guide

---

## 🎯 What This Integration Does

Combines **AgentSet's UI/UX** with **Cloudflare's AI services** to provide:

- ⚡ **Global Edge Performance** - 250+ locations worldwide
- 💰 **60% Cost Reduction** - Through intelligent caching
- 🔒 **Enterprise Security** - Built-in guardrails
- 📊 **Full Observability** - Real-time metrics
- 🔄 **Zero Downtime Migration** - Gradual rollout

### Architecture at a Glance

```
User → AgentSet UI → tRPC Router → {
    Local RAG (Pinecone/Turbopuffer)
    OR
    Cloudflare Worker → AI Search + AI Gateway → LLMs
}
```

---

## 🛠️ Development Workflow

### Working with Claude Code

This workspace uses Claude Code with custom agents:

```bash
# The .claude/ directory contains:
# - Agent definitions for specialized tasks
# - Custom slash commands
# - Hook scripts for automation
```

### Working with Task Master

This workspace uses Task Master for project management:

```bash
# View tasks
task-master list

# Get next task
task-master next

# Update task status
task-master set-status --id=1.1 --status=done
```

---

## 📦 Repository Management

### This Workspace (agentset-cloudflare/)

- **Not a git repository itself**
- Contains development tools and cloned repos
- Root `.gitignore` excludes `agentset/` clone

### agentset-cloudflare-app/

- **Git repository**: https://github.com/davendra/agentset-cloudflare-app
- This is what gets committed to GitHub
- Contains Worker code and all integration documentation

### agentset/

- **Git repository**: https://github.com/agentset-ai/agentset
- Independent repository cloned for development
- Gitignored in this workspace
- Not part of agentset-cloudflare-app

---

## 🎨 Key Features

### Dual-Mode Operation

- **Local Mode** - Traditional AgentSet RAG
- **Cloudflare Mode** - Edge-optimized RAG
- **Hybrid Mode** - Per-namespace configuration

### Admin Controls

- Model route selection (quality vs. cost vs. speed)
- Safety levels and guardrails
- Cache configuration
- Budget limits with auto-degradation

### Observability

- Real-time performance metrics
- Cost tracking and breakdown
- Cache hit/miss rates
- Model usage distribution

---

## 🤝 Contributing

See [agentset-cloudflare-app/CONTRIBUTING.md](./agentset-cloudflare-app/CONTRIBUTING.md) for contribution guidelines.

## 📄 License

See [agentset-cloudflare-app/LICENSE.md](./agentset-cloudflare-app/LICENSE.md) for licensing information.

---

## 💡 Getting Help

- **Documentation**: [agentset-cloudflare-app/docs/integration/](./agentset-cloudflare-app/docs/integration/)
- **Issues**: [GitHub Issues](https://github.com/davendra/agentset-cloudflare-app/issues)
- **Discussions**: [GitHub Discussions](https://github.com/davendra/agentset-cloudflare-app/discussions)

---

**Last Updated**: October 26, 2025
**Status**: Ready for Implementation
# Trigger deployment
