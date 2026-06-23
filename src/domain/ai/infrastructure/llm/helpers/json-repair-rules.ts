export function repairJson(str: string): string {
  let inString = false;
  let escaped = false;
  let result = "";

  for (let i = 0; i < str.length; i++) {
    const char = str[i];

    if (escaped) {
      escaped = false;
      result += char;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      result += char;
      continue;
    }

    if (char === '"') {
      if (inString) {
        // Look ahead to check if this quote is a valid separator: , } ] :
        let nextChar = "";
        let nextIdx = i + 1;
        while (nextIdx < str.length) {
          const c = str[nextIdx];
          if (c !== " " && c !== "\n" && c !== "\r" && c !== "\t") {
            nextChar = c;
            break;
          }
          nextIdx++;
        }

        const isClosing =
          nextChar === "," ||
          nextChar === "}" ||
          nextChar === "]" ||
          nextChar === ":" ||
          nextChar === "";

        if (isClosing) {
          inString = false;
          result += char;
        } else {
          // Unescaped internal quote! Escape it.
          result += '\\"';
        }
      } else {
        inString = true;
        result += char;
      }
      continue;
    }

    if (inString) {
      if (char === "\n") {
        result += "\\n";
      } else if (char === "\r") {
        result += "\\r";
      } else if (char === "\t") {
        result += "\\t";
      } else {
        result += char;
      }
    } else {
      if (char === ",") {
        // Look ahead: if the next non-whitespace char is } or ], this is a trailing comma!
        let nextChar = "";
        let nextIdx = i + 1;
        while (nextIdx < str.length) {
          const c = str[nextIdx];
          if (c !== " " && c !== "\n" && c !== "\r" && c !== "\t") {
            nextChar = c;
            break;
          }
          nextIdx++;
        }

        if (nextChar === "}" || nextChar === "]") {
          continue; // Skip trailing comma
        }
      }
      result += char;
    }
  }

  return result;
}
