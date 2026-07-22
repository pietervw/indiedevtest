type UmamiEventProperties = Record<
  string,
  string | number | boolean | null | undefined
>;

export function umamiEvent(
  name: string,
  properties: UmamiEventProperties = {},
): Record<string, string> {
  return Object.fromEntries(
    [
      ["data-umami-event", name],
      ...Object.entries(properties).map(([key, value]) => [
        `data-umami-event-${key}`,
        value == null ? "" : String(value),
      ]),
    ].filter(([, value]) => value !== ""),
  );
}
