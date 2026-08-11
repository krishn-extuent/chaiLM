import express from 'express';
import cors from "cors";
import cookieParser from "cookie-parser";
import indexerRoutes from './routes/indexer.routes.js';
import queryRoutes from './routes/query.routes.js';
import workspaceRoutes from './routes/workspace.routes.js';
import userRoutes from './routes/user.routes.js';

const app = express();

app.use(cors({
  origin: process.env.CLIENTS_URI || "http://localhost:5173",
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is healthy' });
});

app.use('/api/indexer', indexerRoutes);
app.use('/api/query', queryRoutes);
app.use('/api/workspace', workspaceRoutes);
app.use('/api/user', userRoutes);

export default app;
