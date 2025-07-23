import { PrismaClient } from '@prisma/client';
import * as Y from 'yjs';

async function analyzeDocument() {
  const prisma = new PrismaClient();

  try {
    // Meeting note document ID
    const docId = '61723459-5179-43bc-8c15-352263dc087c';
    const workspaceId = '6e66e74d-da20-4e07-abed-96b82df3c61c';

    console.log(`\nAnalyzing document: ${docId}`);
    console.log('='.repeat(80));

    // Get snapshot and updates
    const snapshot = await prisma.snapshot.findFirst({
      where: { workspaceId, id: docId },
      orderBy: { createdAt: 'desc' },
    });

    const updates = await prisma.update.findMany({
      where: {
        workspaceId,
        id: docId,
        createdAt: snapshot ? { gt: snapshot.createdAt } : undefined,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Create Y.Doc
    const ydoc = new Y.Doc();

    if (snapshot?.blob) {
      Y.applyUpdate(ydoc, Buffer.from(snapshot.blob));
    }

    for (const update of updates) {
      if (update.blob) {
        Y.applyUpdate(ydoc, Buffer.from(update.blob));
      }
    }

    console.log('\nSearching for ALL text content and shapes...\n');

    let textCount = 0;
    let shapeCount = 0;

    // Function to find all text and shapes
    const findAllContent = (item: any, path: string = '') => {
      if (item instanceof Y.Text) {
        textCount++;
        const textContent = item.toString();
        if (textContent.trim()) {
          console.log(`Text #${textCount} at ${path}:`);
          console.log(`  Content: "${textContent}"`);

          // Check delta for attributes
          try {
            const delta = item.toDelta();
            if (delta.ops && delta.ops.length > 0) {
              console.log(`  Delta ops: ${delta.ops.length}`);
              delta.ops.forEach((op, i) => {
                if (op.attributes && Object.keys(op.attributes).length > 0) {
                  console.log(
                    `    Op[${i}]: "${op.insert}" with attributes:`,
                    op.attributes
                  );
                }
              });
            }
          } catch (e) {
            console.log(`  Error getting delta:`, e);
          }
          console.log('');
        }
      } else if (item instanceof Y.Map) {
        // Check if this is a shape
        const flavour = item.get('sys:flavour');
        const shapeType = item.get('type');

        if (flavour === 'affine:shape' || shapeType) {
          shapeCount++;
          console.log(`Shape #${shapeCount} at ${path}:`);
          console.log(`  Flavour: ${flavour}`);
          console.log(`  Type: ${shapeType}`);

          // Get all properties
          const props = {};
          for (const [key, value] of item.entries()) {
            if (
              key.startsWith('prop:') ||
              [
                'text',
                'participantId',
                'speakerId',
                'participantName',
                'speakerName',
              ].includes(key)
            ) {
              if (value instanceof Y.Text) {
                props[key] = `Y.Text("${value.toString()}")`;
              } else if (
                typeof value === 'string' ||
                typeof value === 'number'
              ) {
                props[key] = value;
              } else {
                props[key] = `${value?.constructor?.name || typeof value}`;
              }
            }
          }

          console.log(`  Properties:`, props);
          console.log('');
        }

        // Recurse
        for (const [key, value] of item.entries()) {
          findAllContent(value, path ? `${path}/${key}` : key);
        }
      } else if (item instanceof Y.Array) {
        item.forEach((subItem, index) => {
          findAllContent(subItem, `${path}[${index}]`);
        });
      }
    };

    // Search in blocks
    const blocks = ydoc.getMap('blocks');
    findAllContent(blocks, 'blocks');

    console.log(`\nTotal text nodes: ${textCount}`);
    console.log(`Total shapes: ${shapeCount}`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeDocument();
