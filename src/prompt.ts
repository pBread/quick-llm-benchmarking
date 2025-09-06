import { faker } from "@faker-js/faker";

const TEMPLATES: readonly string[] = [
  "What does this word mean? {word}",
  "Define {word} in one sentence.",
  "Explain '{word}' to a five-year-old.",
  "Give two plain-English synonyms for {word}.",
  "Give two plain-English antonyms for {word}.",
  "Use {word} in a short sentence.",
  "Give a simple metaphor that includes {word}.",
  "What is one common mistake people make with {word}?",
  "Write a two-line poem that includes {word}.",
  "Write a haiku using the word '{word}'",

  "Where does a {animal} usually live?",
  "What does a {animal} typically eat?",
  "Is the {animal} a carnivore?",

  "Give three tips for a {profession}.",
  "Describe a typical day for a {profession} in one sentence.",
  "List a few tools a {profession} uses.",
  "What is one challenge a {profession} often faces?",
  "Give one quick safety tip for a {profession}.",
  "What are job interview questions to prepare for a {profession}?",

  "Summarize {word} in plain language.",
  "What's a curiosity-provoking question about {word}?",
  "Give one rule of thumb related to {word}.",
  "What is a simple mistake to avoid with {word}?",
  "Offer a one-sentence checklist for {word}.",
  "Explain {word} without using the word itself.",

  "Is {book} appropriate reading for a 13 year old?",
  "Is {book} considered a {book_genre} or something else?",
  "Did {book_author} write the book '{book}'?",
  "Did {book_author} write {book}?",
  "What are some books by {book_author}",
  "Were any of {book_author}'s books made into movies?",
  "What are a few books in the {book_genre} genre? Anything by {book_author}?",
];

export function makePrompt() {
  const template =
    TEMPLATES[faker.number.int({ min: 0, max: TEMPLATES.length - 1 })];
  let prompt = fillTemplate(template);

  prompt += `\n`;
  prompt += `[${faker.string.alphanumeric({ length: { min: 2, max: 15 } })}]`;

  return prompt;
}

function fillTemplate(tpl: string): string {
  const out = tpl
    .replaceAll("{word}", word())
    .replaceAll("{animal}", animal())
    .replaceAll("{profession}", profession())
    .replaceAll("{book}", book())
    .replaceAll("{book_genre}", book_genre())
    .replaceAll("{book_author}", book_author())
    .replaceAll("{book_genre}", book_genre())
    .replaceAll("{book_genre}", book_genre());

  return out;
}

function animal(): string {
  const type = pick([
    "bear",
    "cat",
    "cow",
    "dog",
    "fish",
    "horse",
    "insect",
    "lion",
    "rabbit",
    "rodent",
    "snake",
  ]);
  return faker.animal[type]().toLowerCase();
}

function word() {
  return faker.word.sample({ length: { min: 5, max: 40 } }).toLowerCase();
}

function profession() {
  return faker.person.jobType().toLowerCase();
}

function book() {
  return faker.book.title();
}

function book_genre() {
  return faker.book.genre();
}

function book_author() {
  return faker.book.author();
}

function pick<T>(xs: readonly T[]): T {
  return xs[Math.floor(Math.random() * xs.length)];
}
