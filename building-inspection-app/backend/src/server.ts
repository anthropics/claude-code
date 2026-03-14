import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { aiRouter } from './routes/ai';
import { authRouter } from './routes/auth';
import { learningRouter } from './routes/learning';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API Routes
app.use('/api/ai', aiRouter);
app.use('/api/auth', authRouter);
app.use('/api/learning', learningRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend in production
const frontendDist = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🏗️  KuntotarkastusAI running on port ${PORT}`);
  console.log(`   App: http://localhost:${PORT}`);
  console.log(`   Claude API: ${process.env.ANTHROPIC_API_KEY ? '✓ Connected' : '✗ Missing ANTHROPIC_API_KEY'}`);
});

export default app;
