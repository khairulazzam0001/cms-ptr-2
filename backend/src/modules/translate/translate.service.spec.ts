import { ConfigService } from '@nestjs/config';
import { TranslateService } from './translate.service';

function makeService() {
  return new TranslateService(new ConfigService());
}

describe('TranslateService', () => {
  it('menerjemahkan text node HTML tanpa mengubah tag dan melewati style/script/code', async () => {
    const svc = makeService();
    const generate = jest
      .spyOn(svc as unknown as { generate: (p: string) => Promise<string> }, 'generate')
      .mockImplementation(async (prompt: string) => {
        const start = prompt.lastIndexOf('\n[');
        const items = JSON.parse(prompt.slice(start + 1)) as string[];
        return JSON.stringify(items.map((t) => `EN ${t}`));
      });

    const html =
      '<p>Halo <b>dunia</b></p><style>.judul { color: red; }</style>' +
      '<pre>const x = 1;</pre><script>alert("hi")</script>';

    const out = await svc.translateHtml(html, 'English');

    expect(out).toContain('<p>EN Halo <b>EN dunia</b></p>');
    // tag/isi yang dilewati tidak berubah
    expect(out).toContain('<style>.judul { color: red; }</style>');
    expect(out).toContain('<pre>const x = 1;</pre>');
    expect(out).toContain('<script>alert("hi")</script>');
    // hanya 2 text node yang dikirim
    expect(JSON.parse(generate.mock.calls[0][0].slice(generate.mock.calls[0][0].lastIndexOf('\n[') + 1))).toHaveLength(2);
  });

  it('mempertahankan spasi di awal/akhir text node', async () => {
    const svc = makeService();
    jest
      .spyOn(svc as unknown as { generate: (p: string) => Promise<string> }, 'generate')
      .mockImplementation(async (prompt: string) => {
        const start = prompt.lastIndexOf('\n[');
        const items = JSON.parse(prompt.slice(start + 1)) as string[];
        return JSON.stringify(items.map((t) => `EN ${t}`));
      });

    const out = await svc.translateHtml('<p> Halo  dunia </p>', 'English');
    expect(out).toBe('<p> EN Halo  dunia </p>');
  });

  it('menerjemahkan teks biasa dan memangkas spasi hasil', async () => {
    const svc = makeService();
    jest
      .spyOn(svc as unknown as { generate: (p: string) => Promise<string> }, 'generate')
      .mockResolvedValue('  Hello world  ');

    await expect(svc.translateText('Halo dunia', 'English')).resolves.toBe('Hello world');
  });

  it('mengembalikan html apa adanya bila tidak ada teks', async () => {
    const svc = makeService();
    const spy = jest.spyOn(svc as unknown as { generate: (p: string) => Promise<string> }, 'generate');
    await expect(svc.translateHtml('<div><br/></div>', 'English')).resolves.toBe('<div><br/></div>');
    expect(spy).not.toHaveBeenCalled();
  });

  it('gagal jelas bila GEMINI_API_KEY kosong', async () => {
    const svc = makeService();
    await expect(svc.translateText('Halo', 'English')).rejects.toThrow(/GEMINI_API_KEY/);
  });
});
