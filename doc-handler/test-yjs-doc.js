#!/usr/bin/env node

const Y = require('yjs');

// Create a new Yjs document
const doc = new Y.Doc();

// Get the root map
const root = doc.getMap('blocks');

// Create a page block
const pageId = 'page:home';
root.set(
  pageId,
  new Y.Map([
    ['sys:id', pageId],
    ['sys:flavour', 'affine:page'],
    ['sys:children', new Y.Array()],
    ['prop:title', new Y.Text('Test Document Created via REST API')],
  ])
);

// Encode the document as update
const update = Y.encodeStateAsUpdate(doc);

console.log('Yjs document update:');
console.log('Size:', update.length, 'bytes');
console.log('Update as array:', Array.from(update));
console.log('Update as base64:', Buffer.from(update).toString('base64'));
