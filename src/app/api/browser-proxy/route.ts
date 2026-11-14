import { NextResponse } from 'next/server';
import { getEffectiveStudentSession } from '@/lib/adminAuth';

export async function GET(req: Request) {
  const session = await getEffectiveStudentSession();
  if (!session || !session.userId) {
    return new NextResponse('Não autorizado.', { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const targetUrl = (searchParams.get('url') || '').trim();

  if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
    return new NextResponse('URL inválida. Informe http:// ou https://', { status: 400 });
  }

  try {
    const parsedUrl = new URL(targetUrl);
    if (['localhost', '127.0.0.1', '0.0.0.0'].includes(parsedUrl.hostname)) {
      return new NextResponse('Acesso a endereço local bloqueado.', { status: 403 });
    }

    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    const contentType = res.headers.get('content-type') || 'text/html; charset=utf-8';
    const rawBuffer = await res.arrayBuffer();

    // Detecta charset (muitos sites de lei seca como planalto.gov.br usam iso-8859-1 / windows-1252)
    let charset = 'utf-8';
    const charsetMatch = contentType.match(/charset=([^;]+)/i);
    if (charsetMatch) {
      charset = charsetMatch[1].trim().toLowerCase();
    } else {
      const previewAscii = new TextDecoder('ascii').decode(rawBuffer.slice(0, 2048));
      if (/charset=["']?(iso-8859-1|windows-1252)/i.test(previewAscii)) {
        charset = 'windows-1252';
      }
    }

    let html = '';
    try {
      html = new TextDecoder(charset).decode(rawBuffer);
    } catch {
      html = new TextDecoder('utf-8').decode(rawBuffer);
    }

    const baseOrigin = `${parsedUrl.protocol}//${parsedUrl.host}`;
    const baseHref = targetUrl.endsWith('/')
      ? targetUrl
      : targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1) || `${baseOrigin}/`;
    const targetPathAndQuery = `${parsedUrl.pathname || '/'}${parsedUrl.search || ''}${parsedUrl.hash || ''}`;

    // Reescreve caminhos relativos à raiz (src="/..." e href="/...") para a origem absoluta do site alvo
    // Isso garante que SPAs (Vue/Quasar/React como app.caveira.com) carreguem todos os bundles JS/CSS/fontes
    html = html
      .replace(/\b(src|href)=["']\/(?!\/)([^"']*)["']/gi, `$1="${baseOrigin}/$2"`)
      .replace(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/gi, '');

    // Script injetado NO TOPO DO <head> ANTES de qualquer script do SPA:
    // 0. Corrige window.location.pathname via history.replaceState para que roteadores SPA (Vue Router, React Router)
    //    vejam o caminho real (ex: "/home" do app.caveira.com) em vez de "/api/browser-proxy" (evitando tela 404 do SPA!)
    // 1. Selecionar qualquer texto na página e enviar direto para as Notas ou Grifar texto real (<mark>)
    // 2. Interceptar cliques em links para manter a navegação dentro do navegador interno do Krono
    const injectedScript = `
<base href="${baseHref}">
<script>
(function() {
  var TARGET_ORIGIN = ${JSON.stringify(baseOrigin)};
  var DESIRED_PATH = ${JSON.stringify(targetPathAndQuery)};
  try {
    // Evita SecurityError quando scripts da página tentam passar URL absoluta de outra origem no pushState/replaceState
    var origReplaceState = window.history.replaceState;
    var origPushState = window.history.pushState;
    function sanitizeStateUrl(u) {
      if (!u) return u;
      var s = String(u);
      if (s.indexOf('http://') === 0 || s.indexOf('https://') === 0) {
        try {
          var parsed = new URL(s);
          return parsed.pathname + parsed.search + parsed.hash;
        } catch (err) {
          return '/';
        }
      }
      return s;
    }
    window.history.replaceState = function(state, title, url) {
      try {
        return origReplaceState.call(window.history, state, title, sanitizeStateUrl(url));
      } catch (e) {}
    };
    window.history.pushState = function(state, title, url) {
      try {
        return origPushState.call(window.history, state, title, sanitizeStateUrl(url));
      } catch (e) {}
    };
    if (window.location.pathname.indexOf('/api/browser-proxy') !== -1 && DESIRED_PATH) {
      window.history.replaceState(window.history.state, '', DESIRED_PATH);
    }
  } catch (e) {}

  // Redireciona chamadas fetch/XHR relativas à raiz do SPA para a origem real do site (ex: https://app.caveira.com)
  try {
    var origFetch = window.fetch;
    if (origFetch) {
      window.fetch = function(input, init) {
        try {
          if (typeof input === 'string' && input.startsWith('/') && !input.startsWith('//') && !input.startsWith('/api/browser-proxy')) {
            input = TARGET_ORIGIN + input;
          }
        } catch (e) {}
        return origFetch.call(this, input, init);
      };
    }
    var origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
      try {
        if (typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/api/browser-proxy')) {
          arguments[1] = TARGET_ORIGIN + url;
        }
      } catch (e) {}
      return origOpen.apply(this, arguments);
    };
  } catch (e) {}
})();
</script>
<style>
  ::selection { background: #fde047 !important; color: #0f172a !important; }
  mark.krono-real-highlight {
    padding: 1px 2px;
    border-radius: 3px;
    color: #0f172a !important;
    box-shadow: 0 0 0 1px rgba(0,0,0,0.06);
  }
  #krono-selection-popover {
    position: fixed;
    z-index: 2147483647;
    display: none;
    align-items: center;
    gap: 6px;
    background: #0f172a;
    color: #f8fafc;
    padding: 6px 10px;
    border-radius: 10px;
    border: 1px solid #334155;
    box-shadow: 0 10px 25px rgba(0,0,0,0.45);
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 12px;
  }
  #krono-selection-popover button {
    border: none;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 700;
    transition: opacity 0.15s;
  }
  #krono-selection-popover button:hover {
    opacity: 0.9;
  }
</style>
<script>
(function() {
  var popover = null;
  function ensurePopover() {
    if (popover) return popover;
    popover = document.createElement('div');
    popover.id = 'krono-selection-popover';
    popover.innerHTML =
      '<button type="button" id="krono-btn-send-note" style="background:#10b981;color:#052e16;">📌 Enviar para Notas</button>' +
      '<button type="button" data-color="#fde047" class="krono-btn-hl" style="background:#fde047;color:#0f172a;" title="Grifar em Amarelo">🖍️ Amarelo</button>' +
      '<button type="button" data-color="#86efac" class="krono-btn-hl" style="background:#86efac;color:#0f172a;" title="Grifar em Verde">🖍️ Verde</button>' +
      '<button type="button" data-color="#f9a8d4" class="krono-btn-hl" style="background:#f9a8d4;color:#0f172a;" title="Grifar em Rosa">🖍️ Rosa</button>';
    document.body.appendChild(popover);

    popover.addEventListener('mousedown', function(e) {
      e.preventDefault();
      e.stopPropagation();
    });

    document.getElementById('krono-btn-send-note').addEventListener('click', function() {
      var sel = window.getSelection();
      var txt = sel ? sel.toString().trim() : '';
      if (txt) {
        window.parent.postMessage({ type: 'KRONO_SEND_SELECTED_TEXT', text: txt, url: "${targetUrl.replace(/"/g, '\\"')}" }, '*');
        sel.removeAllRanges();
        popover.style.display = 'none';
      }
    });

    var hlBtns = popover.querySelectorAll('.krono-btn-hl');
    hlBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var color = btn.getAttribute('data-color') || '#fde047';
        var sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        var range = sel.getRangeAt(0);
        if (range.collapsed) return;
        try {
          var mark = document.createElement('mark');
          mark.className = 'krono-real-highlight';
          mark.style.backgroundColor = color;
          range.surroundContents(mark);
        } catch (err) {
          try {
            document.execCommand('hiliteColor', false, color);
          } catch (e2) {}
        }
        sel.removeAllRanges();
        popover.style.display = 'none';
      });
    });

    return popover;
  }

  document.addEventListener('mouseup', function(e) {
    setTimeout(function() {
      var sel = window.getSelection();
      var txt = sel ? sel.toString().trim() : '';
      var pop = ensurePopover();
      if (txt && txt.length >= 2) {
        var range = sel.getRangeAt(0);
        var rect = range.getBoundingClientRect();
        var top = Math.max(8, rect.top - 46);
        var left = Math.max(8, Math.min(window.innerWidth - 340, rect.left));
        pop.style.top = top + 'px';
        pop.style.left = left + 'px';
        pop.style.display = 'flex';
      } else {
        pop.style.display = 'none';
      }
    }, 10);
  });

  // Mantém cliques em links dentro do navegador interno do Krono
  document.addEventListener('click', function(e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
    try {
      var abs = new URL(href, "${baseHref.replace(/"/g, '\\"')}").href;
      if (abs.startsWith('http')) {
        e.preventDefault();
        window.parent.postMessage({ type: 'KRONO_NAVIGATE', url: abs }, '*');
      }
    } catch (err) {}
  });
})();
</script>`;

    const finalHtml = /<head[^>]*>/i.test(html)
      ? html.replace(/<head[^>]*>/i, (match) => `${match}${injectedScript}`)
      : `${injectedScript}${html}`;

    return new NextResponse(finalHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:24px;color:#e2e8f0;background:#0b1320;">
        <h3>Não foi possível carregar diretamente esta URL (${targetUrl})</h3>
        <p>${err?.message || 'Erro de conexão'}</p>
        <p>Se este site exigir login privado no seu navegador (como QConcursos ou TEC logado), use o modo <strong>Espelhar Aba com Interação</strong> ou cole o conteúdo/print na área de leitura.</p>
      </body></html>`,
      {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  }
}
