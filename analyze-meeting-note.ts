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

    console.log('\nSearching for text with code: true attribute...\n');

    let codeTextCount = 0;

    // Function to find code blocks
    const findCodeBlocks = (item: any, path: string = '') => {
      if (item instanceof Y.Text) {
        try {
          const delta = item.toDelta();
          if (delta.ops) {
            delta.ops.forEach((op, index) => {
              if (op.attributes?.code === true) {
                codeTextCount++;
                console.log(`Found code text #${codeTextCount} at ${path}:`);
                console.log(`  Text: "${op.insert}"`);
                console.log(`  Attributes:`, op.attributes);

                // Check for speaker/participant info
                if (op.attributes.speakerId || op.attributes.participantId) {
                  console.log(
                    `  => Has ID: speakerId=${op.attributes.speakerId}, participantId=${op.attributes.participantId}`
                  );
                }
                console.log('');
              }
            });
          }
        } catch (e) {
          console.log(`Error processing Y.Text at ${path}:`, e);
        }
      } else if (item instanceof Y.Map) {
        // Check for shapes with participant/speaker metadata
        const participantId = item.get('participantId');
        const speakerId = item.get('speakerId');
        const text = item.get('text');

        if ((participantId || speakerId) && text) {
          console.log(`Found shape with metadata at ${path}:`);
          console.log(`  participantId: ${participantId}`);
          console.log(`  speakerId: ${speakerId}`);
          console.log(`  text type: ${text?.constructor?.name}`);
          if (text instanceof Y.Text) {
            console.log(`  text content: "${text.toString()}"`);
          } else if (typeof text === 'string') {
            console.log(`  text content: "${text}"`);
          }
          console.log('');
        }

        // Recurse
        for (const [key, value] of item.entries()) {
          findCodeBlocks(value, path ? `${path}/${key}` : key);
        }
      } else if (item instanceof Y.Array) {
        item.forEach((subItem, index) => {
          findCodeBlocks(subItem, `${path}[${index}]`);
        });
      }
    };

    // Search in blocks
    const blocks = ydoc.getMap('blocks');
    findCodeBlocks(blocks, 'blocks');

    console.log(`\nTotal code blocks found: ${codeTextCount}`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeDocument();
