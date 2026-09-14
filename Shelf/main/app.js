/**
 * All data lives in the browser's localStorage — there's no server and
 * no database. `api` mimics the shape of an async HTTP client (methods
 * return Promises) so the rest of the app reads the same either way,
 * but everything actually happens synchronously on this device.
 */

const STORAGE_KEY = 'shelf.books.v1';
const VALID_STATUSES = ['want', 'reading', 'finished'];

function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function seedBooks() {
  const now = Date.now();
  return [
    {
      id: '1',
      title: 'The Left Hand of Darkness',
      author: 'Ursula K. Le Guin',
      year: 1969,
      genre: 'Science Fiction',
      status: 'finished',
      rating: 5,
      notes: 'Reread the last chapter twice.',
      createdAt: new Date(now - 3 * 86400000).toISOString(),
    },
    {
      id: '2',
      title: 'Piranesi',
      author: 'Susanna Clarke',
      year: 2020,
      genre: 'Fantasy',
      status: 'reading',
      rating: 0,
      notes: 'About a third of the way through.',
      createdAt: new Date(now - 2 * 86400000).toISOString(),
    },
    {
      id: '3',
      title: 'Braiding Sweetgrass',
      author: 'Robin Wall Kimmerer',
      year: 2013,
      genre: 'Nonfiction',
      status: 'want',
      rating: 0,
      notes: 'Recommended by a friend at book club.',
      createdAt: new Date(now - 1 * 86400000).toISOString(),
    },
  ];
}

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      const seeded = seedBooks();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Could not read from localStorage', err);
    return [];
  }
}

function writeAll(books) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
}

function validateBook(body, { partial = false } = {}) {
  const errors = [];
  const clean = {};

  if (!partial || body.title !== undefined) {
    if (!body.title || !String(body.title).trim()) errors.push('Title is required.');
    else clean.title = String(body.title).trim();
  }
  if (!partial || body.author !== undefined) {
    if (!body.author || !String(body.author).trim()) errors.push('Author is required.');
    else clean.author = String(body.author).trim();
  }
  if (body.year !== undefined && body.year !== null && body.year !== '') {
    const y = Number(body.year);
    if (!Number.isInteger(y) || y < 0 || y > 2100) errors.push('Year must be a valid number.');
    else clean.year = y;
  } else if (!partial) {
    clean.year = null;
  }
  if (body.genre !== undefined) clean.genre = String(body.genre || '').trim();
  else if (!partial) clean.genre = '';
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) errors.push('Status must be want, reading, or finished.');
    else clean.status = body.status;
  } else if (!partial) {
    clean.status = 'want';
  }
  if (body.rating !== undefined && body.rating !== null && body.rating !== '') {
    const r = Number(body.rating);
    if (!Number.isInteger(r) || r < 0 || r > 5) errors.push('Rating must be a whole number from 0 to 5.');
    else clean.rating = r;
  } else if (!partial) {
    clean.rating = 0;
  }
  if (body.notes !== undefined) clean.notes = String(body.notes || '').trim();
  else if (!partial) clean.notes = '';

  return { errors, clean };
}

const api = {
  async list(params = {}) {
    let books = readAll();
    const { q, status } = params;

    if (status && VALID_STATUSES.includes(status)) {
      books = books.filter((b) => b.status === status);
    }
    if (q) {
      const needle = q.toLowerCase();
      books = books.filter(
        (b) =>
          b.title.toLowerCase().includes(needle) ||
          b.author.toLowerCase().includes(needle) ||
          (b.genre || '').toLowerCase().includes(needle)
      );
    }
    books.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return books;
  },

  async get(id) {
    const books = readAll();
    const book = books.find((b) => b.id === id);
    if (!book) throw new Error('Book not found.');
    return book;
  },

  async create(data) {
    const { errors, clean } = validateBook(data);
    if (errors.length) throw { errors };

    const books = readAll();
    const newBook = { id: uid(), ...clean, createdAt: new Date().toISOString() };
    books.push(newBook);
    writeAll(books);
    return newBook;
  },

  async update(id, data) {
    const books = readAll();
    const idx = books.findIndex((b) => b.id === id);
    if (idx === -1) throw new Error('Book not found.');

    const { errors, clean } = validateBook(data, { partial: true });
    if (errors.length) throw { errors };

    books[idx] = { ...books[idx], ...clean };
    writeAll(books);
    return books[idx];
  },

  async remove(id) {
    const books = readAll();
    const idx = books.findIndex((b) => b.id === id);
    if (idx === -1) throw new Error('Book not found.');

    const [removed] = books.splice(idx, 1);
    writeAll(books);
    return removed;
  },
};

function starString(rating) {
  const n = Number(rating) || 0;
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function statusLabel(status) {
  return { want: 'want to read', reading: 'reading', finished: 'finished' }[status] || status;
}

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}
