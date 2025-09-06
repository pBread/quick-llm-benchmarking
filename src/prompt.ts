import { faker } from "@faker-js/faker";

export function makePrompt() {
  const nonce = () =>
    `[${faker.string.alphanumeric({ length: { min: 2, max: 15 } })}]`;

  let prompt = "";

  switch (faker.number.int({ min: 0, max: 3 })) {
    case 0:
      prompt = `Where is the natural habitat of the ${animal().toLowerCase()}?`;
      break;

    case 1:
      prompt = `What is the scientific name of a "${animal()}"?`;
      break;

    case 2:
      prompt = `Where does the ${animal()} live?`;
      break;

    case 3:
      prompt = `How old do ${animal()} live to be?`;
      break;

    case 4:
      prompt = `Who is the leader of ${faker.location.country()}?`;
      break;

    case 5:
      prompt = `What continent is the country ${faker.location.country()} on?`;
      break;

    default:
      prompt = `How is "${word()}" pronounced?`;
  }

  prompt += `\n\n${nonce()}`;

  return prompt;
}

function animal() {
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
  return faker.word.sample({ length: { min: 6, max: 50 } }).toLowerCase();
}

function pick<T>(xs: T[]): T {
  return xs[Math.floor(Math.random() * xs.length)];
}

/**

What does this word mean? {word}
Define {word} in one sentence.
Explain {word} to a five-year-old.
Give two plain-English synonyms for {word}.
Give two plain-English antonyms for {word}.
Use {word} in a short sentence.
Give a simple metaphor that includes {word}.
Describe {word} in five words.
What is one common mistake people make with {word}?
Give a quick pros-and-cons list for {word}.
Write a two-line poem that includes {word}.
Turn {word} into a simple example.
Give one emoji that fits {word} and explain why.

Where does a {animal} usually live?
What does a {animal} typically eat?
Describe a {animal} in five words.
Name one thing a {animal} is known for.

Give three tips for a {profession}.
Describe a typical day for a {profession} in one sentence.
List three tools a {profession} uses.
What is one challenge a {profession} often faces?
Give one quick safety tip for a {profession}.
What are job interview questions to prepare for a {profession}?

Summarize {word} in plain language.
What’s a curiosity-provoking question about {word}?
Give one rule of thumb related to {word}.
What is a simple mistake to avoid with {word}?
Offer a one-sentence checklist for {word}.
Explain {word} without using the word itself.
 */
