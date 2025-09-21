import { faker } from "@faker-js/faker";
import { randomBytes } from "crypto";

const TEMPLATES: string[] = [
  // concise, no reasoning
  "Respond with a friendly greeting to your friend, {name}, who just got back from {country} {integer_10} days ago.",
  "Pretend you are chatting with a friend. Start by greeting me, then naturally bring up that {name} suggested we grab a bite to eat when you're in {country}. You've heard they have great some {food} there.",

  // some reasoning
  "Pretend we're figuring out plans. If we leave {country} at {time}, drive a {car} for {integer_10} hours, and stop for {food}, what time do we arrive? Keep it conversational.",
  "We're planning a trip. If we leave {country} at {time}, drive a {car} for {integer_100} kilometers, and stop every {integer_10} hours, when would we get there? Explain it like a friend would.",
  "Keep it casual. If we bought {integer_100} pieces of {food} and shared them between {integer_10} friends, how many would each of us get? Walk me through it like you're just chatting.",
  "Write a poem in the {poetic_form} style. Set the location in {country}, include a nastalgic reference your car ({car}), and contrast the colors {color} and {color}.",

  // higher reasoning
  "How many jelly beans can you fit into a cylinder that is {integer_100}cm tall and {integer_100}in wide? Would it weigh more or less than {integer_10} {animal}? Show your work, provide a step by step explanation of how you came to your conclusion.",
];

export function generatePrompt(): string {
  const now = new Date().toISOString();

  const header = `This conversation (id ${id()}, generated at ${now}) is unique.`;
  const template = pick(TEMPLATES);
  const rendered = render(template);
  const body = addTypos(rendered);

  return `${header}\n${body}`;
}

function render(template: string) {
  const generators: Record<string, () => string> = {
    animal,
    car,
    color,
    country,
    food,
    integer_10,
    integer_100,
    integer_1000,
    name,
    poetic_form,
    time,
  };

  let rendered = template.replace(
    /\{([a-zA-Z0-9_.-]+)\}/g,
    (_: any, key: string) => {
      if (key in generators) {
        const gen = generators[key] as () => string;
        return gen();
      }

      return `{${key}}`;
    },
  );

  return rendered;
}

function animal() {
  return faker.animal.type();
}

function car() {
  const rand = Math.random();

  if (rand < 0.25) return faker.vehicle.manufacturer();
  if (rand < 0.5)
    return faker.vehicle.manufacturer() + " " + faker.vehicle.type();
  if (rand < 0.75) return faker.vehicle.color() + " " + faker.vehicle.model();
  return faker.vehicle.model();
}

function color() {
  return faker.color.human();
}

function country() {
  return faker.location.country();
}

function food() {
  const types: (keyof typeof faker.food)[] = ["fruit", "meat", "vegetable"];
  const type = pick(types);
  return faker.food[type]();
}

function integer_10() {
  return Math.ceil(Math.random() * 10).toString();
}

function integer_100() {
  return Math.ceil(Math.random() * 100).toString();
}

function integer_1000() {
  return Math.ceil(Math.random() * 1000).toString();
}

function name() {
  const rand = Math.random();

  if (rand < 0.25) return faker.person.prefix() + " " + faker.person.lastName();
  if (rand < 0.5) return faker.person.firstName();
  return faker.person.fullName();
}

function time() {
  const dt = new Date();
  return dt.toLocaleTimeString();
}

function poetic_form() {
  const poemTypes = [
    "Haiku",
    "Limerick",
    "Sonnet",
    "Villanelle",
    "Ode",
    "Elegy",
    "Epic",
    "Ballad",
    "Free Verse",
    "Acrostic",
    "Couplet",
    "Quatrain",
    "Tanka",
    "Pantoum",
    "Sestina",
    "Ghazal",
    "Clerihew",
    "Concrete (Shape) Poem",
    "Prose Poem",
    "Dramatic Monologue",
  ];

  return poemTypes[Math.floor(Math.random() * poemTypes.length)];
}

// ========================================
// Helpers
// ========================================
function addTypos(str: string) {
  const count = Math.round(Math.random() * 3);
  let result = str;
  for (let i = 0; i < count; i++) result = addTypo(result);
  return result;
}

function addTypo(s: string): string {
  if (!s) return s;
  const i = Math.floor(Math.random() * s.length);
  const ops = ["capitalize", "delete", "insert", "substitute", "swap"];
  const op = ops[Math.floor(Math.random() * ops.length)];

  if (op === "capitalize") {
    return s.slice(0, i) + s[i].toUpperCase() + s.slice(i);
  }

  if (op === "insert") {
    const c = randomChar();
    return s.slice(0, i) + c + s.slice(i);
  }

  if (op === "delete") {
    return s.slice(0, i) + s.slice(i + 1);
  }

  if (op === "substitute") {
    const c = randomChar();
    return s.slice(0, i) + c + s.slice(i + 1);
  }

  if (op === "swap" && i < s.length - 1) {
    return s.slice(0, i) + s[i + 1] + s[i] + s.slice(i + 2);
  }

  return s;
}

function randomChar() {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  return alphabet[Math.floor(Math.random() * alphabet.length)];
}

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
