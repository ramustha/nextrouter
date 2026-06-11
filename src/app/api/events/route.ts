import { NextRequest } from 'next/server';
import { eventBus } from '@/watcher/events';

export async function GET(request: NextRequest) {
  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();
  const encoder = new TextEncoder();

  // Send initial connection message
  writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`));

  // Handler to stream eventBus updates
  const onEvent = (event: any) => {
    try {
      writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    } catch (e) {
      // Stream might be closed, clean up listener
      eventBus.off('event', onEvent);
    }
  };

  eventBus.on('event', onEvent);

  // Clean up on request close
  request.signal.addEventListener('abort', () => {
    eventBus.off('event', onEvent);
    writer.close();
  });

  return new Response(responseStream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive'
    }
  });
}
