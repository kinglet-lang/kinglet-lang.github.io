(function (global) {
  'use strict';

  var KL_KEYWORDS = {
    using: 1, import: 1, export: 1, module: 1, struct: 1, enum: 1, concept: 1,
    if: 1, else: 1, for: 1, while: 1, return: 1, match: 1, let: 1, try: 1, catch: 1,
    pub: 1, const: 1, namespace: 1, guard: 1, when: 1, spawn: 1, select: 1, auto: 1,
    true: 1, false: 1, null: 1, mut: 1, break: 1, continue: 1
  };

  var KL_TYPES = {
    int: 1, int8: 1, int16: 1, int32: 1, int64: 1,
    uint8: 1, uint16: 1, uint32: 1, uint64: 1,
    float: 1, float32: 1, float64: 1, double: 1,
    bool: 1, string: 1, void: 1, byte: 1, char: 1
  };

  var NEST_KEYWORDS = {
    project: 1, target: 1, build: 1, fmt: 1,
    kind: 1, sources: 1, deps: 1, default: 1, out: 1, cache: 1,
    indent: 1, max_width: 1, newline: 1, trailing_comma: 1, extensions: 1,
    binary: 1, library: 1, test: 1, object: 1, version: 1
  };

  function esc(s) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function span(cls, text) {
    return '<span class="' + cls + '">' + esc(text) + '</span>';
  }

  function isIdentStart(c) {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';
  }

  function isIdentPart(c) {
    return isIdentStart(c) || (c >= '0' && c <= '9');
  }

  function peekNonSpace(src, i) {
    while (i < src.length && (src[i] === ' ' || src[i] === '\t')) i++;
    return i;
  }

  function classifyKlIdent(word, src, start, end) {
    if (KL_KEYWORDS[word]) return 'k';
    if (KL_TYPES[word]) return 't';
    if (/^[A-Z]/.test(word)) return 't';
    var before = start - 1;
    while (before >= 0 && /\s/.test(src[before])) before--;
    if (before >= 1 && src[before] === ':' && src[before - 1] === ':') return 'f';
    var next = peekNonSpace(src, end);
    if (src[next] === '(' || src[next] === '<') return 'f';
  }

  function highlightKl(src) {
    var out = [];
    var i = 0;

    while (i < src.length) {
      var c = src[i];

      if (c === '/' && src[i + 1] === '/') {
        var lineEnd = src.indexOf('\n', i);
        if (lineEnd === -1) lineEnd = src.length;
        out.push(span('c', src.slice(i, lineEnd)));
        i = lineEnd;
        continue;
      }

      if (c === '"') {
        var j = i + 1;
        while (j < src.length) {
          if (src[j] === '\\') { j += 2; continue; }
          if (src[j] === '"') { j++; break; }
          j++;
        }
        out.push(span('s', src.slice(i, j)));
        i = j;
        continue;
      }

      if (c === '\'' ) {
        var k = i + 1;
        while (k < src.length) {
          if (src[k] === '\\') { k += 2; continue; }
          if (src[k] === '\'') { k++; break; }
          k++;
        }
        out.push(span('s', src.slice(i, k)));
        i = k;
        continue;
      }

      if ((c >= '0' && c <= '9') || (c === '-' && src[i + 1] >= '0' && src[i + 1] <= '9')) {
        var n = i + 1;
        while (n < src.length && /[0-9A-Za-z_.]/.test(src[n])) n++;
        out.push(span('n', src.slice(i, n)));
        i = n;
        continue;
      }

      if (isIdentStart(c)) {
        var idEnd = i + 1;
        while (idEnd < src.length && isIdentPart(src[idEnd])) idEnd++;
        var word = src.slice(i, idEnd);
        var cls = classifyKlIdent(word, src, i, idEnd);
        if (cls) {
          if (cls === 'f' && i > 0 && src[i - 1] === '.') {
            out.push(span('f', word));
          } else {
            out.push(span(cls, word));
          }
        } else if (i > 0 && src[i - 1] === '.') {
          out.push(span('f', word));
        } else {
          out.push(esc(word));
        }
        i = idEnd;
        continue;
      }

      out.push(esc(c));
      i++;
    }

    return out.join('');
  }

  function highlightNest(src) {
    var out = [];
    var i = 0;

    while (i < src.length) {
      var c = src[i];

      if (c === '#') {
        var lineEnd = src.indexOf('\n', i);
        if (lineEnd === -1) lineEnd = src.length;
        out.push(span('c', src.slice(i, lineEnd)));
        i = lineEnd;
        continue;
      }

      if (c === '"') {
        var j = i + 1;
        while (j < src.length) {
          if (src[j] === '\\') { j += 2; continue; }
          if (src[j] === '"') { j++; break; }
          j++;
        }
        out.push(span('s', src.slice(i, j)));
        i = j;
        continue;
      }

      if (isIdentStart(c)) {
        var idEnd = i + 1;
        while (idEnd < src.length && isIdentPart(src[idEnd])) idEnd++;
        var word = src.slice(i, idEnd);
        if (NEST_KEYWORDS[word]) {
          out.push(span('k', word));
        } else {
          out.push(esc(word));
        }
        i = idEnd;
        continue;
      }

      if ((c >= '0' && c <= '9')) {
        var n = i + 1;
        while (n < src.length && /[0-9]/.test(src[n])) n++;
        out.push(span('n', src.slice(i, n)));
        i = n;
        continue;
      }

      out.push(esc(c));
      i++;
    }

    return out.join('');
  }

  function highlightShell(src) {
    var lines = src.split('\n');
    return lines.map(function (line) {
      if (line.indexOf('?  ') === 0) {
        return span('k', '?') + esc('  ' + line.slice(2));
      }
      if (line.indexOf('✓') === 0) {
        return span('t', '✓') + esc(line.slice(1));
      }
      if (/^\s*(kinglet|cd|\.\/)/.test(line)) {
        return span('f', line.replace(/#.*/, '')) + (line.indexOf('#') >= 0 ? span('c', line.slice(line.indexOf('#'))) : '');
      }
      if (line.indexOf('#') >= 0) {
        var hash = line.indexOf('#');
        return esc(line.slice(0, hash)) + span('c', line.slice(hash));
      }
      return esc(line);
    }).join('\n');
  }

  function detectLang(snippet) {
    var explicit = snippet.getAttribute('data-lang');
    if (explicit) return explicit;
    var cap = snippet.querySelector('.snippet__cap');
    if (!cap) return 'kl';
    var label = cap.textContent.trim().toLowerCase();
    if (label === 'kinglet.nest' || label.endsWith('.nest')) return 'nest';
    if (label === 'terminal' || label === 'kinglet init' || label === 'after build') return 'shell';
    if (label.endsWith('.kl')) return 'kl';
    return 'kl';
  }

  function highlight(src, lang) {
    if (lang === 'nest') return highlightNest(src);
    if (lang === 'shell') return highlightShell(src);
    return highlightKl(src);
  }

  function highlightPre(pre, lang) {
    var src = pre.textContent;
    if (!src) return;
    pre.innerHTML = highlight(src, lang || 'kl');
  }

  function highlightAll(root) {
    var scope = root || document;
    scope.querySelectorAll('.snippet').forEach(function (snippet) {
      var pre = snippet.querySelector('pre');
      if (!pre || pre.getAttribute('data-highlighted') === 'true') return;
      highlightPre(pre, detectLang(snippet));
      pre.setAttribute('data-highlighted', 'true');
    });
    scope.querySelectorAll('.demo pre[data-lang]').forEach(function (pre) {
      if (pre.getAttribute('data-highlighted') === 'true') return;
      highlightPre(pre, pre.getAttribute('data-lang') || 'kl');
      pre.setAttribute('data-highlighted', 'true');
    });
  }

  global.KingletHighlight = {
    kl: highlightKl,
    nest: highlightNest,
    shell: highlightShell,
    highlight: highlight,
    highlightPre: highlightPre,
    highlightAll: highlightAll
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { highlightAll(); });
  } else {
    highlightAll();
  }
})(window);
