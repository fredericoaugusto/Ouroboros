/**
 * Utilitário para parsear e importar editais verticalizados a partir de texto gerado por IA ou JSON.
 */

export interface ParsedTopic {
  topic_text: string;
  is_completed?: boolean;
  userWeight?: number;
  relevance?: number;
  difficulty?: number;
  perceivedMastery?: number;
  sub_topics?: ParsedTopic[];
}

export interface ParsedSubject {
  id: string;
  subject: string;
  color: string;
  topics: ParsedTopic[];
}

const PALETTE_COLORS = [
  '#10B981', // Emerald
  '#6366F1', // Indigo
  '#06B6D4', // Cyan
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#3B82F6', // Blue
  '#14B8A6', // Teal
  '#F43F5E', // Rose
  '#84CC16', // Lime
];

/**
 * Retorna o prompt padrão pronto para o usuário copiar e colar na sua IA favorita (ChatGPT, Claude, Gemini, etc.)
 */
export function getStandardAIPrompt(): string {
  return `Você é um assistente especialista em organização de estudos para concursos públicos e vestibulares.
Receba o texto ou anexo de um edital / conteúdo programático e estruture-o rigorosamente no formato abaixo, identificando cada disciplina, seus tópicos principais e seus subtópicos (e sub-subtópicos se houver).

Regras obrigatórias:
1. Cada disciplina deve começar com "# NOME DA DISCIPLINA".
2. Cada tópico deve iniciar com um hífen ou numeração: "- 1. Nome do tópico".
3. Subtópicos devem ter indentação de 2 espaços: "  - 1.1 Nome do subtópico".
4. Sub-subtópicos devem ter indentação de 4 espaços: "    - 1.1.1 Nome do sub-subtópico".
5. Não adicione comentários, introduções ou explicações fora da estrutura. Apenas o conteúdo formatado.

Exemplo do formato desejado:

# DIREITO ADMINISTRATIVO
- 1. Estado, governo e administração pública
  - 1.1 Conceito, elementos, poderes e organização
  - 1.2 Natureza, fins e princípios
- 2. Atos administrativos
  - 2.1 Conceitos, requisitos e atributos
  - 2.2 Anulação, revogação e convalidação

# DIREITO CONSTITUCIONAL
- 1. Direitos e garantias fundamentais
  - 1.1 Direitos e deveres individuais e coletivos
  - 1.2 Direitos sociais
- 2. Organização do Estado
  - 2.1 União, Estados, DF e Municípios

Aqui está o conteúdo do meu edital para você formatar:
[COLE O CONTEÚDO DO EDITAL AQUI]`;
}

/**
 * Faz o parse de texto em disciplinas e árvore hierárquica de tópicos.
 */
export function parseEditalText(rawText: string): ParsedSubject[] {
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  // 1. Tentar parsear como JSON direto caso a IA tenha retornado JSON
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsedJson = JSON.parse(trimmed);
      const list = Array.isArray(parsedJson) ? parsedJson : [parsedJson];
      return list.map((item, idx) => ({
        id: `subject-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
        subject: item.subject || item.name || `Disciplina ${idx + 1}`,
        color: item.color || PALETTE_COLORS[idx % PALETTE_COLORS.length],
        topics: normalizeTopics(item.topics || []),
      }));
    } catch {
      // Se falhar o parse JSON, segue para o parser de texto linha a linha
    }
  }

  // 2. Parser de Texto Linha por Linha
  const lines = trimmed.split('\n');
  const subjects: ParsedSubject[] = [];
  let currentSubject: ParsedSubject | null = null;

  interface StackItem {
    indent: number;
    topic: ParsedTopic;
  }
  let topicStack: StackItem[] = [];

  function getIndentLevel(line: string): number {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
  }

  function cleanTopicText(text: string): string {
    return text
      .trim()
      .replace(/^[-*•]\s*/, '') // Remove bullets
      .trim();
  }

  for (let rawLine of lines) {
    const line = rawLine.replace(/\r$/, '');
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Detectar Cabeçalho de Disciplina: # NOME ou DISCIPLINA: ...
    if (trimmedLine.startsWith('#') || trimmedLine.toUpperCase().startsWith('DISCIPLINA:')) {
      const subjectName = trimmedLine
        .replace(/^#+\s*/, '')
        .replace(/^DISCIPLINA:\s*/i, '')
        .trim();

      if (subjectName) {
        currentSubject = {
          id: `subject-${Date.now()}-${subjects.length}-${Math.random().toString(36).substring(2, 7)}`,
          subject: subjectName,
          color: PALETTE_COLORS[subjects.length % PALETTE_COLORS.length],
          topics: [],
        };
        subjects.push(currentSubject);
        topicStack = [];
        continue;
      }
    }

    // Se ainda não tiver disciplina criada, cria uma genérica
    if (!currentSubject) {
      currentSubject = {
        id: `subject-${Date.now()}-0-${Math.random().toString(36).substring(2, 7)}`,
        subject: 'Conteúdo do Edital',
        color: PALETTE_COLORS[0],
        topics: [],
      };
      subjects.push(currentSubject);
    }

    const indent = getIndentLevel(line);
    const topicText = cleanTopicText(trimmedLine);
    if (!topicText) continue;

    const newTopic: ParsedTopic = {
      topic_text: topicText,
      is_completed: false,
      relevance: 3,
      difficulty: 3,
      perceivedMastery: 3,
      sub_topics: [],
    };

    if (topicStack.length === 0 || indent === 0) {
      currentSubject.topics.push(newTopic);
      topicStack = [{ indent, topic: newTopic }];
    } else {
      // Procura na pilha o pai com indentação menor
      while (topicStack.length > 0 && topicStack[topicStack.length - 1].indent >= indent) {
        topicStack.pop();
      }

      if (topicStack.length > 0) {
        const parent = topicStack[topicStack.length - 1].topic;
        if (!parent.sub_topics) parent.sub_topics = [];
        parent.sub_topics.push(newTopic);
      } else {
        currentSubject.topics.push(newTopic);
      }

      topicStack.push({ indent, topic: newTopic });
    }
  }

  return subjects;
}

function normalizeTopics(topics: any[]): ParsedTopic[] {
  return topics.map(t => ({
    topic_text: typeof t === 'string' ? t : t.topic_text || t.name || 'Tópico',
    is_completed: Boolean(t.is_completed),
    relevance: t.relevance ?? 3,
    difficulty: t.difficulty ?? 3,
    perceivedMastery: t.perceivedMastery ?? 3,
    sub_topics: t.sub_topics ? normalizeTopics(t.sub_topics) : [],
  }));
}
