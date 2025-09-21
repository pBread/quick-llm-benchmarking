import { faker } from "@faker-js/faker";
import { randomBytes } from "crypto";

const TEMPLATES: string[] = [
  `Pretend you are chatting with a friend. Start by greeting me, then naturally bring up that ${name()} suggested we grab a bite to eat when you're in ${country()}. You've heard they have great some ${food()} there.`,
];

export function generatePrompt(): string {
  const now = new Date().toISOString();

  const system = `This conversation (id ${id()}, generated at ${now}) is unique. Keep it casual, like normal spoken conversation.`;

  return `\
This conversation (id ${id()}, generated at ${now}) is unique.


Keep it casual, like normal spoken conversation.`;
}

function country() {
  return faker.location.country();
}

function food() {
  const types: (keyof typeof faker.food)[] = ["fruit", "meat", "vegetable"];
  const type = pick(types);
  return faker.food[type]();
}

function name() {
  const rand = Math.random();

  if (rand < 0.25) return faker.person.prefix() + " " + faker.person.lastName();
  if (rand < 0.5) return faker.person.firstName();
  return faker.person.fullName();
}

// ========================================
// Helpers
// ========================================
function pick<T>(xs: readonly T[]): T {
  return xs[Math.floor(Math.random() * xs.length)];
}

function id() {
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}
