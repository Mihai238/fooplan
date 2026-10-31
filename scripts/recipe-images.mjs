import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const recipesDir = new URL('../src/app/recipes/', import.meta.url);
const imagesDir = new URL('../public/images/recipes/', import.meta.url);
const listFile = new URL('recipe-images.json', recipesDir);

const key = process.env.OPENAI_API_KEY;
if (!key) {
  stop('Set OPENAI_API_KEY.');
}

const recipes = JSON.parse(await readFile(new URL('recipes.json', recipesDir), 'utf8'));
const names = process.argv.slice(2);
for (const name of names) {
  if (!recipes.some((recipe) => recipe.name === name)) {
    stop(`No built-in recipe "${name}".`);
  }
}

await mkdir(imagesDir, { recursive: true });
const existing = await imageSlugs();
const wanted =
  names.length > 0
    ? recipes.filter((recipe) => names.includes(recipe.name))
    : recipes.filter((recipe) => !existing.includes(recipeSlug(recipe.name)));

let failure;
for (const recipe of wanted) {
  const file = `${recipeSlug(recipe.name)}.webp`;
  try {
    const image = await generate(recipe);
    await sharp(image)
      .resize(800, 534, { fit: 'cover' })
      .webp({ quality: 80 })
      .toFile(fileURLToPath(new URL(file, imagesDir)));
  } catch (error) {
    failure = error;
    break;
  }
  console.log(file);
}

// Rewritten from the folder, also after a failure, so it lists the files written so far and drops
// a file deleted by hand
await writeFile(listFile, JSON.stringify(await imageSlugs(), null, 2) + '\n');
if (failure) {
  stop(failureText(failure));
}

async function generate(recipe) {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt: promptFor(recipe),
      size: '1536x1024',
      quality: 'medium',
      n: 1,
      output_format: 'webp',
    }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(errorText(text));
  }
  return Buffer.from(JSON.parse(text).data[0].b64_json, 'base64');
}

function promptFor(recipe) {
  const ingredients = recipe.ingredients.map((ingredient) => ingredient.name).join(', ');
  return (
    `Photo of ${recipe.name}, home-cooked and served on a plain plate on a light wooden table, ` +
    `seen from above at a slight angle, natural daylight, made with ${ingredients}. ` +
    'No text, no people, no hands.'
  );
}

function errorText(body) {
  try {
    return JSON.parse(body).error?.message || body;
  } catch {
    return body;
  }
}

async function imageSlugs() {
  const files = await readdir(imagesDir);
  return files
    .filter((file) => file.endsWith('.webp'))
    .map((file) => file.slice(0, -'.webp'.length))
    .sort();
}

// The same as recipeSlug() in src/app/recipes/recipe-slug.ts, which plain Node can't import (its
// imports have no extension), so that the file names match the slugs the app looks up
function recipeSlug(name) {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N} -]/gu, '')
    .replace(/[ -]+/g, '-')
    .replace(/^-|-$/g, '');
}

// fetch() rejects with just "fetch failed" when the network fails; the reason is further down its
// cause chain, in an AggregateError's errors when every address of the host refused (its own
// message is empty). A part already in an earlier one (the code in "getaddrinfo ENOTFOUND …") is
// left out
function failureText(error) {
  const parts = [];
  for (let link = error; link; link = link.cause) {
    parts.push(link.message, link.code, ...(link.errors ?? []).map((attempt) => attempt.message));
  }
  return parts
    .filter((part) => typeof part === 'string' && part)
    .filter((part, i, all) => !all.slice(0, i).some((earlier) => earlier.includes(part)))
    .join(': ');
}

// Node puts an invalid header value, the key included, into the error message
function stop(message) {
  const secret = key?.trim();
  console.error(secret ? message.replaceAll(secret, '***') : message);
  process.exit(1);
}
