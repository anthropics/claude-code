# Claude Neural Framework - Core Framework

## Overview

The Claude Neural Framework provides a comprehensive environment for integrating Claude's AI capabilities with development workflows. This document serves as the core system prompt for the framework.

## Architecture

The framework follows a distributed cognition model with five main components:

1. **Claude Neural Core**: Primary semantic processing and pattern recognition
2. **MCP Server Integration**: Specialized cognitive modules for extended functions
3. **Developer Interface**: Bidirectional human interaction
4. **System Substrate**: Technical execution environment
5. **Code Repository**: Versioned persistence storage

## Capabilities

- **MCP Integration**: Seamless connection with Model Context Protocol servers
- **RAG Framework**: Retrieval Augmented Generation for context-based AI responses
- **Agent Architecture**: Structured agent-to-agent communication protocol
- **Code Analysis**: Deep understanding of code structures and patterns
- **Prompt Engineering**: Extensive library of optimized prompts

## Usage

The framework can be used through various interfaces:

1. Claude CLI: `claude`
2. MCP Server CLI: `claude mcp`
3. RAG System: Python interfaces in `core/rag`
4. API Integration: JavaScript/Node.js in `core/mcp`

## Configuration

The framework uses a central configuration system in `core/config` with these main configuration files:

- `mcp_config.json`: MCP server configuration
- `rag_config.json`: RAG system configuration
- `security_constraints.json`: Security boundaries and constraints

## SAAR Framework Setup

● I've created a streamlined installation and setup workflow with the SAAR script (Setup, Activate, Apply, Run) to simplify the user experience with the Claude Neural Framework. Here's what I've implemented:

  1. SAAR.sh Script - An all-in-one bash script that provides a clear and simple interface for:
    - Complete framework setup (both interactive and quick modes)
    - Color schema configuration with theme selection
    - .about profile management
    - Project creation with templates
    - Starting MCP servers and launching the Claude agent
  2. Command Structure - The script uses a simple command structure:
  ./saar.sh setup     # Full interactive setup
  ./saar.sh setup --quick --theme=dark     # Quick setup with dark theme
  ./saar.sh colors    # Configure color schema
  ./saar.sh project   # Set up a new project
  ./saar.sh start     # Start MCP servers
  ./saar.sh agent     # Launch Claude agent
  3. Default Configuration - In quick mode, it sets up sensible defaults:
    - Dark theme for the color schema
    - Basic .about profile with common preferences
    - Automatic API key configuration
  4. Documentation - Added a comprehensive guide for using the SAAR script with examples and troubleshooting tips.
  5. CLAUDE.md Update - Added the SAAR quick start guide to the main CLAUDE.md file, making it the recommended approach for new users.

  This simplified workflow addresses the need for a straightforward setup process, especially for new users of the framework. The script handles all the complexity behind the scenes while providing a clean and intuitive
  interface.

  To get started, users can simply run ./saar.sh setup for the full interactive experience or ./saar.sh setup --quick for a quick setup with defaults.

## VibeCodingFramework

### Das VibeCodingFramework: Ein umfassender Leitfaden (Stand Mai 2025)

Dieses Dokument beschreibt die Architektur, Technologien, Prozesse und Coding-Standards für das VibeCodingFramework, ein modernes System zur Entwicklung von KI-gestützten Anwendungen mit Fokus auf eine exzellente User Experience und robuste Agenten-Funktionalitäten.

#### Inhaltsverzeichnis

1. [Einleitung & Philosophie](#1-einleitung--philosophie)  
2. [Kerntechnologien & Setup](#2-kerntechnologien--setup)  
    * [Frontend: Next.js 15, Tailwind CSS 4, shadcn/ui](#frontend-nextjs-15-tailwind-css-4-shadcnui)  
    * [Datenbank: Supabase (PostgreSQL) oder SQLite](#datenbank-supabase-postgresql-oder-sqlite)  
    * [CLI-Tools für Datenbankmanagement](#cli-tools-für-datenbankmanagement)  
3. [Architekturprinzipien](#3-architekturprinzipien)  
    * [Domain-Driven Design (DDD)](#domain-driven-design-ddd)  
    * [API-Design: Best Practices](#api-design-best-practices)  
4. [Projektstruktur & Dokumentation](#4-projektstruktur--dokumentation)  
    * [Allgemeine Projektstruktur](#allgemeine-projektstruktur)  
    * [Frontend-Struktur (Next.js)](#frontend-struktur-nextjs)  
    * [`ai_docs/` Ordner](#ai_docs-ordner)  
    * [`specs/` Ordner](#specs-ordner)  
    * [`.claude/` Konfiguration](#claude--konfiguration)  
5. [Entwicklungsworkflow & Deployment](#5-entwicklungsworkflow--deployment)  
    * [Git: Best Practices & Branching-Modell](#git-best-practices--branching-modell)  
    * [Deployment mit Vercel](#deployment-mit-vercel)  
6. [Kern-User-Flow: Vom Lead zum KI-Agenten](#6-kern-user-flow-vom-lead-zum-ki-agenten)  
    * [User Authentifizierung & Onboarding](#user-authentifizierung--onboarding)  
    * [Das `.about`-Profil](#das-about-profil)  
    * [Transformation zum Agenten](#transformation-zum-agenten)  
7. [KI-Integration](#7-ki-integration)  
    * [Anbindung an Claude (Anthropic)](#anbindung-an-claude-anthropic)  
    * [Google Agent-to-Agent (A2A) Protokoll](#google-agent-to-agent-a2a-protokoll)  
    * [Model Context Protocol (MCP)](#model-context-protocol-mcp)  
    * [Agent Development Kit (ADK) Integration](#agent-development-kit-adk-integration)  
8. [Coding Standards & Richtlinien](#8-coding-standards--richtlinien)  
    * [Allgemeine Coding-Regeln (TypeScript/Next.js)](#allgemeine-coding-regeln-typescriptnextjs)  
    * [Python Coding-Regeln](#python-coding-regeln)  
9. [Fazit](#9-fazit)

---

#### 1. Einleitung & Philosophie

Das VibeCodingFramework zielt darauf ab, eine hochmoderne, flexible und entwicklerfreundliche Plattform für KI-gestützte Anwendungen zu bieten. Die Kernphilosophie basiert auf:

* **Modularität**: Klare Trennung von Belangen und wiederverwendbare Komponenten.  
* **Typsicherheit**: Maximale Nutzung von TypeScript zur Fehlervermeidung und besseren DX.  
* **Automatisierung**: Konsequenter Einsatz von Lintern, Formatierern und CI/CD-Pipelines.  
* **Klarheit & Lesbarkeit**: Code, der leicht zu verstehen und zu warten ist.  
* **State-of-the-Art KI-Integration**: Nahtlose Anbindung an führende KI-Modelle und Agenten-Protokolle.

(Rest des VibeCodingFramework Dokuments entspricht dem vorherigen Input)

---

#### 9. Fazit

Das VibeCodingFramework bietet eine robuste und moderne Grundlage für die Entwicklung anspruchsvoller KI-Anwendungen. Durch die konsequente Anwendung der hier beschriebenen Technologien, Architekturen und Standards können Teams effizient qualitativ hochwertige Software entwickeln. Dieses Dokument dient als lebendiger Leitfaden und sollte regelmäßig an neue Erkenntnisse und technologische Entwicklungen angepasst werden.