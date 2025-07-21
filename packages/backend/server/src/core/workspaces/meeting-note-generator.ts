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

// Calculate text width estimation (rough approximation)
function calculateTextWidth(text: string, fontSize: number = 14): number {
  // Approximate character widths
  const avgCharWidth = fontSize * 1.0;
  const koreanCharWidth = fontSize * 1.5;

  let width = 0;
  for (const char of text) {
    // Check if Korean character
    if (/[\u3131-\uD79D]/.test(char)) {
      width += koreanCharWidth;
    } else {
      width += avgCharWidth;
    }
  }

  return Math.max(width + 40, 200); // Add padding and minimum width
}

// Calculate box height based on text lines
function calculateBoxHeight(
  text: string,
  width: number,
  fontSize: number = 14
): number {
  const lines = text.split('\n');
  const baseHeight = 40;
  const lineHeight = fontSize * 1.5;

  let totalLines = 0;
  lines.forEach(line => {
    const lineWidth = calculateTextWidth(line, fontSize);
    const wrappedLines = Math.ceil(lineWidth / (width - 20));
    totalLines += wrappedLines;
  });

  return Math.max(baseHeight, totalLines * lineHeight + 20);
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

interface ShapeNodeOptions {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fillColor: string;
  strokeColor: string;
  strokeWidth?: number;
  strokeStyle?: string;
  radius?: number;
  index: string;
  textAlign?: string;
  shapeType?: string;
  roughness?: number;
}

// Create a shape node with common properties
function createShapeNode(options: ShapeNodeOptions): Y.Map<unknown> {
  const node = new Y.Map();
  node.set('id', options.id);
  node.set('type', 'shape');
  node.set(
    'xywh',
    `[${options.x},${options.y},${options.width},${options.height}]`
  );
  node.set('seed', Math.floor(Math.random() * 2 ** 31));
  node.set('shapeType', options.shapeType || 'rect');
  node.set('radius', options.radius ?? 4);
  node.set('filled', true);
  node.set('fillColor', options.fillColor);
  node.set('strokeWidth', options.strokeWidth ?? 1);
  node.set('strokeColor', options.strokeColor);
  node.set('strokeStyle', options.strokeStyle || 'solid');
  node.set('index', options.index);
  node.set('roughness', options.roughness ?? 1.4);

  if (options.textAlign) {
    node.set('textAlign', options.textAlign);
  }

  const textNode = new Y.Text();
  textNode.insert(0, options.text);
  node.set('text', textNode);

  return node;
}

interface ConnectorOptions {
  id: string;
  sourceId: string;
  targetId: string;
  strokeWidth?: number;
  strokeColor?: string;
  strokeStyle?: string;
  mode?: number;
  frontEndpointStyle?: string;
  rearEndpointStyle?: string;
  index: string;
  roughness?: number;
}

// Create a connector with common properties
function createConnector(options: ConnectorOptions): Y.Map<unknown> {
  const connector = new Y.Map();
  connector.set('id', options.id);
  connector.set('type', 'connector');
  connector.set('seed', Math.floor(Math.random() * 2 ** 31));
  connector.set('index', options.index);
  connector.set('mode', options.mode ?? 1); // 1 = Orthogonal
  connector.set('strokeWidth', options.strokeWidth ?? 1);
  connector.set('stroke', options.strokeColor || '--affine-palette-line-grey');
  connector.set('strokeStyle', options.strokeStyle || 'solid');
  connector.set('roughness', options.roughness ?? 1.4);
  connector.set('frontEndpointStyle', options.frontEndpointStyle || 'none');
  connector.set('rearEndpointStyle', options.rearEndpointStyle || 'none');
  connector.set('source', { id: options.sourceId });
  connector.set('target', { id: options.targetId });

  return connector;
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

// Create meeting note document with basic structure for edgeless mode
export function createMeetingMindMapDocument(data: MeetingNoteData): Y.Doc {
  const doc = new Y.Doc();
  const blocks = doc.getMap('blocks');

  // Create IDs
  const pageId = 'temp-page-id'; // Will be replaced by server
  const surfaceId = generateUniqueId(10);
  const noteId = generateUniqueId(10);

  // Create root page block
  const pageBlock = new Y.Map();
  pageBlock.set('sys:id', pageId);
  pageBlock.set('sys:flavour', 'affine:page');
  pageBlock.set('sys:version', 2);

  const pageChildren = new Y.Array();
  pageChildren.push([surfaceId, noteId]);
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

  // Create surface block for edgeless mode with empty elements
  const surfaceBlock = new Y.Map();
  surfaceBlock.set('sys:id', surfaceId);
  surfaceBlock.set('sys:flavour', 'affine:surface');
  surfaceBlock.set('sys:version', 5);
  surfaceBlock.set('sys:children', new Y.Array());

  // Create Boxed elements structure with mindmap shapes
  const elementsYMap = new Y.Map();

  // Create central node for meeting title (positioned to the right of note)
  const centralNodeId = generateUniqueId(10);
  const centralNode = createShapeNode({
    id: centralNodeId,
    x: 1400, // Moved to the right to avoid overlap with page info
    y: 400,
    width: 300,
    height: 100,
    text: data.title || '회의록',
    fillColor: '--affine-palette-shape-blue',
    strokeColor: '--affine-palette-line-blue',
    strokeWidth: 2,
    radius: 8,
    index: 'a0',
  });

  elementsYMap.set(centralNodeId, centralNode);

  // Create branch nodes
  let nodeIndex = 0;
  const branchNodeIds = [];

  // Calculate the height needed for each branch section
  const branchHeights: number[] = [];
  const minBranchSpacing = 100; // Minimum spacing between branches

  // Info branch height
  if (data.date || data.time || data.location) {
    branchHeights.push(100); // Fixed height for info section
  }

  // Participants branch height
  if (data.participants && data.participants.length > 0) {
    const participantSpacing = 55;
    const participantsHeight = Math.max(
      100,
      data.participants.length * participantSpacing
    );
    branchHeights.push(participantsHeight);
  }

  // Agenda branch height (with discussion items)
  if (data.agenda && data.agenda.length > 0) {
    let totalAgendaHeight = 0;
    const agendaSpacing = 100;
    const detailSpacing = 35;

    data.agenda.forEach(item => {
      const summaryForAgenda = data.summary?.find(s => {
        if (typeof s === 'object' && !Array.isArray(s)) {
          return Object.keys(s).some(key => key.includes(item));
        }
        return false;
      });

      let itemHeight = agendaSpacing;
      if (summaryForAgenda && typeof summaryForAgenda === 'object') {
        const details = Object.values(summaryForAgenda)[0];
        if (Array.isArray(details)) {
          itemHeight += details.length * detailSpacing;
        }
      }
      totalAgendaHeight += itemHeight;
    });

    branchHeights.push(totalAgendaHeight);
  }

  // Action items branch height
  if (data.action && data.action.length > 0) {
    const actionSpacing = 55;
    const actionsHeight = Math.max(100, data.action.length * actionSpacing);
    branchHeights.push(actionsHeight);
  }

  // Calculate branch positions to avoid overlap
  const centralY = 400;
  const branchPositions: number[] = [];
  let currentY = centralY;

  if (branchHeights.length > 0) {
    // Start from top
    const totalHeight =
      branchHeights.reduce((sum, h) => sum + h, 0) +
      (branchHeights.length - 1) * minBranchSpacing;
    currentY = centralY - totalHeight / 2;

    branchHeights.forEach((height, index) => {
      branchPositions.push(currentY + height / 2);
      currentY += height + minBranchSpacing;
    });
  }

  let currentBranchIndex = 0;

  // Meeting info node
  if (data.date || data.time || data.location) {
    const infoNodeId = generateUniqueId(10);
    const infoNode = createShapeNode({
      id: infoNodeId,
      x: 1800,
      y: branchPositions[currentBranchIndex],
      width: 200,
      height: 60,
      text: '📅 회의 정보',
      fillColor: '--affine-palette-shape-yellow',
      strokeColor: '--affine-palette-line-yellow',
      strokeWidth: 2,
      radius: 8,
      index: 'a1',
    });

    elementsYMap.set(infoNodeId, infoNode);
    branchNodeIds.push(infoNodeId);

    // Connector from central to info node
    const infoConnectorId = generateUniqueId(10);
    const infoConnector = createConnector({
      id: infoConnectorId,
      sourceId: centralNodeId,
      targetId: infoNodeId,
      strokeWidth: 2,
      rearEndpointStyle: 'arrow',
      index: 'b1',
    });

    elementsYMap.set(infoConnectorId, infoConnector);

    // Add sub-nodes for meeting info details
    const infoBranchY = branchPositions[currentBranchIndex];
    let infoDetailY = infoBranchY - 30;

    if (data.date || data.time) {
      const dateNodeId = generateUniqueId(10);
      const dateNode = createShapeNode({
        id: dateNodeId,
        x: 2100,
        y: infoDetailY,
        width: 200,
        height: 40,
        text: `${data.date || ''} ${data.time || ''}`.trim(),
        fillColor: '--affine-palette-shape-white',
        strokeColor: '--affine-palette-line-grey',
        index: 'c1',
      });

      elementsYMap.set(dateNodeId, dateNode);

      // Connector
      const dateConnectorId = generateUniqueId(10);
      const dateConnector = createConnector({
        id: dateConnectorId,
        sourceId: infoNodeId,
        targetId: dateNodeId,
        index: 'd1',
      });

      elementsYMap.set(dateConnectorId, dateConnector);
      infoDetailY += 50;
      // infoDetailCount++;
    }

    if (data.location) {
      const locationNodeId = generateUniqueId(10);
      const locationNode = createShapeNode({
        id: locationNodeId,
        x: 2100,
        y: infoDetailY,
        width: 200,
        height: 40,
        text: `📍 ${data.location}`,
        fillColor: '--affine-palette-shape-white',
        strokeColor: '--affine-palette-line-grey',
        index: 'c2',
      });

      elementsYMap.set(locationNodeId, locationNode);

      // Connector
      const locationConnectorId = generateUniqueId(10);
      const locationConnector = createConnector({
        id: locationConnectorId,
        sourceId: infoNodeId,
        targetId: locationNodeId,
        index: 'd2',
      });

      elementsYMap.set(locationConnectorId, locationConnector);
      // infoDetailCount++;
    }

    currentBranchIndex++;
    nodeIndex++;
  }

  // Participants node
  if (data.participants && data.participants.length > 0) {
    const participantsNodeId = generateUniqueId(10);
    const participantsNode = createShapeNode({
      id: participantsNodeId,
      x: 1800,
      y: branchPositions[currentBranchIndex],
      width: 200,
      height: 60,
      text: '👥 참석자',
      fillColor: '--affine-palette-shape-green',
      strokeColor: '--affine-palette-line-green',
      strokeWidth: 2,
      radius: 8,
      index: 'a2',
    });

    elementsYMap.set(participantsNodeId, participantsNode);
    branchNodeIds.push(participantsNodeId);

    // Connector
    const participantsConnectorId = generateUniqueId(10);
    const participantsConnector = createConnector({
      id: participantsConnectorId,
      sourceId: centralNodeId,
      targetId: participantsNodeId,
      strokeWidth: 2,
      rearEndpointStyle: 'arrow',
      index: 'b2',
    });

    elementsYMap.set(participantsConnectorId, participantsConnector);

    // Add individual participant nodes - center them around the branch node
    const participantSpacing = 55;
    const participantsBranchY = branchPositions[currentBranchIndex];
    let participantY =
      participantsBranchY -
      Math.floor(((data.participants.length - 1) * participantSpacing) / 2);

    data.participants.forEach((participant, idx) => {
      const nodeWidth = calculateTextWidth(participant);
      const nodeHeight = 40;

      const participantNodeId = generateUniqueId(10);
      const participantNode = createShapeNode({
        id: participantNodeId,
        x: 2100,
        y: participantY,
        width: nodeWidth,
        height: nodeHeight,
        text: participant,
        fillColor: '--affine-palette-shape-white',
        strokeColor: '--affine-palette-line-grey',
        index: `c${10 + idx}`,
        textAlign: 'left',
      });

      elementsYMap.set(participantNodeId, participantNode);

      // Connector
      const participantConnectorId = generateUniqueId(10);
      const participantConnector = createConnector({
        id: participantConnectorId,
        sourceId: participantsNodeId,
        targetId: participantNodeId,
        index: `d${10 + idx}`,
      });

      elementsYMap.set(participantConnectorId, participantConnector);
      participantY += participantSpacing;
    });

    currentBranchIndex++;
    nodeIndex++;
  }

  // Agenda node with integrated discussion
  if (data.agenda && data.agenda.length > 0) {
    const agendaNodeId = generateUniqueId(10);
    const agendaNode = createShapeNode({
      id: agendaNodeId,
      x: 1800,
      y: branchPositions[currentBranchIndex],
      width: 200,
      height: 60,
      text: '📋 안건 및 논의사항',
      fillColor: '--affine-palette-shape-purple',
      strokeColor: '--affine-palette-line-purple',
      strokeWidth: 2,
      radius: 8,
      index: 'a3',
    });

    elementsYMap.set(agendaNodeId, agendaNode);
    branchNodeIds.push(agendaNodeId);

    // Connector
    const agendaConnectorId = generateUniqueId(10);
    const agendaConnector = createConnector({
      id: agendaConnectorId,
      sourceId: centralNodeId,
      targetId: agendaNodeId,
      strokeWidth: 2,
      strokeColor: '--affine-palette-line-grey',
      strokeStyle: 'solid',
      rearEndpointStyle: 'arrow',
      index: 'b3',
    });

    elementsYMap.set(agendaConnectorId, agendaConnector);

    // Calculate total height needed for agenda items
    let totalAgendaHeight = 0;
    const agendaSpacing = 100; // Increased spacing for agenda items with details
    const detailSpacing = 50; // Reduced spacing for compact details

    data.agenda.forEach(item => {
      const summaryForAgenda = data.summary?.find(s => {
        if (typeof s === 'object' && !Array.isArray(s)) {
          return Object.keys(s).some(key => key.includes(item));
        }
        return false;
      });

      let itemHeight = agendaSpacing; // Base height for agenda item
      if (summaryForAgenda && typeof summaryForAgenda === 'object') {
        const details = Object.values(summaryForAgenda)[0];
        if (Array.isArray(details)) {
          itemHeight += details.length * detailSpacing; // Additional height for each detail
        }
      }
      totalAgendaHeight += itemHeight;
    });

    // Add individual agenda item nodes - center them around the branch node
    const agendaBranchY = branchPositions[currentBranchIndex];
    let agendaY =
      agendaBranchY - Math.floor(totalAgendaHeight / 2) + agendaSpacing;
    data.agenda.forEach((item, idx) => {
      const itemText = `${idx + 1}. ${item}`;
      const nodeWidth = calculateTextWidth(itemText);
      const nodeHeight = calculateBoxHeight(itemText, nodeWidth);

      const itemNodeId = generateUniqueId(10);
      const itemNode = createShapeNode({
        id: itemNodeId,
        x: 2100,
        y: agendaY,
        width: nodeWidth,
        height: nodeHeight,
        text: itemText,
        fillColor: '--affine-palette-shape-white',
        strokeColor: '--affine-palette-line-purple',
        strokeWidth: 1,
        radius: 4,
        textAlign: 'left',
        index: `c${20 + idx}`,
      });

      elementsYMap.set(itemNodeId, itemNode);

      // Connector
      const itemConnectorId = generateUniqueId(10);
      const itemConnector = createConnector({
        id: itemConnectorId,
        sourceId: agendaNodeId,
        targetId: itemNodeId,
        strokeWidth: 1,
        strokeColor: '--affine-palette-line-grey',
        strokeStyle: 'solid',
        index: `d${20 + idx}`,
      });

      elementsYMap.set(itemConnectorId, itemConnector);

      // Add summary details if available
      if (data.summary && data.summary.length > 0) {
        const summaryForAgenda = data.summary.find(s => {
          if (typeof s === 'object' && !Array.isArray(s)) {
            return Object.keys(s).some(key => key.includes(item));
          }
          return false;
        });

        if (summaryForAgenda && typeof summaryForAgenda === 'object') {
          const details = Object.values(summaryForAgenda)[0];
          if (Array.isArray(details) && details.length > 0) {
            // Center details around the current agenda item's Y position
            let detailY =
              agendaY - Math.floor(((details.length - 1) * detailSpacing) / 2);
            const detailX = 2100 + nodeWidth + 50; // Position to the right of agenda item

            details.forEach((detail, detailIdx) => {
              const cleanDetail = detail.trim().replace(/^-\s*/, '');
              const detailText = cleanDetail;
              const detailWidth = calculateTextWidth(detailText, 12);
              const detailHeight = calculateBoxHeight(
                detailText,
                detailWidth,
                12
              );

              const detailNodeId = generateUniqueId(10);
              const detailNode = createShapeNode({
                id: detailNodeId,
                x: detailX,
                y: detailY,
                width: detailWidth,
                height: detailHeight,
                text: detailText,
                fillColor: '--affine-palette-shape-white',
                strokeColor: '--affine-palette-line-purple',
                strokeWidth: 1,
                strokeStyle: 'dashed',
                radius: 4,
                textAlign: 'left',
                index: `e${10000 + idx * 100 + detailIdx}`,
              });

              elementsYMap.set(detailNodeId, detailNode);

              // Connector
              const detailConnectorId = generateUniqueId(10);
              const detailConnector = createConnector({
                id: detailConnectorId,
                sourceId: itemNodeId,
                targetId: detailNodeId,
                strokeWidth: 1,
                strokeColor: '--affine-palette-line-purple',
                strokeStyle: 'dashed',
                index: `f${100000 + idx * 100 + detailIdx}`,
              });

              elementsYMap.set(detailConnectorId, detailConnector);
              detailY += detailSpacing;
            });
            agendaY += details.length * detailSpacing;
          }
        }
      }

      agendaY += agendaSpacing;
    });

    currentBranchIndex++;
    nodeIndex++;
  }

  // Action items node
  if (data.action && data.action.length > 0) {
    const actionNodeId = generateUniqueId(10);
    const actionNode = createShapeNode({
      id: actionNodeId,
      x: 1800,
      y: branchPositions[currentBranchIndex],
      width: 200,
      height: 60,
      text: '✅ 액션아이템',
      fillColor: '--affine-palette-shape-red',
      strokeColor: '--affine-palette-line-red',
      strokeWidth: 2,
      radius: 8,
      index: 'a4',
    });

    elementsYMap.set(actionNodeId, actionNode);
    branchNodeIds.push(actionNodeId);

    // Connector
    const actionConnectorId = generateUniqueId(10);
    const actionConnector = createConnector({
      id: actionConnectorId,
      sourceId: centralNodeId,
      targetId: actionNodeId,
      strokeWidth: 2,
      strokeColor: '--affine-palette-line-grey',
      strokeStyle: 'solid',
      rearEndpointStyle: 'arrow',
      index: 'b4',
    });

    elementsYMap.set(actionConnectorId, actionConnector);

    // Add individual action item nodes - center them around the branch node
    const actionSpacing = 55;
    const actionBranchY = branchPositions[currentBranchIndex];
    let actionY =
      actionBranchY -
      Math.floor(((data.action.length - 1) * actionSpacing) / 2);

    data.action.forEach((item, idx) => {
      const itemText = item;
      const nodeWidth = calculateTextWidth(itemText);
      const nodeHeight = calculateBoxHeight(itemText, nodeWidth);

      const itemNodeId = generateUniqueId(10);
      const itemNode = createShapeNode({
        id: itemNodeId,
        x: 2100,
        y: actionY,
        width: nodeWidth,
        height: nodeHeight,
        text: itemText,
        fillColor: '--affine-palette-shape-white',
        strokeColor: '--affine-palette-line-red',
        strokeWidth: 1,
        radius: 4,
        textAlign: 'left',
        index: `c${30 + idx}`,
      });

      elementsYMap.set(itemNodeId, itemNode);

      // Connector
      const itemConnectorId = generateUniqueId(10);
      const itemConnector = createConnector({
        id: itemConnectorId,
        sourceId: actionNodeId,
        targetId: itemNodeId,
        strokeWidth: 1,
        strokeColor: '--affine-palette-line-grey',
        strokeStyle: 'solid',
        index: `d${30 + idx}`,
      });

      elementsYMap.set(itemConnectorId, itemConnector);
      actionY += actionSpacing;
    });
  }

  const boxedElements = new Y.Map();
  boxedElements.set('type', '$blocksuite:internal:native$');
  boxedElements.set('value', elementsYMap);
  surfaceBlock.set('prop:elements', boxedElements);

  blocks.set(surfaceId, surfaceBlock);

  // Create a note block with meeting content
  const noteBlock = new Y.Map();
  noteBlock.set('sys:id', noteId);
  noteBlock.set('sys:flavour', 'affine:note');
  noteBlock.set('sys:version', 1);

  const noteChildren = new Y.Array();

  // Add meeting info header
  const headerIds: string[] = [];

  // Meeting title
  const titleId = generateUniqueId(10);
  const titleBlock = createParagraphBlock(
    titleId,
    `# ${data.title || '회의록'}`,
    'h1'
  );
  blocks.set(titleId, titleBlock);
  headerIds.push(titleId);

  // Meeting info
  if (data.date || data.time) {
    const dateId = generateUniqueId(10);
    const dateText = `📅 ${data.date || ''} ${data.time || ''}`.trim();
    blocks.set(dateId, createParagraphBlock(dateId, dateText, 'text'));
    headerIds.push(dateId);
  }

  if (data.location) {
    const locationId = generateUniqueId(10);
    blocks.set(
      locationId,
      createParagraphBlock(locationId, `📍 ${data.location}`, 'text')
    );
    headerIds.push(locationId);
  }

  if (data.participants && data.participants.length > 0) {
    const participantsId = generateUniqueId(10);
    blocks.set(
      participantsId,
      createParagraphBlock(
        participantsId,
        `👥 ${data.participants.join(', ')}`,
        'text'
      )
    );
    headerIds.push(participantsId);
  }

  // Add all header blocks to note
  if (headerIds.length > 0) {
    noteChildren.push(headerIds);
  }

  // Add structured sections for mindmap conversion
  if (data.agenda && data.agenda.length > 0) {
    const agendaHeaderId = generateUniqueId(10);
    blocks.set(
      agendaHeaderId,
      createParagraphBlock(agendaHeaderId, '## 📋 안건', 'h2')
    );
    noteChildren.push([agendaHeaderId]);

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
      blocks.set(itemId, itemBlock);
      noteChildren.push([itemId]);
    });
  }

  if (data.summary && data.summary.length > 0) {
    const summaryHeaderId = generateUniqueId(10);
    blocks.set(
      summaryHeaderId,
      createParagraphBlock(summaryHeaderId, '## 💬 논의사항', 'h2')
    );
    noteChildren.push([summaryHeaderId]);

    data.summary.forEach(item => {
      const itemText = typeof item === 'string' ? item : Object.keys(item)[0];
      const itemId = generateUniqueId(10);
      const itemBlock = new Y.Map();
      itemBlock.set('sys:id', itemId);
      itemBlock.set('sys:flavour', 'affine:list');
      itemBlock.set('sys:version', 1);
      itemBlock.set('sys:children', new Y.Array());
      itemBlock.set('prop:type', 'bulleted');
      const text = new Y.Text();
      text.insert(0, itemText);
      itemBlock.set('prop:text', text);
      blocks.set(itemId, itemBlock);
      noteChildren.push([itemId]);
    });
  }

  if (data.action && data.action.length > 0) {
    const actionHeaderId = generateUniqueId(10);
    blocks.set(
      actionHeaderId,
      createParagraphBlock(actionHeaderId, '## ✅ 액션아이템', 'h2')
    );
    noteChildren.push([actionHeaderId]);

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
      blocks.set(itemId, itemBlock);
      noteChildren.push([itemId]);
    });
  }

  noteBlock.set('sys:children', noteChildren);
  noteBlock.set('prop:xywh', '[400,300,800,600]');
  noteBlock.set('prop:background', '--affine-palette-shape-white');
  noteBlock.set('prop:index', 'a0');
  noteBlock.set('prop:hidden', false);
  noteBlock.set('prop:displayMode', 'both');

  blocks.set(noteId, noteBlock);

  // Set metadata
  const meta = doc.getMap('meta');
  meta.set('workspaceVersion', 2);

  const blockVersions = new Y.Map();
  blockVersions.set('affine:page', 2);
  blockVersions.set('affine:surface', 5);
  blockVersions.set('affine:note', 1);
  meta.set('blockVersions', blockVersions);

  // Create pages metadata
  const pages = new Y.Array();
  const pageMeta = new Y.Map();
  const currentTime = Date.now();
  pageMeta.set('id', pageId);
  pageMeta.set('title', formattedTitle);
  pageMeta.set('createDate', currentTime);
  pageMeta.set('updatedDate', currentTime);
  pageMeta.set('tags', new Y.Array());

  pages.push([pageMeta]);
  meta.set('pages', pages);

  return doc;
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
