import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DEFAULT_MODEL = 'gemini-2.0-flash';
const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
// Batas per request agar prompt tidak melebihi konteks model
const MAX_CHARS_PER_REQUEST = 6000;
const MAX_ITEMS_PER_REQUEST = 60;
// Isi tag ini tidak boleh diterjemahkan (kode/stylesheet/script)
const SKIP_TAGS = ['code', 'pre', 'style', 'script', 'svg'];
// Minimal mengandung huruf (Latin, Latin extended, Cyrillic, Arabic, kana, CJK)
const HAS_LETTER = /[\p{L}]/u;
const HTML_ENTITY = /^&[a-zA-Z0-9#]+;$/;

type Segment = { index: number; lead: string; core: string; trail: string };

/**
 * Terjemahan memakai Google Gemini API.
 * Env: GEMINI_API_KEY (wajib), GEMINI_MODEL (opsional), GEMINI_BASE_URL (opsional).
 *
 * HTML tidak dikirim mentah: hanya text node yang diekstrak lalu diterjemahkan,
 * sehingga tag, atribut, dan struktur HTML tidak berubah.
 */
@Injectable()
export class TranslateService {
  private readonly logger = new Logger(TranslateService.name);

  constructor(private config: ConfigService) {}

  async translateText(text: string, target: string, source?: string): Promise<string> {
    if (!text.trim()) return text;
    const prompt = [
      `Terjemahkan teks berikut ke bahasa ${target}.`,
      source ? `Bahasa sumber: ${source}.` : 'Deteksi sendiri bahasa sumbernya.',
      'Pertahankan makna, nada, tanda baca, baris baru, angka, nama produk, dan istilah teknis.',
      'Balas HANYA hasil terjemahan, tanpa penjelasan dan tanpa tanda kutip pembungkus.',
      '',
      text,
    ].join('\n');
    return (await this.generate(prompt)).trim();
  }

  async translateHtml(html: string, target: string, source?: string): Promise<string> {
    if (!html.trim()) return html;
    const { parts, segments } = this.splitHtml(html);
    if (!segments.length) return html;

    const translated = await this.translateSegments(
      segments.map((s) => s.core),
      target,
      source,
    );
    segments.forEach((s, i) => {
      parts[s.index] = `${s.lead}${translated[i] ?? s.core}${s.trail}`;
    });
    return parts.join('');
  }

  // ============ ekstraksi text node HTML ============
  private splitHtml(html: string) {
    const parts = html.split(/(<[^>]*>)/);
    const segments: Segment[] = [];
    let skipDepth = 0;

    parts.forEach((part, index) => {
      if (part.startsWith('<')) {
        const match = /^<\s*(\/?)\s*([a-zA-Z0-9:-]+)/.exec(part);
        const tag = match?.[2]?.toLowerCase();
        if (tag && SKIP_TAGS.includes(tag)) {
          const closing = match?.[1] === '/';
          skipDepth = Math.max(0, skipDepth + (closing ? -1 : 1));
        }
        return;
      }
      if (skipDepth > 0) return;
      if (!HAS_LETTER.test(part) || HTML_ENTITY.test(part.trim())) return;

      const lead = /^\s*/.exec(part)?.[0] ?? '';
      const trail = /\s*$/.exec(part)?.[0] ?? '';
      const core = part.slice(lead.length, part.length - trail.length);
      if (!core || !HAS_LETTER.test(core)) return;
      segments.push({ index, lead, core, trail });
    });

    return { parts, segments };
  }

  // ============ batch terjemahan + fallback ============
  private async translateSegments(cores: string[], target: string, source?: string): Promise<string[]> {
    const out: string[] = [];
    let batch: { idx: number; text: string }[] = [];
    let chars = 0;

    const flush = async () => {
      if (!batch.length) return;
      const translated = await this.translateJsonArray(batch.map((b) => b.text), target, source);
      translated.forEach((t, i) => (out[batch[i].idx] = t));
      batch = [];
      chars = 0;
    };

    for (let i = 0; i < cores.length; i++) {
      const text = cores[i];
      if (batch.length >= MAX_ITEMS_PER_REQUEST || chars + text.length > MAX_CHARS_PER_REQUEST) {
        await flush();
      }
      batch.push({ idx: i, text });
      chars += text.length;
    }
    await flush();
    return out;
  }

  private async translateJsonArray(items: string[], target: string, source?: string): Promise<string[]> {
    const prompt = [
      `Terjemahkan setiap item pada array JSON berikut ke bahasa ${target}.`,
      source ? `Bahasa sumber: ${source}.` : 'Deteksi bahasa sumber tiap item.',
      'Aturan: balas HANYA array JSON berisi string, jumlah item sama, urutan sama.',
      'Jangan menerjemahkan kode, URL, alamat email, nama variabel, atau entitas HTML (&...;).',
      'Pertahankan spasi/tanda baca di awal dan akhir item.',
      '',
      JSON.stringify(items),
    ].join('\n');

    const raw = await this.generate(prompt);
    const parsed = this.parseJsonArray(raw);
    if (parsed && parsed.length === items.length) {
      return parsed.map((v) => (typeof v === 'string' ? v : String(v ?? '')));
    }

    this.logger.warn('Jumlah item hasil terjemahan tidak cocok, fallback ke per-item');
    const out: string[] = [];
    for (const item of items) out.push(await this.translateText(item, target, source));
    return out;
  }

  private parseJsonArray(raw: string): unknown[] | null {
    const cleaned = raw.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim();
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start < 0 || end <= start) return null;
    try {
      const value = JSON.parse(cleaned.slice(start, end + 1));
      return Array.isArray(value) ? value : null;
    } catch {
      return null;
    }
  }

  // ============ panggilan Gemini ============
  private async generate(prompt: string): Promise<string> {
    const apiKey = (this.config.get<string>('GEMINI_API_KEY') || '').trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'GEMINI_API_KEY belum dikonfigurasi di .env backend',
      );
    }
    const model = (this.config.get<string>('GEMINI_MODEL') || DEFAULT_MODEL).trim();
    const baseUrl = (this.config.get<string>('GEMINI_BASE_URL') || DEFAULT_BASE_URL).replace(/\/+$/, '');
    const url = `${baseUrl}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, topP: 0.95, maxOutputTokens: 8192 },
        }),
      });
    } catch (e) {
      this.logger.error(`Gagal menghubungi Gemini: ${(e as Error).message}`);
      throw new BadGatewayException('Gagal menghubungi layanan terjemahan');
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      this.logger.error(`Gemini ${res.status}: ${detail.slice(0, 500)}`);
      throw new BadGatewayException(`Layanan terjemahan gagal (${res.status})`);
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? '')
      .join('')
      .trim();
    if (!text) throw new BadGatewayException('Layanan terjemahan mengembalikan hasil kosong');
    return text;
  }
}
