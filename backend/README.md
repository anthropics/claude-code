# Creator Studio Backend

AI-powered content creation and publishing platform for creators. Record once, content everywhere.

## Tech Stack

- **Framework**: Django 5.0 + Django REST Framework
- **Database**: PostgreSQL 16
- **Task Queue**: Celery + Redis
- **AI**: OpenAI (GPT-4, Whisper)
- **Payments**: Stripe
- **Auth**: JWT (SimpleJWT)

## Quick Start

### 1. Clone and Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your API keys
```

### 2. Run with Docker (Recommended)

```bash
docker-compose up -d
```

The API will be available at `http://localhost:8000`

### 3. Run Locally (Development)

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install dependencies
pip install -r requirements.txt

# Start PostgreSQL and Redis (or use Docker for just these)
docker-compose up -d db redis

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Run server
python manage.py runserver

# In another terminal, run Celery worker
celery -A config worker -l info
```

## API Documentation

Once running, visit:
- Swagger UI: `http://localhost:8000/api/docs/`
- OpenAPI Schema: `http://localhost:8000/api/schema/`

## Core Endpoints

### Authentication
```
POST /api/v1/auth/register/          # Create account
POST /api/v1/auth/token/             # Get JWT token
POST /api/v1/auth/token/refresh/     # Refresh token
GET  /api/v1/auth/me/                # Get current user
```

### Content Pipeline
```
# Brands (your creator identity)
GET/POST   /api/v1/brands/
POST       /api/v1/brands/{id}/learn_voice/     # Learn voice from samples
POST       /api/v1/brands/{id}/generate_plan/   # Generate content plan

# Source Samples (for voice learning)
GET/POST   /api/v1/samples/

# Transcripts (from audio or paste)
GET/POST   /api/v1/transcripts/
POST       /api/v1/transcripts/{id}/detect_clips/

# Clips (viral moments)
GET        /api/v1/clips/
POST       /api/v1/clips/{id}/approve/
POST       /api/v1/clips/{id}/reject/

# Content Plans
GET/POST   /api/v1/plans/
GET/POST   /api/v1/plan-items/
POST       /api/v1/plan-items/{id}/generate_draft/

# Drafts
GET        /api/v1/drafts/
POST       /api/v1/drafts/{id}/edit/
POST       /api/v1/drafts/{id}/regenerate/
POST       /api/v1/drafts/{id}/approve/
```

### Podcasts
```
GET/POST   /api/v1/shows/
POST       /api/v1/shows/{id}/generate_episode/
GET/POST   /api/v1/episodes/
POST       /api/v1/episodes/{id}/publish/
GET/POST   /api/v1/podcast-connections/
```

### Billing
```
GET        /api/v1/subscriptions/current/
POST       /api/v1/billing/checkout/    # Start subscription
POST       /api/v1/billing/portal/      # Manage subscription
POST       /api/v1/billing/webhook/     # Stripe webhook
```

### Jobs (async operation status)
```
GET        /api/v1/jobs/{id}/status/
```

## Environment Variables

See `.env.example` for all required variables.

### Required for MVP:
- `DJANGO_SECRET_KEY` - Django secret key
- `DATABASE_URL` - PostgreSQL connection string
- `OPENAI_API_KEY` - OpenAI API key for GPT-4 and Whisper

### Required for Production:
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- `FIELD_ENCRYPTION_KEY` - Fernet key for encrypting API tokens

## Architecture

```
backend/
├── config/                 # Django settings, URLs, Celery config
├── apps/
│   ├── core/              # User, Workspace, GenerationJob
│   ├── content/           # Brand, Transcript, Clip, Draft
│   ├── ai/                # Prompts, AI service, generation tasks
│   ├── billing/           # Subscription, Stripe integration
│   ├── podcasts/          # Show, Episode, host connections
│   ├── publishing/        # Platform connections, publish records
│   └── media/             # Asset storage
└── requirements.txt
```

## Content Generation Flow

1. **Upload/Paste** → Create Transcript
2. **Detect Clips** → AI extracts viral moments
3. **Generate Plan** → AI creates week's content calendar
4. **Generate Drafts** → AI creates platform-native content
5. **Review/Edit** → User approves or requests changes
6. **Publish** → Content goes live on platforms

## Pricing Tiers

| Tier | Price | Generations | Brands | Scheduled Posts |
|------|-------|-------------|--------|-----------------|
| Free | $0 | 3/month | 1 | 0 |
| Creator | $29/mo | Unlimited | 1 | 30/month |
| Pro | $79/mo | Unlimited | 3 | Unlimited |
| Agency | $199/mo | Unlimited | 10 | Unlimited |

## Testing

```bash
# Run tests
python manage.py test

# With coverage
coverage run manage.py test
coverage report
```

## License

Proprietary - All rights reserved
