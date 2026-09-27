#!/usr/bin/env node
/**
 * Category A Finland motorcycle quiz — local MCP server for Licence Coach.
 * Tools: quiz_due_count, quiz_next_card, quiz_answer, quiz_stats, quiz_add_topic_drill
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { createQuizEngine } from './lib/quiz.js';

const engine = await createQuizEngine();

const server = new McpServer({
  name: 'category-a-quiz',
  version: '1.0.0'
});

function text(obj) {
  return { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] };
}

server.registerTool(
  'quiz_due_count',
  {
    description: 'How many Category A theory cards are due for review (optional topic filter).',
    inputSchema: {
      topic: z
        .string()
        .optional()
        .describe('Topic id e.g. signs, alcohol, highways, or "all"')
    }
  },
  async ({ topic }) => text(engine.dueCount(topic || 'all'))
);

server.registerTool(
  'quiz_next_card',
  {
    description:
      'Get the next due (or drill) Category A practice card without revealing the answer. Then call quiz_answer with a rating.',
    inputSchema: {
      topic: z.string().optional().describe('Optional topic filter when not using a drill queue')
    }
  },
  async ({ topic }) => text(engine.nextCard({ topic }))
);

server.registerTool(
  'quiz_answer',
  {
    description:
      'Record an SM-2 rating for a card. rating: 0=Again, 1=Hard, 2=Good, 3=Easy. Optionally pass chosen answer to grade correctness.',
    inputSchema: {
      cardId: z.string().optional().describe('Card id (defaults to last quiz_next_card)'),
      rating: z.number().int().min(0).max(3).describe('0 Again, 1 Hard, 2 Good, 3 Easy'),
      chosen: z
        .union([z.number(), z.boolean()])
        .optional()
        .describe('Selected MC index or true/false for grading feedback')
    }
  },
  async (args) => text(engine.answer(args))
);

server.registerTool(
  'quiz_stats',
  {
    description: 'Progress dashboard: due today, retention index, weak topics, mature/young counts.',
    inputSchema: {}
  },
  async () => text(engine.stats())
);

server.registerTool(
  'quiz_add_topic_drill',
  {
    description:
      'Queue a focused drill of cards for a topic (signs, right_of_way, speed, equipment, alcohol, lights, passengers, winter, highways, licence, visibility, mechanics, other_users, risk).',
    inputSchema: {
      topic: z.string().describe('Topic id to drill'),
      limit: z.number().int().min(1).max(50).optional().describe('How many cards to queue (default 15)')
    }
  },
  async ({ topic, limit }) => text(engine.addTopicDrill({ topic, limit }))
);

const transport = new StdioServerTransport();
await server.connect(transport);
