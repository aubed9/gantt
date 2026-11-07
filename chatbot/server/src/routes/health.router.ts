import { Router, Request, Response } from 'express';
import { pgListenerService } from '../services/events/pg-listener.service.js';
import { mastra } from '../mastra/instance.js';

export const healthRouter = Router();

healthRouter.get('/health', (req: Request, res: Response) => {
  const listenerStatus = pgListenerService.getStatus();
  const registeredAgents = ['rpm-assistant-agent', 'task-claim-ranking-agent', 'eoj-assessor-agent'];

  return res.json({
    status: 'ok',
    service: 'rpm-v1-api-gateway',
    timestamp: new Date().toISOString(),
    databaseListener: listenerStatus,
    mastra: {
      registeredAgents,
      workflows: ['rpm-chat-v1', 'report-ingestion-v1'],
    },
  });
});
