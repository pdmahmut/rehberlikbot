// pdfjs-dist Node tarafında çalışırken tarayıcıya ait bazı global sınıfları arar.
// Node'da bunlar bulunmadığı için "DOMMatrix is not defined" hatası oluşuyordu.
//
// Geliştirme sunucusunda hata çıkmıyordu çünkü Next dev derlemesi bu kod yolunu
// farklı çözümlüyor; hata yalnızca üretim derlemesinde ortaya çıktı.
//
// Metin çıkarma için grafik yeteneklerine ihtiyaç yok; bu yüzden tam bir tarayıcı
// uygulaması yerine pdfjs'in beklediği asgari arayüz sağlanıyor.

interface MatrixInit {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

class NodeDOMMatrix implements MatrixInit {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;

  constructor(init?: number[] | string) {
    if (Array.isArray(init) && init.length >= 6) {
      [this.a, this.b, this.c, this.d, this.e, this.f] = init;
    }
  }

  /** this × other (pdfjs dönüşüm zincirlerinde kullanır). */
  multiply(other: MatrixInit): NodeDOMMatrix {
    return new NodeDOMMatrix([
      this.a * other.a + this.c * other.b,
      this.b * other.a + this.d * other.b,
      this.a * other.c + this.c * other.d,
      this.b * other.c + this.d * other.d,
      this.a * other.e + this.c * other.f + this.e,
      this.b * other.e + this.d * other.f + this.f,
    ]);
  }

  translate(tx = 0, ty = 0): NodeDOMMatrix {
    return this.multiply({ a: 1, b: 0, c: 0, d: 1, e: tx, f: ty });
  }

  scale(sx = 1, sy = sx): NodeDOMMatrix {
    return this.multiply({ a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 });
  }

  get isIdentity(): boolean {
    return (
      this.a === 1 && this.b === 0 && this.c === 0 &&
      this.d === 1 && this.e === 0 && this.f === 0
    );
  }

  toString(): string {
    return `matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})`;
  }
}

class NodePath2D {
  addPath(): void {}
  moveTo(): void {}
  lineTo(): void {}
  bezierCurveTo(): void {}
  quadraticCurveTo(): void {}
  closePath(): void {}
  rect(): void {}
  arc(): void {}
}

class NodeImageData {
  width: number;
  height: number;
  data: Uint8ClampedArray;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
  }
}

/**
 * pdfjs import edilmeden ÖNCE çağrılmalı.
 * Var olan tanımların üzerine yazmaz.
 */
export function installPdfNodePolyfills(): void {
  const g = globalThis as Record<string, unknown>;

  if (typeof g.DOMMatrix === "undefined") g.DOMMatrix = NodeDOMMatrix;
  if (typeof g.Path2D === "undefined") g.Path2D = NodePath2D;
  if (typeof g.ImageData === "undefined") g.ImageData = NodeImageData;
}
