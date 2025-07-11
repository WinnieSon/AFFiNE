import * as Y from 'yjs';

interface MeetingNoteData {
  title?: string;
  date?: string;
  time?: string;
  location?: string;
  participants?: string[];
  tags?: string[];
  agenda?: string[];
  summary?: Array<string | { [agenda: string]: string[] }>;
  action?: string[];
  conversation?: Array<{
    speaker: string;
    text: string;
    time: string;
  }>;
}

// Generate unique ID for blocks
function generateUniqueId(length = 10): string {
  const chars =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate order string for table columns/rows
function generateOrderString(index: number): string {
  const base = 'a' + (index * 10).toString().padStart(4, '0');
  const random = generateUniqueId(32);
  return base + random;
}

// Create a paragraph block
function createParagraphBlock(
  id: string,
  text: string,
  type: string = 'text'
): Y.Map<any> {
  const block = new Y.Map();
  block.set('sys:id', id);
  block.set('sys:flavour', 'affine:paragraph');
  block.set('sys:version', 1);
  block.set('sys:children', new Y.Array());
  block.set('prop:type', type);

  const textContent = new Y.Text();
  textContent.insert(0, text);
  block.set('prop:text', textContent);

  return block;
}

// Create a list block
function createListBlock(
  id: string,
  items: string[],
  type: string = 'bulleted'
): Y.Map<any> {
  const listBlock = new Y.Map();
  listBlock.set('sys:id', id);
  listBlock.set('sys:flavour', 'affine:list');
  listBlock.set('sys:version', 1);
  listBlock.set('prop:type', type);

  const children = new Y.Array();
  const listItems: string[] = [];

  items.forEach(item => {
    const itemId = generateUniqueId(10);
    listItems.push(itemId);

    const itemBlock = new Y.Map();
    itemBlock.set('sys:id', itemId);
    itemBlock.set('sys:flavour', 'affine:list');
    itemBlock.set('sys:version', 1);
    itemBlock.set('sys:children', new Y.Array());
    itemBlock.set('prop:type', type);

    const itemText = new Y.Text();
    itemText.insert(0, item);
    itemBlock.set('prop:text', itemText);
  });

  children.push(listItems);
  listBlock.set('sys:children', children);

  return { listBlock, listItems };
}

// Create a divider block
function createDividerBlock(id: string): Y.Map<any> {
  const block = new Y.Map();
  block.set('sys:id', id);
  block.set('sys:flavour', 'affine:divider');
  block.set('sys:version', 1);
  block.set('sys:children', new Y.Array());

  return block;
}

export function createMeetingNoteDocument(data: MeetingNoteData): Y.Doc {
  const doc = new Y.Doc();
  const blocks = doc.getMap('blocks');

  // Create IDs
  const pageId = 'temp-page-id'; // Will be replaced by server
  const noteId = generateUniqueId(10);

  const blockIds: string[] = [];
  const allBlocks: { [key: string]: Y.Map<any> } = {};

  // Create root page block
  const pageBlock = new Y.Map();
  pageBlock.set('sys:id', pageId);
  pageBlock.set('sys:flavour', 'affine:page');
  pageBlock.set('sys:version', 2);

  const pageChildren = new Y.Array();
  pageChildren.push([noteId]);
  pageBlock.set('sys:children', pageChildren);

  // Set page title with date/time format
  let formattedTitle = '📋';
  if (data.date && data.time) {
    formattedTitle += `${data.date} ${data.time} `;
  } else if (data.date) {
    formattedTitle += `${data.date} `;
  }
  formattedTitle += data.title || '회의록';

  const titleText = new Y.Text();
  titleText.insert(0, formattedTitle);
  pageBlock.set('prop:title', titleText);

  blocks.set(pageId, pageBlock);

  // Meeting info section - combined format (no title in document body)
  const meetingInfoItems = [];

  // Combine date and time
  if (data.date || data.time) {
    let dateTimeText = '일시 : ';
    if (data.date) dateTimeText += data.date;
    if (data.time) dateTimeText += ` ${data.time}`;
    meetingInfoItems.push(dateTimeText);
  }

  // Location
  if (data.location) {
    meetingInfoItems.push(`장소 : ${data.location}`);
  }

  // Participants - inline format
  if (data.participants && data.participants.length > 0) {
    meetingInfoItems.push(`참석자 : ${data.participants.join(', ')}`);
  }

  // Add meeting info as separate paragraphs
  meetingInfoItems.forEach(item => {
    const itemId = generateUniqueId(10);
    const itemBlock = createParagraphBlock(itemId, item, 'text');
    allBlocks[itemId] = itemBlock;
    blockIds.push(itemId);
  });

  // Add divider after meeting info
  if (meetingInfoItems.length > 0) {
    const dividerId1 = generateUniqueId(10);
    allBlocks[dividerId1] = createDividerBlock(dividerId1);
    blockIds.push(dividerId1);
  }

  // Agenda section
  if (data.agenda && data.agenda.length > 0) {
    const agendaHeaderId = generateUniqueId(10);
    const agendaHeader = createParagraphBlock(
      agendaHeaderId,
      '📌 주요 안건',
      'h2'
    );
    allBlocks[agendaHeaderId] = agendaHeader;
    blockIds.push(agendaHeaderId);

    // Add agenda items as list blocks directly
    data.agenda.forEach(item => {
      const itemId = generateUniqueId(10);
      const itemBlock = new Y.Map();
      itemBlock.set('sys:id', itemId);
      itemBlock.set('sys:flavour', 'affine:list');
      itemBlock.set('sys:version', 1);
      itemBlock.set('sys:children', new Y.Array());
      itemBlock.set('prop:type', 'bulleted');

      const itemText = new Y.Text();
      itemText.insert(0, item);
      itemBlock.set('prop:text', itemText);

      allBlocks[itemId] = itemBlock;
      blockIds.push(itemId);
    });
  }

  // Add divider
  const dividerId2 = generateUniqueId(10);
  allBlocks[dividerId2] = createDividerBlock(dividerId2);
  blockIds.push(dividerId2);

  // Summary section
  if (data.summary && data.summary.length > 0) {
    const summaryHeaderId = generateUniqueId(10);
    const summaryHeader = createParagraphBlock(
      summaryHeaderId,
      '💡 논의 내용 요약',
      'h2'
    );
    allBlocks[summaryHeaderId] = summaryHeader;
    blockIds.push(summaryHeaderId);

    data.summary.forEach(item => {
      if (typeof item === 'object' && !Array.isArray(item)) {
        // Handle agenda format with sub-items
        Object.entries(item).forEach(([agenda, details]) => {
          // Add agenda as a list item (1st level indentation)
          const agendaId = generateUniqueId(10);
          const agendaBlock = new Y.Map();
          agendaBlock.set('sys:id', agendaId);
          agendaBlock.set('sys:flavour', 'affine:list');
          agendaBlock.set('sys:version', 1);
          agendaBlock.set('prop:type', 'bulleted');

          const agendaText = new Y.Text();
          agendaText.insert(0, agenda);
          agendaBlock.set('prop:text', agendaText);

          // Store detail IDs as children of this agenda item
          const agendaChildren = new Y.Array();
          const detailIds: string[] = [];

          // Add details as sub-items (2nd level indentation)
          if (Array.isArray(details)) {
            details.forEach(detail => {
              const detailId = generateUniqueId(10);
              detailIds.push(detailId);

              const detailBlock = new Y.Map();
              detailBlock.set('sys:id', detailId);
              detailBlock.set('sys:flavour', 'affine:list');
              detailBlock.set('sys:version', 1);
              detailBlock.set('sys:children', new Y.Array());
              detailBlock.set('prop:type', 'bulleted');

              const detailText = new Y.Text();
              // Remove leading "  - " if present
              const cleanDetail = detail.trim().replace(/^-\s*/, '');
              detailText.insert(0, cleanDetail);
              detailBlock.set('prop:text', detailText);

              allBlocks[detailId] = detailBlock;
            });
          }

          // Set children for the agenda block
          if (detailIds.length > 0) {
            agendaChildren.push(detailIds);
          }
          agendaBlock.set('sys:children', agendaChildren);

          allBlocks[agendaId] = agendaBlock;
          blockIds.push(agendaId);
        });
      } else if (typeof item === 'string') {
        // Handle simple string format (1st level indentation)
        const itemId = generateUniqueId(10);
        const itemBlock = new Y.Map();
        itemBlock.set('sys:id', itemId);
        itemBlock.set('sys:flavour', 'affine:list');
        itemBlock.set('sys:version', 1);
        itemBlock.set('sys:children', new Y.Array());
        itemBlock.set('prop:type', 'bulleted');

        const itemText = new Y.Text();
        itemText.insert(0, item);
        itemBlock.set('prop:text', itemText);

        allBlocks[itemId] = itemBlock;
        blockIds.push(itemId);
      }
    });
  }

  // Action items section
  if (data.action && data.action.length > 0) {
    const actionHeaderId = generateUniqueId(10);
    const actionHeader = createParagraphBlock(
      actionHeaderId,
      '✅ 향후 조치 사항',
      'h2'
    );
    allBlocks[actionHeaderId] = actionHeader;
    blockIds.push(actionHeaderId);

    // Add action items as todo list blocks directly
    data.action.forEach(item => {
      const itemId = generateUniqueId(10);
      const itemBlock = new Y.Map();
      itemBlock.set('sys:id', itemId);
      itemBlock.set('sys:flavour', 'affine:list');
      itemBlock.set('sys:version', 1);
      itemBlock.set('sys:children', new Y.Array());
      itemBlock.set('prop:type', 'todo');
      itemBlock.set('prop:checked', false);

      const itemText = new Y.Text();
      itemText.insert(0, item);
      itemBlock.set('prop:text', itemText);

      allBlocks[itemId] = itemBlock;
      blockIds.push(itemId);
    });
  }

  // Conversation section
  if (data.conversation && data.conversation.length > 0) {
    // Add divider
    const dividerId3 = generateUniqueId(10);
    allBlocks[dividerId3] = createDividerBlock(dividerId3);
    blockIds.push(dividerId3);

    const conversationHeaderId = generateUniqueId(10);
    const conversationHeader = createParagraphBlock(
      conversationHeaderId,
      '🎙️ 대화 내용',
      'h2'
    );
    allBlocks[conversationHeaderId] = conversationHeader;
    blockIds.push(conversationHeaderId);

    // Create table block
    const tableId = generateUniqueId(10);
    const tableBlock = new Y.Map();

    // Basic table properties
    tableBlock.set('sys:id', tableId);
    tableBlock.set('sys:flavour', 'affine:table');
    tableBlock.set('sys:version', 1);
    tableBlock.set('sys:children', new Y.Array());

    // Create column IDs
    const timeColId = generateUniqueId(10);
    const speakerColId = generateUniqueId(10);
    const contentColId = generateUniqueId(10);

    // Add columns metadata with width
    tableBlock.set(`prop:columns.${timeColId}.columnId`, timeColId);
    tableBlock.set(`prop:columns.${timeColId}.order`, generateOrderString(0));
    tableBlock.set(`prop:columns.${timeColId}.width`, 80); // 시간 열 좁게

    tableBlock.set(`prop:columns.${speakerColId}.columnId`, speakerColId);
    tableBlock.set(
      `prop:columns.${speakerColId}.order`,
      generateOrderString(1)
    );
    tableBlock.set(`prop:columns.${speakerColId}.width`, 100); // 화자 열 중간

    tableBlock.set(`prop:columns.${contentColId}.columnId`, contentColId);
    tableBlock.set(
      `prop:columns.${contentColId}.order`,
      generateOrderString(2)
    );
    tableBlock.set(`prop:columns.${contentColId}.width`, 500); // 발화내용 열 크게

    // Create rows - header + data rows
    const headerRowId = generateUniqueId(10);
    tableBlock.set(`prop:rows.${headerRowId}.rowId`, headerRowId);
    tableBlock.set(`prop:rows.${headerRowId}.order`, generateOrderString(0));

    // Header cells
    const headerTimeText = new Y.Text();
    headerTimeText.insert(0, '시간');
    tableBlock.set(
      `prop:cells.${headerRowId}:${timeColId}.text`,
      headerTimeText
    );

    const headerSpeakerText = new Y.Text();
    headerSpeakerText.insert(0, '화자');
    tableBlock.set(
      `prop:cells.${headerRowId}:${speakerColId}.text`,
      headerSpeakerText
    );

    const headerContentText = new Y.Text();
    headerContentText.insert(0, '발화내용');
    tableBlock.set(
      `prop:cells.${headerRowId}:${contentColId}.text`,
      headerContentText
    );

    // Sort conversations by time and add data rows
    const sortedConversations = [...data.conversation].sort((a, b) => {
      // Parse time strings (MM:SS format)
      const parseTime = (timeStr: string) => {
        const parts = timeStr.split(':');
        return parseInt(parts[0]) * 60 + parseInt(parts[1]);
      };
      return parseTime(a.time) - parseTime(b.time);
    });

    sortedConversations.forEach((conv, index) => {
      const rowId = generateUniqueId(10);
      tableBlock.set(`prop:rows.${rowId}.rowId`, rowId);
      tableBlock.set(
        `prop:rows.${rowId}.order`,
        generateOrderString(index + 1)
      );

      // Time cell
      const timeText = new Y.Text();
      timeText.insert(0, conv.time);
      tableBlock.set(`prop:cells.${rowId}:${timeColId}.text`, timeText);

      // Speaker cell
      const speakerText = new Y.Text();
      speakerText.insert(0, conv.speaker);
      tableBlock.set(`prop:cells.${rowId}:${speakerColId}.text`, speakerText);

      // Content cell
      const contentText = new Y.Text();
      contentText.insert(0, conv.text);
      tableBlock.set(`prop:cells.${rowId}:${contentColId}.text`, contentText);
    });

    allBlocks[tableId] = tableBlock;
    blockIds.push(tableId);
  }

  // Tags will be added to page metadata, not in the document body

  // Create note block that contains all content
  const noteBlock = new Y.Map();
  noteBlock.set('sys:id', noteId);
  noteBlock.set('sys:flavour', 'affine:note');
  noteBlock.set('sys:version', 1);

  const noteChildren = new Y.Array();
  noteChildren.push(blockIds);
  noteBlock.set('sys:children', noteChildren);

  noteBlock.set('prop:xywh', '[0,0,800,600]');
  noteBlock.set('prop:background', '--affine-palette-shape-blue');
  noteBlock.set('prop:index', 'a0');
  noteBlock.set('prop:hidden', false);

  blocks.set(noteId, noteBlock);

  // Add all content blocks
  Object.entries(allBlocks).forEach(([id, block]) => {
    blocks.set(id, block);
  });

  // Set metadata
  const meta = doc.getMap('meta');
  meta.set('workspaceVersion', 2);

  const blockVersions = new Y.Map();
  blockVersions.set('affine:page', 2);
  blockVersions.set('affine:note', 1);
  blockVersions.set('affine:paragraph', 1);
  blockVersions.set('affine:list', 1);
  blockVersions.set('affine:divider', 1);
  blockVersions.set('affine:table', 1);
  meta.set('blockVersions', blockVersions);

  // Create pages metadata
  const pages = new Y.Array();
  const pageMeta = new Y.Map();
  const currentTime = Date.now();
  pageMeta.set('id', pageId);
  pageMeta.set('title', formattedTitle);
  pageMeta.set('createDate', currentTime);
  pageMeta.set('updatedDate', currentTime);

  // Tags will be handled at the controller level with tag IDs
  pageMeta.set('tags', new Y.Array());

  pages.push([pageMeta]);
  meta.set('pages', pages);

  return doc;
}
