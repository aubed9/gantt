import { Router, Request, Response } from 'express';
import { audioTranscriptionService } from '../services/audio-transcribe.service.js';

export const audioRouter = Router();

/**
 * POST /api/audio/transcribe
 * Transcribe voice dictations and apply Persian normalizer with ZWNJ preservation.
 */
audioRouter.post('/transcribe', async (req: Request, res: Response) => {
  const tenantId = (req.body.tenant_id || req.headers['x-tenant-id'] || 'TN-1') as string;
  const audioBase64 = req.body.audio_base64 as string | undefined;
  const simulatedTranscript = req.body.simulated_transcript || req.body.text as string | undefined;
  const humanId = (req.body.human_id || req.headers['x-human-id'] || 'HM-3') as string;

  try {
    const result = await audioTranscriptionService.transcribe({
      tenantId,
      audioBase64,
      simulatedTranscript,
      humanId,
    });
    return res.json(result);
  } catch (err: any) {
    console.error('[AudioRouter] Transcription failed:', err);
    return res.status(500).json({ error: err.message });
  }
});
