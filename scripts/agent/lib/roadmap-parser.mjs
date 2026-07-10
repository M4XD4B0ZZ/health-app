const ROADMAP_TASK_ID_PATTERN = String.raw`(?:P\d+-\d+|RESOLVER-V2-\d+|RALPH-\d+[A-Z]?)`;
const ROADMAP_TASK_HEADER = new RegExp(
  String.raw`^(#{2,6})\s+(?:[-*]\s+)?(${ROADMAP_TASK_ID_PATTERN})(?::)?\s*(.*)$`,
);
const CHECKBOX_TASK = new RegExp(
  String.raw`^\s*-\s+\[[ xX]\]\s+(${ROADMAP_TASK_ID_PATTERN})(?::)?\s*(.*)$`,
);
const ANY_HEADING = /^(#{1,6})\s+(.+)$/;

export { ROADMAP_TASK_ID_PATTERN };

export function normalizeStatus(value) {
  return typeof value === 'string' ? value.trim().replace(/^`|`$/g, '').toLowerCase() : null;
}

function cleanTitle(title) {
  return String(title || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function sectionPathFromStack(stack) {
  return stack.map((item) => item.title).join(' > ');
}

function collectTaskText(lines, startIndex, taskLevel) {
  const collected = [];
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    const heading = line.match(ANY_HEADING);
    if (heading && heading[1].length <= taskLevel) break;
    if (/^\s*---\s*$/.test(line)) break;
    collected.push(line);
  }
  return collected;
}

function extractStatus(taskLines) {
  for (const line of taskLines) {
    const match = line.match(/^\s*Status:\s*`?([A-Za-z_]+)`?\s*$/i);
    if (match) return normalizeStatus(match[1]);
  }
  return null;
}

function extractDodVerify(taskLines) {
  const blocks = [];
  for (let i = 0; i < taskLines.length; i += 1) {
    const line = taskLines[i];
    const inline = line.match(/^\s*\*\*(DoD|Verify):\*\*\s*(.*)$/i);
    if (inline) {
      const label = inline[1];
      const content = [inline[2].trim()].filter(Boolean);
      for (let j = i + 1; j < taskLines.length; j += 1) {
        const next = taskLines[j];
        if (/^\s*\*\*(DoD|Verify|Description):\*\*/i.test(next)) break;
        if (/^\s*Status:\s*/i.test(next)) break;
        if (/^\s*#{1,6}\s+/.test(next)) break;
        if (/^\s*---\s*$/.test(next)) break;
        if (next.trim()) content.push(next.trim());
      }
      blocks.push(`${label}: ${content.join(' ')}`.trim());
    }
  }
  return blocks.join('\n');
}

export function parseRoadmap(content) {
  const lines = content.split(/\r?\n/);
  const tasks = [];
  const taskReferences = [];
  const sectionStack = [];
  let order = 0;

  lines.forEach((line, index) => {
    const heading = line.match(ANY_HEADING);
    if (heading) {
      const level = heading[1].length;
      const title = cleanTitle(heading[2]);
      while (sectionStack.length && sectionStack[sectionStack.length - 1].level >= level) {
        sectionStack.pop();
      }
      sectionStack.push({ level, title, line: index + 1 });
    }

    const headerMatch = line.match(ROADMAP_TASK_HEADER);
    if (headerMatch) {
      order += 1;
      const taskLevel = headerMatch[1].length;
      const id = headerMatch[2];
      const title = cleanTitle(headerMatch[3]);
      const taskLines = collectTaskText(lines, index, taskLevel);

      tasks.push({
        id,
        title,
        status: extractStatus(taskLines),
        order,
        line: index + 1,
        section: sectionPathFromStack(
          sectionStack.filter((section) => !section.title.includes(id)),
        ),
        dod_verify_text: extractDodVerify(taskLines),
      });
      return;
    }

    const checkboxMatch = line.match(CHECKBOX_TASK);
    if (checkboxMatch) {
      const id = checkboxMatch[1];
      const title = cleanTitle(checkboxMatch[2]);
      const isDone = line.includes('[x]') || line.includes('[X]');

      taskReferences.push({
        id,
        title,
        checkbox_state: isDone ? 'done' : 'not_done',
        line: index + 1,
        section: sectionPathFromStack(
          sectionStack.filter((section) => !section.title.includes(id)),
        ),
      });
    }
  });

  return { tasks, taskReferences };
}
