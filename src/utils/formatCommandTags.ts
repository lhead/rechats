export function formatCommandTags(text: string): string {
  const commandNameMatch = text.match(/<command-name>\s*(\/\w+)\s*<\/command-name>/);
  const commandArgsMatch = text.match(/<command-args>\s*(.*?)\s*<\/command-args>/s);

  if (commandNameMatch) {
    const cmd = commandNameMatch[1];
    const args = commandArgsMatch?.[1]?.trim() || '';
    return args ? `${cmd} ${args}` : cmd;
  }

  return text;
}
