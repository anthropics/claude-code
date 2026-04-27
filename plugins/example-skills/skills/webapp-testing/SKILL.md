---
name: webapp-testing
description: This skill should be used when the user asks to "write tests for my web app", "add unit tests", "create integration tests", "set up end-to-end tests", "write Playwright tests", "add Jest tests", "test my React components", "write Cypress tests", "test API endpoints", or implement any form of automated testing for web applications.
version: 1.0.0
---

# Web Application Testing

This skill guides writing automated tests for web applications — unit, integration, and end-to-end (E2E) tests.

## Test Type Selection

| Type | When to Use | Tools |
|------|-------------|-------|
| **Unit** | Individual functions, utilities, pure logic | Jest, Vitest, Mocha |
| **Component** | React/Vue/Angular components in isolation | React Testing Library, Vue Test Utils |
| **Integration** | Multiple units working together, API calls | Jest + MSW, Supertest |
| **E2E** | Full user flows in real browser | Playwright, Cypress |
| **API** | REST/GraphQL endpoint behavior | Supertest, Vitest + fetch |

## Unit Testing (Jest / Vitest)

```bash
npm install --save-dev jest @types/jest
# or
npm install --save-dev vitest
```

```javascript
// utils.test.js
import { formatCurrency, validateEmail } from './utils';

describe('formatCurrency', () => {
    it('formats positive numbers', () => {
        expect(formatCurrency(1234.5)).toBe('$1,234.50');
    });

    it('handles zero', () => {
        expect(formatCurrency(0)).toBe('$0.00');
    });

    it('handles negative numbers', () => {
        expect(formatCurrency(-50)).toBe('-$50.00');
    });
});

describe('validateEmail', () => {
    it.each([
        ['user@example.com', true],
        ['invalid-email', false],
        ['', false],
        ['user@', false],
    ])('validates "%s" as %s', (email, expected) => {
        expect(validateEmail(email)).toBe(expected);
    });
});
```

## React Component Testing

```bash
npm install --save-dev @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

```javascript
// Button.test.jsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
    it('renders with label', () => {
        render(<Button>Click me</Button>);
        expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
    });

    it('calls onClick when clicked', async () => {
        const user = userEvent.setup();
        const handleClick = jest.fn();

        render(<Button onClick={handleClick}>Submit</Button>);
        await user.click(screen.getByRole('button'));

        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('is disabled when loading', () => {
        render(<Button loading>Submit</Button>);
        expect(screen.getByRole('button')).toBeDisabled();
    });
});
```

## Async and API Testing

```javascript
// Mock fetch / API calls
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
    http.get('/api/users', () => {
        return HttpResponse.json([{ id: 1, name: 'Alice' }]);
    })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

it('loads and displays users', async () => {
    render(<UserList />);
    expect(await screen.findByText('Alice')).toBeInTheDocument();
});

// Test error states
it('shows error on failed request', async () => {
    server.use(
        http.get('/api/users', () => HttpResponse.error())
    );
    render(<UserList />);
    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
});
```

## API Route Testing (Node.js / Supertest)

```javascript
import request from 'supertest';
import app from '../app';

describe('GET /api/users', () => {
    it('returns users list', async () => {
        const res = await request(app).get('/api/users');
        expect(res.status).toBe(200);
        expect(res.body).toBeInstanceOf(Array);
        expect(res.body[0]).toHaveProperty('id');
    });

    it('requires authentication', async () => {
        const res = await request(app).get('/api/users/me');
        expect(res.status).toBe(401);
    });

    it('creates a user', async () => {
        const res = await request(app)
            .post('/api/users')
            .send({ name: 'Bob', email: 'bob@example.com' });
        expect(res.status).toBe(201);
        expect(res.body.email).toBe('bob@example.com');
    });
});
```

## End-to-End Testing (Playwright)

```bash
npm install --save-dev @playwright/test
npx playwright install
```

```javascript
// tests/login.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
    test('successful login redirects to dashboard', async ({ page }) => {
        await page.goto('/login');

        await page.fill('[name=email]', 'user@example.com');
        await page.fill('[name=password]', 'password123');
        await page.click('[type=submit]');

        await expect(page).toHaveURL('/dashboard');
        await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    });

    test('shows error with invalid credentials', async ({ page }) => {
        await page.goto('/login');
        await page.fill('[name=email]', 'wrong@example.com');
        await page.fill('[name=password]', 'wrongpass');
        await page.click('[type=submit]');

        await expect(page.getByText('Invalid credentials')).toBeVisible();
    });
});
```

## Testing Checklist

### Unit Tests
- [ ] Happy path works correctly
- [ ] Edge cases handled (empty input, null, zero, very large numbers)
- [ ] Error conditions throw/return correctly
- [ ] Pure functions are deterministic

### Component Tests
- [ ] Renders without crashing
- [ ] Displays correct content
- [ ] User interactions work (`click`, `type`, `submit`)
- [ ] Loading/error/empty states render correctly
- [ ] Accessibility: interactive elements are keyboard-accessible

### E2E Tests
- [ ] Critical user journeys covered (login, checkout, core feature)
- [ ] Error states are tested (network failure, invalid data)
- [ ] Runs against staging environment before production

## Best Practices

- Test behavior, not implementation — test what the component does, not how
- Use `data-testid` sparingly; prefer accessible queries (`getByRole`, `getByLabel`)
- Mock at the network layer (MSW), not at the module level
- Keep tests independent — no shared mutable state between tests
- One assertion per test is ideal; related assertions in one test is acceptable
- Name tests descriptively: `it('shows error message when email is invalid')`
- Run tests in CI on every PR — don't let a broken test suite slide
