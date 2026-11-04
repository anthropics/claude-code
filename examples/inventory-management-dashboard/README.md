# ELP Cloud - Inventory Management Dashboard

A professional-grade logistics management system built with React, TypeScript, and modern best practices.

## Features

- **Database Management**: Full CRUD operations for shipping rates
- **Smart Calculator**: Calculate shipping costs with ELP margin
- **Analytics Dashboard**: Visual insights with charts and statistics
- **Data Import/Export**: JSON and CSV support
- **Calculation History**: Track and save your calculations
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Accessibility**: WCAG 2.1 compliant with full keyboard navigation

## Tech Stack

- **React 18** with TypeScript
- **Vite** for blazing fast development
- **Tailwind CSS** for styling
- **Recharts** for data visualization
- **Lucide React** for icons
- **date-fns** for date formatting

## Architecture

```
src/
├── components/
│   ├── ui/           # Reusable UI components (Button, Input, Modal, etc.)
│   ├── layout/       # Layout components (Header, Footer)
│   └── features/     # Feature-specific components
│       ├── database/     # Rate management
│       ├── calculator/   # Cost calculation
│       └── analytics/    # Statistics & charts
├── hooks/            # Custom React hooks
├── types/            # TypeScript type definitions
├── utils/            # Utility functions
└── constants/        # App constants and configuration
```

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

## Key Improvements over Original

1. **TypeScript**: Full type safety across the entire codebase
2. **Component Architecture**: Proper separation of concerns
3. **Custom Hooks**: Reusable business logic (`useRates`, `useCalculator`, `useToast`)
4. **Toast Notifications**: User-friendly feedback instead of browser alerts
5. **Confirmation Dialogs**: Custom modal dialogs for destructive actions
6. **Data Export/Import**: JSON and CSV export, JSON import with merge support
7. **Calculation History**: Save and review past calculations
8. **Analytics Dashboard**: Visual statistics with pie charts and bar charts
9. **Debounced Search**: Optimized search performance
10. **Accessibility**: Proper ARIA labels, keyboard navigation, focus management
11. **Responsive Design**: Mobile-first approach with Tailwind CSS
12. **Error Handling**: Graceful error handling throughout
13. **LocalStorage Abstraction**: Type-safe storage utilities
14. **Configurable Settings**: Exchange rate, margins, etc.

## License

MIT
