import { Priority, Ticket, TicketCategory } from '@/src/types/ticket';

/**
 * Result of the deterministic fake AI triage pass.
 */
export interface FakeTriageResult {
  priority: Priority;
  category: TicketCategory;
  summary: string;
  reason: string;
  confidence: number;
}

const PRIORITIES: Priority[] = ['P0', 'P1', 'P2', 'P3'];
const CATEGORIES: TicketCategory[] = [
  'billing',
  'technical',
  'account',
  'feature_request',
  'security',
  'general',
];

/**
 * Simple, stable 32-bit string hash (djb2 variant). Deterministic across runs
 * and platforms — NO Math.random — so the same ticket always triages the same
 * way, which keeps the behavior testable.
 */
function hashString(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  // Force to an unsigned 32-bit integer.
  return hash >>> 0;
}

/**
 * Deterministic fake AI triage. Seeds all of its choices from a hash of the
 * ticket's id + subject + description so a given ticket always yields the exact
 * same result. Enforces the enterprise priority floor: enterprise-tier tickets
 * never triage below P1.
 */
export function runFakeTriage(ticket: Ticket): FakeTriageResult {
  const seedSource = `${ticket.id}|${ticket.subject}|${ticket.description}`;
  const seed = hashString(seedSource);

  let priority = PRIORITIES[seed % PRIORITIES.length];

  // Enterprise floor: never return a priority below P1 (P2/P3 -> P1).
  if (ticket.customer.tier === 'enterprise' && (priority === 'P2' || priority === 'P3')) {
    priority = 'P1';
  }

  const category = CATEGORIES[(seed >>> 3) % CATEGORIES.length];

  // Confidence in a stable 0.60–0.99 band derived from the same seed.
  const confidence = Number((0.6 + ((seed >>> 5) % 40) / 100).toFixed(2));

  const summary = `Auto-triaged ${ticket.id}: ${priority} ${category.replace(/_/g, ' ')} request from ${ticket.customer.tier} customer.`;

  const reason =
    ticket.customer.tier === 'enterprise'
      ? `Enterprise customer detected; priority floored to ${priority}. Classified as ${category} with ${Math.round(confidence * 100)}% confidence.`
      : `Classified as ${category} at ${priority} with ${Math.round(confidence * 100)}% confidence based on subject and description signals.`;

  return { priority, category, summary, reason, confidence };
}
