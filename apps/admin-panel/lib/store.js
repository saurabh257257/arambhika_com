// Plain JSON files, one per collection, in the data folder (no database). Each file is read once into memory
// and rewritten atomically (temp file, then rename) after every change, so a crash never leaves a half-written file.
// The app runs as a single process, so there is no concurrent writer to coordinate with.
'use strict';
const fs = require('fs');
const path = require('path');

class Store {
  constructor(dir) {
    this.dir = dir;
    this.cache = new Map();
    fs.mkdirSync(dir, { recursive: true });
  }

  file(name) { return path.join(this.dir, name + '.json'); }

  // The live array for a collection. Mutate it, then call save(name).
  list(name, defaults = []) {
    if (!this.cache.has(name)) {
      let data;
      try { data = JSON.parse(fs.readFileSync(this.file(name), 'utf8')); } catch (e) { data = null; }
      if (!Array.isArray(data)) { data = JSON.parse(JSON.stringify(defaults)); this.cache.set(name, data); this.save(name); }
      else this.cache.set(name, data);
    }
    return this.cache.get(name);
  }

  save(name) {
    const tmp = this.file(name) + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.cache.get(name), null, 1));
    fs.renameSync(tmp, this.file(name));
  }
}

module.exports = { Store };
