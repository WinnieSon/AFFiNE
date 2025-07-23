import * as Y from 'yjs';

// Helper function to get speaker names from User Identification
async function getSpeakerMappings(
  workspaceId: string,
  speakerIds: string[],
  prisma?: any
): Promise<Map<string, string>> {
  const speakerMap = new Map<string, string>();

  if (!prisma) {
    // Fallback to sequential naming if no Prisma client
    speakerIds.forEach((id, index) => {
      speakerMap.set(id, `화자 ${index + 1}`);
    });
    return speakerMap;
  }

  try {
    // Get user identifications that have speakerId matching our speakers
    const userIdentifications = await prisma.userIdentification.findMany({
      where: {
        workspaceId,
        speakerId: {
          in: speakerIds,
        },
      },
      select: {
        speakerId: true,
        nickname: true,
      },
    });

    // Create map from registered speakers
    const registeredSpeakers = new Map<string, string>();
    userIdentifications.forEach((ui: any) => {
      if (ui.speakerId && ui.nickname) {
        registeredSpeakers.set(ui.speakerId, ui.nickname);
      }
    });

    // Map speakers: use registered name if available, otherwise use sequential naming
    let sequentialIndex = 1;
    speakerIds.forEach(speakerId => {
      if (registeredSpeakers.has(speakerId)) {
        const name = registeredSpeakers.get(speakerId);
        if (name) {
          speakerMap.set(speakerId, name);
        } else {
          speakerMap.set(speakerId, `화자 ${sequentialIndex}`);
          sequentialIndex++;
        }
      } else {
        speakerMap.set(speakerId, `화자 ${sequentialIndex}`);
        sequentialIndex++;
      }
    });

    return speakerMap;
  } catch (error) {
    console.error('Error fetching speaker mappings:', error);
    // Fallback to sequential naming on error
    speakerIds.forEach((id, index) => {
      speakerMap.set(id, `화자 ${index + 1}`);
    });
    return speakerMap;
  }
}

interface MeetingNoteData {
  title?: string;
  date?: string;
  time?: string;
  location?: string;
  participants?: string[];
  tags?: string[];
  agenda?: string[];
  summary?: Array<string | { [agenda: string]: string[] }>;
  action?: Array<
    | string
    | {
        assignee?: string[];
        text: string;
      }
  >;
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
  fontSize?: number;
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
  node.set('fontSize', options.fontSize ?? 20);
  node.set('margin', 5);
  node.set('color', '--affine-palette-line-black'); // Set text color to black for light theme

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
  sourcePosition?: [number, number]; // [0.5, 0.5] means center, [1, 0.5] means right center
  targetPosition?: [number, number]; // [0, 0.5] means left center
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

  // Set source with position (default to right center [1, 0.5])
  connector.set('source', {
    id: options.sourceId,
    position: options.sourcePosition ?? [1, 0.5], // Right center
  });

  // Set target with position (default to left center [0, 0.5])
  connector.set('target', {
    id: options.targetId,
    position: options.targetPosition ?? [0, 0.5], // Left center
  });

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
export async function createMeetingMindMapDocument(
  data: MeetingNoteData,
  workspaceId: string,
  prisma?: any
): Promise<Y.Doc> {
  // Define central node position early for viewport calculation
  const centralNodeX = 1400;
  const centralNodeY = 400;

  // Create comprehensive speaker mapping for all sections early
  const allSpeakerIds: string[] = [];

  // Collect speaker IDs from participants
  if (data.participants) {
    allSpeakerIds.push(...data.participants);
  }

  // Collect speaker IDs from action items
  if (data.action) {
    data.action.forEach(item => {
      if (typeof item === 'object' && item.assignee) {
        allSpeakerIds.push(...item.assignee);
      }
    });
  }

  // Collect speaker IDs from conversations
  if (data.conversation) {
    allSpeakerIds.push(...data.conversation.map(conv => conv.speaker));
  }

  // Create unified speaker mapping
  let globalSpeakerIdToName: Map<string, string> | null = null;
  if (allSpeakerIds.length > 0) {
    const uniqueSpeakerIds = Array.from(new Set(allSpeakerIds));
    globalSpeakerIdToName = await getSpeakerMappings(
      workspaceId,
      uniqueSpeakerIds,
      prisma
    );
  }

  // Create Y.Doc and wrap all operations in a transaction
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

  // Add to blocks first
  blocks.set(pageId, pageBlock);

  const pageChildren = new Y.Array();

  pageBlock.set('sys:children', pageChildren);

  pageChildren.push([surfaceId, noteId]);

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

  // Create surface block for edgeless mode with empty elements
  const surfaceBlock = new Y.Map();
  surfaceBlock.set('sys:id', surfaceId);
  surfaceBlock.set('sys:flavour', 'affine:surface');
  surfaceBlock.set('sys:version', 5);
  surfaceBlock.set('sys:children', new Y.Array());

  // Set light theme background
  surfaceBlock.set('prop:background', '--affine-palette-transparent');
  surfaceBlock.set('prop:grid', 'grid');

  // Create Boxed elements structure with mindmap shapes
  const elementsYMap = new Y.Map();

  // Create central node for meeting title at a reasonable position
  // We'll set viewport to center on this node
  const centralNodeId = generateUniqueId(10);
  const centralNode = createShapeNode({
    id: centralNodeId,
    x: centralNodeX,
    y: centralNodeY,
    width: 300,
    height: 100,
    text: data.title || '회의록',
    fillColor: '--affine-palette-shape-blue',
    strokeColor: '--affine-palette-line-blue',
    strokeWidth: 2,
    radius: 8,
    index: 'a0', // This is a valid fractional index
  });

  elementsYMap.set(centralNodeId, centralNode);

  // Create branch nodes
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

  // Conversation branch height
  if (data.conversation && data.conversation.length > 0) {
    // Filter conversations with text length >= 5 characters (excluding spaces, '.', '?')
    const filteredConversations = data.conversation.filter(conv => {
      if (!conv.text) return false;
      const cleanedText = conv.text.replace(/[\s.?]/g, ''); // Remove spaces, '.', '?'
      return cleanedText.length >= 5;
    });

    if (filteredConversations.length > 0) {
      // Group conversations by speaker to calculate height
      const speakerGroups = new Map();
      filteredConversations.forEach(conv => {
        if (!speakerGroups.has(conv.speaker)) {
          speakerGroups.set(conv.speaker, []);
        }
        speakerGroups.get(conv.speaker).push(conv);
      });

      const conversationSpacing = 80;
      const conversationHeight = Math.max(
        100,
        speakerGroups.size * conversationSpacing
      );
      branchHeights.push(conversationHeight);
    }
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

    branchHeights.forEach(height => {
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
      index: 'a1', // This is a valid fractional index
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
      index: 'a0V', // Changed from 'b1' to valid fractional index
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
        index: 'a0i', // Changed from 'c1' to valid fractional index
      });

      elementsYMap.set(dateNodeId, dateNode);

      // Connector
      const dateConnectorId = generateUniqueId(10);
      const dateConnector = createConnector({
        id: dateConnectorId,
        sourceId: infoNodeId,
        targetId: dateNodeId,
        index: 'a0v', // Changed from 'd1' to valid fractional index
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
        index: 'a0l', // Changed from 'c2' to valid fractional index
      });

      elementsYMap.set(locationNodeId, locationNode);

      // Connector
      const locationConnectorId = generateUniqueId(10);
      const locationConnector = createConnector({
        id: locationConnectorId,
        sourceId: infoNodeId,
        targetId: locationNodeId,
        index: 'a0z', // Changed from 'd2' to valid fractional index
      });

      elementsYMap.set(locationConnectorId, locationConnector);
      // infoDetailCount++;
    }

    currentBranchIndex++;
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
      index: 'a2', // This is a valid fractional index
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
      index: 'a1V', // Changed from 'b2' to valid fractional index
    });

    elementsYMap.set(participantsConnectorId, participantsConnector);

    // Add individual participant nodes - center them around the branch node
    const participantSpacing = 55;
    const participantsBranchY = branchPositions[currentBranchIndex];
    let participantY =
      participantsBranchY -
      Math.floor(((data.participants.length - 1) * participantSpacing) / 2);

    data.participants.forEach((participant, idx) => {
      // Use mapped participant name or fallback to original ID
      const participantName =
        globalSpeakerIdToName?.get(participant) || participant;
      const nodeWidth = calculateTextWidth(participantName);
      const nodeHeight = 40;

      const participantNodeId = generateUniqueId(10);
      const participantNode = createShapeNode({
        id: participantNodeId,
        x: 2100,
        y: participantY,
        width: nodeWidth,
        height: nodeHeight,
        text: participantName,
        fillColor: '--affine-palette-shape-white',
        strokeColor: '--affine-palette-line-grey',
        index: `a${(30 + idx * 2).toString().padStart(4, '0')}`, // a0030, a0032, a0034, etc.
        textAlign: 'left',
      });

      // Add speaker metadata (using speakerId/speakerName for consistency)
      participantNode.set('speakerId', participant);
      participantNode.set('speakerName', participantName);

      elementsYMap.set(participantNodeId, participantNode);

      // Connector
      const participantConnectorId = generateUniqueId(10);
      const participantConnector = createConnector({
        id: participantConnectorId,
        sourceId: participantsNodeId,
        targetId: participantNodeId,
        index: `a${(31 + idx * 2).toString().padStart(4, '0')}`, // a0031, a0033, a0035, etc.
      });

      elementsYMap.set(participantConnectorId, participantConnector);
      participantY += participantSpacing;
    });

    currentBranchIndex++;
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
      text: '📋 아젠다 및 내용 요약',
      fillColor: '--affine-palette-shape-purple',
      strokeColor: '--affine-palette-line-purple',
      strokeWidth: 2,
      radius: 8,
      index: 'a3', // This is a valid fractional index
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
      index: 'a2V', // Changed from 'b3' to valid fractional index
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
        index: `a${(40 + idx * 2).toString().padStart(4, '0')}`, // a0040, a0042, a0044, etc.
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
        index: `a${(41 + idx * 2).toString().padStart(4, '0')}`, // a0041, a0043, a0045, etc.
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
                index: `a${(50 + idx * 10 + detailIdx).toString().padStart(4, '0')}`, // a0050, a0051, etc.
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
                index: `a${(500 + idx * 10 + detailIdx).toString().padStart(4, '0')}`, // a0500, a0501, etc.
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
  }
  let endHeight = 0;

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
      index: 'a4', // This is a valid fractional index
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
      index: 'a3V', // Changed from 'b4' to valid fractional index
    });

    elementsYMap.set(actionConnectorId, actionConnector);

    // Add individual action item nodes - center them around the branch node
    const actionSpacing = 55;
    const actionBranchY = branchPositions[currentBranchIndex];
    let actionY =
      actionBranchY -
      Math.floor(((data.action.length - 1) * actionSpacing) / 2);

    data.action.forEach((item, idx) => {
      // Handle both old string format and new object format
      const itemText = typeof item === 'string' ? item : item.text;
      const assignees =
        typeof item === 'object' && item.assignee ? item.assignee : [];

      // Create display text with assignees if available
      let displayText = itemText;
      if (assignees.length > 0) {
        // Map assignee IDs to names using globalSpeakerIdToName
        const assigneeNames = assignees.map(
          assigneeId => globalSpeakerIdToName?.get(assigneeId) || assigneeId
        );
        // Format: [화자1] 액션 텍스트
        displayText = `[${assigneeNames.join(', ')}] ${itemText}`;
      }

      const nodeWidth = calculateTextWidth(displayText);
      const nodeHeight = calculateBoxHeight(displayText, nodeWidth);

      const itemNodeId = generateUniqueId(10);
      const itemNode = createShapeNode({
        id: itemNodeId,
        x: 2100,
        y: actionY,
        width: nodeWidth,
        height: nodeHeight,
        text: displayText,
        fillColor: '--affine-palette-shape-white',
        strokeColor: '--affine-palette-line-red',
        strokeWidth: 1,
        radius: 4,
        textAlign: 'left',
        index: `a${(60 + idx * 2).toString().padStart(4, '0')}`, // a0060, a0062, a0064, etc.
      });

      // Add assignee metadata to the shape for bulk replacement
      if (assignees.length > 0) {
        itemNode.set('assignees', assignees);
        // Store the original action text without assignees for reference
        itemNode.set('actionText', itemText);
      }

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
        index: `a${(61 + idx * 2).toString().padStart(4, '0')}`, // a0061, a0063, a0065, etc.
      });

      elementsYMap.set(itemConnectorId, itemConnector);
      actionY += actionSpacing;
    });
    endHeight = actionY;
  }

  // Conversation content node
  if (data.conversation && data.conversation.length > 0) {
    endHeight += 100;

    // Filter conversations with text length >= 5 characters (excluding spaces, '.', '?')
    const filteredConversations = data.conversation.filter(conv => {
      if (!conv.text) return false;
      const cleanedText = conv.text.replace(/[\s.?]/g, ''); // Remove spaces, '.', '?'
      return cleanedText.length >= 5;
    });

    // Only proceed if there are conversations left after filtering
    if (filteredConversations.length > 0) {
      // Create speaker ID to name mapping using database lookups
      const uniqueSpeakers = Array.from(
        new Set(filteredConversations.map(conv => conv.speaker))
      );
      const speakerIdToName = await getSpeakerMappings(
        workspaceId,
        uniqueSpeakers,
        prisma
      );

      // Group conversations by speaker name (not ID)
      const speakerGroups = new Map();
      filteredConversations.forEach(conv => {
        const speakerName = speakerIdToName.get(conv.speaker) || conv.speaker;
        if (!speakerGroups.has(speakerName)) {
          speakerGroups.set(speakerName, []);
        }
        speakerGroups.get(speakerName).push({
          ...conv,
          speakerId: conv.speaker,
          speakerName: speakerName,
        });
      });

      // Add speaker nodes and their conversations
      const conversationSpacing = 30;
      let speakerIdx = 0;

      const conversationNodeId = generateUniqueId(10);
      const conversationNode = createShapeNode({
        id: conversationNodeId,
        x: 1800,
        y:
          endHeight +
          Math.floor(
            ((filteredConversations.length - 1) * conversationSpacing) / 2
          ),
        width: 200,
        height: 60,
        text: '🎙️ 대화내용',
        fillColor: '--affine-palette-shape-blue',
        strokeColor: '--affine-palette-line-blue',
        strokeWidth: 2,
        radius: 8,
        index: 'a5', // This is a valid fractional index
      });

      elementsYMap.set(conversationNodeId, conversationNode);
      branchNodeIds.push(conversationNodeId);

      // Connector
      const conversationConnectorId = generateUniqueId(10);
      const conversationConnector = createConnector({
        id: conversationConnectorId,
        sourceId: centralNodeId,
        targetId: conversationNodeId,
        strokeWidth: 2,
        strokeColor: '--affine-palette-line-grey',
        strokeStyle: 'solid',
        rearEndpointStyle: 'arrow',
        index: 'a4V', // Changed from 'b5' to valid fractional index
      });

      elementsYMap.set(conversationConnectorId, conversationConnector);
      let speakerY = endHeight;
      speakerGroups.forEach((conversations, speakerName) => {
        // Create speaker node
        const speakerNodeId = generateUniqueId(10);

        // Get the original speaker ID from the first conversation
        const originalSpeakerId =
          conversations.length > 0 ? conversations[0].speakerId : speakerName;

        // Create speaker text without backticks
        const speakerText = speakerName;
        const speakerWidth = calculateTextWidth(speakerText);
        const speakerHeight = 45;
        speakerY += (conversations.length * conversationSpacing) / 2;

        const speakerNode = createShapeNode({
          id: speakerNodeId,
          x: 2100,
          y: speakerY,
          width: speakerWidth,
          height: speakerHeight,
          text: speakerText,
          fillColor: '--affine-palette-shape-white',
          strokeColor: '--affine-palette-line-blue',
          strokeWidth: 1,
          radius: 6,
          textAlign: 'center',
          index: `a${(70 + speakerIdx * 2).toString().padStart(4, '0')}`, // a0070, a0072, a0074, etc.
        });

        // Add speaker metadata as custom properties
        speakerNode.set('speakerId', originalSpeakerId);
        speakerNode.set('speakerName', speakerName);

        elementsYMap.set(speakerNodeId, speakerNode);

        // Connector from conversation to speaker
        const speakerConnectorId = generateUniqueId(10);
        const speakerConnector = createConnector({
          id: speakerConnectorId,
          sourceId: conversationNodeId,
          targetId: speakerNodeId,
          strokeWidth: 1,
          strokeColor: '--affine-palette-line-grey',
          strokeStyle: 'solid',
          index: `a${(71 + speakerIdx * 2).toString().padStart(4, '0')}`, // a0071, a0073, a0075, etc.
        });

        elementsYMap.set(speakerConnectorId, speakerConnector);

        // Sort conversations by time for this speaker
        const sortedConvs = conversations.sort((a: any, b: any) => {
          const parseTime = (timeStr: string) => {
            const parts = timeStr.split(':');
            return parseInt(parts[0]) * 60 + parseInt(parts[1]);
          };
          return parseTime(a.time) - parseTime(b.time);
        });

        // Add individual conversation nodes
        let convY =
          speakerY -
          Math.floor(((sortedConvs.length - 1) * conversationSpacing) / 2);

        sortedConvs.forEach((conv: any, convIdx: number) => {
          const convText = `${conv.time}: ${conv.text}`;
          const convWidth = calculateTextWidth(convText);
          const convHeight = 30;

          const convNodeId = generateUniqueId(10);
          const convNode = createShapeNode({
            id: convNodeId,
            x: 2400,
            y: convY,
            width: convWidth,
            height: convHeight,
            text: convText,
            fillColor: '--affine-palette-shape-white',
            strokeColor: '--affine-palette-line-blue',
            strokeWidth: 1,
            radius: 4,
            textAlign: 'left',
            fontSize: 12,

            index: `a${(80 + speakerIdx * 100 + convIdx).toString().padStart(4, '0')}`, // a0080, a0081, etc.
          });

          elementsYMap.set(convNodeId, convNode);

          // Connector from speaker to conversation
          const convConnectorId = generateUniqueId(10);
          const convConnector = createConnector({
            id: convConnectorId,
            sourceId: speakerNodeId,
            targetId: convNodeId,
            strokeWidth: 1,
            strokeColor: '--affine-palette-line-blue',
            strokeStyle: 'dashed',
            index: `a${(8000 + speakerIdx * 100 + convIdx).toString().padStart(4, '0')}`, // a8000, a8001, etc.
          });

          elementsYMap.set(convConnectorId, convConnector);
          convY += conversationSpacing;
        });
        speakerIdx++;
        speakerY += (conversations.length * conversationSpacing) / 2 + 30;
      });

      currentBranchIndex++;
    } // End of filteredConversations.length > 0 check
  }

  const boxedElements = new Y.Map();
  boxedElements.set('type', '$blocksuite:internal:native$');
  boxedElements.set('value', elementsYMap);
  surfaceBlock.set('prop:elements', boxedElements);

  blocks.set(surfaceId, surfaceBlock);

  const blockIds: string[] = [];
  const allBlocks: { [key: string]: Y.Map<any> } = {};
  const meetingInfoItems = [];

  // Combine date and time
  if (data.date || data.time) {
    let dateTimeText = '📅 일시 : ';
    if (data.date) dateTimeText += data.date;
    if (data.time) dateTimeText += ` ${data.time}`;
    meetingInfoItems.push(dateTimeText);
  }

  // Location
  if (data.location) {
    meetingInfoItems.push(`장소 : ${data.location}`);
  }

  // Participants - will be handled separately with code block format
  let hasParticipants = data.participants && data.participants.length > 0;

  // Add meeting info as separate paragraphs with enhanced formatting
  meetingInfoItems.forEach(item => {
    const itemId = generateUniqueId(10);
    const itemBlock = new Y.Map();
    itemBlock.set('sys:id', itemId);
    itemBlock.set('sys:flavour', 'affine:paragraph');
    itemBlock.set('sys:version', 1);
    itemBlock.set('sys:children', new Y.Array());
    itemBlock.set('prop:type', 'text');

    const itemText = new Y.Text();

    // Regular text item
    itemText.insert(0, item);

    itemBlock.set('prop:text', itemText);
    allBlocks[itemId] = itemBlock;
    blockIds.push(itemId);
  });

  // Add participants section with code block formatting
  if (hasParticipants) {
    const participantBlockId = generateUniqueId(10);
    const participantBlock = new Y.Map();
    participantBlock.set('sys:id', participantBlockId);
    participantBlock.set('sys:flavour', 'affine:paragraph');
    participantBlock.set('sys:version', 1);
    participantBlock.set('sys:children', new Y.Array());
    participantBlock.set('prop:type', 'text');

    const participantText = new Y.Text();

    // Build the text content with delta operations
    const delta = [];

    // Add prefix
    delta.push({ insert: '👥 참석자 : ' });

    // Add participants
    data.participants?.forEach((participantId, index) => {
      if (index > 0) {
        delta.push({ insert: ', ' });
      }

      // Get mapped participant name
      const participantName =
        globalSpeakerIdToName?.get(participantId) || participantId;

      // Add participant with formatting
      delta.push({
        insert: participantName,
        attributes: {
          code: true,
          speakerId: participantId,
          speakerName: participantName,
        },
      });
    });

    // Apply all delta operations at once
    participantText.applyDelta(delta);

    participantBlock.set('prop:text', participantText);
    allBlocks[participantBlockId] = participantBlock;
    blockIds.push(participantBlockId);
  }

  // Add divider after meeting info
  if (meetingInfoItems.length > 0 || hasParticipants) {
    const dividerId1 = generateUniqueId(10);
    allBlocks[dividerId1] = createDividerBlock(dividerId1);
    blockIds.push(dividerId1);
  }

  // Agenda section
  if (data.agenda && data.agenda.length > 0) {
    const agendaHeaderId = generateUniqueId(10);
    const agendaHeader = createParagraphBlock(
      agendaHeaderId,
      '📌 아젠다',
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
      '💡 내용 요약',
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
      '✅ 엑션 아이템',
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
      // Handle both old string format and new object format
      const actionText = typeof item === 'string' ? item : item.text;
      const assignees =
        typeof item === 'object' && item.assignee ? item.assignee : [];

      // Build all content as a single delta operation to avoid length access issues
      const contentDelta = [];

      // Add action text
      contentDelta.push({ insert: actionText });

      // Add assignees with code block formatting if available
      if (assignees.length > 0) {
        assignees.forEach((assigneeId, index) => {
          // Get speaker name from global mapping
          const assigneeName =
            globalSpeakerIdToName?.get(assigneeId) || assigneeId;

          // Add separator
          if (index === 0) {
            contentDelta.push({ insert: ' ' });
          } else {
            contentDelta.push({ insert: ', ' });
          }

          // Add assignee with formatting
          contentDelta.push({
            insert: assigneeName,
            attributes: {
              code: true,
              speakerId: assigneeId,
            },
          });
        });
      }

      // Apply all content at once
      itemText.applyDelta(contentDelta);

      itemBlock.set('prop:text', itemText);

      allBlocks[itemId] = itemBlock;
      blockIds.push(itemId);
    });
  }

  // Conversation section with speaker ID mapping
  if (data.conversation && data.conversation.length > 0) {
    // Use global speaker mapping
    const speakerIdToName = globalSpeakerIdToName || new Map<string, string>();
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

    // Create column IDs - reorder: speaker first, then time, then content
    const speakerColId = generateUniqueId(10);
    const timeColId = generateUniqueId(10);
    const contentColId = generateUniqueId(10);

    // Add columns metadata with width - speaker column first
    tableBlock.set(`prop:columns.${speakerColId}.columnId`, speakerColId);
    tableBlock.set(
      `prop:columns.${speakerColId}.order`,
      generateOrderString(0)
    );
    tableBlock.set(`prop:columns.${speakerColId}.width`, 100); // 화자 열 첫 번째

    tableBlock.set(`prop:columns.${timeColId}.columnId`, timeColId);
    tableBlock.set(`prop:columns.${timeColId}.order`, generateOrderString(1));
    tableBlock.set(`prop:columns.${timeColId}.width`, 80); // 시간 열 두 번째

    tableBlock.set(`prop:columns.${contentColId}.columnId`, contentColId);
    tableBlock.set(
      `prop:columns.${contentColId}.order`,
      generateOrderString(2)
    );
    tableBlock.set(`prop:columns.${contentColId}.width`, 500); // 발화내용 열 세 번째

    // Create rows - header + data rows
    const headerRowId = generateUniqueId(10);
    tableBlock.set(`prop:rows.${headerRowId}.rowId`, headerRowId);
    tableBlock.set(`prop:rows.${headerRowId}.order`, generateOrderString(0));

    // Header cells - reorder: speaker first, then time, then content
    const headerSpeakerText = new Y.Text();
    headerSpeakerText.insert(0, '화자');
    tableBlock.set(
      `prop:cells.${headerRowId}:${speakerColId}.text`,
      headerSpeakerText
    );

    const headerTimeText = new Y.Text();
    headerTimeText.insert(0, '시간');
    tableBlock.set(
      `prop:cells.${headerRowId}:${timeColId}.text`,
      headerTimeText
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

      // Speaker cell first - with code block format and ID attributes
      const speakerName = speakerIdToName.get(conv.speaker) || conv.speaker;
      const speakerText = new Y.Text();

      // Create delta with code block styling and speaker ID attributes
      const speakerDelta = [
        {
          insert: speakerName,
          attributes: {
            code: true,
            speakerId: conv.speaker,
            speakerName: speakerName, // Add speaker name as attribute too
          },
        },
      ];

      speakerText.applyDelta(speakerDelta);
      tableBlock.set(`prop:cells.${rowId}:${speakerColId}.text`, speakerText);

      // Also store speaker metadata at cell level for easier access
      tableBlock.set(
        `prop:cells.${rowId}:${speakerColId}.speakerId`,
        conv.speaker
      );
      tableBlock.set(
        `prop:cells.${rowId}:${speakerColId}.speakerName`,
        speakerName
      );

      // Time cell second
      const timeText = new Y.Text();
      timeText.insert(0, conv.time);
      tableBlock.set(`prop:cells.${rowId}:${timeColId}.text`, timeText);

      // Content cell third
      const contentText = new Y.Text();
      contentText.insert(0, conv.text);
      tableBlock.set(`prop:cells.${rowId}:${contentColId}.text`, contentText);
    });

    allBlocks[tableId] = tableBlock;
    blockIds.push(tableId);
  }

  // Store all blocks
  Object.entries(allBlocks).forEach(([id, block]) => {
    blocks.set(id, block);
  });

  // Create a note block with the correct children structure
  const noteBlock = new Y.Map();
  noteBlock.set('sys:id', noteId);
  noteBlock.set('sys:flavour', 'affine:note');
  noteBlock.set('sys:version', 1);

  // Add to blocks first
  blocks.set(noteId, noteBlock);

  // Set children in the correct structure
  const noteChildren = new Y.Array();
  noteBlock.set('sys:children', noteChildren);
  blockIds.forEach(id => {
    noteChildren.push([id]);
  });
  noteBlock.set('prop:xywh', '[400,300,800,600]');
  noteBlock.set('prop:background', '--affine-palette-shape-white');
  noteBlock.set('prop:index', 'a0');
  noteBlock.set('prop:hidden', false);
  noteBlock.set('prop:displayMode', 'both');

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
  meta.set('pages', pages); // Set pages array to meta first

  const pageMeta = new Y.Map();
  const currentTime = Date.now();
  pageMeta.set('id', pageId);
  pageMeta.set('title', formattedTitle);
  pageMeta.set('createDate', currentTime);
  pageMeta.set('updatedDate', currentTime);
  pageMeta.set('tags', new Y.Array());

  // Set viewport to center on the central node
  // Calculate center position considering the node's dimensions
  const viewportMeta = new Y.Map();
  viewportMeta.set('centerX', centralNodeX + 150); // centerX = nodeX + width/2
  viewportMeta.set('centerY', centralNodeY + 50); // centerY = nodeY + height/2
  viewportMeta.set('zoom', 0.8); // Default zoom level
  pageMeta.set('viewport', viewportMeta);

  pages.push([pageMeta]);

  return doc;
}
