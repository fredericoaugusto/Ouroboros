'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  ExternalLink,
  MonitorPlay,
  StopCircle,
  PenTool,
  Highlighter,
  Eraser,
  Trash2,
  Crop,
  Camera,
  Send,
  Globe,
  MousePointer,
  RotateCcw,
  FileText,
  ArrowRight,
} from 'lucide-react';
import { useNotification } from '../context/NotificationContext';

interface QuestionStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjectName: string;
  topicName: string;
  notebookUrl?: string;
  currentNotes?: string;
  onAppendToNotes: (htmlSnippet: string) => void;
  initialTab?: 'studio' | 'discursive';
}

type StudioTool = 'interact' | 'highlighter' | 'pen' | 'eraser' | 'crop';
type SourceMode = 'web' | 'reader' | 'mirror';

interface StrokeItem {
  tool: 'pen' | 'highlighter' | 'eraser';
  color: string;
  width: number;
  points: Array<{ x: number; y: number }>;
}

export default function QuestionStudioModal({
  isOpen,
  onClose,
  subjectName,
  topicName,
  notebookUrl = '',
  onAppendToNotes,
}: QuestionStudioModalProps) {
  const { showNotification } = useNotification();

  // Modo de Fonte: Navegador Web Interativo | Leitor de Texto/Questões | Espelhamento de Aba
  const [sourceMode, setSourceMode] = useState<SourceMode>('web');
  const [urlInput, setUrlInput] = useState<string>(
    notebookUrl || 'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm'
  );
  const [activeProxyUrl, setActiveProxyUrl] = useState<string>('');
  const [iframeKey, setIframeKey] = useState<number>(0);

  // Modo Leitor Interativo (permite colar questões/leis de sites fechados, rolar, grifar texto real e enviar seleção para Notas)
  const [readerHtml, setReaderHtml] = useState<string>('');
  const readerContainerRef = useRef<HTMLDivElement | null>(null);
  const [selectedReaderText, setSelectedReaderText] = useState<string>('');

  // Ferramenta atual: 'interact' permite rolar a página e selecionar texto normalmente!
  const [tool, setTool] = useState<StudioTool>('interact');
  const [strokeColor, setStrokeColor] = useState('#fde047'); // Amarelo fluorescente padrão para marca-texto
  const [strokeWidth, setStrokeWidth] = useState(4);

  // Canvas & Vetor de Traços (para que o Marca-Texto seja 100% uniforme sem sobreposição esfumaçada!)
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [strokes, setStrokes] = useState<StrokeItem[]>([]);
  const [currentStroke, setCurrentStroke] = useState<StrokeItem | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Espelhamento e Imagem Colada
  const [isMirroring, setIsMirroring] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [pastedBgImage, setPastedBgImage] = useState<string | null>(null);

  // Recorte (Crop)
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null);
  const [cropEnd, setCropEnd] = useState<{ x: number; y: number } | null>(null);

  // Envio rápido de comentário/trecho na barra inferior
  const [quickSnippetText, setQuickSnippetText] = useState('');
  const [quickSnippetTag, setQuickSnippetTag] = useState<
    'Questão / Jurisprudência' | 'Bizu / Comentário' | 'Pegadinha de Banca' | 'Lei Seca Grifada'
  >('Bizu / Comentário');

  // Inicializa URL ao abrir
  useEffect(() => {
    if (isOpen) {
      const initial = notebookUrl?.trim()
        ? notebookUrl.startsWith('http')
          ? notebookUrl
          : `https://${notebookUrl}`
        : 'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm';
      setUrlInput(initial);
      setActiveProxyUrl(`/api/browser-proxy?url=${encodeURIComponent(initial)}`);
      setTool('interact');
    }
  }, [isOpen, notebookUrl]);

  // Escuta mensagens vindas de dentro do iframe do navegador interno (Seleção de Texto e Navegação de Links)
  useEffect(() => {
    if (!isOpen) return;
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'KRONO_SEND_SELECTED_TEXT' && data.text) {
        const cleanText = String(data.text).trim();
        const escaped = cleanText
          .split('\n')
          .map((line) => `<p>${line}</p>`)
          .join('');
        const htmlSnippet = `<blockquote><p><strong>📌 Trecho Selecionado (${topicName}):</strong></p>${escaped}</blockquote><p></p>`;
        onAppendToNotes(htmlSnippet);
        showNotification('Texto selecionado na página enviado direto para as Notas do Tópico!', 'success');
      } else if (data.type === 'KRONO_NAVIGATE' && data.url) {
        setUrlInput(data.url);
        setActiveProxyUrl(`/api/browser-proxy?url=${encodeURIComponent(data.url)}`);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isOpen, topicName, onAppendToNotes, showNotification]);

  const stopMirroring = useCallback(() => {
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      setMediaStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsMirroring(false);
  }, [mediaStream]);

  useEffect(() => {
    if (!isOpen) {
      stopMirroring();
    }
  }, [isOpen, stopMirroring]);

  // Redesenha os traços de forma vetorial limpa (evita o efeito "esfumaçado" de sobrepor círculos transparentes!)
  const renderAllStrokes = useCallback(
    (canvas: HTMLCanvasElement, allStrokes: StrokeItem[], active: StrokeItem | null) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const list = active ? [...allStrokes, active] : allStrokes;
      for (const s of list) {
        if (s.points.length === 0) continue;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (let i = 1; i < s.points.length; i++) {
          ctx.lineTo(s.points[i].x, s.points[i].y);
        }

        if (s.tool === 'eraser') {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.lineWidth = s.width * 7;
          ctx.globalAlpha = 1;
        } else if (s.tool === 'highlighter') {
          // Marca-Texto Reto Real: ponta chanfrada ('butt'), opacidade uniforme em passe único (nunca acumula/borra!)
          ctx.globalCompositeOperation = 'source-over';
          ctx.lineCap = 'butt';
          ctx.lineJoin = 'miter';
          ctx.strokeStyle = s.color;
          ctx.lineWidth = 22;
          ctx.globalAlpha = 0.38;
        } else {
          ctx.globalCompositeOperation = 'source-over';
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = s.color;
          ctx.lineWidth = s.width;
          ctx.globalAlpha = 1;
        }

        ctx.stroke();
        ctx.restore();
      }
    },
    []
  );

  // Mantém o tamanho do canvas sincronizado com a tela inteira
  useEffect(() => {
    if (!isOpen) return;
    const resizeCanvas = () => {
      const canvas = drawCanvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      canvas.width = rect.width;
      canvas.height = rect.height;
      renderAllStrokes(canvas, strokes, currentStroke);
    };
    const timer = setTimeout(resizeCanvas, 50);
    window.addEventListener('resize', resizeCanvas);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [isOpen, strokes, currentStroke, renderAllStrokes]);

  useEffect(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    renderAllStrokes(canvas, strokes, currentStroke);
  }, [strokes, currentStroke, renderAllStrokes]);

  // Suporte a Ctrl+V de imagem
  useEffect(() => {
    if (!isOpen) return;
    const handlePaste = (e: ClipboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'INPUT' ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
              const dataUrl = ev.target?.result as string;
              if (dataUrl) {
                setPastedBgImage(dataUrl);
                setSourceMode('mirror');
                showNotification('Print colado em tela cheia! Use o Marca-Texto Reto ou Recortar.', 'success');
              }
            };
            reader.readAsDataURL(file);
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, showNotification]);

  if (!isOpen) return null;

  const handleLoadUrl = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!urlInput.trim()) return;
    const finalUrl = urlInput.trim().startsWith('http')
      ? urlInput.trim()
      : `https://${urlInput.trim()}`;
    setUrlInput(finalUrl);
    setSourceMode('web');
    setActiveProxyUrl(`/api/browser-proxy?url=${encodeURIComponent(finalUrl)}`);
    setIframeKey((k) => k + 1);
  };

  const handleStartMirroring = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' } as any,
        audio: false,
      });
      setMediaStream(stream);
      setIsMirroring(true);
      setSourceMode('mirror');
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        stopMirroring();
      });
    } catch (err) {
      console.warn('Espelhamento cancelado:', err);
    }
  };

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === 'interact') return;
    const pt = getCanvasCoords(e);
    if (tool === 'crop') {
      setCropStart(pt);
      setCropEnd(pt);
      setIsDrawing(true);
      return;
    }
    setIsDrawing(true);
    setCurrentStroke({
      tool: tool as 'pen' | 'highlighter' | 'eraser',
      color: strokeColor,
      width: strokeWidth,
      points: [pt],
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || tool === 'interact') return;
    const pt = getCanvasCoords(e);
    if (tool === 'crop') {
      setCropEnd(pt);
      return;
    }
    if (!currentStroke) return;

    // No Marca-Texto, nivela suavemente o eixo Y para criar um grifo reto perfeito sobre a linha de texto!
    if (currentStroke.tool === 'highlighter' && currentStroke.points.length > 0 && !e.shiftKey) {
      const startY = currentStroke.points[0].y;
      const lockedPt = Math.abs(pt.y - startY) < 18 ? { x: pt.x, y: startY } : pt;
      setCurrentStroke({
        ...currentStroke,
        points: [currentStroke.points[0], lockedPt],
      });
    } else {
      setCurrentStroke({
        ...currentStroke,
        points: [...currentStroke.points, pt],
      });
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (tool === 'crop' && cropStart && cropEnd) {
      const width = Math.abs(cropEnd.x - cropStart.x);
      const height = Math.abs(cropEnd.y - cropStart.y);
      if (width > 20 && height > 20) {
        captureRegionToNotes(
          Math.min(cropStart.x, cropEnd.x),
          Math.min(cropStart.y, cropEnd.y),
          width,
          height
        );
      }
      setCropStart(null);
      setCropEnd(null);
      setTool('interact');
      return;
    }

    if (currentStroke && currentStroke.points.length > 0) {
      setStrokes((prev) => [...prev, currentStroke]);
      setCurrentStroke(null);
    }
  };

  const clearCanvas = () => {
    setStrokes([]);
    setCurrentStroke(null);
  };

  const captureRegionToNotes = (sx: number, sy: number, sw: number, sh: number) => {
    const drawCanvas = drawCanvasRef.current;
    if (!drawCanvas) return;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = sw;
    outCanvas.height = sh;
    const outCtx = outCanvas.getContext('2d');
    if (!outCtx) return;

    outCtx.fillStyle = '#0f172a';
    outCtx.fillRect(0, 0, sw, sh);

    if (isMirroring && videoRef.current && videoRef.current.videoWidth > 0) {
      const video = videoRef.current;
      const scaleX = video.videoWidth / drawCanvas.width;
      const scaleY = video.videoHeight / drawCanvas.height;
      outCtx.drawImage(video, sx * scaleX, sy * scaleY, sw * scaleX, sh * scaleY, 0, 0, sw, sh);
    } else if (pastedBgImage) {
      const img = document.getElementById('studio-pasted-bg') as HTMLImageElement | null;
      if (img && img.naturalWidth > 0) {
        const scaleX = img.naturalWidth / drawCanvas.width;
        const scaleY = img.naturalHeight / drawCanvas.height;
        outCtx.drawImage(img, sx * scaleX, sy * scaleY, sw * scaleX, sh * scaleY, 0, 0, sw, sh);
      }
    }

    outCtx.drawImage(drawCanvas, sx, sy, sw, sh, 0, 0, sw, sh);

    const dataUrl = outCanvas.toDataURL('image/png');
    const nowStr = new Date().toLocaleDateString('pt-BR');
    const htmlSnippet = `<p><strong>📸 Recorte de Estudo (${nowStr}):</strong></p><img src="${dataUrl}" alt="Recorte de Estudo" /><p></p>`;
    onAppendToNotes(htmlSnippet);
    showNotification('Recorte enviado direto para as Notas do Tópico!', 'success');
  };

  const handleSendReaderSelectionToNotes = () => {
    const sel = window.getSelection();
    const txt = (sel ? sel.toString().trim() : '') || selectedReaderText.trim();
    if (!txt) {
      showNotification('Selecione um trecho de texto com o mouse primeiro.', 'warning');
      return;
    }
    const escaped = txt
      .split('\n')
      .map((line) => `<p>${line}</p>`)
      .join('');
    const htmlSnippet = `<blockquote><p><strong>📌 [${quickSnippetTag}]:</strong></p>${escaped}</blockquote><p></p>`;
    onAppendToNotes(htmlSnippet);
    setSelectedReaderText('');
    showNotification('Texto selecionado enviado direto para as Notas do Tópico!', 'success');
  };

  const handleHighlightReaderSelection = (bgColor: string) => {
    try {
      document.execCommand('hiliteColor', false, bgColor);
    } catch {}
  };

  const handleSendTextSnippetToNotes = () => {
    if (!quickSnippetText.trim()) {
      showNotification('Cole ou digite um trecho antes de enviar para as notas.', 'warning');
      return;
    }
    const escaped = quickSnippetText
      .trim()
      .split('\n')
      .map((line) => `<p>${line}</p>`)
      .join('');
    const htmlSnippet = `<blockquote><p><strong>📌 [${quickSnippetTag}]:</strong></p>${escaped}</blockquote><p></p>`;
    onAppendToNotes(htmlSnippet);
    setQuickSnippetText('');
    showNotification('Trecho adicionado às Notas do Tópico!', 'success');
  };

  return (
    <div className="fixed inset-0 w-screen h-screen z-[100] bg-[#060b13] flex flex-col overflow-hidden">
      {/* Barra Superior Compacta em Tela Cheia */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-[#0f172a] border-b border-slate-800 shrink-0">
        {/* Esquerda: Modos de Fonte + Barra de Endereço do Navegador Interno */}
        <div className="flex items-center gap-1.5 flex-1 min-w-[280px]">
          <div className="flex items-center bg-[#090e1a] p-0.5 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setSourceMode('web');
                setTool('interact');
              }}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                sourceMode === 'web'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Navegar na página, rolar, clicar e selecionar texto direto para as Notas"
            >
              <Globe size={13} />
              Navegador Web
            </button>
            <button
              type="button"
              onClick={() => {
                setSourceMode('reader');
                setTool('interact');
              }}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                sourceMode === 'reader'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Cole qualquer questão, PDF ou texto para ler, grifar texto real e enviar seleção para as Notas"
            >
              <FileText size={13} />
              Leitor & Grifo de Texto
            </button>
            <button
              type="button"
              onClick={() => setSourceMode('mirror')}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                sourceMode === 'mirror'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Espelhar aba externa com login ou colar print"
            >
              <MonitorPlay size={13} />
              Espelhar Aba / Print
            </button>
          </div>

          {sourceMode === 'web' && (
            <form onSubmit={handleLoadUrl} className="flex items-center gap-1.5 flex-1 max-w-xl">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Digite qualquer URL (Planalto, Wikipedia, Caderno, Site)..."
                className="flex-1 px-3 py-1.5 rounded-xl bg-[#090e1a] border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1"
              >
                Ir <ArrowRight size={12} />
              </button>
              <button
                type="button"
                onClick={() => setIframeKey((k) => k + 1)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                title="Recarregar página"
              >
                <RotateCcw size={13} />
              </button>
              <button
                type="button"
                onClick={() => window.open(urlInput, '_blank', 'noopener,noreferrer')}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                title="Abrir em nova aba externa"
              >
                <ExternalLink size={13} />
              </button>
            </form>
          )}
        </div>

        {/* Centro/Direita: Ferramentas de Interação, Marca-Texto Reto, Caneta e Recorte */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1 bg-[#090e1a] p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setTool('interact')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all ${
                tool === 'interact'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Modo Interativo: Rolar a página, clicar e selecionar texto com o mouse"
            >
              <MousePointer size={13} />
              Rolar & Selecionar Texto
            </button>

            <button
              type="button"
              onClick={() => {
                setTool('highlighter');
                setStrokeColor('#fde047');
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all ${
                tool === 'highlighter'
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Marca-Texto Reto Fluorescente (não borra nem esfumaça o texto)"
            >
              <Highlighter size={13} />
              Marca-Texto Reto
            </button>

            <button
              type="button"
              onClick={() => {
                setTool('pen');
                setStrokeColor('#10b981');
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all ${
                tool === 'pen'
                  ? 'bg-indigo-500 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Caneta de anotação livre"
            >
              <PenTool size={13} />
              Caneta
            </button>

            <button
              type="button"
              onClick={() => setTool('eraser')}
              className={`p-1.5 rounded-lg text-xs transition-all ${
                tool === 'eraser' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Borracha"
            >
              <Eraser size={13} />
            </button>

            <button
              type="button"
              onClick={clearCanvas}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400"
              title="Limpar marcações da tela"
            >
              <Trash2 size={13} />
            </button>
          </div>

          {/* Paleta de Cores Rápida */}
          <div className="flex items-center gap-1 px-1.5">
            {[
              { color: '#fde047', label: 'Amarelo Marca-Texto' },
              { color: '#4ade80', label: 'Verde Marca-Texto' },
              { color: '#38bdf8', label: 'Azul Marca-Texto' },
              { color: '#f472b6', label: 'Rosa Marca-Texto' },
              { color: '#f43f5e', label: 'Vermelho Caneta' },
            ].map((c) => (
              <button
                key={c.color}
                type="button"
                onClick={() => setStrokeColor(c.color)}
                className={`w-4 h-4 rounded-full border transition-transform ${
                  strokeColor === c.color ? 'scale-125 border-white' : 'border-transparent opacity-75'
                }`}
                style={{ backgroundColor: c.color }}
                title={c.label}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => setTool('crop')}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all ${
              tool === 'crop'
                ? 'bg-amber-500 text-slate-950 border-amber-400 animate-pulse'
                : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/30'
            }`}
            title="Arraste um retângulo para recortar e enviar para as Notas"
          >
            <Crop size={13} />
            Recortar p/ Notas
          </button>

          <button
            type="button"
            onClick={() => {
              const canvas = drawCanvasRef.current;
              if (canvas) captureRegionToNotes(0, 0, canvas.width, canvas.height);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30"
          >
            <Camera size={13} />
            Print p/ Notas
          </button>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white text-xs font-bold transition-colors ml-1"
            title="Fechar Navegador em Tela Cheia"
          >
            <X size={15} />
            Fechar
          </button>
        </div>
      </div>

      {/* Área Principal em Tela Cheia (Ocupa 100% da Altura Restante) */}
      <div ref={containerRef} className="relative flex-1 w-full bg-[#090f1a] overflow-hidden">
        {/* MODO 1: Navegador Web Interativo (Rola a página, clica e seleciona texto direto para as Notas!) */}
        {sourceMode === 'web' && (
          <iframe
            key={iframeKey}
            src={activeProxyUrl}
            className="w-full h-full border-0 bg-white"
            title="Navegador de Estudo Krono"
          />
        )}

        {/* MODO 2: Leitor Interativo de Questões / Lei Seca (Grifo de texto real <mark> + Seleção para Notas) */}
        {sourceMode === 'reader' && (
          <div className="w-full h-full flex flex-col bg-white dark:bg-[#0b1320] overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-2.5 bg-slate-100 dark:bg-[#131f33] border-b border-slate-200 dark:border-[#1f304a]">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                💡 Cole abaixo qualquer texto, questão ou lei seca. Selecione qualquer trecho com o mouse e clique em <strong>Grifar Texto</strong> ou <strong>Enviar Seleção para as Notas</strong>!
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleHighlightReaderSelection('#fde047')}
                  className="px-2.5 py-1 rounded-lg bg-yellow-300 text-slate-950 text-xs font-bold"
                >
                  🖍️ Grifar Amarelo
                </button>
                <button
                  type="button"
                  onClick={() => handleHighlightReaderSelection('#86efac')}
                  className="px-2.5 py-1 rounded-lg bg-emerald-300 text-slate-950 text-xs font-bold"
                >
                  🖍️ Grifar Verde
                </button>
                <button
                  type="button"
                  onClick={() => handleHighlightReaderSelection('#f9a8d4')}
                  className="px-2.5 py-1 rounded-lg bg-pink-300 text-slate-950 text-xs font-bold"
                >
                  🖍️ Grifar Rosa
                </button>
                <button
                  type="button"
                  onClick={handleSendReaderSelectionToNotes}
                  className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold shadow-sm"
                >
                  📌 Enviar Texto Selecionado para as Notas
                </button>
              </div>
            </div>

            <div
              ref={readerContainerRef}
              contentEditable
              suppressContentEditableWarning
              onMouseUp={() => {
                const sel = window.getSelection();
                const txt = sel ? sel.toString().trim() : '';
                if (txt) setSelectedReaderText(txt);
              }}
              onInput={(e) => setReaderHtml((e.target as HTMLDivElement).innerHTML)}
              className="flex-1 w-full p-8 overflow-y-auto text-slate-800 dark:text-slate-100 text-sm sm:text-base leading-relaxed focus:outline-none max-w-5xl mx-auto"
              style={{ minHeight: '100%' }}
              dangerouslySetInnerHTML={
                readerHtml
                  ? undefined
                  : {
                      __html: `<p style="color:#64748b;">Cole aqui (<kbd>Ctrl+V</kbd>) o enunciado da questão, comentários de professores ou artigos de lei seca para ler em tela cheia, grifar com marca-texto real e enviar trechos selecionados direto para as suas Notas de <strong>${topicName}</strong>...</p>`,
                    }
              }
            />
          </div>
        )}

        {/* MODO 3: Espelhamento de Aba ou Print Colado */}
        {sourceMode === 'mirror' && (
          <div className="w-full h-full relative flex items-center justify-center bg-[#050911]">
            <video
              ref={videoRef}
              className={`w-full h-full object-contain ${isMirroring ? 'block' : 'hidden'}`}
              playsInline
              muted
            />
            {!isMirroring && pastedBgImage && (
              <img
                id="studio-pasted-bg"
                src={pastedBgImage}
                alt="Print colado"
                className="w-full h-full object-contain select-none pointer-events-none"
              />
            )}
            {!isMirroring && !pastedBgImage && (
              <div className="max-w-lg text-center p-6 space-y-4">
                <MonitorPlay size={42} className="text-indigo-400 mx-auto" />
                <h3 className="text-base font-bold text-white">
                  Espelhar Aba Externa ou Colar Print (<kbd>Ctrl+V</kbd>)
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Para sites abertos em outra aba com sessão privada, clique abaixo para espelhar em tela cheia ou dê <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200">Ctrl+V</kbd> em qualquer print para grifar com o Marca-Texto Reto e recortar para as Notas.
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleStartMirroring}
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                  >
                    🖥️ Escolher Aba para Espelhar
                  </button>
                  {notebookUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        window.open(
                          notebookUrl.startsWith('http') ? notebookUrl : `https://${notebookUrl}`,
                          '_blank'
                        )
                      }
                      className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
                    >
                      🔗 Abrir Caderno em Nova Aba
                    </button>
                  )}
                </div>
              </div>
            )}
            {isMirroring && (
              <button
                type="button"
                onClick={stopMirroring}
                className="absolute top-3 right-3 z-30 px-3 py-1.5 rounded-xl bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg"
              >
                <StopCircle size={14} /> Parar Espelhamento
              </button>
            )}
          </div>
        )}

        {/* Camada Transparente de Marca-Texto Reto / Caneta / Recorte
            IMPORTANTE: Quando tool === 'interact', pointer-events-none permite rolar a página e selecionar texto normalmente! */}
        <canvas
          ref={drawCanvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ mixBlendMode: sourceMode === 'web' || sourceMode === 'reader' ? 'multiply' : 'normal' }}
          className={`absolute inset-0 z-20 ${
            tool === 'interact'
              ? 'pointer-events-none'
              : tool === 'crop'
              ? 'cursor-crosshair'
              : 'cursor-crosshair'
          }`}
        />

        {/* Retângulo visual de Recorte (Crop) */}
        {tool === 'crop' && cropStart && cropEnd && (
          <div
            className="absolute z-30 border-2 border-dashed border-amber-400 bg-amber-400/15 pointer-events-none"
            style={{
              left: Math.min(cropStart.x, cropEnd.x),
              top: Math.min(cropStart.y, cropEnd.y),
              width: Math.abs(cropEnd.x - cropStart.x),
              height: Math.abs(cropEnd.y - cropStart.y),
            }}
          />
        )}
      </div>

      {/* Barra Inferior Rápida para Enviar Comentários/Trechos para as Notas */}
      <div className="px-4 py-2 bg-[#0f172a] border-t border-slate-800 flex flex-col sm:flex-row items-center gap-2 shrink-0">
        <select
          value={quickSnippetTag}
          onChange={(e) => setQuickSnippetTag(e.target.value as any)}
          className="px-2.5 py-1.5 rounded-xl bg-[#090e1a] border border-slate-700 text-xs font-bold text-emerald-400"
        >
          <option value="Bizu / Comentário">💡 Bizu / Comentário</option>
          <option value="Questão / Jurisprudência">⚖️ Questão / Jurisprudência</option>
          <option value="Lei Seca Grifada">📜 Lei Seca Grifada</option>
          <option value="Pegadinha de Banca">🚨 Pegadinha de Banca</option>
        </select>

        <input
          type="text"
          value={quickSnippetText}
          onChange={(e) => setQuickSnippetText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendTextSnippetToNotes();
            }
          }}
          placeholder={`Digite uma anotação rápida ou selecione qualquer texto na página acima para enviar direto para as Notas de "${topicName}"...`}
          className="flex-1 w-full px-3 py-1.5 rounded-xl bg-[#090e1a] border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
        />

        <button
          type="button"
          onClick={handleSendTextSnippetToNotes}
          className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 shrink-0"
        >
          <Send size={12} />
          Enviar p/ Notas
        </button>
      </div>
    </div>
  );
}
